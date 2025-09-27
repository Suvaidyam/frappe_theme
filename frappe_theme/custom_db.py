from frappe.database.mariadb.database import MariaDBDatabase
import frappe
# or PostgresDatabase if you use Postgres

class CustomDatabase(MariaDBDatabase):
    def get_value(self, doctype, filters=None, fieldname="name", *args, **kwargs):
        print(">>> Custom get_value called>>>>>>>>>>>>>>>>>>>>>>>:", doctype, filters, fieldname)
        result = super().get_value(doctype, filters, fieldname, *args, **kwargs)
        frappe.log_error(result, "Custom get_value called>>>>>>>>>>>>>>>>>>>>>>>:")
        return result

    def get_all(self, *args, **kwargs):
        print(">>> Custom get_all called>>>>>>>>>>>>>>>>>>>>>>>:")
        frappe.log_error(args, f"Custom get_all called>>>>>>>>>>>>>>>>>>>>>>>:{args} {kwargs}")
        return super().get_all(*args, **kwargs)

    def get_list(self, *args, **kwargs):
        print(">>> Custom get_list called>>>>>>>>>>>>>>>>>>>>>>>:")
        return super().get_list(*args, **kwargs)
