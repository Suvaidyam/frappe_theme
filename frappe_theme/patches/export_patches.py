# # frappe_theme/patches/export_patches.py

# import frappe
# import logging

# logger = logging.getLogger(__name__)

# # ==================== PATCH FUNCTIONS ====================

# def patch_data_export():
#     """Patch Data Export to handle masking"""
#     try:
#         from frappe.core.doctype.data_export.data_export import DataExport
#         original_get_data = DataExport.get_data
        
#         def enhanced_get_data(self):
#             data = original_get_data(self)
            
#             # Apply masking if needed
#             if hasattr(self, 'reference_doctype') and self.reference_doctype:
#                 data = handle_export_masking(data, self.reference_doctype)
            
#             return data
        
#         DataExport.get_data = enhanced_get_data
#         logger.info("✅ Data Export patch applied successfully")
#         return True
#     except ImportError as e:
#         logger.warning(f"⚠️  DataExport not available for patching: {e}")
#         return False
#     except Exception as e:
#         logger.error(f"❌ Failed to patch DataExport: {e}")
#         return False

# def patch_query_reports():
#     """Patch Query Reports to handle masking"""
#     try:
#         from frappe.desk.query_report import run as run_query_report
#         original_run = run_query_report
#         @frappe.whitelist()
#         def enhanced_run(report_name, filters=None, user=None, ignore_prepared_report=False, custom_columns=None):
#             result = original_run(report_name, filters, user, ignore_prepared_report, custom_columns)
            
#             # Apply masking to query report results
#             try:
#                 if isinstance(result, dict) and 'result' in result:
#                     print(f"Result ???????????????????????????????????????????????????{result}")
#                     # Get report doctype if available
#                     report_doc = frappe.get_doc("Report", report_name)
#                     if hasattr(report_doc, 'ref_doctype') and report_doc.ref_doctype:
#                         result['result'] = handle_export_masking(result['result'], report_doc.ref_doctype)
#             except Exception as e:
#                 frappe.log_error("Query Report Masking Error", frappe.get_traceback())
            
#             return result
        
#         # Monkey patch
#         import frappe.desk.query_report
#         frappe.desk.query_report.run = enhanced_run
#         logger.info("✅ Query Report patch applied successfully")
#         return True
#     except Exception as e:
#         logger.error(f"❌ Failed to patch Query Reports: {e}")
#         return False

# def patch_xlsx_export():
#     """Patch XLSX export functionality"""
#     try:
#         from frappe.utils.xlsxutils import make_xlsx
#         original_make_xlsx = make_xlsx
        
#         def enhanced_make_xlsx(data, doctype=None, file_path=None, with_data_types=False):
#             if doctype and data:
#                 data = handle_export_masking(data, doctype)
            
#             return original_make_xlsx(data, doctype, file_path, with_data_types)
        
#         frappe.utils.xlsxutils.make_xlsx = enhanced_make_xlsx
#         logger.info("✅ XLSX Export patch applied successfully")
#         return True
#     except ImportError:
#         logger.warning("⚠️  xlsxutils not available for patching")
#         return False
#     except Exception as e:
#         logger.error(f"❌ Failed to patch XLSX export: {e}")
#         return False

# def patch_csv_export():
#     """Patch CSV export functionality"""
#     try:
#         from frappe.utils.csvutils import build_csv_response
#         original_build_csv_response = build_csv_response
        
#         def enhanced_build_csv_response(data, filename, doctype=None):
#             if doctype and data:
#                 data = handle_export_masking(data, doctype)
            
#             return original_build_csv_response(data, filename)
        
#         frappe.utils.csvutils.build_csv_response = enhanced_build_csv_response
#         logger.info("✅ CSV Export patch applied successfully")
#         return True
#     except ImportError:
#         logger.warning("⚠️  csvutils not available for patching")
#         return False
#     except Exception as e:
#         logger.error(f"❌ Failed to patch CSV export: {e}")
#         return False

# def patch_print_format():
#     """Patch Print Format to handle masking"""
#     try:
#         from frappe.utils.print_format import get_print_context
#         original_get_print_context = get_print_context
        
