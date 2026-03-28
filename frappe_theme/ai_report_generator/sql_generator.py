import json
import frappe
from frappe_theme.ai_report_generator.llm_provider import LLMProvider
from frappe_theme.ai_report_generator.meta_analyzer import MetaAnalyzer
from frappe_theme.ai_report_generator.prompt_templates import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE


class SQLGenerator:
    """Orchestrates meta analysis + LLM call to generate report components."""

    def __init__(self, doctypes: list[str], user_request: str, max_depth: int = 3):
        self.doctypes = doctypes
        self.user_request = user_request
        self.max_depth = max_depth

    def generate(self) -> dict:
        """Main entry: analyze meta, build context, call LLM, parse response."""
        # 1. Analyze DocType meta recursively
        analyzer = MetaAnalyzer(self.doctypes, self.max_depth)
        analyzer.analyze()
        schema_context = analyzer.to_prompt_context()

        # 2. Fetch stored DocType descriptions
        descriptions = self._get_doctype_descriptions()

        # 3. Build user prompt
        user_prompt = USER_PROMPT_TEMPLATE.format(
            schema_context=schema_context,
            doctype_descriptions=descriptions,
            user_request=self.user_request,
        )

        # 4. Call LLM
        response_text = LLMProvider.generate(SYSTEM_PROMPT, user_prompt)

        # 5. Parse JSON response
        return self._parse_response(response_text)

    def _get_doctype_descriptions(self) -> str:
        """Fetch user-stored descriptions for the selected DocTypes."""
        descriptions = []
        for dt in self.doctypes:
            ctx = frappe.db.get_value(
                "AI Report Context",
                {"reference_doctype": dt},
                ["description", "field_descriptions"],
                as_dict=True,
            )
            if ctx and ctx.description:
                descriptions.append(f"### {dt}\n{ctx.description}")
                if ctx.field_descriptions:
                    descriptions.append(f"Field details: {ctx.field_descriptions}")
            else:
                descriptions.append(f"### {dt}\n(No user description provided)")
        return "\n\n".join(descriptions)

    def _parse_response(self, response_text: str) -> dict:
        """Parse LLM JSON response, handling potential markdown fencing."""
        text = response_text.strip()
        # Strip markdown code fencing if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            frappe.throw("AI returned invalid JSON. Please try again with a clearer description.")

        # Validate required keys
        for key in ("query", "columns", "filters"):
            if key not in result:
                frappe.throw(f"AI response missing required key: {key}")

        return result

    def suggest_columns_and_filters(self) -> dict:
        """Pre-suggestion: analyze meta and suggest possible columns/filters without generating SQL."""
        analyzer = MetaAnalyzer(self.doctypes, self.max_depth)
        schema = analyzer.analyze()

        suggested_columns = []
        suggested_filters = []

        for dt_name, info in schema.items():
            if info["is_child"]:
                continue  # Skip child tables for top-level suggestions

            for f in info["fields"]:
                ft = f["fieldtype"]
                # Suggest as column if it's a displayable field
                if ft in ("Data", "Link", "Select", "Currency", "Int", "Float",
                          "Date", "Datetime", "Check", "Duration", "Small Text"):
                    suggested_columns.append({
                        "fieldname": f["fieldname"],
                        "label": f["label"],
                        "fieldtype": ft,
                        "options": f["options"] or "",
                        "doctype": dt_name,
                    })

                # Suggest as filter if it's a filterable field
                if ft in ("Link", "Select", "Date", "Check", "Data"):
                    suggested_filters.append({
                        "fieldname": f["fieldname"],
                        "label": f["label"],
                        "fieldtype": ft,
                        "options": f["options"] or "",
                        "doctype": dt_name,
                    })

        return {
            "columns": suggested_columns,
            "filters": suggested_filters,
            "schema": schema,
        }
