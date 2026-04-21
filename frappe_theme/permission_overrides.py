from __future__ import annotations

import frappe
from frappe import _
from frappe.core.doctype.server_script.server_script_utils import get_server_script_map


def patch_db_query_permissions_operator() -> None:
	"""Patch DatabaseQuery to merge user permissions and permission_query_conditions with OR."""
	from frappe.model.db_query import (
		DatabaseQuery,
		has_any_user_permission_for_doctype,
		requires_owner_constraint,
	)

	if getattr(DatabaseQuery, "_frappe_theme_or_patch_applied", False):
		return

	def get_permission_query_conditions(self) -> str:
		and_conditions = []
		or_conditions = []
		has_or_connector = False
		hooks = frappe.get_hooks("permission_query_conditions", {})
		condition_methods = hooks.get(self.doctype, []) + hooks.get("*", [])
		# Collect hook-based conditions (default AND)
		for method in condition_methods:
			if c := frappe.call(frappe.get_attr(method), self.user, doctype=self.doctype):
				and_conditions.append(f"({c})")

		# Handle server script
		if permission_script_name := get_server_script_map().get("permission_query", {}).get(self.doctype):
			script = frappe.get_doc("Server Script", permission_script_name)
			condition = script.get_permission_query_conditions(self.user)
			if condition:
				condition = f"({condition})"

				if script.custom_apply_as_or:
					or_conditions.append(condition)
					has_or_connector = True
				else:
					and_conditions.append(condition)

		# Build final query
		final_query = ""

		if and_conditions:
			final_query = " AND ".join(and_conditions)

		if or_conditions:
			or_block = " OR ".join(or_conditions)

			if final_query:
				final_query = f"({final_query}) OR ({or_block})"
			else:
				final_query = or_block

		return final_query, has_or_connector

	def build_match_conditions(self, as_condition=True) -> str | list:
		"""add match conditions if applicable"""
		self.match_filters = []
		self.match_conditions = []
		only_if_shared = False
		if not self.user:
			self.user = frappe.session.user

		if not self.tables:
			self.extract_tables()

		role_permissions = frappe.permissions.get_role_permissions(self.doctype_meta, user=self.user)
		if (
			not self.doctype_meta.istable
			and not (role_permissions.get("select") or role_permissions.get("read"))
			and not self.flags.ignore_permissions
			and not has_any_user_permission_for_doctype(self.doctype, self.user, self.reference_doctype)
		):
			only_if_shared = True
			self.shared = frappe.share.get_shared(self.doctype, self.user)
			if not self.shared:
				frappe.throw(_("No permission to read {0}").format(_(self.doctype)), frappe.PermissionError)
			else:
				self.conditions.append(self.get_share_condition())

		else:
			# skip user perm check if owner constraint is required
			if requires_owner_constraint(role_permissions):
				self._fetch_shared_documents = True
				self.match_conditions.append(
					f"`tab{self.doctype}`.`owner` = {frappe.db.escape(self.user, percent=False)}"
				)

			# add user permission only if role has read perm
			elif role_permissions.get("read") or role_permissions.get("select"):
				# get user permissions
				user_permissions = frappe.permissions.get_user_permissions(self.user)
				self.add_user_permissions(user_permissions)

			# Only when full read access is not present fetch shared docuemnts.
			# This is done to avoid extra query.
			# Only following cases can require explicit addition of shared documents.
			#    1. DocType has if_owner constraint and hence can't see shared documents
			#    2. DocType has user permissions and hence can't see shared documents
			if self._fetch_shared_documents:
				self.shared = frappe.share.get_shared(self.doctype, self.user)

		if as_condition:
			conditions = ""
			if self.match_conditions:
				# will turn out like ((blog_post in (..) and blogger in (...)) or (blog_category in (...)))
				conditions = "((" + ") or (".join(self.match_conditions) + "))"

			doctype_conditions, has_or_connector = self.get_permission_query_conditions()
			if doctype_conditions:
				conditions += (
					(" or " if has_or_connector else " and ") + doctype_conditions
					if conditions
					else doctype_conditions
				)

			# share is an OR condition, if there is a role permission
			if not only_if_shared and self.shared and conditions:
				conditions = f"(({conditions}) or ({self.get_share_condition()}))"
			return conditions

		else:
			return self.match_filters

	DatabaseQuery.get_permission_query_conditions = get_permission_query_conditions
	DatabaseQuery.build_match_conditions = build_match_conditions
	DatabaseQuery._frappe_theme_or_patch_applied = True
