import frappe
import requests


def create_ticket(payload=None):
	creds = frappe.db.get_single_value("My Theme", "hd_creds")
	base_url = frappe.db.get_single_value("My Theme", "hd_url")

	if creds:
		headers = {"Authorization": f"token {creds}"}
		res = requests.post(f"{base_url}/api/resource/HD Ticket", json=payload or {}, headers=headers)
		if res.status_code != 200:
			return False
		res_json = res.json()
		if res_json.get("data") and res_json["data"].get("name"):
			return res_json["data"]["name"]
	return False
