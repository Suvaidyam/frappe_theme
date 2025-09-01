import frappe
from openpyxl import load_workbook, Workbook
import frappe
import io
import os
import json
import uuid 
import datetime
from openpyxl.utils.cell import get_column_letter,coordinate_from_string, column_index_from_string


def load_excel_from_private(file_url):
    file_path = os.path.join(frappe.get_site_path(), file_url.lstrip("/"))
    if not os.path.exists(file_path):
        frappe.throw(f"File {file_url} not found in private/files")
    wb = load_workbook(file_path, data_only=False)
    return wb


def extract_cell_style(cell):
    style = {}

    # Background color
    if (cell.fill and cell.fill.start_color and 
        hasattr(cell.fill.start_color, 'rgb') and 
        cell.fill.start_color.rgb):
        rgb = str(cell.fill.start_color.rgb)
        if rgb and len(rgb) >= 6 and rgb != "00000000":
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            style["bg"] = {"rgb": color.upper()}

    # Font color
    if (cell.font and cell.font.color and 
        hasattr(cell.font.color, 'rgb') and 
        cell.font.color.rgb):
        rgb = str(cell.font.color.rgb)
        if rgb and len(rgb) >= 6 and rgb != "00000000":
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            style["cl"] = {"rgb": color.upper()}

    # Font properties
    if cell.font:
        if cell.font.bold is True:
            style["bl"] = 1
        if cell.font.italic is True:
            style["it"] = 1
        if cell.font.size:
            style["fs"] = cell.font.size
        if cell.font.name:
            style["ff"] = cell.font.name

    # Alignment
    if cell.alignment:
        if cell.alignment.horizontal == "center":
            style["ht"] = 2
        elif cell.alignment.horizontal == "right":
            style["ht"] = 3
        elif cell.alignment.horizontal == "left":
            style["ht"] = 1
        
        if cell.alignment.vertical == "center":
            style["vt"] = 2
        elif cell.alignment.vertical == "top":
            style["vt"] = 1
        elif cell.alignment.vertical == "bottom":
            style["vt"] = 3

    # Borders
    border = {}
    if cell.border and cell.border.top and cell.border.top.style:
        top_border = {"s": 1}
        if (cell.border.top.color and hasattr(cell.border.top.color, 'rgb') and cell.border.top.color.rgb):
            rgb = str(cell.border.top.color.rgb)
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            top_border["cl"] = {"rgb": color.upper()}
        border["t"] = top_border

    if cell.border and cell.border.bottom and cell.border.bottom.style:
        bottom_border = {"s": 1}
        if (cell.border.bottom.color and hasattr(cell.border.bottom.color, 'rgb') and cell.border.bottom.color.rgb):
            rgb = str(cell.border.bottom.color.rgb)
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            bottom_border["cl"] = {"rgb": color.upper()}
        border["b"] = bottom_border

    if cell.border and cell.border.left and cell.border.left.style:
        left_border = {"s": 1}
        if (cell.border.left.color and hasattr(cell.border.left.color, 'rgb') and cell.border.left.color.rgb):
            rgb = str(cell.border.left.color.rgb)
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            left_border["cl"] = {"rgb": color.upper()}
        border["l"] = left_border

    if cell.border and cell.border.right and cell.border.right.style:
        right_border = {"s": 1}
        if (cell.border.right.color and hasattr(cell.border.right.color, 'rgb') and cell.border.right.color.rgb):
            rgb = str(cell.border.right.color.rgb)
            color = f"#{rgb[2:]}" if len(rgb) == 8 else f"#{rgb}"
            right_border["cl"] = {"rgb": color.upper()}
        border["r"] = right_border

    if border:
        style["bd"] = border

    return style if style else None

import datetime

def extract_cell_value(cell):
    """
    Extract value, date/time (clean format), formula, and hyperlink.
    """
    value_obj = {}

    # Formula
    if cell.value is not None and isinstance(cell.value, str) and cell.value.startswith("="):
        value_obj["f"] = cell.value
        value_obj["v"] = 0
    else:
        # Date / DateTime
        if isinstance(cell.value, datetime.datetime):
            # Full datetime
            value_obj["v"] = cell.value.strftime("%Y-%m-%d %H:%M:%S")
            value_obj["t"] = "dt"
        elif isinstance(cell.value, datetime.date):
            # Only date
            value_obj["v"] = cell.value.strftime("%Y-%m-%d")
            value_obj["t"] = "d"
        else:
            value_obj["v"] = cell.value

    # Hyperlink
    if cell.hyperlink:
        # Proper hyperlink object
        value_obj["l"] = {
            "Target": cell.hyperlink.target,
            "Display": cell.value if cell.value else cell.hyperlink.display
        }
    elif isinstance(cell.value, str) and (cell.value.startswith("http://") or cell.value.startswith("https://")):
        # Raw URL in value
        value_obj["l"] = {
            "Target": cell.value,
            "Display": cell.value
        }

    return value_obj if value_obj else None