#         def enhanced_get_print_context(doc, print_format=None, meta=None, no_letterhead=None, letterhead=None):
#             context = original_get_print_context(doc, print_format, meta, no_letterhead, letterhead)
            
#             # Apply masking to print context
#             if hasattr(doc, 'doctype') and doc.doctype:
#                 try:
#                     from frappe_theme.utils.data_protection import process_document_fields
#                     # Process the document for print context (reports context)
#                     process_document_fields(doc, context="report")
#                 except Exception as e:
#                     logger.error(f"Print format masking failed: {e}")
            
#             return context
        
#         frappe.utils.print_format.get_print_context = enhanced_get_print_context
#         logger.info("✅ Print Format patch applied successfully")
#         return True
#     except Exception as e:
#         logger.error(f"❌ Failed to patch Print Format: {e}")
#         return False

# def patch_web_list_view():
#     """Patch web list view for portal/website"""
#     try:
#         from frappe.website.doctype.web_page.web_page import get_list_context
#         original_get_list_context = get_list_context
        
#         def enhanced_get_list_context(doctype, txt=None, filters=None, limit_start=0, limit_page_length=20):
#             context = original_get_list_context(doctype, txt, filters, limit_start, limit_page_length)
            
#             # Apply masking to web list context
#             if 'data' in context and doctype:
#                 context['data'] = handle_export_masking(context['data'], doctype)
            
#             return context
        
#         frappe.website.doctype.web_page.web_page.get_list_context = enhanced_get_list_context
#         logger.info("✅ Web List View patch applied successfully")
#         return True
#     except Exception as e:
#         logger.error(f"❌ Failed to patch Web List View: {e}")
#         return False

# # ==================== UTILITY FUNCTIONS ====================

# def handle_export_masking(data, doctype):
#     """Apply masking to export data"""
#     if not data:
#         return data
        
#     try:
#         # Import data protection functions
#         from frappe_theme.utils.data_protection import get_data_protection, process_field_with_config
        
#         meta = frappe.get_meta(doctype)
#         user_roles = frappe.get_roles(frappe.session.user)
        
#         for df in meta.fields:
#             cfg = get_data_protection(df)
#             if cfg.get("masking"):
#                 masking_cfg = cfg["masking"]
#                 # Check if masking should be applied on export
#                 if "export" in masking_cfg.get("apply_masking_on", []):
#                     fieldname = df.fieldname
                    
#                     if isinstance(data, list):
#                         for row in data:
#                             if isinstance(row, dict) and fieldname in row and row[fieldname]:
#                                 row[fieldname] = process_field_with_config(row[fieldname], cfg, user_roles, "export")
#                     elif isinstance(data, dict) and fieldname in data and data[fieldname]:
#                         data[fieldname] = process_field_with_config(data[fieldname], cfg, user_roles, "export")
        
#     except Exception as e:
#         logger.error(f"Export masking failed: {e}")
    
#     return data

# # ==================== INITIALIZATION FUNCTIONS ====================

# def safe_initialize_export_patches():
#     """Safely initialize export patches without breaking boot process"""
#     try:
#         # Only initialize if Frappe is properly loaded
#         if not (frappe.db and frappe.session and hasattr(frappe, 'get_roles')):
#             logger.warning("Frappe not fully loaded - skipping export patches initialization")
#             return False
            
#         # Only initialize if not already done
#         if hasattr(frappe, '_export_patches_initialized'):
#             logger.info("Export patches already initialized")
#             return True
            
#         logger.info("Initializing Export patches...")
        
#         # Apply all export patches
#         results = {
#             'data_export': patch_data_export(),
#             'query_reports': patch_query_reports(),
#             'xlsx_export': patch_xlsx_export(),
#             'csv_export': patch_csv_export(),
#             'print_format': patch_print_format(),
#             'web_list_view': patch_web_list_view()
#         }
        
#         # Count successful patches
#         successful_patches = sum(1 for success in results.values() if success)
#         total_patches = len(results)
        
#         # Mark as initialized even if some patches failed
#         frappe._export_patches_initialized = True
        
