from __future__ import annotations

import frappe
from frappe import _
from frappe.core.doctype.server_script.server_script_utils import get_server_script_map


def doc_has_permission_via_query_conditions(doc, user=None, ptype=None, **kwargs):
	"""Allow read/select when doc matches permission_query_conditions with OR connector."""
	if ptype and ptype not in ("read", "select"):
		return None

	user = user or frappe.session.user
	if user == "Administrator":
		return True

	if not doc or not getattr(doc, "doctype", None) or not getattr(doc, "name", None):
		return None

	from frappe.model.db_query import DatabaseQuery

	doctype = doc.doctype
	dq = DatabaseQuery(doctype, user=user)
	condition_result = dq.get_permission_query_conditions()
	if isinstance(condition_result, tuple):
		doctype_conditions, has_or_connector = condition_result
	else:
		doctype_conditions, has_or_connector = condition_result, False

	# keep default behavior unless this doctype explicitly requested OR behavior
	if not doctype_conditions or not has_or_connector:
		return None

	match = frappe.db.sql(
		f"""select name from `tab{doctype}`
			where name=%s and ({doctype_conditions})
			limit 1""",
		(doc.name,),
	)
	return True if match else None


def patch_db_query_permissions_operator() -> None:
	"""Patch DatabaseQuery to merge user permissions and permission_query_conditions with OR."""
	import frappe.permissions as permissions_mod
	from frappe.model.db_query import (
		DatabaseQuery,
		cast_name,
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
				else:
					and_conditions.append(condition)

		# Build final query
		final_query = ""

		if and_conditions:
			final_query = " AND ".join(and_conditions)

		if or_conditions:
			or_block = " OR ".join(or_conditions)
			has_or_connector = True
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

	def add_linked_doctype_query_conditions(self):
		"""Apply link-field filters from linked doctypes that use OR query conditions."""
		apply_strict_user_permissions = (
			False
			if self.doctype_meta.issingle
			else frappe.get_system_settings("apply_strict_user_permissions")
		)
		linked_match_conditions = []

		for df in self.doctype_meta.get_link_fields():
			if df.get("ignore_user_permissions"):
				continue

			linked_doctype = df.get("options")
			if not linked_doctype or linked_doctype == "[Select]":
				continue

			linked_dq = DatabaseQuery(linked_doctype, user=self.user)
			result = linked_dq.get_permission_query_conditions()
			if isinstance(result, tuple):
				linked_conditions, has_or_connector = result
			else:
				linked_conditions, has_or_connector = result, False

			if not linked_conditions or not has_or_connector:
				continue

			link_column = cast_name(f"`tab{self.doctype}`.`{df.get('fieldname')}`")
			subquery = f"{link_column} in (select name from `tab{linked_doctype}` where {linked_conditions})"

			if apply_strict_user_permissions:
				condition = subquery
			else:
				empty_value_condition = cast_name(
					f"ifnull(`tab{self.doctype}`.`{df.get('fieldname')}`, '')=''"
				)
				condition = f"{empty_value_condition} or {subquery}"

			linked_match_conditions.append(f"({condition})")

		if linked_match_conditions:
			self._fetch_shared_documents = True
			self.match_conditions.append(" and ".join(linked_match_conditions))

	original_add_user_permissions = DatabaseQuery.add_user_permissions

	def add_user_permissions_with_linked_query(self, user_permissions):
		original_add_user_permissions(self, user_permissions)
		add_linked_doctype_query_conditions(self)

	original_has_user_permission = permissions_mod.has_user_permission

	def has_user_permission_with_query_cond(doc, user=None, debug=False, ptype=None):
		allowed = original_has_user_permission(doc, user=user, debug=debug, ptype=ptype)
		if allowed:
			return True

		if not doc or not getattr(doc, "doctype", None) or not getattr(doc, "name", None):
			return False

		if ptype and ptype not in ("read", "select"):
			return False

		check_user = user or frappe.session.user
		if check_user == "Administrator":
			return True

		dq = DatabaseQuery(doc.doctype, user=check_user)
		condition_result = dq.get_permission_query_conditions()
		if isinstance(condition_result, tuple):
			doctype_conditions, has_or_connector = condition_result
		else:
			doctype_conditions, has_or_connector = condition_result, False

		if not doctype_conditions or not has_or_connector:
			doctype_allowed = False
		else:
			match = frappe.db.sql(
				f"""select name from `tab{doc.doctype}`
                where name=%s and ({doctype_conditions})
                limit 1""",
				(doc.name,),
			)
			doctype_allowed = bool(match)

		if doctype_allowed:
			return True

		# linked doctype fallback: allow if all relevant link fields satisfy OR query conditions
		meta = frappe.get_meta(doc.doctype)
		matched_any_link = False
		for field in meta.get_link_fields():
			if field.ignore_user_permissions:
				continue

			linked_value = doc.get(field.fieldname)
			if not linked_value:
				continue

			linked_dq = DatabaseQuery(field.options, user=check_user)
			linked_result = linked_dq.get_permission_query_conditions()
			if isinstance(linked_result, tuple):
				linked_conditions, linked_has_or_connector = linked_result
			else:
				linked_conditions, linked_has_or_connector = linked_result, False

			if not linked_conditions or not linked_has_or_connector:
				continue

			matched_any_link = True
			linked_match = frappe.db.sql(
				f"""select name from `tab{field.options}`
                where name=%s and ({linked_conditions})
                limit 1""",
				(linked_value,),
			)
			if not linked_match:
				return False

		return matched_any_link

	DatabaseQuery.get_permission_query_conditions = get_permission_query_conditions
	DatabaseQuery.add_user_permissions = add_user_permissions_with_linked_query
	DatabaseQuery.build_match_conditions = build_match_conditions
	permissions_mod.has_user_permission = has_user_permission_with_query_cond
	DatabaseQuery._frappe_theme_or_patch_applied = True
