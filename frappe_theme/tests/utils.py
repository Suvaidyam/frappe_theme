import json
import random

import frappe


class SvaTestUtils:
	def generate_field_value(self, field, default_values=None):
		"""
		Generate a value for a given field based on its type and default values.
		"""
		if default_values is None:
			default_values = {}
		if field.fieldname in ["Tab", "Section Break", "Column Break"]:
			return None
		if field.fieldname in default_values:
			return default_values[field.fieldname]
		if field.fieldtype in ["Data", "Text", "Long Text", "Small Text", "Text Editor", "Markdown Editor"]:
			return "Test Data"
		if field.fieldtype == "Int":
			return random.randint(1, 100)
		if field.fieldtype == "Float":
			return random.uniform(1.0, 100.0)
		if field.fieldtype == "Percent":
			return random.uniform(1.0, 100.0)
		if field.fieldtype == "Currency":
			return random.uniform(1.0, 100.0)
		if field.fieldtype == "Rating":
			return random.randint(1, 5)
		if field.fieldtype == "Date":
			return frappe.utils.nowdate()
		if field.fieldtype == "Datetime":
			return frappe.utils.now_datetime()
		if field.fieldtype == "Time":
			return frappe.utils.now_time()
		if field.fieldtype == "Duration":
			return "01:00:00"
		if field.fieldtype == "Check":
			return 1
		if field.fieldtype == "Password":
			return "Test@123"
		if field.fieldtype == "Phone":
			return self.generate_random_phone_number()
		if field.fieldtype == "Email":
			return "test@example.com"
		if field.fieldtype == "Select":
			if field.options:
				options = [opt.strip() for opt in field.options.split("\n") if opt.strip()]
				if options:
					return options[random.randint(0, len(options) - 1)]
		if field.fieldtype == "JSON":
			return {"key": "value"}
		if field.fieldtype == "Html":
			return "<p>Test HTML</p>"
		if field.fieldtype == "Html Editor":
			return "<p>Test HTML Editor</p>"
		if field.fieldtype == "Heading":
			return "Test Heading"
		if field.fieldtype == "Barcode":
			return "123456789012"
		if field.fieldtype == "URL":
			return "http://example.com"
		if field.fieldtype == "Color":
			return "#A30808"
		if field.fieldtype == "Geolocation":
			return "12.9715987,77.594566"
		if field.fieldtype == "Code":
			return "print('Hello, World!')"
		if field.fieldtype in ["Image", "Attach Image", "Attach"]:
			return "/files/test_image.png"
		if field.fieldtype == "Icon":
			return "octicon octicon-file-directory"
		if field.fieldtype == "Signature":
			return "Test Signature"
		if field.fieldtype == "Table":
			if getattr(field, "options", None):
				return [{"test_field": "Test Value"}]
			return []
		if field.fieldtype == "Table MultiSelect":
			# Return a list with one test child row if options is set
			if getattr(field, "options", None):
				return [{"test_field": "Test Value"}]
			return []
		if field.fieldtype in ["Link", "Dynamic Link"]:
			# For Link, try to get an existing doc or return a test name
			if field.fieldtype == "Link" and getattr(field, "options", None):
				linked_doc = frappe.get_all(field.options, limit=1)
				if linked_doc:
					return linked_doc[0].name
				else:
					# Create a new doc if none exists
					new_linked_doc = frappe.new_doc(field.options)
					new_linked_doc.insert(ignore_permissions=True)
					return new_linked_doc.name
			# For Dynamic Link, just return a test value
			return "Test Dynamic Link"
		return None

	@staticmethod
	def generate_random_string(length: int = 20) -> str:
		"""Generate a random string of fixed length."""
		if isinstance(length, str):
			try:
				length = int(length)
			except ValueError:
				length = 20
		letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
		return "".join(random.choice(letters) for i in range(length))

	@staticmethod
	def generate_random_phone_number(is_country_code: bool = True) -> str:
		"""
		Generate a valid random Indian mobile number.

		Args:
		    is_country_code (bool, optional): Whether to include the country code (+91) or not. Defaults to True.
		Returns:
		    str: A valid Indian phone number string.
		"""
		# First digit should be between 6 and 9 for valid Indian numbers
		first_digit = random.choice("6789")
		remaining_digits = "".join(random.choice("0123456789") for _ in range(9))
		number = first_digit + remaining_digits

		if is_country_code:
			return f"+91-{number}"
		return number

	def generate_test_doc_with_mandatory_fields(self, doctype: str, default_values: dict = None) -> dict:
		"""
		Generate a test document for the given doctype with all mandatory fields filled and also accept default values for fields for certain field types.
		args:
		    doctype (str): The name of the doctype for which to generate the test document.
		    default_values (dict, optional): A dictionary of field names and their corresponding values to set in the document. Defaults to None.
		Returns:
		    dict: A dictionary representing the test document with mandatory fields filled.
		"""
		if default_values is None:
			default_values = {}
		if isinstance(default_values, str):
			try:
				default_values = json.loads(default_values)
			except Exception:
				default_values = {}

		doc = frappe.new_doc(doctype)
		meta = frappe.get_meta(doctype)
		for field in meta.fields:
			if field.reqd and not doc.get(field.fieldname):
				value = self.generate_field_value(field, default_values)
				if value is not None:
					doc.set(field.fieldname, value)
		return doc

	def generate_test_doc_with_all_fields(self, doctype: str, default_values: dict = None) -> dict:
		"""
		Generate a test document for the given doctype with all fields (not just mandatory) populated.
		args:
		    doctype (str): The name of the doctype for which to generate the test document.
		    default_values (dict, optional): A dictionary of field names and their corresponding values to set in the document. Defaults to None.
		Returns:
		    dict: A dictionary representing the test document with all fields filled.
		"""
		if default_values is None:
			default_values = {}
		if isinstance(default_values, str):
			try:
				default_values = json.loads(default_values)
			except Exception:
				default_values = {}
		doc = frappe.new_doc(doctype)
		meta = frappe.get_meta(doctype)
		for field in meta.fields:
			if not doc.get(field.fieldname):
				value = self.generate_field_value(field, default_values)
				if value is not None:
					doc.set(field.fieldname, value)
		return doc


# def abc():
#     abc = SvaTestUtils()
#     doc = abc.generate_test_doc_with_mandatory_fields("Donor")
#     return doc
