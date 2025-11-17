import frappe

def get_permission_query_conditions_custom(doctype, user=None):
    """
    Returns a SQL condition string for user-permission filtering on a linked Doctype.
    Works in Frappe v16 where get_permission_query_conditions is removed.
    """

    if not user:
        user = frappe.session.user

    # Admin bypass
    if user == "Administrator":
        return ""

    # 1. Fetch allowed document names from User Permissions
    allowed_docs = frappe.get_all(
        "User Permission",
        filters={"user": user, "allow": doctype},
        pluck="for_value"
    )

    # 2. Include shared docs (DocShare)
    shared_docs = frappe.get_all(
        "DocShare",
        filters={"user": user, "share_doctype": doctype},
        pluck="share_name"
    )

    allowed = list(set(allowed_docs + shared_docs))

    # No explicit user permission exists → allow all
    if not allowed:
        return ""

    # Convert list to SQL-safe quoted values
    allowed_sql = ", ".join([frappe.db.escape(d) for d in allowed])

    # Final output:  IN ('A', 'B', 'C')
    return f"IN ({allowed_sql})"
