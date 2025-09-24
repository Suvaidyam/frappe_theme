import json
import frappe
import logging
from cryptography.fernet import Fernet, InvalidToken
from frappe.desk import reportview
from frappe.model.document import Document

logger = logging.getLogger(__name__)

# ==================== DOCUMENT HOOKS ====================

@frappe.whitelist()
def encrypt_doc_fields(doc, method=None):
    """Encrypt fields before saving"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val and not is_encrypted(val):
                doc.set(df.fieldname, encrypt_value(val))

@frappe.whitelist()
def decrypt_doc_fields(doc, method=None):
    """Decrypt fields after loading - for single document view"""
    for df in doc.meta.fields:
        cfg = get_data_protection(df)
        if cfg.get("encrypt"):
            val = doc.get(df.fieldname)
            if val and is_encrypted(val):
                doc.set(df.fieldname, decrypt_value(val))

# ==================== LIST VIEW HANDLING ====================

@frappe.whitelist()
def mask_doc_list_view(*args, **kwargs):
    """Enhanced wrapper for list view with decryption + masking"""
    result = reportview.get(*args, **kwargs)
    
    try:
        if isinstance(result, dict) and "keys" in result and "values" in result:
            doctype = kwargs.get("doctype") or (args[0] if args else None)
            if doctype:
                meta = frappe.get_meta(doctype)
                user_roles = frappe.get_roles(frappe.session.user)

                # Find fields that need processing
                processing_fields = []
                for idx, fieldname in enumerate(result["keys"]):
                    df = meta.get_field(fieldname)
                    if not df:
                        continue
                    cfg = get_data_protection(df)
                    if cfg.get("encrypt") or (cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", [])):
                        processing_fields.append((idx, cfg, fieldname))

                # Process each row
                for row in result["values"]:
                    for idx, cfg, fieldname in processing_fields:
                        if idx < len(row) and row[idx]:
                            # Step 1: Decrypt if needed
                            value = row[idx]
                            if cfg.get("encrypt") and is_encrypted(value):
                                value = decrypt_value(value)
                            
                            # Step 2: Apply masking if configured
                            if cfg.get("masking") and "list" in cfg["masking"].get("apply_masking_on", []):
                                value = mask_value(value, cfg, user_roles)
                            
                            row[idx] = value

    except Exception as e:
        frappe.log_error("List Processing Error", frappe.get_traceback())
        logger.error(f"List processing failed: {e}")
    
    return result

# ==================== API METHOD OVERRIDES ====================

def patch_get_value():
    """Patch frappe.get_value to handle decryption + masking"""
    original_get_value = frappe.get_value
    
    def enhanced_get_value(*args, **kwargs):
        try:
            result = original_get_value(*args, **kwargs)
            
            # Extract doctype and fieldname from arguments
            doctype = args[0] if args else kwargs.get('doctype')
            fieldname = args[2] if len(args) > 2 else kwargs.get('fieldname', 'name')
            
            if not doctype or not result:
                return result
            
            # Handle single field result
            if isinstance(fieldname, str) and fieldname != "name":
                try:
                    meta = frappe.get_meta(doctype)
                    df = meta.get_field(fieldname)
                    if df:
                        result = process_field_value(result, df, context="api")
                except Exception as e:
                    logger.error(f"Error processing field {fieldname} in get_value: {e}")
            
            # Handle multiple fields result (dict or list)
            elif isinstance(result, (dict, list)) and fieldname != "name":
                try:
                    meta = frappe.get_meta(doctype)
                    user_roles = frappe.get_roles(frappe.session.user)
                    
                    if isinstance(result, dict):
                        for field, value in result.items():
                            if value:
                                df = meta.get_field(field)
                                if df:
                                    result[field] = process_field_value(value, df, user_roles, context="api")
                    
                    elif isinstance(result, list):
                        for item in result:
                            if isinstance(item, dict):
                                for field, value in item.items():
                                    if value:
                                        df = meta.get_field(field)
                                        if df:
                                            item[field] = process_field_value(value, df, user_roles, context="api")
                except Exception as e:
                    logger.error(f"Error processing multiple fields in get_value: {e}")
            
            return result
            
        except Exception as e:
            # If our patch fails, return original result to avoid breaking functionality
            logger.error(f"Enhanced get_value patch failed: {e}")
            return original_get_value(*args, **kwargs)
    
    frappe.get_value = enhanced_get_value

def patch_get_all():
    """Patch frappe.get_all to handle decryption + masking"""
    original_get_all = frappe.get_all
    
    def enhanced_get_all(*args, **kwargs):
        try:
            result = original_get_all(*args, **kwargs)
            
            # Extract doctype and fields from arguments
            doctype = args[0] if args else kwargs.get('doctype')
            fields = args[1] if len(args) > 1 else kwargs.get('fields')
            
            if not result or not fields or not doctype:
                return result
            
            try:
                meta = frappe.get_meta(doctype)
                user_roles = frappe.get_roles(frappe.session.user)
                
                # Determine which fields need processing
                fields_to_process = []
                if isinstance(fields, list):
                    for field in fields:
                        field_name = field.split(" as ")[0].strip() if " as " in field else field
                        df = meta.get_field(field_name)
                        if df:
                            cfg = get_data_protection(df)
                            if cfg.get("encrypt") or (cfg.get("masking") and "api" in cfg["masking"].get("apply_masking_on", [])):
                                fields_to_process.append((field_name, cfg))
                
                # Process results
                for item in result:
                    if isinstance(item, dict):
                        for field_name, cfg in fields_to_process:
                            if field_name in item and item[field_name]:
                                item[field_name] = process_field_with_config(item[field_name], cfg, user_roles, context="api")
            
            except Exception as e:
                logger.error(f"Error processing get_all results: {e}")
            
            return result
            
        except Exception as e:
            # If our patch fails, return original result
            logger.error(f"Enhanced get_all patch failed: {e}")
            return original_get_all(*args, **kwargs)
    
    frappe.get_all = enhanced_get_all

def patch_get_doc():
    """Patch frappe.get_doc to handle decryption + masking"""
    original_get_doc = frappe.get_doc
    
    def enhanced_get_doc(*args, **kwargs):
        # Handle different call patterns for get_doc
        doc = original_get_doc(*args, **kwargs)
        
        # Determine context for masking
        context = determine_context()
        
        # Process document fields
        process_document_fields(doc, context)
        
        return doc
    
    frappe.get_doc = enhanced_get_doc

def patch_as_dict():
    """Patch Document.as_dict to handle masking"""
    original_as_dict = Document.as_dict
    
    def enhanced_as_dict(self, *args, **kwargs):
        # Call original method with all arguments
        result = original_as_dict(self, *args, **kwargs)
        
        # Apply masking for API/form contexts
        try:
            user_roles = frappe.get_roles(frappe.session.user)
            context = determine_context()
            
            for df in self.meta.fields:
                cfg = get_data_protection(df)
                if cfg.get("masking") and df.fieldname in result and result[df.fieldname]:
                    masking_cfg = cfg["masking"]
                    contexts = masking_cfg.get("apply_masking_on", [])
                    
                    if context in contexts:
                        result[df.fieldname] = mask_value(result[df.fieldname], cfg, user_roles)
                        
        except Exception as e:
            # Don't break the as_dict functionality if masking fails
            logger.error(f"Masking in as_dict failed: {e}")
        
        return result
    
    Document.as_dict = enhanced_as_dict

# ==================== UTILITY FUNCTIONS ====================

def process_field_value(value, df, user_roles=None, context="api"):
    """Process a single field value (decrypt + mask)"""
    cfg = get_data_protection(df)
    return process_field_with_config(value, cfg, user_roles or frappe.get_roles(frappe.session.user), context)

def process_field_with_config(value, cfg, user_roles, context="api"):
    """Process field value with given config"""
    if not value:
        return value
    
    processed_value = value
    
    # Step 1: Decrypt if needed
    if cfg.get("encrypt") and is_encrypted(processed_value):
        processed_value = decrypt_value(processed_value)
    
    # Step 2: Apply masking if configured
    if cfg.get("masking"):
        masking_cfg = cfg["masking"]
        contexts = masking_cfg.get("apply_masking_on", [])
        if context in contexts:
            processed_value = mask_value(processed_value, cfg, user_roles)
    
    return processed_value

def process_document_fields(doc, context="form"):
    """Process all fields in a document for encryption/masking"""
    if not (hasattr(doc, 'meta') and hasattr(doc.meta, 'fields')):
        return doc
    
    try:
        user_roles = frappe.get_roles(frappe.session.user)
        
        for df in doc.meta.fields:
            cfg = get_data_protection(df)
            if not (cfg.get("encrypt") or cfg.get("masking")):
                continue
                
            val = doc.get(df.fieldname)
            if not val:
                continue
                
            processed_val = process_field_with_config(val, cfg, user_roles, context)
            
            if processed_val != val:
                doc.set(df.fieldname, processed_val)
                
    except Exception as e:
        logger.error(f"Document field processing failed: {e}")
    
    return doc

def is_encrypted(value):
    """Check if value is encrypted (Fernet tokens start with 'gAAAA')"""
    return isinstance(value, str) and value.startswith("gAAAA")

def determine_context():
    """Determine the current context (form, api, list, etc.)"""
    try:
        if frappe.request and frappe.request.path:
            path = frappe.request.path
            if "/api/" in path:
                return "api"
            elif "/desk" in path or "/app" in path:
                if "listview" in path or "list" in path:
                    return "list"
                return "form"
        return "form"  # Default fallback
    except:
        return "form"

# ==================== EXISTING FUNCTIONS (ENHANCED) ====================

@frappe.whitelist()
def get_data_protection(field):
    """Load data_protection config from field meta"""
    cfg = getattr(field, "data_protection", None)
    if not cfg:
        return {}
    try:
        if isinstance(cfg, str):
            return json.loads(cfg)
        return cfg
    except Exception as e:
        logger.error(f"Invalid data_protection JSON for field {field.fieldname}: {e}")
        return {}

@frappe.whitelist()
def get_cipher():
    """Get Fernet cipher using site_config.json 'encryption_key'"""
    key = frappe.conf.get("encryption_key")
    if not key:
        raise RuntimeError("Encryption key not found in site_config.json")
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"Invalid encryption key: {e}")

@frappe.whitelist()
def encrypt_value(value):
    """Encrypt value using Fernet"""
    if not value:
        return value
    try:
        cipher = get_cipher()
        return cipher.encrypt(str(value).encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return value

@frappe.whitelist()
def decrypt_value(value):
    """Decrypt value using Fernet"""
    if not value or not is_encrypted(value):
        return value
    try:
        cipher = get_cipher()
        return cipher.decrypt(value.encode()).decode()
    except InvalidToken:
        logger.warning(f"Invalid token during decryption, returning original value")
        return value
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return value

@frappe.whitelist()
def mask_value(value, cfg, user_roles):
    """Apply masking based on config"""
    if not value or not cfg.get("masking"):
        return value

    m = cfg["masking"]

    # Role-based unmask
    allowed_roles = m.get("role_based_unmask", [])
    if any(role in user_roles for role in allowed_roles):
        return value

    char = m.get("masking_character", "X")
    strategy = m.get("masking_strategy", "full").lower()
    
    try:
        value_str = str(value)
        
        if strategy == "full":
            return char * len(value_str)

        elif strategy == "partial":
            prefix = int(m.get("visible_prefix", 0))
            suffix = int(m.get("visible_suffix", 0))
            if prefix + suffix >= len(value_str):
                return char * len(value_str)
            middle_length = len(value_str) - prefix - suffix
            return value_str[:prefix] + (char * middle_length) + value_str[-suffix:]

        elif strategy == "regex":
            import re
            pattern = m.get("pattern", r".")
            masked_value = re.sub(pattern, char, value_str)
            return masked_value if masked_value != value_str else char * len(value_str)

        elif strategy == "custom":
            func_path = m.get("custom_function")
            if func_path:
                try:
                    fn = frappe.get_attr(func_path)
                    return fn(value_str, char)
                except Exception as e:
                    logger.error(f"Custom masking failed: {e}")
                    return char * len(value_str)
            else:
                return char * len(value_str)

        else:
            return char * len(value_str)

    except Exception as e:
        logger.error(f"Masking failed: {e}")
        return char * len(str(value))

# ==================== EXPORT HANDLING ====================

# ==================== EXPORT HANDLING (Moved to separate file) ====================

# Export handling functions have been moved to:
# frappe_theme/patches/export_patches.py

# Legacy function for backward compatibility
def handle_export_masking(data, doctype):
    """Legacy function - now handled by export_patches.py"""
    try:
        from frappe_theme.patches.export_patches import handle_export_masking as new_handle_export_masking
        return new_handle_export_masking(data, doctype)
    except ImportError:
        logger.warning("Export patches not available - skipping export masking")
        return data

# ==================== INITIALIZATION ====================

def safe_initialize_data_protection():
    """Safely initialize core data protection patches without breaking boot process"""
    try:
        # Only initialize if Frappe is properly loaded
        if not (frappe.db and frappe.session and hasattr(frappe, 'get_roles')):
            logger.warning("Frappe not fully loaded - skipping data protection initialization")
            return False
            
        # Only initialize if not already done
        if hasattr(frappe, '_data_protection_initialized'):
            logger.info("Data Protection core patches already initialized")
            return True
            
        logger.info("Initializing Data Protection core patches...")
        
        # Apply core patches
        patch_get_value()
        patch_get_all()
        patch_get_doc()
        patch_as_dict()
        
        # Mark as initialized
        frappe._data_protection_initialized = True
        logger.info("✅ Data Protection core patches initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize data protection core patches: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def initialize_data_protection():
    """Main initialization function for core data protection - called from hooks"""
    try:
        logger.info("Starting Data Protection core initialization...")
        
        # Try immediate initialization
        if safe_initialize_data_protection():
            return True
            
        # If immediate fails, try delayed initialization
        if frappe.db:
            logger.info("Attempting delayed Data Protection initialization...")
            frappe.enqueue(
                'frappe_theme.utils.data_protection.safe_initialize_data_protection',
                queue='short',
                timeout=30,
                is_async=False
            )
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"❌ Data protection core initialization failed: {e}")
        return False

def reset_data_protection():
    """Reset data protection initialization - for testing/debugging"""
    if hasattr(frappe, '_data_protection_initialized'):
        delattr(frappe, '_data_protection_initialized')
        logger.info("🔄 Data Protection initialization flag cleared")

# Utility function to check if core patches are active
def is_data_protection_active():
    """Check if core data protection patches are active"""
    return getattr(frappe, '_data_protection_initialized', False)

def get_data_protection_status():
    """Get detailed status of data protection core"""
    return {
        "initialized": is_data_protection_active(),
        "patches_applied": [
            "get_value",
            "get_all", 
            "get_doc",
            "as_dict"
        ],
        "module": "frappe_theme.utils.data_protection"
    }

# ==================== TESTING API ====================

@frappe.whitelist()
def testing_api():
    """Enhanced test API to verify encryption/decryption/masking across all methods"""
    docs = frappe.get_all("NGO", fields=["name", "pan_number", "account_number"], limit=2)
    results = []
    
    for doc_info in docs:
        doc_name = doc_info.name
        
        # Test different methods
        test_result = {
            "name": doc_name,
            "methods": {}
        }
        
        # Test get_value
        try:
            pan_from_get_value = frappe.get_value("NGO", doc_name, "pan_number")
            account_from_get_value = frappe.get_value("NGO", doc_name, "account_number")
            test_result["methods"]["get_value"] = {
                "pan_number": pan_from_get_value,
                "account_number": account_from_get_value
            }
        except Exception as e:
            test_result["methods"]["get_value"] = {"error": str(e)}
        
        # Test get_all
        try:
            from_get_all = frappe.get_all("NGO", 
                                        fields=["pan_number", "account_number"], 
                                        filters={"name": doc_name}, 
                                        limit=1)
            test_result["methods"]["get_all"] = from_get_all[0] if from_get_all else {}
        except Exception as e:
            test_result["methods"]["get_all"] = {"error": str(e)}
        
        # Test get_doc
        try:
            full_doc = frappe.get_doc("NGO", doc_name)
            test_result["methods"]["get_doc"] = {
                "pan_number": full_doc.get("pan_number"),
                "account_number": full_doc.get("account_number")
            }
        except Exception as e:
            test_result["methods"]["get_doc"] = {"error": str(e)}
        
        # Test as_dict
        try:
            full_doc = frappe.get_doc("NGO", doc_name)
            as_dict_result = full_doc.as_dict()
            test_result["methods"]["as_dict"] = {
                "pan_number": as_dict_result.get("pan_number"),
                "account_number": as_dict_result.get("account_number")
            }
        except Exception as e:
            test_result["methods"]["as_dict"] = {"error": str(e)}
        
        # Raw database value (for comparison)
        try:
            raw_values = frappe.db.get_value("NGO", doc_name, 
                                           ["pan_number", "account_number"], as_dict=True)
            test_result["raw_db_values"] = raw_values
        except Exception as e:
            test_result["raw_db_values"] = {"error": str(e)}
        
        results.append(test_result)
    
    return {
        "results": results,
        "data_protection_status": {
            "initialized": getattr(frappe, '_data_protection_initialized', False),
            "current_user": frappe.session.user,
            "user_roles": frappe.get_roles(frappe.session.user)
        }
    }

@frappe.whitelist()
def test_masking_contexts():
    """Test masking in different contexts"""
    try:
        # Get a test document
        test_doc = frappe.get_all("NGO", fields=["name"], limit=1)
        if not test_doc:
            return {"error": "No NGO documents found for testing"}
        
        doc_name = test_doc[0].name
        
        # Test different contexts
        contexts = ["form", "api", "list", "report"]
        results = {}
        
        for context in contexts:
            try:
                # Get document
                doc = frappe.get_doc("NGO", doc_name)
                
                # Manually process with specific context
                user_roles = frappe.get_roles(frappe.session.user)
                processed_values = {}
                
                for df in doc.meta.fields:
                    if df.fieldname in ["pan_number", "account_number"]:
                        cfg = get_data_protection(df)
                        val = doc.get(df.fieldname)
                        if val:
                            processed_val = process_field_with_config(val, cfg, user_roles, context)
                            processed_values[df.fieldname] = processed_val
                
                results[context] = processed_values
                
            except Exception as e:
                results[context] = {"error": str(e)}
        
        return results
        
    except Exception as e:
        return {"error": str(e)}