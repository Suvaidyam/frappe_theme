function apply_dt_filters(frm, dt, fieldname, filters) {
	if (!frm["dt_filters"]) {
		frm["dt_filters"] = {};
	}
	if (!frm["dt_filters"][dt]) {
		frm["dt_filters"][dt] = {};
	}
	frm["dt_filters"][dt][fieldname] = filters;
}
frappe.utils.apply_dt_filters = apply_dt_filters;
