import frappe,uuid

# # def get_doctype_metadata(doctype_name):
# #     try:
# #         doctype_doc = frappe.get_doc("DocType", doctype_name)
# #         fields, headers = [], []

# #         for field in doctype_doc.fields:
# #             if field.fieldtype not in ['Section Break', 'Column Break', 'Tab Break', 'HTML']:
# #                 field_info = {
# #                     'fieldname': field.fieldname,
# #                     'label': field.label or field.fieldname,
# #                     'fieldtype': field.fieldtype,
# #                     'options': field.options or '',  # For Link / Select / Table
# #                     'reqd': field.reqd,
# #                     'read_only': field.read_only,
# #                     'hidden': field.hidden,
# #                     'default': field.default or '',
# #                     'width': field.width or 100
# #                 }
# #                 fields.append(field_info)

# #                 # ✅ Skip header for child table fields
# #                 if field.fieldtype != "Table":
# #                     headers.append(field.label or field.fieldname)

# #         return fields, headers
# #     except Exception as e:
# #         frappe.log_error(f"Error extracting metadata: {str(e)}")
# #         return [], []


# # def fetch_records_with_children(doctype_name, fields):
# #     parent_fields = [f['fieldname'] for f in fields if f['fieldtype'] != "Table"]
# #     child_tables = [f for f in fields if f['fieldtype'] == "Table"]

# #     # ✅ Parent records
# #     records = frappe.get_list(doctype_name, fields=parent_fields, limit=50)

# #     # ✅ Attach child table data
# #     for rec in records:
# #         rec_name = rec.get("name")
# #         for child in child_tables:
# #             child_dt = child['options']  # child doctype name
# #             try:
# #                 child_rows = frappe.get_list(
# #                     child_dt,
# #                     filters={"parent": rec_name, "parenttype": doctype_name, "parentfield": child['fieldname']},
# #                     fields=["*"]
# #                 )
# #             except:
# #                 child_rows = []
# #             rec[child['fieldname']] = child_rows
# #     return records


# # def create_validations(fields, row_count):
# #     """
# #     Create dropdowns for Select and Link fields
# #     """
# #     validations = []

# #     for col_idx, field in enumerate(fields):
# #         if field['fieldtype'] == "Select" and field['options']:
# #             opts = [opt.strip() for opt in field['options'].replace(",", "\n").split("\n") if opt.strip()]
# #             if opts:
# #                 validations.append({
# #                     "sqref": f"{chr(65+col_idx)}2:{chr(65+col_idx)}{row_count}",
# #                     "type": "list",
# #                     "formula1": ",".join(opts),
# #                     "showDropDown": True
# #                 })

# #         elif field['fieldtype'] == "Link" and field['options']:
# #             try:
# #                 link_values = frappe.get_all(field['options'], fields=["name"], limit=50)
# #                 opts = [lv['name'] for lv in link_values]
# #             except:
# #                 opts = []

# #             if opts:
# #                 validations.append({
# #                     "sqref": f"{chr(65+col_idx)}2:{chr(65+col_idx)}{row_count}",
# #                     "type": "list",
# #                     "formula1": ",".join(opts),
# #                     "showDropDown": True
# #                 })

# #     return validations


# # def create_univer_json_structure(doctype_name):
# #     fields, headers = get_doctype_metadata(doctype_name)
# #     if not fields:
# #         return {"error": "No fields found or doctype doesn't exist"}

# #     data_records = fetch_records_with_children(doctype_name, fields)
# #     row_count = len(data_records) + 1

# #     univer_structure = {
# #         "id": str(uuid.uuid4()),
# #         "name": f"{doctype_name} Workbook",
# #         "sheetOrder": ["sheet1"],
# #         "sheets": {
# #             "sheet1": {
# #                 "id": "sheet1",
# #                 "name": doctype_name,
# #                 "rowCount": row_count,
# #                 "columnCount": len(headers),
# #                 "freeze": {"xSplit": 0, "ySplit": 1, "startRow": 0, "startColumn": 0},
# #                 "cellData": create_cell_data(headers, fields, data_records),
# #                 "rowData": create_row_data(row_count),
# #                 "columnData": create_column_data(fields),
# #                 "mergeData": [],
# #                 "rowTitle": {"width": 46, "hidden": 0},
# #                 "columnTitle": {"height": 20, "hidden": 0},
# #                 "showGridlines": 1,
# #                 "rightToLeft": 0,
# #                 "pluginMeta": {
# #                     "dataValidation": create_validations(fields, row_count)  # ✅ Dropdowns
# #                 }
# #             }
# #         },
# #         "locale": "en",
# #         "styles": create_styles()
# #     }
# #     return univer_structure