def is_column_hidden(sheet, col_idx):
    col_letter = get_column_letter(col_idx)
    col_dimension = sheet.column_dimensions.get(col_letter)

    if col_dimension:
        # Direct hidden property
        if getattr(col_dimension, "hidden", False) is True:
            return True

        # Some Excel versions set width very small instead of hidden
        if hasattr(col_dimension, "width") and col_dimension.width is not None:
            if col_dimension.width <= 0.01:  
                return True

    return False


def is_row_hidden(sheet, row_idx):

    row_dimension = sheet.row_dimensions.get(row_idx)
    
    # Method 1: Direct hidden property 
    if row_dimension:
        if getattr(row_dimension, 'hidden', False) is True:
            print(f"Row {row_idx} hidden by property")
            return True
        
        # Method 2: Height is 0 or very small 
        if hasattr(row_dimension, 'height') and row_dimension.height is not None:
            if row_dimension.height <= 0.1:  # Increased threshold
                print(f"Row {row_idx} hidden by height: {row_dimension.height}")
                return True
    
    return False

def get_freeze_info(sheet):
    if sheet.freeze_panes:
        fp = sheet.freeze_panes
        if isinstance(fp, str):  
            # e.g. "C5"
            col, row = coordinate_from_string(fp)
            row_idx = row
            col_idx = column_index_from_string(col)
        else:  
            # OpenPyXL Cell object
            row_idx = fp.row
            col_idx = fp.col_idx

        return {
            "startRow": row_idx - 1 if row_idx else -1,
            "startColumn": col_idx - 1 if col_idx else -1,
            "ySplit": row_idx - 1 if row_idx else 0,
            "xSplit": col_idx - 1 if col_idx else 0,
        }
    else:
        return {"startRow": -1, "startColumn": -1, "ySplit": 0, "xSplit": 0}
    

@frappe.whitelist(allow_guest=True)
def excel():
    wb = load_excel_from_private("/private/files/Quarterly_FU_Reporting_10ebf560ebf56.xlsx")
    
    sheets = {}
    sheet_order = []
    
    for sheet in wb.worksheets:
        sheet_id = str(uuid.uuid4())
        sheet_order.append(sheet_id)
        
        print(f"=== Processing Sheet: {sheet.title} ===")
        
        # ====== CELL DATA ======
        cell_data = {}
        for row_idx in range(1, sheet.max_row + 1):
            row_data = {}
            for col_idx in range(1, sheet.max_column + 1):
                cell = sheet.cell(row=row_idx, column=col_idx)
                cell_obj = {}

                # Always extract styling first
                cell_style = extract_cell_style(cell)
                
                  # Values, Dates, Links
                cell_val = extract_cell_value(cell)
                if cell_val:
                    cell_obj.update(cell_val)

                # Always add style if it exists
                if cell_style:
                    cell_obj["s"] = cell_style

                # Store cell
                if cell_obj:
                    row_data[col_idx - 1] = cell_obj

            if row_data:
                cell_data[row_idx - 1] = row_data

        # ====== MERGED CELLS ======
        merge_data = []
        for merged in sheet.merged_cells.ranges:
            merge_data.append({
                "startRow": merged.min_row - 1,
                "endRow": merged.max_row - 1,
                "startColumn": merged.min_col - 1,
                "endColumn": merged.max_col - 1
            })

        # ====== HIDDEN ROWS ======
        row_data = {}
        for row_idx in range(1, sheet.max_row + 1):
            if is_row_hidden(sheet, row_idx):
                row_data[row_idx - 1] = {"h": 1, "hd": 0}

       # ====== HIDDEN COLUMNS ======
        column_data = {}
        for col_idx in range(1, sheet.max_column + 1):
            if is_column_hidden(sheet, col_idx):
                column_data[col_idx - 1] = {"h": 1, "hd": 0}


        # ====== FREEZE PANES ======
        freeze = get_freeze_info(sheet)

        # ====== SHEET JSON ======
        sheets[sheet_id] = {
            "id": sheet_id,
            "name": sheet.title,
            "tabColor": "",
            "hidden": 0,
            "rowCount": sheet.max_row,
            "columnCount": sheet.max_column,
            "zoomRatio": 1,
            "freeze": freeze,
            "scrollTop": 0,
            "scrollLeft": 0,
            "defaultColumnWidth": 73,
            "defaultRowHeight": 23,
            "mergeData": merge_data,
            "cellData": cell_data,
            "rowData": row_data,       # Hidden rows only
            "columnData": column_data, # Hidden columns only
            "showGridlines": 1,
            "rowHeader": {"width": 46, "hidden": 0},
            "columnHeader": {"height": 20, "hidden": 0},
            "rightToLeft": 0,
        }
    
    return {
        "id": str(uuid.uuid4()),
        "name": "Excel Import",
        "appVersion": "0.10.2",
        "locale": "enUS",
        "styles": cell_style,
        "sheetOrder": sheet_order,
        "sheets": sheets,
        "resources": [],
    }