import frappe
import requests
import json


def generate_html_block(client_prompt="", system_prompt=None, existing=None):
    try:
        if not system_prompt:
            frappe.throw("System prompt not provided")

        api_key = frappe.get_cached_doc("My Theme","My Theme").get_password("anthropic")
        if not api_key:
            frappe.throw("Anthropic API key not configured in site_config.json")

        # Build user message based on mode
        if existing:
            user_message = f"""Current code:
                html:
                {existing['html']}

                script:
                {existing['script']}

                style:
                {existing['style']}

                ---
                Edit: {client_prompt}

                Return FULL updated {{"html":"...","script":"...","style":"..."}} JSON.
                Only modify what's needed. Keep everything else intact."""
        else:
            user_message = client_prompt or "Generate the dashboard now."

        payload = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 16384,
            "temperature": 0,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_message}
            ]
        }

        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json=payload,
            timeout=600
        )

        if response.status_code != 200:
            frappe.throw(f"AI API Error: {response.text}")

        data = response.json()
        # Anthropic: check stop_reason
        if data.get("stop_reason") == "max_tokens":
            frappe.throw("AI response was truncated. Try a simpler prompt or reduce the number of reports.")

        # Extract text from response blocks
        text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                text += block["text"]

        # Strip markdown fences if present
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        parsed = json.loads(text)

        return {
            "html": parsed.get("html", ""),
            "script": parsed.get("script", ""),
            "style": parsed.get("style", "")
        }

    except json.JSONDecodeError:
        frappe.log_error(f"Failed to parse AI response: {text[:500]}", "AI JSON Parse Error")
        frappe.throw("AI returned invalid JSON. Try again.")

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "AI HTML Block Generation Error")
        frappe.throw(str(e))