# # def create_cell_data(headers, fields, data_records):
# #     cell_data = {}
# #     # Header row
# #     cell_data["0"] = {}
# #     non_table_fields = [f for f in fields if f['fieldtype'] != "Table"]

# #     for col_idx, header in enumerate(headers):
# #         cell_data["0"][str(col_idx)] = {"v": header, "s": "header_style", "t": 1}

# #     # Data rows
# #     for row_idx, record in enumerate(data_records, 1):
# #         cell_data[str(row_idx)] = {}
# #         for col_idx, field in enumerate(non_table_fields):
# #             value = record.get(field['fieldname'], "")
# #             cell_value, cell_type = convert_field_value(value, field['fieldtype'])
# #             cell_data[str(row_idx)][str(col_idx)] = {"v": cell_value, "t": cell_type}

# #     return cell_data


# # def create_row_data(row_count):
# #     return {str(i): {"h": 25, "hd": 0} for i in range(row_count)}


# # def create_column_data(fields):
# #     column_data = {}
# #     non_table_fields = [f for f in fields if f['fieldtype'] != "Table"]

# #     for col_idx, field in enumerate(non_table_fields):
# #         width = field.get('width', 100)
# #         if isinstance(width, str) and width.endswith('px'):
# #             width = int(width.replace('px', ''))
# #         elif isinstance(width, str):
# #             width = 100
# #         column_data[str(col_idx)] = {"w": width, "hd": 1 if field.get('hidden') else 0}
# #     return column_data


# # def create_styles():
# #     return {
# #         "header_style": {
# #             "bg": {"rgb": "#E3F2FD"},
# #             "ff": "Arial",
# #             "fs": 11,
# #             "bl": 1,
# #             "ht": 2,
# #             "vt": 2
# #         }
# #     }


# # def convert_field_value(value, fieldtype):
# #     if value is None or value == '':
# #         return '', 1
# #     if fieldtype in ['Int', 'Long Int', 'Check']:
# #         try: return int(value), 2
# #         except: return 0, 2
# #     elif fieldtype in ['Float', 'Currency', 'Percent']:
# #         try: return float(value), 2
# #         except: return 0.0, 2
# #     elif fieldtype in ['Date', 'Datetime', 'Time']:
# #         return str(value), 1
# #     else:
# #         return str(value), 1


# # @frappe.whitelist(allow_guest=True)
# # def generate_excel_json_wb_univer():
# #     doctype_name = "Excel JSON Wb"
# #     try:
# #         univer_json = create_univer_json_structure(doctype_name)
# #         fields, headers = get_doctype_metadata(doctype_name)
# #         records = fetch_records_with_children(doctype_name, fields)
# #         return {
# #             "univer_workbook": univer_json,
# #             "metadata": {
# #                 "doctype": doctype_name,
# #                 "fields": fields,
# #                 "headers": headers,
# #                 "total_fields": len(fields),
# #                 "records": records
# #             }
# #         }
# #     except Exception as e:
# #         frappe.log_error(f"Error generating Univer JSON: {str(e)}")
# #         return {"error": str(e)}


# # # # ================= Excel Import Example =================
# # @frappe.whitelist(allow_guest=True)
# # def get_excel_json():
# #     # column/row counts
# #     column_count = 100
# #     row_count = 1000

# #     # default column widths
# #     columnData = {i: {"hd": False, "w": 60} for i in range(column_count)}
# #     # increase widths for main headers (A-D -> indices 0..3)
# #     columnData[0] = {"hd": False, "w": 20}
# #     columnData[1] = {"hd": False, "w": 100}  # Budget Head
# #     columnData[2] = {"hd": False, "w": 150}  # Sub Budget Head
# #     columnData[3] = {"hd": False, "w": 100}  # Activity

