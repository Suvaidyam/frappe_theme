import json
import frappe
from urllib.request import Request, urlopen
from urllib.error import HTTPError


class LLMProvider:
    """Abstract LLM provider using raw HTTP (no pip dependencies)."""

    @staticmethod
    def get_config():
        """Read AI provider config from My Theme, fallback to site_config."""
        theme = frappe.get_cached_doc("My Theme")
        provider = theme.get("ai_provider") or "OpenAI"
        api_key = theme.get_password("ai_api_key") or ""
        model = theme.get("ai_model") or ""

        # Fallback to site_config.json if My Theme has no key
        if not api_key:
            conf = frappe.get_conf()
            if provider == "OpenAI":
                api_key = conf.get("openai_key") or conf.get("openai_api_key") or ""
            elif provider == "Anthropic":
                api_key = conf.get("anthropic_key") or conf.get("anthropic_api_key") or ""

        return {
            "provider": provider,
            "api_key": api_key,
            "model": model,
        }

    @staticmethod
    def generate(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        """Send prompt to configured LLM and return response text."""
        config = LLMProvider.get_config()
        provider = config["provider"]
        api_key = config["api_key"]
        model = config["model"]

        if not api_key:
            frappe.throw("AI API Key not configured in My Theme → AI Report Generator section")

        if provider == "OpenAI":
            return LLMProvider._call_openai(api_key, model or "gpt-4o", system_prompt, user_prompt, temperature)
        elif provider == "Anthropic":
            return LLMProvider._call_anthropic(api_key, model or "claude-sonnet-4-5-20241022", system_prompt, user_prompt, temperature)
        else:
            frappe.throw(f"Unsupported AI provider: {provider}")

    @staticmethod
    def _call_openai(api_key, model, system_prompt, user_prompt, temperature):
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }
        return LLMProvider._http_post(url, headers, payload, extract=lambda r: r["choices"][0]["message"]["content"])

    @staticmethod
    def _call_anthropic(api_key, model, system_prompt, user_prompt, temperature):
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": temperature,
        }
        return LLMProvider._http_post(url, headers, payload, extract=lambda r: r["content"][0]["text"])

    @staticmethod
    def _http_post(url, headers, payload, extract):
        data = json.dumps(payload).encode("utf-8")
        req = Request(url, data=data, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return extract(result)
        except HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else str(e)
            frappe.throw(f"LLM API Error ({e.code}): {error_body}")