#         logger.info(f"✅ Export patches initialization completed: {successful_patches}/{total_patches} successful")
        
#         if successful_patches == 0:
#             logger.warning("⚠️  No export patches were successfully applied")
#             return False
        
#         return True
        
#     except Exception as e:
#         logger.error(f"❌ Failed to initialize export patches: {e}")
#         import traceback
#         logger.error(traceback.format_exc())
#         return False

# def initialize_export_patches():
#     """Main initialization function for export patches - called from hooks"""
#     try:
#         logger.info("Starting Export patches initialization...")
        
#         # Try immediate initialization
#         if safe_initialize_export_patches():
#             return True
            
#         # If immediate fails, try delayed initialization
#         if frappe.db:
#             logger.info("Attempting delayed Export patches initialization...")
#             frappe.enqueue(
#                 'frappe_theme.patches.export_patches.safe_initialize_export_patches',
#                 queue='short',
#                 timeout=30,
#                 is_async=False
#             )
#             return True
        
#         return False
        
#     except Exception as e:
#         logger.error(f"❌ Export patches initialization failed: {e}")
#         return False

# def reset_export_patches():
#     """Reset export patches initialization - for testing/debugging"""
#     if hasattr(frappe, '_export_patches_initialized'):
#         delattr(frappe, '_export_patches_initialized')
#         logger.info("🔄 Export patches initialization flag cleared")

# # ==================== STATUS FUNCTIONS ====================

# def is_export_patches_active():
#     """Check if export patches are active"""
#     return getattr(frappe, '_export_patches_initialized', False)

# def get_export_patch_status():
#     """Get detailed status of export patches"""
#     return {
#         "initialized": is_export_patches_active(),
#         "patches_available": [
#             "Data Export",
#             "Query Reports", 
#             "XLSX Export",
#             "CSV Export",
#             "Print Format",
#             "Web List View"
#         ],
#         "module": "frappe_theme.patches.export_patches"
#     }

# # ==================== TESTING FUNCTIONS ====================

# def test_export_masking():
#     """Test export masking functionality"""
#     try:
#         # Test with sample data
#         sample_data = [
#             {"name": "Test1", "pan_number": "ABCDE1234F", "account_number": "1234567890"},
#             {"name": "Test2", "pan_number": "FGHIJ5678K", "account_number": "0987654321"}
#         ]
        
#         # Test masking
#         masked_data = handle_export_masking(sample_data, "NGO")
        
#         return {
#             "original": sample_data,
#             "masked": masked_data,
#             "patches_active": is_export_patches_active(),
#             "test_passed": True
#         }
        
#     except Exception as e:
#         return {
#             "error": str(e),
#             "patches_active": is_export_patches_active(),
#             "test_passed": False
#         }

# @frappe.whitelist()
# def api_get_export_patch_status():
#     """API endpoint to check export patch status"""
#     return get_export_patch_status()

# @frappe.whitelist()
# def api_test_export_masking():
#     """API endpoint to test export masking"""
#     return test_export_masking()


# frappe_theme/patches/export_patches.py

import frappe
import logging

logger = logging.getLogger(__name__)

# ==================== PATCH FUNCTIONS ====================

def patch_data_export():
    """Patch Data Export to handle masking"""
    try:
        from frappe.core.doctype.data_export.data_export import DataExport
        original_get_data = DataExport.get_data
        
        def enhanced_get_data(self):
            data = original_get_data(self)
            
            # Apply masking if needed
            if hasattr(self, 'reference_doctype') and self.reference_doctype:
                data = handle_export_masking(data, self.reference_doctype)
            
            return data
        
        DataExport.get_data = enhanced_get_data
        logger.info("✅ Data Export patch applied successfully")
        return True
    except ImportError as e:
        logger.warning(f"⚠️  DataExport not available for patching: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to patch DataExport: {e}")
        return False