# #     workbook = {
# #         "id": str(uuid.uuid4()),
# #         "name": "Budget Sheet",
# #         "sheetOrder": ["sheet-1"],
# #         "styles": {
# #             "year_header": {"bg": {"rgb": "#FFFF00"}, "bl": 1, "ht": 2, "vt": 2},
# #             "unit_header": {"bg": {"rgb": "#FFC0CB"}, "bl": 1, "ht": 2, "vt": 2},
# #             "source_header": {"bg": {"rgb": "#D9EAD3"}, "bl": 1, "ht": 2, "vt": 2},
# #             "main_header": {"bl": 1, "ht": 2, "vt": 2,},
# #             "quarter_header": {"bg": {"rgb": "#BD5CA8"}, "ht": 2, "vt": 2},
# #             "total_header": {"bg": {"rgb": "#D182C0"}, "bl": 1, "ht": 2, "vt": 2},
# #             "data_cell": {"ht": 2, "vt": 2}
# #         },
# #         "sheets": {
# #             "sheet-1": {
# #                 "id": "sheet-1",
# #                 "name": "Budget",
# #                 "rowCount": row_count,
# #                 "columnCount": column_count,
# #                 "freeze": {"xSplit": 4, "ySplit": 4, "startColumn": 4},
# #                 "cellData": {
# #                     "0": {
# #                         "4": {"v": "Year 1", "s": "year_header"},
# #                         "22": {"v": "Year 2", "s": "year_header"},
# #                         "40": {"v": "Year 3", "s": "year_header"}
# #                     },
# #                      "1": {
# #                         # Year1
# #                         "4": {"v": "", "s": "unit_header"},
# #                         "7": {"v": "Source 1", "s": "source_header"},
# #                         "12": {"v": "Source 2", "s": "source_header"},
# #                         "17": {"v": "Source 3", "s": "source_header"},
# #                         # Year2
# #                         "22": {"v": "", "s": "unit_header"},
# #                         "25": {"v": "Source 1", "s": "source_header"},
# #                         "30": {"v": "Source 2", "s": "source_header"},
# #                         "35": {"v": "Source 3", "s": "source_header"},
# #                         # Year3
# #                         "40": {"v": "", "s": "unit_header"},
# #                         "43": {"v": "Source 1", "s": "source_header"},
# #                         "48": {"v": "Source 2", "s": "source_header"},
# #                         "53": {"v": "Source 3", "s": "source_header"}
# #                     },
# #                     "2": {
# #                         "0": {"v": "", "s": "main_header"},
# #                         "1": {"v": "Budget Head", "s": "main_header"},
# #                         "2": {"v": "Sub Budget Head", "s": "main_header"},
# #                         "3": {"v": "Activity", "s": "main_header"},
# #                         # Year1 headers
# #                         "4": {"v": "Unit", "s": "unit_header"},
# #                         "5": {"v": "Time", "s": "unit_header"},
# #                         "6": {"v": "Cost", "s": "unit_header"},
# #                         "7": {"v": "Q1", "s": "quarter_header"},
# #                         "8": {"v": "Q2", "s": "quarter_header"},
# #                         "9": {"v": "Q3", "s": "quarter_header"},
# #                         "10": {"v": "Q4", "s": "quarter_header"},
# #                         "11": {"v": "Total", "s": "total_header"},
# #                         # extra Year1 quarters groups...
# #                         "12": {"v": "Q1", "s": "quarter_header"},
# #                         "13": {"v": "Q2", "s": "quarter_header"},
# #                         "14": {"v": "Q3", "s": "quarter_header"},
# #                         "15": {"v": "Q4", "s": "quarter_header"},
# #                         "16": {"v": "Total", "s": "total_header"},
# #                         "17": {"v": "Q1", "s": "quarter_header"},
# #                         "18": {"v": "Q2", "s": "quarter_header"},
# #                         "19": {"v": "Q3", "s": "quarter_header"},
# #                         "20": {"v": "Q4", "s": "quarter_header"},
# #                         "21": {"v": "Total", "s": "total_header"},
# #                         # Year2
# #                         "22": {"v": "Unit", "s": "unit_header"},
# #                         "23": {"v": "Time", "s": "unit_header"},
# #                         "24": {"v": "Cost", "s": "unit_header"},
# #                         "25": {"v": "Q1", "s": "quarter_header"},
# #                         "26": {"v": "Q2", "s": "quarter_header"},
# #                         "27": {"v": "Q3", "s": "quarter_header"},
# #                         "28": {"v": "Q4", "s": "quarter_header"},
# #                         "29": {"v": "Total", "s": "total_header"},
# #                         "30": {"v": "Q1", "s": "quarter_header"},
# #                         "31": {"v": "Q2", "s": "quarter_header"},
# #                         "32": {"v": "Q3", "s": "quarter_header"},
# #                         "33": {"v": "Q4", "s": "quarter_header"},
# #                         "34": {"v": "Total", "s": "total_header"},
# #                         "35": {"v": "Q1", "s": "quarter_header"},
# #                         "36": {"v": "Q2", "s": "quarter_header"},
# #                         "37": {"v": "Q3", "s": "quarter_header"},
# #                         "38": {"v": "Q4", "s": "quarter_header"},
# #                         "39": {"v": "Total", "s": "total_header"},
# #                         # Year3
# #                         "40": {"v": "Unit", "s": "unit_header"},
# #                         "41": {"v": "Time", "s": "unit_header"},
# #                         "42": {"v": "Cost", "s": "unit_header"},
# #                         "43": {"v": "Q1", "s": "quarter_header"},
# #                         "44": {"v": "Q2", "s": "quarter_header"},
# #                         "45": {"v": "Q3", "s": "quarter_header"},
# #                         "46": {"v": "Q4", "s": "quarter_header"},
# #                         "47": {"v": "Total", "s": "total_header"},
# #                         "48": {"v": "Q1", "s": "quarter_header"},
# #                         "49": {"v": "Q2", "s": "quarter_header"},
# #                         "50": {"v": "Q3", "s": "quarter_header"},
# #                         "51": {"v": "Q4", "s": "quarter_header"},
# #                         "52": {"v": "Total", "s": "total_header"},
# #                         "53": {"v": "Q1", "s": "quarter_header"},
# #                         "54": {"v": "Q2", "s": "quarter_header"},
# #                         "55": {"v": "Q3", "s": "quarter_header"},
# #                         "56": {"v": "Q4", "s": "quarter_header"},
# #                         "57": {"v": "Total", "s": "total_header"},
# #                     },
# #                     # Row 3 sample data (Excel row 4)
# #                     "3": {
# #                         "1": {"v": "Budget_Head 1", "s": "data_cell"},
# #                         "2": {"v": "Sub_Head 1", "s": "data_cell"},
# #                         "3": {"v": "Activity_1", "s": "data_cell"},
# #                         # Year1 raw quarter values
# #                         "4": {"v": "Nos", "s": "data_cell"},
# #                         "5": {"v": "12", "s": "data_cell"},
# #                         "6": {"v": "1000", "s": "data_cell"},
# #                         "7": {"v": 250, "s": "data_cell"},
# #                         "8": {"v": 300, "s": "data_cell"},
# #                         "9": {"v": 200, "s": "data_cell"},
# #                         "10": {"v": 250, "s": "data_cell"},
# #                         # Year1 total (value + formula)
# #                         "11": {"v": 250 + 300 + 200 + 250, "f": "=H4+I4+J4+K4", "s": "data_cell"},
# #                         # Year1 other quarter group
# #                         "12": {"v": 200, "s": "data_cell"},
# #                         "13": {"v": 150, "s": "data_cell"},
# #                         "14": {"v": 100, "s": "data_cell"},
# #                         "15": {"v": 50, "s": "data_cell"},
# #                         "16": {"v": 200 + 150 + 100 + 50, "f": "=M4+N4+O4+P4", "s": "data_cell"},
# #                         # Year1 third quarter group
# #                         "17": {"v": 300, "s": "data_cell"},
# #                         "18": {"v": 200, "s": "data_cell"},
# #                         "19": {"v": 150, "s": "data_cell"},
# #                         "20": {"v": 100, "s": "data_cell"},
# #                         "21": {"v": 300 + 200 + 150 + 100, "f": "=R4+S4+T4+U4", "s": "data_cell"},
# #                         # Year2 raw quarter values
# #                         "22": {"v": "Nos", "s": "data_cell"},
# #                         "23": {"v": 10, "s": "data_cell"},
# #                         "24": {"v": 900, "s": "data_cell"},
# #                         "25": {"v": 100, "s": "data_cell"},
# #                         "26": {"v": 200, "s": "data_cell"},
# #                         "27": {"v": 300, "s": "data_cell"},
# #                         "28": {"v": 400, "s": "data_cell"},
# #                         "29": {"v": 100 + 200 + 300 + 400, "f": "=Z4+AA4+AB4+AC4", "s": "data_cell"},
# #                         "30": {"v": 150, "s": "data_cell"},
# #                         "31": {"v": 100, "s": "data_cell"},
# #                         "32": {"v": 250, "s": "data_cell"},
# #                         "33": {"v": 200, "s": "data_cell"},
# #                         "34": {"v": 150 + 100 + 250 + 200, "f": "=AE4+AF4+AG4+AH4", "s": "data_cell"},
# #                         "35": {"v": 200, "s": "data_cell"},
# #                         "36": {"v": 250, "s": "data_cell"},
# #                         "37": {"v": 150, "s": "data_cell"},
# #                         "38": {"v": 300, "s": "data_cell"},
# #                         "39": {"v": 200 + 250 + 150 + 300, "f": "=AJ4+AK4+AL4+AM4", "s": "data_cell"},
# #                         # Year3 raw quarter values
# #                         "40": {"v": "Nos", "s": "data_cell"},
# #                         "41": {"v": 15, "s": "data_cell"},
# #                         "42": {"v": 1100, "s": "data_cell"},
# #                         "43": {"v": 200, "s": "data_cell"},
# #                         "44": {"v": 150, "s": "data_cell"},
# #                         "45": {"v": 300, "s": "data_cell"},
# #                         "46": {"v": 350, "s": "data_cell"},
# #                         "47": {"v": 200 + 150 + 300 + 350, "f": "=AR4+AS4+AT4+AU4", "s": "data_cell"},
# #                         "48": {"v": 250, "s": "data_cell"},
# #                         "49": {"v": 200, "s": "data_cell"},
# #                         "50": {"v": 300, "s": "data_cell"},
# #                         "51": {"v": 150, "s": "data_cell"},
# #                         "52": {"v": 250 + 200 + 300 + 150, "f": "=AW4+AX4+AY4+AZ4", "s": "data_cell"},
# #                         "53": {"v": 300, "s": "data_cell"},
# #                         "54": {"v": 200, "s": "data_cell"},
# #                         "55": {"v": 250, "s": "data_cell"},
# #                         "56": {"v": 150, "s": "data_cell"},
# #                         "57": {"v": 300 + 200 + 250 + 150, "f": "=BB4+BC4+BD4+BE4", "s": "data_cell"},
# #                     }
# #                 },
# #                 "mergeData": [
# #                 # Main header merge (row 0 aur 1)
# #                 {"startRow": 0, "endRow": 1, "startColumn": 1, "endColumn": 1},   # Budget Head
# #                 {"startRow": 0, "endRow": 1, "startColumn": 2, "endColumn": 2},   # Sub Budget Head
# #                 {"startRow": 0, "endRow": 1, "startColumn": 3, "endColumn": 3},   # Activity
# #                 # Year headers
# #                 {"startRow": 0, "endRow": 0, "startColumn": 4, "endColumn": 21},
# #                 {"startRow": 0, "endRow": 0, "startColumn": 22, "endColumn": 39},
# #                 {"startRow": 0, "endRow": 0, "startColumn": 40, "endColumn": 57},
# #                 # Unit/Time/Cost merge (each year)
# #                 {"startRow": 1, "endRow": 1, "startColumn": 4, "endColumn": 6},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 22, "endColumn": 24},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 40, "endColumn": 42},
# #                 # Sources merge
# #                 {"startRow": 1, "endRow": 1, "startColumn": 7, "endColumn": 11},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 12, "endColumn": 16},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 17, "endColumn": 21},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 25, "endColumn": 29},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 30, "endColumn": 34},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 35, "endColumn": 39},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 43, "endColumn": 47},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 48, "endColumn": 52},
# #                 {"startRow": 1, "endRow": 1, "startColumn": 53, "endColumn": 57}
# #                 ],
# #                 "columnData": columnData,
# #                 "rowData": {i: {"hd": False, "h": 25} for i in range(row_count)}
# #             }
# #         }
# #     }

