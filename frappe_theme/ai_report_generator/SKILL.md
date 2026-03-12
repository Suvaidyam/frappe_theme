# AI Report Generator — Developer Guide

## Overview

The AI Report Generator is a self-contained module within `frappe_theme` that generates Frappe Query Reports from natural language descriptions using LLM APIs (OpenAI or Anthropic).

## Architecture

```
frappe_theme/ai_report_generator/
├── __init__.py
├── api.py              # @frappe.whitelist() endpoints
├── llm_provider.py     # Raw HTTP LLM abstraction (no pip deps)
├── meta_analyzer.py    # Recursive DocType meta extraction
├── sql_generator.py    # Orchestrates meta + LLM → report
├── prompt_templates.py # System/user prompt templates
└── doctype/
    └── ai_report_context/  # Stores user descriptions of DocTypes
```

## API Reference

All endpoints are in `frappe_theme.ai_report_generator.api`:

| Endpoint | Args | Returns |
|----------|------|---------|
| `get_all_doctypes()` | — | `list[str]` of non-child, non-single DocType names |
| `analyze_doctypes(doctypes, max_depth=3)` | JSON list of DocType names | `{suggestions, missing_descriptions}` |
| `save_doctype_description(doctype, description, field_descriptions?)` | DocType name + text | AI Report Context name |
| `generate_report(doctypes, user_request, max_depth=3)` | JSON list + natural language | `{query, columns, filters, explanation}` |
| `preview_query(query, filters?)` | SQL string + JSON filter values | `list[dict]` (max 20 rows) |
| `save_as_report(report_name, ref_doctype, query, columns, filters, description?)` | All report components | `{name, url}` |

## DocTypes

### AI Report Context
Stores user-provided business descriptions of DocTypes to improve LLM accuracy.

| Field | Type | Description |
|-------|------|-------------|
| `reference_doctype` | Link (DocType) | The DocType being described |
| `description` | Small Text | Business description |
| `field_descriptions` | Code (JSON) | Optional `{fieldname: description}` map |

### Report (custom field)
- `custom_ai_report_description` (Small Text) — stores the AI explanation for future AI Dashboard Generator use.

## Configuration

AI provider settings are in **My Theme** → **AI Report Generator** tab:
- `ai_provider`: Select (OpenAI / Anthropic)
- `ai_api_key`: Password field
- `ai_model`: Data field (optional override)

Fallback: `site_config.json` keys `openai_key` / `anthropic_key`.

## Adding a New LLM Provider

1. Add provider name to `ai_provider` Select options in My Theme
2. Add `_call_<provider>()` static method in `llm_provider.py`
3. Add provider branch in `LLMProvider.generate()`
4. Add site_config fallback key in `LLMProvider.get_config()`

## Extending Prompt Templates

Edit `prompt_templates.py`:
- `SYSTEM_PROMPT`: Rules for SQL generation
- `USER_PROMPT_TEMPLATE`: Schema + descriptions + user request template

## Security

- SQL validated via `check_safe_sql_query()` before execution
- Filter values escaped via `frappe.db.escape()`
- API keys stored as Frappe Password fields (encrypted)
- Circular DocType traversal prevented by visited-set in MetaAnalyzer
- Page access restricted to System Manager role