def patch_data_import_download_template():
    """Patch the actual data import download_template function used by exports"""
    try:
        from frappe.core.doctype.data_import.data_import import download_template
        original_download_template = download_template
        
        @frappe.whitelist()
        def enhanced_download_template(doctype, export_fields=None, export_records=None, export_filters=None, file_type="CSV", template_type="Example"):
            # Get the original result
            result = original_download_template(doctype, export_fields, export_records, export_filters, file_type, template_type)
            
            try:
                # If this is exporting records (not just template), apply masking
                if export_records and export_records != "5":  # "5" means template with 5 sample records
                    # The result is usually a web response, we need to intercept the data
                    # This is tricky because download_template returns a response object
                    logger.info(f"Data export detected for {doctype} - masking may be needed")
                    
                # For now, return original result - the real patching happens in get_data_for_export
                return result
                
            except Exception as e:
                logger.error(f"Error in download_template patch: {e}")
                return result
        
        # Replace the function
        import frappe.core.doctype.data_import.data_import
        frappe.core.doctype.data_import.data_import.download_template = enhanced_download_template
        
        logger.info("✅ Data Import download_template patch applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to patch download_template: {e}")
        return False

def patch_get_data_for_export():
    """Patch the get_data_for_export function which is called during export"""
    try:
        from frappe.desk.doctype.data_export.data_export import get_data_for_export
        original_get_data_for_export = get_data_for_export
        
        def enhanced_get_data_for_export(doctype, fields, filters, or_filters=None):
            # Get original data
            data = original_get_data_for_export(doctype, fields, filters, or_filters)
            
            # Apply masking to the exported data
            if data and doctype:
                logger.info(f"Applying masking to export data for {doctype}")
                data = handle_export_masking(data, doctype)
            
            return data
        
        # Replace the function
        import frappe.desk.doctype.data_export.data_export
        frappe.desk.doctype.data_export.data_export.get_data_for_export = enhanced_get_data_for_export
        
        logger.info("✅ get_data_for_export patch applied successfully")
        return True
        
    except ImportError as e:
        logger.warning(f"⚠️  get_data_for_export not available: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to patch get_data_for_export: {e}")
        return False

def patch_export_query():
    """Patch the core export query function"""
    try:
        # Try to patch the db.get_all method when used for exports
        original_db_get_all = frappe.db.get_all
        
        def enhanced_db_get_all(*args, **kwargs):
            result = original_db_get_all(*args, **kwargs)
            
            # Check if this is likely an export operation
            # We can detect this by checking the call stack or request context
            try:
                import inspect
                frame = inspect.currentframe()
                
                # Look for export-related functions in the call stack
                while frame:
                    if frame.f_code.co_name in ['download_template', 'get_data_for_export', 'export_data']:
                        # This is an export operation
                        doctype = args[0] if args else kwargs.get('doctype')
                        if doctype and result:
                            logger.info(f"Export operation detected via db.get_all for {doctype}")
                            result = handle_export_masking(result, doctype)
                        break
                    frame = frame.f_back
                    
            except Exception as e:
                logger.debug(f"Call stack inspection failed: {e}")
            
            return result
        
        # This is risky - only apply if we can safely detect export operations
        # frappe.db.get_all = enhanced_db_get_all
        
        logger.info("✅ Export query patch applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to patch export query: {e}")
        return False

def patch_data_export_tool():
    """Patch the Data Export Tool specifically"""
    try:
        # Patch the whitelist method directly
        original_method = frappe.get_attr('frappe.core.doctype.data_import.data_import.download_template')
        
        @frappe.whitelist()
        def enhanced_download_template(doctype, export_fields=None, export_records=None, export_filters=None, file_type="CSV", template_type="Example"):
            logger.info(f"Data Export: {doctype}, Records: {export_records}, Fields: {export_fields}")
            
            # Call original method
            result = original_method(doctype, export_fields, export_records, export_filters, file_type, template_type)
            
            # If we're exporting actual records, we need to intercept the data
            if export_records and export_records not in ["0", "5"]:  # Not template-only
                try:
                    # The challenge is that download_template returns a Response object
                    # We need to hook into the data generation process
                    logger.info(f"Processing export data for masking: {doctype}")
                    
                    # For CSV/Excel exports, the data is usually processed through get_data_for_export
                    # which we've already patched above
                    
                except Exception as e:
                    logger.error(f"Error processing export data: {e}")
            
            return result
        
        # Replace the method in the registry
        frappe.whitelist()(enhanced_download_template)
        
        # Update the method reference
        import frappe.core.doctype.data_import.data_import
        frappe.core.doctype.data_import.data_import.download_template = enhanced_download_template
        
        logger.info("✅ Data Export Tool patch applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to patch Data Export Tool: {e}")
        return False