# #     return workbook


# @frappe.whitelist(allow_guest=True)
# def get_excel_json(project_name=None):
#     if not project_name:
#         frappe.throw("Project name is required")

#     project = frappe.get_doc("Project", project_name)

#     # --- Dynamic Years ---
#     years = [row.year for row in project.annual_project]

#     # --- Dynamic Quarters (grouped by year) ---
#     quarters_by_year = {}
#     for row in project.quaterly_project:
#         year = row.year
#         if year not in quarters_by_year:
#             quarters_by_year[year] = []
#         quarters_by_year[year].append(row.timespan)

#     # --- Dynamic Sources ---
#     sources = []
#     if project.donor_name:
#         sources.append(project.donor_name)

#     if project.other_fund_sources:
#         for row in project.other_fund_sources:
#             fund_sources_title = frappe.get_value("Fund Sources Child", row.name, 'fund_sources_title')
#             if fund_sources_title:
#                 sources.append(fund_sources_title)

#     # --- Counts ---
#     column_count = 100
#     row_count = 1000

#     # --- Default Column Widths ---
#     columnData = {i: {"hd": False, "w": 100} for i in range(column_count)}
#     columnData[0] = {"hd": False, "w": 20}   # ID / Sl No
#     columnData[1] = {"hd": False, "w": 100}  # Budget Head
#     columnData[2] = {"hd": False, "w": 150}  # Sub Budget Head
#     columnData[3] = {"hd": False, "w": 90}  # Activity

