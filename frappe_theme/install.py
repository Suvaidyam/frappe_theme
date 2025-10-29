import os

import frappe
from frappe.installer import update_site_config as _update_site_config


def after_install():
	check_esbuild_dependencies()


def check_esbuild_dependencies():
	"""
	Frappe Theme depends on esbuild with es2020 target to build frontend assets.
	This function checks that configuration is present in common_site_config.json if not present adds it.
	"""
	common_site_config = frappe.get_common_site_config(cached=False)
	esbuild_config = common_site_config.get("esbuild_target")

	if not esbuild_config:
		try:
			sites_path = getattr(frappe.local, "sites_path", None)
			if not sites_path:
				sites_path = os.path.dirname(frappe.get_site_path())

			common_conf_path = os.path.join(sites_path, "common_site_config.json")
			_update_site_config("esbuild_target", "es2020", validate=False, site_config_path=common_conf_path)
		except Exception:
			try:
				_update_site_config("esbuild_target", "es2020", validate=False)
			except Exception:
				frappe.log_error(
					title="Frappe Theme: Failed to set esbuild_target",
					message=frappe.get_traceback(),
				)
