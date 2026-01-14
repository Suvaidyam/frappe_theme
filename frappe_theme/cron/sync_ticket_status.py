import frappe
import requests
import json


def get_hd_tickets(base_url, creds, filters=None):
    if not filters:
        filters = {}

    response = requests.get(
        f"{base_url}/api/resource/HD Ticket",
        headers={"Authorization": f"token {creds}"},
        params={
            "fields": '["name","status","priority","description","modified"]',
            "filters": json.dumps(filters)
        },
        timeout=15
    )

    if response.status_code != 200:
        frappe.log_error(response.text, "HD Ticket fetch failed")
        return []

    return response.json().get("data", [])


def run():
    """
    Runs every 10 minutes
    Sync changes from HD Ticket to SVA Ticket
    """

    if not frappe.db.exists("SVA Ticket", {}):
        frappe.logger().info("No SVA Ticket found. Sync skipped.")
        return

    mainCreds = frappe.db.get_single_value("My Theme", "hd_creds")
    mainBaseURL = frappe.db.get_single_value("My Theme", "hd_url")

    if not (mainCreds and mainBaseURL):
        frappe.logger().info("Client helpdesk creds not configured. Sync skipped.")
        return

    sva_tickets = frappe.db.get_all(
        "SVA Ticket",
        filters={"status": ["!=", "Closed"]},
        fields=["name", "hd_id"]
    )

    sva_closed_tickets = frappe.db.get_all(
        "SVA Ticket",
        filters={"status": "Closed"},
    )

    hd_names = [t.hd_id for t in sva_tickets if t.hd_id]

    if not hd_names:
        return

    hd_tickets = get_hd_tickets(
        mainBaseURL,
        mainCreds,
        {"name": ["IN", hd_names]}
    )

    for hd in hd_tickets:
        sva_ticket = frappe.db.get_value(
            "SVA Ticket",
            {"hd_id": hd["name"]},
            ["name", "status", "priority", "description"],
            as_dict=True
        )

        if not sva_ticket:
            continue

        updates = {}

        if sva_ticket.status != hd["status"]:
            updates["status"] = hd["status"]

        if sva_ticket.priority != hd["priority"]:
            updates["priority"] = hd["priority"]

        if sva_ticket.description != hd["description"]:
            updates["description"] = hd["description"]

        if updates:
            frappe.db.set_value("SVA Ticket", sva_ticket.name, updates)

    frappe.log_error("HD → SVA ticket sync completed successfully")