#     workbook = {
#         "id": str(uuid.uuid4()),
#         "name": f"Budget Sheet - {project.project_name}",
#         "sheetOrder": ["sheet-1"],
#         "styles": {
#             "year_header": {"bg": {"rgb": "#FFFF00"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
#             "unit_header": {"bg": {"rgb": "#FFC0CB"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
#             "source_header": {"bg": {"rgb": "#D9EAD3"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
#             "main_header": {"bl": 1, "ht": 2, "vt": 2, "wrapText": True},
#             "quarter_header": {"bg": {"rgb": "#BD5CA8"}, "ht": 2, "vt": 2, "wrapText": True},
#             "total_header": {"bg": {"rgb": "#D182C0"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
#             "data_cell": {"ht": 2, "vt": 2, "wrapText": True}
#         },
#         "sheets": {
#             "sheet-1": {
#                 "id": "sheet-1",
#                 "name": project.project_name,
#                 "rowCount": row_count,
#                 "columnCount": column_count,
#                 "freeze": {"xSplit": 4, "ySplit": 4, "startColumn": 4},
#                 "cellData": {},
#                 "mergeData": [],
#                 "columnData": columnData,
#                 "rowData": {i: {"hd": False, "h": 25} for i in range(row_count)}
#             }
#         }
#     }