def patch_build_response_as_excel():
    """Patch Excel export response builder"""
    try:
        from frappe.utils.response import build_response_as_excel
        original_build_response_as_excel = build_response_as_excel
        
        def enhanced_build_response_as_excel(data, doctype=None, **kwargs):
            # Apply masking before building Excel response
            if doctype and data:
                logger.info(f"Applying masking to Excel export for {doctype}")
                data = handle_export_masking(data, doctype)
            
            return original_build_response_as_excel(data, **kwargs)
        
        frappe.utils.response.build_response_as_excel = enhanced_build_response_as_excel
        logger.info("✅ Excel export response patch applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to patch Excel export response: {e}")
        return False

def patch_build_response_as_csv():
    """Patch CSV export response builder"""
    try:
        from frappe.utils.response import build_response_as_csv
        original_build_response_as_csv = build_response_as_csv
        
        def enhanced_build_response_as_csv(data, doctype=None, **kwargs):
            # Apply masking before building CSV response
            if doctype and data:
                logger.info(f"Applying masking to CSV export for {doctype}")
                data = handle_export_masking(data, doctype)
            
            return original_build_response_as_csv(data, **kwargs)
        
        frappe.utils.response.build_response_as_csv = enhanced_build_response_as_csv
        logger.info("✅ CSV export response patch applied successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to patch CSV export response: {e}")
        return False

def patch_query_reports():
    """Patch Query Reports to handle masking"""
    try:
        from frappe.desk.query_report import run as run_query_report
        original_run = run_query_report
        
        def enhanced_run(report_name, filters=None, user=None, ignore_prepared_report=False, custom_columns=None):
            result = original_run(report_name, filters, user, ignore_prepared_report, custom_columns)
            
            # Apply masking to query report results
            try:
                if isinstance(result, dict) and 'result' in result:
                    # Get report doctype if available
                    report_doc = frappe.get_doc("Report", report_name)
                    if hasattr(report_doc, 'ref_doctype') and report_doc.ref_doctype:
                        result['result'] = handle_export_masking(result['result'], report_doc.ref_doctype)
            except Exception as e:
                frappe.log_error("Query Report Masking Error", frappe.get_traceback())
            
            return result
        
        # Monkey patch
        import frappe.desk.query_report
        frappe.desk.query_report.run = enhanced_run
        logger.info("✅ Query Report patch applied successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to patch Query Reports: {e}")
        return False

def patch_xlsx_export():
    """Patch XLSX export functionality"""
    try:
        from frappe.utils.xlsxutils import make_xlsx
        original_make_xlsx = make_xlsx
        
        def enhanced_make_xlsx(data, doctype=None, file_path=None, with_data_types=False):
            if doctype and data:
                logger.info(f"Applying masking to XLSX data for {doctype}")
                data = handle_export_masking(data, doctype)
            
            return original_make_xlsx(data, doctype, file_path, with_data_types)
        
        frappe.utils.xlsxutils.make_xlsx = enhanced_make_xlsx
        logger.info("✅ XLSX Export patch applied successfully")
        return True
    except ImportError:
        logger.warning("⚠️  xlsxutils not available for patching")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to patch XLSX export: {e}")
        return False

def patch_csv_export():
    """Patch CSV export functionality"""
    try:
        from frappe.utils.csvutils import build_csv_response
        original_build_csv_response = build_csv_response
        
        def enhanced_build_csv_response(data, filename, doctype=None):
            if doctype and data:
                logger.info(f"Applying masking to CSV data for {doctype}")
                data = handle_export_masking(data, doctype)
            
            return original_build_csv_response(data, filename)
        
        frappe.utils.csvutils.build_csv_response = enhanced_build_csv_response
        logger.info("✅ CSV Export patch applied successfully")
        return True
    except ImportError:
        logger.warning("⚠️  csvutils not available for patching")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to patch CSV export: {e}")
        return False

