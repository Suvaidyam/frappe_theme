import frappe

OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "in", "not in", "like", "not like", "between", "not between"]


class DTFilters:
    @staticmethod
    def validate_doctype_filters(doctype, docname, filters, base_doctype=None):
        if not doctype:
            return filters, []
        renderer_dt = frappe.get_meta(doctype, True)
        if renderer_dt.get("is_dashboard") != 1:
            return filters, []

        valid_filters = []
        invalid_filters = []
        if doctype is None or docname is None:
            return filters, []
        if doctype != docname:
            return filters, []
        else:
            if not filters:
                return valid_filters, invalid_filters

            if isinstance(filters, str):
                filters = frappe.parse_json(filters)
            fields = [f.as_dict() for f in renderer_dt.get("fields", [])]
            base_fields = [f.as_dict() for f in frappe.get_meta(base_doctype, True).get("fields", [])]
            if isinstance(filters, dict):
                valid_filters = {}
            if isinstance(filters, list):
                valid_filters = []
            invalid_filters = []
            filter_keys = []
            if isinstance(filters, dict):
                filter_keys = list(filters.keys())
            elif isinstance(filters, list):
                filter_keys = [f[1] for f in filters if len(f) >= 2]

            for key in filter_keys:
                filter_field = next((f.as_dict() for f in fields if f.get("fieldname") == key), None)
                if filter_field.fieldtype == "Link":
                    DTFilters.process_link_fields_as_filters(
                        base_fields, filter_field, base_doctype, filters, key, valid_filters, invalid_filters
                    )
                elif filter_field.fieldtype == "Table MultiSelect":
                    first_link_field = DTFilters.get_conf_for_multi_slect_link_field(
                        filter_field.get("options")
                    )
                    DTFilters.process_link_fields_as_filters(
                        base_fields,
                        first_link_field,
                        base_doctype,
                        filters,
                        key,
                        valid_filters,
                        invalid_filters,
                    )
                else:
                    invalid_filters.append(filter_field)
        return valid_filters, invalid_filters

    @staticmethod
    def validate_query_report_filters(doctype, docname, report_name, filters, is_script_report=False):
        try:
            if isinstance(filters, str):
                filters = frappe.parse_json(filters)
            standard_filters = {}
            aditional_filters = filters or {}
            invalid_filters = []

            if not doctype:
                return standard_filters, aditional_filters, invalid_filters
            renderer_dt = frappe.get_meta(doctype, True)
            if renderer_dt.get("is_dashboard") != 1:
                return standard_filters, aditional_filters, invalid_filters

            if doctype == docname:
                fields = renderer_dt.get("fields", [])
                try:
                    report = frappe.get_doc("Report", report_name)
                except frappe.DoesNotExistError:
                    return standard_filters, aditional_filters, invalid_filters
                
                report_columns = report.get("columns", []) or []
                report_filters = report.get("filters", []) or []

                filter_keys = []
                if isinstance(filters, dict):
                    filter_keys = list(filters.keys())
                elif isinstance(filters, list):
                    filter_keys = [f[1] if len(f) >= 2 else f[0] for f in filters if isinstance(f, (list, tuple)) and len(f) > 0]
                for key in filter_keys:
                    if not key:
                        continue
                    filter_field = next((f.as_dict() for f in fields if f.get("fieldname") == key), None)
                    print(f"""
                        \n\n\n\nreport: {report_name}
                        """)
                    applied = False
                    if filter_field:
                        if filter_field.get("fieldtype") == "Link":
                            applied = DTFilters.process_report_columns_link_fields_as_filters(
                                report_columns,
                                report_filters,
                                filter_field,
                                filters,
                                key,
                                standard_filters,
                                aditional_filters,
                            )
                            if applied:
                                continue
                        elif filter_field.get("fieldtype") == "Table MultiSelect":
                            first_link_field = DTFilters.get_conf_for_multi_slect_link_field(
                                filter_field.get("options")
                            )
                            if first_link_field:
                                applied = DTFilters.process_report_columns_link_fields_as_filters(
                                    report_columns,
                                    report_filters,
                                    first_link_field,
                                    filters,
                                    key,
                                    standard_filters,
                                    aditional_filters,
                                )
                                if applied:
                                    continue
                            else:
                                invalid_filters.append(filter_field)
                                continue
                        else:
                            invalid_filters.append(filter_field)
                            continue
                    else:
                        applied = DTFilters.match_filters_by_fieldname(
                            report_columns, report_filters, filters, key, standard_filters, aditional_filters
                        )
                        if applied:
                            continue
                    if not applied:
                        invalid_filters.append({"fieldname": key})
            if not is_script_report:
                return standard_filters, aditional_filters, invalid_filters
            else:
                return standard_filters, invalid_filters
        except Exception as e:
            frappe.log_error(f"Error in validate_query_report_filters: {str(e)}")
            if not is_script_report:
                return {}, {}, []
            else:
                return {}, []

    @staticmethod
    def get_conf_for_multi_slect_link_field(child_doctype):
        child_meta = frappe.get_meta(child_doctype)
        return next((f.as_dict() for f in child_meta.fields if f.fieldtype == "Link" and not f.hidden), None)

    @staticmethod
    def process_link_fields_as_filters(
        base_fields, filter_field, base_doctype, filters, key, valid_filters, invalid_filters
    ):
        relevant_field_from_base = next(
            (f.as_dict() for f in base_fields if f.get("options") == filter_field.get("options")), None
        )
        if isinstance(filter_field, str):
            filter_field = frappe.parse_json(filter_field or "{}")
        if not relevant_field_from_base:
            if filter_field.get("options") == base_doctype:
                if isinstance(filters[key], list):
                    valid_filters["name"] = [
                        "in",
                        [v.get(filter_field.get("fieldname")) for v in filters[key]],
                    ]
                else:
                    valid_filters["name"] = filters[key]
            else:
                ref_dt = next(
                    (x for x in base_fields if x.fieldtype == "Link" and x.options == "DocType"), None
                )
                if ref_dt:
                    ref_dn = next(
                        (
                            x
                            for x in base_fields
                            if x.fieldtype == "Dynamic Link" and x.options == ref_dt.get("fieldname")
                        ),
                        None,
                    )
                    if ref_dn:
                        if isinstance(filters, list):
                            valid_filters.append(
                                [base_doctype, ref_dt.get("fieldname"), "=", filter_field.get("options")]
                            )
                            if isinstance(filters[key], list):
                                valid_filters.append(
                                    [
                                        base_doctype,
                                        ref_dn.get("fieldname"),
                                        "in",
                                        [v.get(filter_field.get("fieldname")) for v in filters[key]],
                                    ]
                                )
                            else:
                                valid_filters.append(
                                    [base_doctype, ref_dn.get("fieldname"), "=", filters[key]]
                                )
                        else:
                            valid_filters[ref_dt.get("fieldname")] = filter_field.get("options")
                            if isinstance(filters[key], list):
                                valid_filters[ref_dn.get("fieldname")] = [
                                    "in",
                                    [v.get(filter_field.get("fieldname")) for v in filters[key]],
                                ]
                            else:
                                valid_filters[ref_dn.get("fieldname")] = filters[key]
                    else:
                        invalid_filters.append(filter_field)
                else:
                    invalid_filters.append(filter_field)
                    return
        else:
            if isinstance(filters, list):
                for f in filters:
                    if f[1] == key:
                        f[1] = relevant_field_from_base.get("fieldname")
                        if isinstance(f[3], list):
                            f[2] = "in"
                            f[3] = [v.get(filter_field.get("fieldname")) for v in f[3]]
                        valid_filters.append(f)
            else:
                if isinstance(filters[key], list):
                    valid_filters[relevant_field_from_base.get("fieldname")] = [
                        "in",
                        [v.get(filter_field.get("fieldname")) for v in filters[key]],
                    ]
                else:
                    valid_filters[relevant_field_from_base.get("fieldname")] = filters[key]

    @staticmethod
    def process_report_columns_link_fields_as_filters(
        report_columns, report_filters, filter_field, filters, key, standard_filters, additional_filters
    ):
        if isinstance(filter_field, str):
            filter_field = frappe.parse_json(filter_field or "{}")
        print('\n\n\n\n\n',filter_field.get("fieldname"),'filter_field.get("fieldname")')
        relevant_filter_from_base = next(
            (f.as_dict() for f in report_filters if f.get("options") == filter_field.get("options")), None
        )

        # Match column by options AND check if fieldname matches the filter key
        print(report_columns,'report_columns')
        relevant_column_from_base = next(
            (f.as_dict() for f in report_columns if f.get("options") == filter_field.get("options")), None
        )
        if relevant_filter_from_base is not None:
            if filters[key]:
                if isinstance(filters[key], list):
                    value = filters[key]
                    if len(value):
                        if value[0] in OPERATORS:
                            val = value[1]
                            if isinstance(val, list):
                                val = [
                                    v.get(filter_field.get("fieldname")) if isinstance(v, dict) else v
                                    for v in val
                                ]
                            standard_filters[relevant_column_from_base.get("fieldname")] = val
                        else:
                            if isinstance(value, list):
                                value = [
                                    v.get(filter_field.get("fieldname")) if isinstance(v, dict) else v
                                    for v in value
                                ]
                            standard_filters[relevant_column_from_base.get("fieldname")] = value
                else:
                    standard_filters[relevant_column_from_base.get("fieldname")] = filters[key]
            return True
        elif relevant_column_from_base is not None:
            print('888888888888888888888888888888888888888888888',relevant_column_from_base, relevant_column_from_base.get("parent"),'t/////////////////')
            if filters[key]:
                if isinstance(filters[key], list):
                    value = filters[key]
                    if len(value):
                        if value[0] in OPERATORS:
                            val = value[1]
                            if isinstance(val, list):
                                val = [
                                    v.get(filter_field.get("fieldname")) if isinstance(v, dict) else v
                                    for v in val
                                ]
                            additional_filters[relevant_column_from_base.get("fieldname")] = val
                        else:
                            if isinstance(value, list):
                                value = [
                                    v.get(filter_field.get("fieldname")) if isinstance(v, dict) else v
                                    for v in value
                                ]
                            additional_filters[relevant_column_from_base.get("fieldname")] = value
                else:
                    additional_filters[relevant_column_from_base.get("fieldname")] = ["=", filters[key]]
            return True
        else:
            return False

    @staticmethod
    def match_filters_by_fieldname(
        report_columns, report_filters, filters, key, standard_filters, additional_filters
    ):
        matching_filter = next((f.as_dict() for f in report_filters if f.get("fieldname") == key), None)
        matching_column = next((f.as_dict() for f in report_columns if f.get("fieldname") == key), None)
        if matching_filter is not None:
            if filters[key]:
                if isinstance(filters[key], list):
                    value = filters[key]
                    if value[0] in OPERATORS:
                        val = value[1]
                        if isinstance(val, list):
                            val = [v.get(key) if isinstance(v, dict) else v for v in val]
                        standard_filters[key] = val
                    else:
                        standard_filters[key] = value
                else:
                    standard_filters[key] = filters[key]
            return True
        elif matching_column is not None:
            print('888888888888888888888888888888888888888888888',matching_column, matching_column.get("parent"),'/////////////////')
            if filters[key]:
                if isinstance(filters[key], list):
                    value = filters[key]
                    if value[0] in OPERATORS:
                        val = value[1]
                        if isinstance(val, list):
                            val = [v.get(key) if isinstance(v, dict) else v for v in val]
                        additional_filters[key] = val
                    else:
                        additional_filters[key] = value
                else:
                    additional_filters[key] = ["=", filters[key]]
            return True
        else:
            return False