#     sheet = workbook["sheets"]["sheet-1"]

#     # --- Base headers (row 2) ---
#     sheet["cellData"]["2"] = {
#         "0": {"v": "", "s": "main_header"},
#         "1": {"v": "Budget Head", "s": "main_header"},
#         "2": {"v": "Sub Budget Head", "s": "main_header"},
#         "3": {"v": "Activity", "s": "main_header"},
#     }

#     sheet["cellData"]["0"] = {}
#     sheet["cellData"]["1"] = {}
#     sheet["cellData"]["3"] = {}

#     col_index = 4

#     # --- Fill Years Dynamically ---
#     for year in years:
#         year_quarters = quarters_by_year.get(year, [])
#         year_start = col_index

#         # Year header
#         sheet["cellData"]["0"][str(col_index)] = {"v": year, "s": "year_header"}
#         year_block = 3 + len(sources) * len(year_quarters) + 1  # +1 for single Total column
#         sheet["mergeData"].append({
#             "startRow": 0, "endRow": 0,
#             "startColumn": year_start,
#             "endColumn": year_start + year_block - 1
#         })

#         # Unit/Time/Cost
#         sheet["cellData"]["2"][str(col_index)] = {"v": "Unit", "s": "unit_header"}
#         sheet["cellData"]["2"][str(col_index + 1)] = {"v": "Time", "s": "unit_header"}
#         sheet["cellData"]["2"][str(col_index + 2)] = {"v": "Cost", "s": "unit_header"}
#         sheet["mergeData"].append({
#             "startRow": 1, "endRow": 1,
#             "startColumn": year_start,
#             "endColumn": year_start + 2
#         })
#         sheet["cellData"]["1"][str(year_start)] = {"v": "", "s": "unit_header"}
#         col_index += 3

#         # --- Sources ---
#         for source in sources:
#             source_start = col_index
#             sheet["cellData"]["1"][str(source_start)] = {"v": source, "s": "source_header"}

#             # Merge across quarters only
#             sheet["mergeData"].append({
#                 "startRow": 1, "endRow": 1,
#                 "startColumn": source_start,
#                 "endColumn": source_start + len(year_quarters) - 1
#             })

#             # Quarters row
#             for q in year_quarters:
#                 sheet["cellData"]["2"][str(col_index)] = {"v": q, "s": "quarter_header"}
#                 col_index += 1

#         # --- Single Total column after all sources ---
#         sheet["cellData"]["1"][str(col_index)] = {"v": "", "s": "source_header"}  # Extend source color
#         sheet["cellData"]["2"][str(col_index)] = {"v": "Total", "s": "total_header"}
#         col_index += 1
        


#         # --- ADD Dynamic Data Row from Project Budget Planning ---
#         pbp_doc = frappe.get_doc("Project Budget Planning", "PBP-002303")
#         data_start_row = 3
#         row_counter = data_start_row

#         sheet["cellData"][str(row_counter)] = {}

#         # --- Parent fields ---
#         sheet["cellData"][str(row_counter)]["0"] = {"v": "", "s": "data_cell"}
#         sheet["cellData"][str(row_counter)]["1"] = {"v": pbp_doc.budget_head_title, "s": "data_cell"}
#         sheet["cellData"][str(row_counter)]["2"] = {"v": pbp_doc.sub_budget_head_title, "s": "data_cell"}
#         sheet["cellData"][str(row_counter)]["3"] = {"v": pbp_doc.fund_source_title, "s": "data_cell"}

#         # --- Fill quarter values dynamically from planning_table by matching timespan with headers ---
#         col_idx = 4

#         for year in years:
#             year_quarters = quarters_by_year.get(year, [])
#             for source in sources:
#                 for q in year_quarters:
#                     # Match planning_table row with header text (timespan)
#                     match = next((r for r in pbp_doc.planning_table if r.timespan == q), None)
#                     if match:
#                         planned = match.planned_amount or 0
#                         unit = match.custom_unit or 0
#                         time = match.custom_time or 0
#                         cost = match.custom_unit_cost or 0
#                         total = unit * time * cost