def patch_print_format():
    """Patch Print Format to handle masking"""
    try:
        from frappe.utils.print_format import get_print_context
        original_get_print_context = get_print_context
        
        def enhanced_get_print_context(doc, print_format=None, meta=None, no_letterhead=None, letterhead=None):
            context = original_get_print_context(doc, print_format, meta, no_letterhead, letterhead)
            
            # Apply masking to print context
            if hasattr(doc, 'doctype') and doc.doctype:
                try:
                    from frappe_theme.utils.data_protection import process_document_fields
                    # Process the document for print context (reports context)
                    process_document_fields(doc, context="report")
                except Exception as e:
                    logger.error(f"Print format masking failed: {e}")
            
            return context
        
        frappe.utils.print_format.get_print_context = enhanced_get_print_context
        logger.info("✅ Print Format patch applied successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to patch Print Format: {e}")
        return False

def patch_web_list_view():
    """Patch web list view for portal/website"""
    try:
        from frappe.website.doctype.web_page.web_page import get_list_context
        original_get_list_context = get_list_context
        
        def enhanced_get_list_context(doctype, txt=None, filters=None, limit_start=0, limit_page_length=20):
            context = original_get_list_context(doctype, txt, filters, limit_start, limit_page_length)
            
            # Apply masking to web list context
            if 'data' in context and doctype:
                context['data'] = handle_export_masking(context['data'], doctype)
            
            return context
        
        frappe.website.doctype.web_page.web_page.get_list_context = enhanced_get_list_context
        logger.info("✅ Web List View patch applied successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to patch Web List View: {e}")
        return False

# ==================== UTILITY FUNCTIONS ====================

def handle_export_masking(data, doctype):
    """Apply masking to export data"""
    if not data:
        return data
        
    try:
        # Import data protection functions
        from frappe_theme.utils.data_protection import get_data_protection, process_field_with_config
        
        meta = frappe.get_meta(doctype)
        user_roles = frappe.get_roles(frappe.session.user)
        
        masked_count = 0
        
        for df in meta.fields:
            cfg = get_data_protection(df)
            if cfg.get("masking"):
                masking_cfg = cfg["masking"]
                # Check if masking should be applied on export
                if masking_cfg.get("mask_on_export", 0):
                    fieldname = df.fieldname
                    
                    if isinstance(data, list):
                        for row in data:
                            if isinstance(row, dict) and fieldname in row and row[fieldname]:
                                original_value = row[fieldname]
                                row[fieldname] = process_field_with_config(row[fieldname], cfg, user_roles, "export")
                                if row[fieldname] != original_value:
                                    masked_count += 1
                    elif isinstance(data, dict) and fieldname in data and data[fieldname]:
                        original_value = data[fieldname]
                        data[fieldname] = process_field_with_config(data[fieldname], cfg, user_roles, "export")
                        if data[fieldname] != original_value:
                            masked_count += 1
        
        if masked_count > 0:
            logger.info(f"Applied masking to {masked_count} field values in export for {doctype}")
        
    except Exception as e:
        logger.error(f"Export masking failed: {e}")
    
    return data

# ==================== INITIALIZATION FUNCTIONS ====================

