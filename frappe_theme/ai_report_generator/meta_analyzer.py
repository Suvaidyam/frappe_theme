import frappe


class MetaAnalyzer:
    """Recursively analyze DocType meta for SQL context building."""

    def __init__(self, doctypes: list[str], max_depth: int = 3):
        self.doctypes = doctypes
        self.max_depth = max_depth
        self.visited = set()  # Circular link prevention
        self.schema = {}      # doctype -> {fields, links, children}

    def analyze(self) -> dict:
        """Entry point: analyze all selected doctypes recursively."""
        for dt in self.doctypes:
            self._analyze_doctype(dt, depth=0)
        return self.schema

    def _analyze_doctype(self, doctype: str, depth: int):
        """Recursively extract meta for a single doctype."""
        if doctype in self.visited or depth > self.max_depth:
            return
        self.visited.add(doctype)

        try:
            meta = frappe.get_meta(doctype)
        except Exception:
            return  # DocType doesn't exist or no permission

        dt_info = {
            "table_name": f"tab{doctype}",
            "is_child": bool(meta.istable),
            "is_single": bool(meta.issingle),
            "is_submittable": bool(meta.is_submittable),
            "fields": [],
            "link_fields": [],
            "child_tables": [],
        }

        for field in meta.fields:
            if field.fieldtype in ("Column Break", "Section Break", "Tab Break"):
                continue

            field_info = {
                "fieldname": field.fieldname,
                "fieldtype": field.fieldtype,
                "label": field.label,
                "options": field.options,
                "reqd": field.reqd,
            }
            dt_info["fields"].append(field_info)

            # Track Link fields for relationship mapping
            if field.fieldtype == "Link" and field.options:
                dt_info["link_fields"].append({
                    "fieldname": field.fieldname,
                    "linked_doctype": field.options,
                })
                # Recurse into linked DocType
                self._analyze_doctype(field.options, depth + 1)

            # Track child tables
            elif field.fieldtype == "Table" and field.options:
                dt_info["child_tables"].append({
                    "fieldname": field.fieldname,
                    "child_doctype": field.options,
                })
                # Recurse into child table DocType
                self._analyze_doctype(field.options, depth + 1)

        self.schema[doctype] = dt_info

    def get_all_doctypes(self) -> list[str]:
        """Return list of all non-child, non-single DocTypes for autocomplete."""
        return frappe.get_all(
            "DocType",
            filters={"istable": 0, "issingle": 0},
            pluck="name",
            order_by="name",
        )

    def to_prompt_context(self) -> str:
        """Convert analyzed schema to a text format suitable for LLM prompts."""
        lines = []
        for dt_name, info in self.schema.items():
            lines.append(f"\n## DocType: {dt_name}")
            lines.append(f"Table: `{info['table_name']}`")
            if info["is_child"]:
                lines.append("Type: Child Table")
            if info["is_submittable"]:
                lines.append("Submittable: Yes (has docstatus field)")

            lines.append("\nFields:")
            for f in info["fields"]:
                opts = f" → {f['options']}" if f["options"] else ""
                reqd = " (required)" if f["reqd"] else ""
                lines.append(f"  - `{f['fieldname']}` ({f['fieldtype']}{opts}){reqd} — {f['label']}")

            if info["link_fields"]:
                lines.append("\nRelationships (Link fields):")
                for lf in info["link_fields"]:
                    lines.append(f"  - `{lf['fieldname']}` → `tab{lf['linked_doctype']}`")

            if info["child_tables"]:
                lines.append("\nChild Tables:")
                for ct in info["child_tables"]:
                    lines.append(f"  - `{ct['fieldname']}` → `tab{ct['child_doctype']}` (joined via parent = name)")

        return "\n".join(lines)