#                         sheet["cellData"][str(row_counter)][str(col_idx)] = {"v": planned, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 1)] = {"v": unit, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 2)] = {"v": time, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 3)] = {"v": total, "s": "data_cell"}
#                     else:
#                         # empty if no matching timespan
#                         sheet["cellData"][str(row_counter)][str(col_idx)] = {"v": 0, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 1)] = {"v": 0, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 2)] = {"v": 0, "s": "data_cell"}
#                         sheet["cellData"][str(row_counter)][str(col_idx + 3)] = {"v": 0, "s": "data_cell"}
#                     col_idx += 4

#     return workbook





# =================== main api =================
@frappe.whitelist(allow_guest=True)
def get_excel_json(name):
    if not name:
        frappe.throw("Project name is required")

    # ------------------ HEADER SOURCE ------------------
    project = frappe.get_doc("Project", name)

    # --- Dynamic Years ---
    years = [row.year for row in project.annual_project]

    # --- Dynamic Quarters (grouped by year) ---
    quarters_by_year = {}
    for row in project.quaterly_project:
        year = row.year
        if year not in quarters_by_year:
            quarters_by_year[year] = []
        quarters_by_year[year].append(row.timespan)

    # --- Dynamic Sources ---
    sources = []
    if project.donor_name:
        sources.append(project.donor_name)

    if project.other_fund_sources:
        for r in project.other_fund_sources:
            fund_sources_title = frappe.get_value(
                "Fund Sources Child", r.name, "fund_sources_title"
            )
            if fund_sources_title:
                sources.append(fund_sources_title)

    # --- Counts ---
    column_count = 100
    row_count = 1000

    # --- Default Column Widths ---
    columnData = {i: {"hd": False, "w": 100} for i in range(column_count)}
    columnData[0] = {"hd": False, "w": 20}   # ID / Sl No
    columnData[1] = {"hd": False, "w": 100}  # Budget Head
    columnData[2] = {"hd": False, "w": 150}  # Sub Budget Head
    columnData[3] = {"hd": False, "w": 90}   # Activity

    workbook = {
        "id": str(uuid.uuid4()),
        "name": f"Budget Sheet - {project.project_name}",
        "sheetOrder": ["sheet-1"],
        "styles": {
            "year_header": {"bg": {"rgb": "#FFFF00"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
            "unit_header": {"bg": {"rgb": "#FFC0CB"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
            "source_header": {"bg": {"rgb": "#D9EAD3"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
            "main_header": {"bl": 1, "ht": 2, "vt": 2, "wrapText": True},
            "quarter_header": {"bg": {"rgb": "#BD5CA8"}, "ht": 2, "vt": 2, "wrapText": True},
            "total_header": {"bg": {"rgb": "#D182C0"}, "bl": 1, "ht": 2, "vt": 2, "wrapText": True},
            "data_cell": {"ht": 2, "vt": 2, "wrapText": True},
        },
        "sheets": {
            "sheet-1": {
                "id": "sheet-1",
                "name": project.project_name,
                "rowCount": row_count,
                "columnCount": column_count,
                "freeze": {"xSplit": 4, "ySplit": 4, "startColumn": 4},
                "cellData": {},
                "mergeData": [],
                "columnData": columnData,
                "rowData": {i: {"hd": False, "h": 25} for i in range(row_count)},
            }
        },
    }

    sheet = workbook["sheets"]["sheet-1"]

    # --- Base headers (row 2) ---
    sheet["cellData"]["2"] = {
        "0": {"v": "", "s": "main_header"},
        "1": {"v": "Budget Head", "s": "main_header"},
        "2": {"v": "Sub Budget Head", "s": "main_header"},
        "3": {"v": "Activity", "s": "main_header"},
    }

    sheet["cellData"]["0"] = {}
    sheet["cellData"]["1"] = {}
    sheet["cellData"]["3"] = {}

    col_index = 4

    # --- Fill Years Dynamically ---
    for year in years:
        year_quarters = quarters_by_year.get(year, [])
        year_start = col_index

        # Year header
        sheet["cellData"]["0"][str(col_index)] = {"v": year, "s": "year_header"}
        year_block = 3 + len(sources) * len(year_quarters) + 1  # +1 for single Total column
        sheet["mergeData"].append(
            {"startRow": 0, "endRow": 0, "startColumn": year_start, "endColumn": year_start + year_block - 1}
        )

        # Unit/Time/Cost
        sheet["cellData"]["2"][str(col_index)] = {"v": "Unit", "s": "unit_header"}
        sheet["cellData"]["2"][str(col_index + 1)] = {"v": "Time", "s": "unit_header"}
        sheet["cellData"]["2"][str(col_index + 2)] = {"v": "Cost", "s": "unit_header"}
        sheet["mergeData"].append(
            {"startRow": 1, "endRow": 1, "startColumn": year_start, "endColumn": year_start + 2}
        )
        sheet["cellData"]["1"][str(year_start)] = {"v": "", "s": "unit_header"}
        col_index += 3

        # --- Sources ---
        for source in sources:
            source_start = col_index
            sheet["cellData"]["1"][str(source_start)] = {"v": source, "s": "source_header"}
            sheet["mergeData"].append(
                {"startRow": 1, "endRow": 1, "startColumn": source_start, "endColumn": source_start + len(year_quarters) - 1}
            )

            # Quarters row
            for q in year_quarters:
                sheet["cellData"]["2"][str(col_index)] = {"v": q, "s": "quarter_header"}
                col_index += 1

        # --- Single Total column after all sources ---
        sheet["cellData"]["1"][str(col_index)] = {"v": "", "s": "source_header"}
        sheet["cellData"]["2"][str(col_index)] = {"v": "Total", "s": "total_header"}
        col_index += 1

    # --- keep final column index for mapping ---
    final_col = col_index
    data = []
    # ---------- DATA ROW (FROM Project Budget Planning) ----------
    try:
        pbp_list = frappe.get_all("Project Budget Planning", filters={"project": project.name}, pluck="name")
        for item in pbp_list:
            doc = frappe.get_doc("Project Budget Planning", item,)
            data.append(doc.as_dict())
    except Exception:
        print('jhgj')
    #     found = frappe.get_all("Project Budget Planning", filters={"project": project.name}, fields=["name"], limit=1)
    #     if not found:
    #         found = frappe.get_all("Project Budget Planning", filters=[["name", "like", f"%{project_name}%"]], fields=["name"], limit=1)
    #     if found:
    #         pbp_doc = frappe.get_doc("Project Budget Planning", found[0]["name"])
    #     else:
    #         frappe.throw(f"Project Budget Planning doc not found for '{project_name}'.")
    
    # Build year_start positions from header row 0
    year_positions = {int(k): v["v"] for k, v in sheet["cellData"]["0"].items()}

    # Compute total column for each year_start
    year_total_col = {}
    for ys in sorted(year_positions.keys()):
        total_col = None
        next_starts = [s for s in sorted(year_positions.keys()) if s > ys]
        end_search = next_starts[0] if next_starts else final_col
        for c in range(ys, end_search):
            h2 = sheet["cellData"]["2"].get(str(c))
            if h2 and h2.get("s") == "total_header":
                total_col = c
                break
        year_total_col[ys] = total_col

    # --- Single Data Row ---
    data_row = 3
    sheet["cellData"][str(data_row)] = {
        "0": {"v": 1, "s": "data_cell"},
        "1": {"v": getattr(pbp_doc, "budget_head_title", "") or "", "s": "data_cell"},
        "2": {"v": getattr(pbp_doc, "sub_budget_head_title", "") or "", "s": "data_cell"},
        "3": {"v": getattr(pbp_doc, "fund_source_title", "") or "", "s": "data_cell"},
    }

    year_filled = set()

    # --- iterate over all columns ---
    for col in range(4, final_col):
        header_cell = sheet["cellData"]["2"].get(str(col))
        if not header_cell:
            continue

        kind = header_cell.get("s")
        value = header_cell.get("v")

        if kind == "quarter_header":
            q_text = value
            year_keys = [k for k in year_positions.keys() if k <= col]
            year_start_col = max(year_keys) if year_keys else None
            year_header = year_positions.get(year_start_col)

            # --- Find child row where both timespan & year match ---
            ch = next(
                (r for r in pbp_doc.planning_table if r.timespan == q_text and str(r.year) == str(year_header)),
                None,
            )

            if ch:
                planned = getattr(ch, "planned_amount", 0) or 0
                unit = getattr(ch, "unit", 0) or 0
                ctime = getattr(ch, "time", 0) or 0
                cost = getattr(ch, "unit_cost", 0) or 0
                total_val = (unit * ctime * cost) or 0

                # quarter value
                sheet["cellData"][str(data_row)][str(col)] = {"v": planned, "s": "data_cell"}

                # unit/time/cost/total (set once per year)
                if year_start_col is not None and year_start_col not in year_filled:
                    u_col = year_start_col
                    t_col = year_start_col + 1
                    c_col = year_start_col + 2
                    tot_col = year_total_col.get(year_start_col)

                    sheet["cellData"][str(data_row)][str(u_col)] = {"v": unit, "s": "data_cell"}
                    sheet["cellData"][str(data_row)][str(t_col)] = {"v": ctime, "s": "data_cell"}
                    sheet["cellData"][str(data_row)][str(c_col)] = {"v": cost, "s": "data_cell"}
                    if tot_col:
                        sheet["cellData"][str(data_row)][str(tot_col)] = {"v": total_val, "s": "data_cell"}
                    year_filled.add(year_start_col)
            else:
                sheet["cellData"][str(data_row)][str(col)] = {"v": 0, "s": "data_cell"}

    return workbook
