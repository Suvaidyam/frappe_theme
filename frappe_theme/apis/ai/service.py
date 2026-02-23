import frappe
import json
import uuid
from frappe_theme.apis.ai.utils import generate_system_prompt
from frappe_theme.apis.ai.anthropic import generate_html_block as anthropic_generate_html_block
from frappe_theme.apis.ai.openai import generate_html_block as openai_generate_html_block

AI_PROMPT_PREFIX = "[AI_PROMPT]"

# ─── Async (Socket) Entry Point ─────────────────────────────────────────────────

@frappe.whitelist()
def generate_html_block_async(provider, client_prompt, custom_filter_report, custom_data_report, block_name=None, resume_from=None):
    """
    Enqueues AI generation as a background job.
    Returns a task_id immediately. Result is pushed via frappe.publish_realtime.

    Client listens on:
      frappe.realtime.on("ai_block_result", callback)   — success
      frappe.realtime.on("ai_block_error", callback)     — failure
    """
    task_id = str(uuid.uuid4())[:12]
    user = frappe.session.user

    # Normalize child table inputs from client
    if isinstance(custom_filter_report, str):
        try:
            custom_filter_report = json.loads(custom_filter_report)
        except Exception:
            custom_filter_report = []

    if isinstance(custom_data_report, str):
        try:
            custom_data_report = json.loads(custom_data_report)
        except Exception:
            custom_data_report = []

    if isinstance(resume_from, str) and resume_from:
        try:
            resume_from = json.loads(resume_from)
        except Exception:
            resume_from = None

    # Publish "started" event so client can confirm handshake
    frappe.publish_realtime(
        "ai_block_start",
        {"task_id": task_id, "block_name": block_name},
        user=user,
        after_commit=True,
    )

    frappe.enqueue(
        _run_generation,
        queue="long",
        timeout=300,
        is_async=True,
        now=False,
        task_id=task_id,
        user=user,
        provider=provider,
        client_prompt=client_prompt,
        custom_filter_report=custom_filter_report,
        custom_data_report=custom_data_report,
        block_name=block_name,
        resume_from=resume_from,
    )

    return {"task_id": task_id}


def _run_generation(task_id, user, provider, client_prompt, custom_filter_report,
                    custom_data_report, block_name=None, resume_from=None):
    """Background job: calls AI provider, publishes result via socket."""
    try:
        frappe.set_user(user)

        system_prompt = generate_system_prompt(custom_filter_report, custom_data_report, block_name)

        # Resolve existing code for edit mode
        existing = None
        if resume_from and isinstance(resume_from, dict):
            existing = resume_from
        elif block_name:
            try:
                doc = frappe.get_doc("Custom HTML Block", block_name)
                if doc.html and doc.html.strip():
                    existing = {
                        "html": doc.html or "",
                        "script": doc.script or "",
                        "style": doc.style or "",
                    }
            except frappe.DoesNotExistError:
                pass

        # Call provider
        provider = (provider or "anthropic").lower()
        if provider == "anthropic":
            result = anthropic_generate_html_block(client_prompt, system_prompt, existing)
        elif provider == "openai":
            result = openai_generate_html_block(client_prompt, system_prompt, existing)
        else:
            raise ValueError(f"Invalid provider: {provider}")

        # Save prompt as comment
        if block_name and client_prompt:
            _save_prompt_comment(block_name, client_prompt, provider)

        frappe.publish_realtime(
            "ai_block_result",
            {
                "task_id": task_id,
                "block_name": block_name,
                "result": result,
            },
            user=user,
        )

    except Exception as e:
        frappe.log_error(title=f"AI Generation Failed [{task_id}]", message=frappe.get_traceback())
        frappe.publish_realtime(
            "ai_block_error",
            {
                "task_id": task_id,
                "block_name": block_name,
                "error": str(e),
            },
            user=user,
        )


# ─── Sync Entry Point (kept for direct use / testing) ───────────────────────────

@frappe.whitelist()
def generate_html_block(provider, client_prompt, custom_filter_report, custom_data_report, block_name=None, resume_from=None):
    if not provider:
        provider = "anthropic"

    if isinstance(custom_filter_report, str):
        try:
            custom_filter_report = json.loads(custom_filter_report)
        except Exception:
            custom_filter_report = []

    if isinstance(custom_data_report, str):
        try:
            custom_data_report = json.loads(custom_data_report)
        except Exception:
            custom_data_report = []

    system_prompt = generate_system_prompt(custom_filter_report, custom_data_report, block_name)

    existing = None
    if resume_from:
        if isinstance(resume_from, str):
            existing = json.loads(resume_from)
        else:
            existing = resume_from
    elif block_name:
        try:
            doc = frappe.get_doc("Custom HTML Block", block_name)
            if doc.html and doc.html.strip():
                existing = {
                    "html": doc.html or "",
                    "script": doc.script or "",
                    "style": doc.style or "",
                }
        except frappe.DoesNotExistError:
            pass

    provider = provider.lower()
    if provider == "anthropic":
        result = anthropic_generate_html_block(client_prompt, system_prompt, existing)
    elif provider == "openai":
        result = openai_generate_html_block(client_prompt, system_prompt, existing)
    else:
        raise ValueError(f"Invalid provider: {provider}")

    if block_name and client_prompt:
        _save_prompt_comment(block_name, client_prompt, provider)

    return result


