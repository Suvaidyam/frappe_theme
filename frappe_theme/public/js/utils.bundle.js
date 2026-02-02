export const add_custom_approval_assignments_fields = async (d) => {
	const customFields = [];
	let is_comment_required = d?.custom_comment || d?.is_comment_required;
	if (is_comment_required) {
		customFields.push({
			label: "Comment",
			fieldname: "wf_comment",
			fieldtype: "Small Text",
			reqd: is_comment_required ? 1 : 0,
		});
	}
	if (d?.custom_allow_assignment) {
		let approval_assignment_fields = await frappe.xcall(
			"frappe_theme.dt_api.get_meta_fields",
			{
				doctype: "Approval Assignment Child",
				_type: "Direct",
			}
		);
		approval_assignment_fields?.forEach((f) => {
			if (f?.fieldname === "user") {
				f.get_query = function (row) {
					let ex_role_profiles = JSON.parse(d?.custom_selected_role_profile || "[]");
					ex_role_profiles = ex_role_profiles?.map(
						(role_profile) => role_profile?.role_profile
					);
					let filters = {
						status: "Active",
					};
					if (row && row?.role_profile) {
						filters["role_profile"] = ["=", row.role_profile];
					} else if (ex_role_profiles?.length) {
						filters["role_profile"] = ["in", ex_role_profiles];
					}
					return {
						filters: filters,
					};
				};
				return f;
			} else if (f?.fieldname === "role_profile") {
				let role_profiles = JSON.parse(d?.custom_selected_role_profile || "[]");
				role_profiles = role_profiles?.map((role_profile) => role_profile?.role_profile);
				if (role_profiles?.length) {
					f.get_query = function () {
						return {
							filters: {
								role_profile: ["in", role_profiles],
							},
						};
					};
				}
				return f;
			} else {
				return f;
			}
		});
		customFields.push({
			label: "Approval Assignments",
			fieldname: "approval_assignments",
			fieldtype: "Table",
			options: "Approval Assignment Child",
			fields: approval_assignment_fields,
			reqd: d?.custom_allow_assignment ? 1 : 0,
		});
	}
	return customFields;
};

export const get_parent_section_field_by_fieldname = (frm, fieldname) => {
	let section_field = null;
	for (let field of frm.meta?.fields) {
		if (field?.fieldtype === "Section Break") {
			section_field = field;
			continue;
		}
		if (field?.fieldname === fieldname) {
			return section_field;
		}
	}
	return null;
};

frappe.utils.get_parent_section_field_by_fieldname = get_parent_section_field_by_fieldname;
