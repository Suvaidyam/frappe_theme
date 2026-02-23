import frappe
import json

SYSTEM_PROMPT_TEMPLATE = """Senior frontend engineer. Build Frappe Custom HTML Block dashboard.

OUTPUT: Only valid JSON, no markdown, no explanation.
{{"html":"...","script":"...","style":"..."}}

STRICTLY FORBIDDEN IN OUTPUT:
- HTML comments (<!-- -->)  — breaks Shadow DOM parser
- JS comments (// or /* */) — breaks JSON string encoding
- Code comments of any kind anywhere in html, script, or style values
- Trailing commas in objects or arrays

TEMPLATE:
html: <div id="{block_id}"> with Vue syntax. Use v-text to avoid Jinja {{{{}}}} conflicts.
script:
frappe.require('/assets/frappe/node_modules/vue/dist/vue.global.prod.js',()=>{{
  let el=root_element.querySelector('#{block_id}');
  const {{createApp,ref,reactive,computed,onMounted,watch}}=Vue;
  createApp({{setup(){{ /*logic*/ return {{}}; }}}}).mount(el);
}});
style: only custom overrides. Tailwind handles the rest.

CRITICAL STYLING CONTEXT:
This block renders inside a Shadow DOM element. No parent CSS cascades in.
Load Tailwind via CDN inside the script block before mounting Vue:

const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
el.parentElement.appendChild(link);

Then use standard Tailwind classes in HTML.
Put only non-Tailwind overrides in "style".

COMPONENT STRUCTURE (MANDATORY):
Mark each visual section with data-component attribute on wrapper div. NO HTML comments.

<div data-component="filters">...</div>
<div data-component="kpi-{{report_name}}">...</div>
<div data-component="chart-{{report_name}}">...</div>
<div data-component="table-{{report_name}}">...</div>

In script, group related logic into named functions. NO JS comments.

API:
frappe.call({{
  method: "frappe_theme.dt_api.get_dt_list",
  args: {{
    doctype: "<report doctype from config 'dt' key>",
    _type: "Report"
  }}
}})
Returns {{message:[{{col:val}}]}}. Access rows via res.message.
Backend does NOT aggregate—all math in frontend.
For filter reports: set unfiltered:1, no filters needed.
For data reports: pass pageFilters into filters arg only if value is not empty.

FORBIDDEN: window,document(except for Tailwind link injection),eval,import,external JS libs,innerHTML,iframe,HTML comments,JS comments

FORBIDDEN: window,document(except for Tailwind link injection),eval,import,external JS libs,innerHTML,iframe,HTML comments,JS comments,direct frappe calls in HTML templates

RULES:
- Vue3 Composition API, loading+error states
- NEVER call frappe.* directly in HTML template expressions. Vue templates only see setup() return values.
  Wrap: function formatCurrency(v){{ return frappe.utils.format_currency(v); }} then return formatCurrency from setup().
  Use formatCurrency(val) in HTML, not frappe.utils.format_currency(val).
- KPI=styled card, computed sum(Currency/Int/Float)
- Bar=CSS width bars, group(Link/Data/Select)
- Table=<table> Tailwind, overflow-x-auto
- Max 2 charts/report, aggregation via computed()
- Responsive grid using Tailwind: grid-cols-1, md:grid-cols-2, lg:grid-cols-3
- Format currency: formatCurrency(val) only for Currency fieldtype

LOGIC:
1. Title=name
2. Filters: fetch each filter report on mount (unfiltered:1)→<select>, store in reactive pageFilters, watch→reload
3. Data: fetch each data report with pageFilters, per-report state(loading,error,rows), render: title→KPIs→charts→table

VALIDATION:
- Every opening tag MUST have a matching closing tag. Double-check h1-h6, div, span, td, tr, table.
- Validate JSON is complete before returning. Never truncate.
- Keep total response under 12000 tokens. If dashboard is complex, reduce decorative classes.
- ZERO comments in output. Not one.

FIELD KEY: fn=fieldname, ft=fieldtype, opt=options, dt=report doctype

CONFIG:
{config}

Return ONLY the JSON."""


def _compact_fields(fields):
    out = []
    for f in fields:
        o = {"fn": f.fieldname, "ft": f.fieldtype, "label": f.label}
        if f.options:
            o["opt"] = f.options
        for k in ("default", "description"):
            v = f.get(k)
            if v:
                o[k] = v
        out.append(o)
    return out


def generate_system_prompt(custom_filter_report=[], custom_data_report=[], block_name=None, ref_doctype=None):
    try:
        block_name = block_name or ""
        ref_doctype = ""
        block_id = "cb-" + (block_name or "dash").lower().replace(" ", "-")

        filter_reports = json.loads(custom_filter_report or "[]")
        data_reports = json.loads(custom_data_report or "[]")

        config = {"name": block_name, "ref": ref_doctype, "f": [], "d": []}

        for name in filter_reports:
            r = frappe.get_doc("Report", name, as_dict=True)
            config["f"].append({
                "r": r.report_name,
                "dt": r.report_name,
                "cols": _compact_fields(r.columns),
            })

        for name in data_reports:
            r = frappe.get_doc("Report", name, as_dict=True)
            entry = {
                "r": r.report_name,
                "dt": r.report_name,
                "cols": _compact_fields(r.columns),
            }
            if r.custom_description:
                entry["desc"] = r.custom_description
            if r.filters:
                entry["fi"] = _compact_fields(r.filters)
            config["d"].append(entry)

        config_json = json.dumps(config, separators=(",", ":"))

        return SYSTEM_PROMPT_TEMPLATE.format(
            block_id=block_id,
            block_name=block_name,
            ref_doctype=ref_doctype,
            config=config_json,
        )

    except Exception as e:
        frappe.log_error(f"generate_system_prompt error: {str(e)}")
        return f"Error: {str(e)}"