import frappe
from openai import OpenAI


@frappe.whitelist()
def generate_html_block(prompt):
	client = OpenAI(api_key=frappe.conf.get("openai"))

	system_instruction = """
    You are an expert UI designer for Frappe.
    Generate clean, responsive HTML, CSS and JS.
    Output must be valid HTML only.
    Do NOT add explanations.
    """

	result = client.chat.completions.create(
		model="gpt-4.1",
		messages=[{"role": "system", "content": system_instruction}, {"role": "user", "content": prompt}],
	)

	html_output = result.choices[0].message.content
	return {"html": html_output, "script": "", "style": ""}