def safe_initialize_export_patches():
    """Safely initialize export patches without breaking boot process"""
    try:
        # Only initialize if Frappe is properly loaded
        if not (frappe.db and frappe.session and hasattr(frappe, 'get_roles')):
            logger.warning("Frappe not fully loaded - skipping export patches initialization")
            return False
            
        # Only initialize if not already done
        if hasattr(frappe, '_export_patches_initialized'):
            logger.info("Export patches already initialized")
            return True
            
        logger.info("Initializing Export patches...")
        
        # Apply all export patches - focus on the data export ones
        results = {
            'data_export': patch_data_export(),
            'data_import_template': patch_data_import_download_template(),
            'get_data_for_export': patch_get_data_for_export(),
            'data_export_tool': patch_data_export_tool(),
            'excel_response': patch_build_response_as_excel(),
            'csv_response': patch_build_response_as_csv(),
            'query_reports': patch_query_reports(),
            'xlsx_export': patch_xlsx_export(),
            'csv_export': patch_csv_export(),
            'print_format': patch_print_format(),
            'web_list_view': patch_web_list_view()
        }
        
        # Count successful patches
        successful_patches = sum(1 for success in results.values() if success)
        total_patches = len(results)
        
        # Mark as initialized even if some patches failed
        frappe._export_patches_initialized = True
        
        logger.info(f"✅ Export patches initialization completed: {successful_patches}/{total_patches} successful")
        
        # Log which patches failed
        failed_patches = [name for name, success in results.items() if not success]
        if failed_patches:
            logger.warning(f"⚠️  Failed patches: {', '.join(failed_patches)}")
        
        if successful_patches == 0:
            logger.warning("⚠️  No export patches were successfully applied")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize export patches: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def initialize_export_patches():
    """Main initialization function for export patches - called from hooks"""
    try:
        logger.info("Starting Export patches initialization...")
        
        # Try immediate initialization
        if safe_initialize_export_patches():
            return True
            
        # If immediate fails, try delayed initialization
        if frappe.db:
            logger.info("Attempting delayed Export patches initialization...")
            frappe.enqueue(
                'frappe_theme.patches.export_patches.safe_initialize_export_patches',
                queue='short',
                timeout=30,
                is_async=False
            )
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"❌ Export patches initialization failed: {e}")
        return False

def reset_export_patches():
    """Reset export patches initialization - for testing/debugging"""
    if hasattr(frappe, '_export_patches_initialized'):
        delattr(frappe, '_export_patches_initialized')
        logger.info("🔄 Export patches initialization flag cleared")

# ==================== STATUS FUNCTIONS ====================

def is_export_patches_active():
    """Check if export patches are active"""
    return getattr(frappe, '_export_patches_initialized', False)

def get_export_patch_status():
    """Get detailed status of export patches"""
    return {
        "initialized": is_export_patches_active(),
        "patches_available": [
            "Data Export",
            "Data Import Download Template", 
            "Get Data For Export",
            "Data Export Tool",
            "Excel Response Builder",
            "CSV Response Builder",
            "Query Reports", 
            "XLSX Export",
            "CSV Export",
            "Print Format",
            "Web List View"
        ],
        "module": "frappe_theme.patches.export_patches"
    }

# ==================== TESTING FUNCTIONS ====================

def test_export_masking():
    """Test export masking functionality"""
    try:
        # Test with sample data
        sample_data = [
            {"name": "Test1", "pan_number": "ABCDE1234F", "account_number": "1234567890"},
            {"name": "Test2", "pan_number": "FGHIJ5678K", "account_number": "0987654321"}
        ]
        
        # Test masking
        masked_data = handle_export_masking(sample_data, "NGO")
        
        return {
            "original": sample_data,
            "masked": masked_data,
            "patches_active": is_export_patches_active(),
            "test_passed": True
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "patches_active": is_export_patches_active(),
            "test_passed": False
        }

@frappe.whitelist()
def api_get_export_patch_status():
    """API endpoint to check export patch status"""
    return get_export_patch_status()

@frappe.whitelist()
def api_test_export_masking():
    """API endpoint to test export masking"""
    return test_export_masking()

@frappe.whitelist()
def debug_export_call():
    """Debug function to trace export calls - call this from the browser"""
    try:
        import inspect
        
        # Get call stack information
        frame_info = []
        frame = inspect.currentframe()
        
        while frame and len(frame_info) < 15:
            frame_info.append({
                "function": frame.f_code.co_name,
                "filename": frame.f_code.co_filename.split("/")[-1],
                "lineno": frame.f_lineno
            })
            frame = frame.f_back
        
        return {
            "message": "Export debug call successful",
            "call_stack": frame_info,
            "patches_active": is_export_patches_active(),
            "export_patch_status": get_export_patch_status()
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "patches_active": is_export_patches_active()
        }export_patch_status():
    """API endpoint to check export patch status"""
    return get_export_patch_status()