# ─── Prompt History ──────────────────────────────────────────────────────────────

def _save_prompt_comment(block_name, prompt, provider=""):
    meta = json.dumps({"provider": provider}, separators=(",", ":"))
    frappe.get_doc({
        "doctype": "Comment",
        "comment_type": "Comment",
        "reference_doctype": "Custom HTML Block",
        "reference_name": block_name,
        "content": f"{AI_PROMPT_PREFIX}{meta}\n{prompt}",
        "comment_email": frappe.session.user,
    }).insert(ignore_permissions=True)
    frappe.db.commit()


@frappe.whitelist()
def get_chat_history(block_name):
    comments = frappe.get_all(
        "Comment",
        filters={
            "reference_doctype": "Custom HTML Block",
            "reference_name": block_name,
            "comment_type": "Comment",
            "content": ["like", f"{AI_PROMPT_PREFIX}%"],
        },
        fields=["name", "creation", "content"],
        order_by="creation asc",
    )

    versions = frappe.get_all(
        "Version",
        filters={"docname": block_name, "ref_doctype": "Custom HTML Block"},
        fields=["name", "creation", "data"],
        order_by="creation asc",
    )

    messages = []

    for c in comments:
        raw = c.content[len(AI_PROMPT_PREFIX):]
        meta_str, _, prompt = raw.partition("\n")
        try:
            meta = json.loads(meta_str)
        except Exception:
            meta = {}
            prompt = raw

        messages.append({
            "type": "user",
            "content": prompt.strip(),
            "provider": meta.get("provider", ""),
            "timestamp": str(c.creation),
            "id": c.name,
        })

    for v in versions:
        try:
            diff = json.loads(v.data)
            changed = [ch[0] for ch in diff.get("changed", [])]
            code_changed = [c for c in changed if c in ("html", "script", "style")]
            if code_changed:
                messages.append({
                    "type": "assistant",
                    "version": v.name,
                    "timestamp": str(v.creation),
                    "changed": code_changed,
                    "id": v.name,
                })
        except Exception:
            pass

    messages.sort(key=lambda x: x["timestamp"])
    return messages


# ─── Version Management ──────────────────────────────────────────────────────────

@frappe.whitelist()
def get_versions(block_name):
    versions = frappe.get_all(
        "Version",
        filters={"docname": block_name, "ref_doctype": "Custom HTML Block"},
        fields=["name", "creation", "data"],
        order_by="creation desc",
        limit=20,
    )

    result = []
    for v in versions:
        try:
            diff = json.loads(v.data)
            changed = [c[0] for c in diff.get("changed", [])]
            if any(f in changed for f in ("html", "script", "style")):
                result.append({
                    "version": v.name,
                    "created": str(v.creation),
                    "changed": changed,
                })
        except Exception:
            pass

    return result


@frappe.whitelist()
def get_version_code(block_name, version_name):
    version = frappe.get_doc("Version", version_name)
    if version.docname != block_name or version.ref_doctype != "Custom HTML Block":
        frappe.throw("Version does not belong to this block")

    diff = json.loads(version.data)
    result = {}
    for change in diff.get("changed", []):
        fieldname, _old_value, new_value = change
        if fieldname in ("html", "script", "style"):
            result[fieldname] = new_value

    if not all(k in result for k in ("html", "script", "style")):
        doc = frappe.get_doc("Custom HTML Block", block_name)
        result.setdefault("html", doc.html or "")
        result.setdefault("script", doc.script or "")
        result.setdefault("style", doc.style or "")

    return result


@frappe.whitelist()
def rollback(block_name, version_name):
    version = frappe.get_doc("Version", version_name)
    if version.docname != block_name or version.ref_doctype != "Custom HTML Block":
        frappe.throw("Version does not belong to this block")

    diff = json.loads(version.data)
    doc = frappe.get_doc("Custom HTML Block", block_name)

    for change in diff.get("changed", []):
        fieldname, old_value, _new_value = change
        if fieldname in ("html", "script", "style"):
            doc.set(fieldname, old_value)

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "html": doc.html or "",
        "script": doc.script or "",
        "style": doc.style or "",
    }