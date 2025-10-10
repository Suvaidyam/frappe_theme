import json
import random

import frappe


class SvaTestUtils:
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

	def generate_test_doc_with_mandatory_fields(self, doctype: str, default_values: dict) -> dict:
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
				if field.fieldname in ["Tab", "Section Break", "Column Break", "Fold"]:
					continue
				if field.fieldname in default_values:
					doc.set(field.fieldname, default_values[field.fieldname])
					continue
				elif field.fieldtype in [
					"Data",
					"Text",
					"Long Text",
					"Small Text",
					"Text Editor",
					"Markdown Editor",
				]:
					doc.set(field.fieldname, "Test Data")
					continue
				elif field.fieldtype == "Int":
					doc.set(field.fieldname, random.randint(1, 100))
					continue
				elif field.fieldtype == "Float":
					doc.set(field.fieldname, random.uniform(1.0, 100.0))
					continue
				elif field.fieldtype == "Percent":
					doc.set(field.fieldname, random.uniform(1.0, 100.0))
					continue
				elif field.fieldtype == "Currency":
					doc.set(field.fieldname, random.uniform(1.0, 100.0))
					continue
				elif field.fieldtype == "Rating":
					doc.set(field.fieldname, random.randint(1, 5))
					continue
				elif field.fieldtype == "Date":
					doc.set(field.fieldname, frappe.utils.nowdate())
					continue
				elif field.fieldtype == "Datetime":
					doc.set(field.fieldname, frappe.utils.now_datetime())
					continue
				elif field.fieldtype == "Time":
					doc.set(field.fieldname, frappe.utils.now_time())
					continue
				elif field.fieldtype == "Duration":
					doc.set(field.fieldname, "01:00:00")
					continue
				elif field.fieldtype == "Check":
					doc.set(field.fieldname, 1)
					continue
				elif field.fieldtype == "Password":
					doc.set(field.fieldname, "Test@123")
					continue
				elif field.fieldtype == "Phone":
					doc.set(field.fieldname, self.generate_random_phone_number())
					continue
				elif field.fieldtype == "Email":
					doc.set(field.fieldname, "test@example.com")
					continue
				elif field.fieldtype == "Select":
					if field.options:
						options = [opt.strip() for opt in field.options.split("\n") if opt.strip()]
						if options:
							doc.set(field.fieldname, options[random.randint(0, len(options) - 1)])
							continue
				elif field.fieldtype == "JSON":
					doc.set(field.fieldname, {"key": "value"})
					continue
				elif field.fieldtype == "Icon":
					# doc.set(field.fieldname, "octicon octicon-file-directory")
					continue
				elif field.fieldtype == "Html":
					doc.set(field.fieldname, "<p>Test HTML</p>")
					continue
				elif field.fieldtype == "Html Editor":
					doc.set(field.fieldname, "<p>Test HTML Editor</p>")
					continue
				elif field.fieldtype == "Heading":
					doc.set(field.fieldname, "Test Heading")
					continue
				elif field.fieldtype == "Barcode":
					doc.set(field.fieldname, "123456789012")
					continue
				elif field.fieldtype == "URL":
					doc.set(field.fieldname, "http://example.com")
					continue
				elif field.fieldtype == "Color":
					doc.set(field.fieldname, "#A30808")
					continue
				elif field.fieldtype == "Geolocation":
					doc.set(field.fieldname, "12.9715987,77.594566")
					continue
				elif field.fieldtype == "Code":
					doc.set(field.fieldname, "print('Hello, World!')")
					continue
				elif field.fieldtype in ["Image", "Attach Image", "Attach"]:
					# doc.set(field.fieldname, "/files/test_image.png")
					pass
				elif field.fieldtype in ["Link", "Dynamic Link"]:
					if field.fieldtype == "Link" and field.options:
						linked_doc = frappe.get_all(field.options, limit=1)
						if linked_doc:
							doc.set(field.fieldname, linked_doc[0].name)
							continue
						else:
							new_linked_doc = self.generate_test_doc_with_mandatory_fields(field.options)
							new_linked_doc.insert(ignore_permissions=True)
							doc.set(field.fieldname, new_linked_doc.name)
							continue
					elif field.fieldtype == "Dynamic Link":
						pass
				elif field.fieldtype == "Signature":
					pass
				elif field.fieldtype == "Table":
					pass
				elif field.fieldtype == "Table MultiSelect":
					pass
				# Add more field types as needed
		# doc.insert(ignore_permissions=True) #temporary saving for testing
		return doc


# def abc():
#     abc = SvaTestUtils()
#     doc = abc.generate_test_doc_with_mandatory_fields("Donor")
#     return doc