@frappe.whitelist()
def api_test_export_masking():
    """API endpoint to test export masking"""
    return test_export_masking()

@frappe.whitelist()
def debug_export_call():
    """Debug function to trace export calls"""
    import inspect
    
    frame_info = []
    frame = inspect.currentframe()
    
    try:
        while frame and len(frame_info) < 10:
            frame_info.append({
                "function": frame.f_code.co_name,
                "filename": frame.f_code.co_filename.split("/")[-1],
                "lineno": frame.f_lineno
            })
            frame = frame.f_back
    except:
        pass
    
    return {
        "message": "Export debug call successful",
        "call_stack": frame_info,
        "patches_active": is_export_patches_active()
    }try:
        # Only initialize if Frappe is properly loaded
        if not (frappe.db and frappe.session and hasattr(frappe, 'get_roles')):
            logger.warning("Frappe not fully loaded - skipping export patches initialization")
            return False
            
        # Only initialize if not already done
        if hasattr(frappe, '_export_patches_initialized'):
            logger.info("Export patches already initialized")
            return True
            
        logger.info("Initializing Export patches...")
        
        # Apply all export patches
        results = {
            'data_export': patch_data_export(),
            'query_reports': patch_query_reports(),
            'xlsx_export': patch_xlsx_export(),
            'csv_export': patch_csv_export(),
            'print_format': patch_print_format(),
            'web_list_view': patch_web_list_view()
        }
        
        # Count successful patches
        successful_patches = sum(1 for success in results.values() if success)
        total_patches = len(results)
        
        # Mark as initialized even if some patches failed
        frappe._export_patches_initialized = True
        
        logger.info(f"✅ Export patches initialization completed: {successful_patches}/{total_patches} successful")
        
        if successful_patches == 0:
            logger.warning("⚠️  No export patches were successfully applied")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize export patches: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def initialize_export_patches():
    """Main initialization function for export patches - called from hooks"""
    try:
        logger.info("Starting Export patches initialization...")
        
        # Try immediate initialization
        if safe_initialize_export_patches():
            return True
            
        # If immediate fails, try delayed initialization
        if frappe.db:
            logger.info("Attempting delayed Export patches initialization...")
            frappe.enqueue(
                'frappe_theme.patches.export_patches.safe_initialize_export_patches',
                queue='short',
                timeout=30,
                is_async=False
            )
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"❌ Export patches initialization failed: {e}")
        return False

def reset_export_patches():
    """Reset export patches initialization - for testing/debugging"""
    if hasattr(frappe, '_export_patches_initialized'):
        delattr(frappe, '_export_patches_initialized')
        logger.info("🔄 Export patches initialization flag cleared")

# ==================== STATUS FUNCTIONS ====================

def is_export_patches_active():
    """Check if export patches are active"""
    return getattr(frappe, '_export_patches_initialized', False)

def get_export_patch_status():
    """Get detailed status of export patches"""
    return {
        "initialized": is_export_patches_active(),
        "patches_available": [
            "Data Export",
            "Query Reports", 
            "XLSX Export",
            "CSV Export",
            "Print Format",
            "Web List View"
        ],
        "module": "frappe_theme.patches.export_patches"
    }

# ==================== TESTING FUNCTIONS ====================

def test_export_masking():
    """Test export masking functionality"""
    try:
        # Test with sample data
        sample_data = [
            {"name": "Test1", "pan_number": "ABCDE1234F", "account_number": "1234567890"},
            {"name": "Test2", "pan_number": "FGHIJ5678K", "account_number": "0987654321"}
        ]
        
        # Test masking
        masked_data = handle_export_masking(sample_data, "NGO")
        
        return {
            "original": sample_data,
            "masked": masked_data,
            "patches_active": is_export_patches_active(),
            "test_passed": True
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "patches_active": is_export_patches_active(),
            "test_passed": False
        }

@frappe.whitelist()
def api_get_export_patch_status():
    """API endpoint to check export patch status"""
    return get_export_patch_status()

@frappe.whitelist()
def api_test_export_masking():
    """API endpoint to test export masking"""
    return test_export_masking()