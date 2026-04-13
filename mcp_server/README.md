# Frappe MCP Server

An MCP (Model Context Protocol) server that lets Claude manage Frappe DocTypes
and documents via REST API. On startup it validates your credentials and
auto-creates the `Theme` DocType if it doesn't already exist.

## Prerequisites

- Python 3.10+
- A running Frappe / ERPNext instance
- A Frappe user with **System Manager** role

---

## Step 1 — Generate a Frappe API Key & Secret

1. Log in to your Frappe instance as an Administrator.
2. Go to **Settings → Users** and open your user record.
3. Scroll to the **API Access** section.
4. Click **Generate Keys**.
5. Copy the **API Key** and **API Secret** shown in the dialog — the secret is
   only shown once.

> If you don't see the API Access section, enable it via
> **System Settings → Allow API Key based Authentication**.

---

## Step 2 — Configure the environment

```bash
cd mcp_server
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
FRAPPE_URL=http://localhost:8000
FRAPPE_API_KEY=abc123...
FRAPPE_API_SECRET=xyz789...
```

---

## Step 3 — Install dependencies

```bash
cd mcp_server
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 4 — Run the server

```bash
python server.py
```

On startup you should see:

```
[frappe-mcp] Authenticated as: Administrator
[frappe-mcp] Theme DocType created successfully.   # or "already exists"
```

The server communicates over **stdio** and is ready to accept MCP tool calls.

---

## Step 5 — Connect to Claude Desktop

Open (or create) `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

Add the following entry inside the `"mcpServers"` object:

```json
{
  "mcpServers": {
    "frappe": {
      "command": "/absolute/path/to/mcp_server/.venv/bin/python",
      "args": ["/absolute/path/to/mcp_server/server.py"],
      "env": {
        "FRAPPE_URL": "http://localhost:8000",
        "FRAPPE_API_KEY": "your_api_key",
        "FRAPPE_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

Replace the paths and credentials with your actual values. Restart Claude
Desktop — the **Frappe MCP Server** tools will appear in the tool panel.

---

## Available MCP Tools

### DocType Management

| Tool | Description |
|------|-------------|
| `create_doctype` | Create a DocType with full field definitions |
| `get_doctype` | Fetch a DocType definition by name |
| `delete_doctype` | Delete a DocType (irreversible) |

### Document CRUD (any DocType)

| Tool | Description |
|------|-------------|
| `create_document` | Create a new document |
| `get_document` | Fetch a single document by name |
| `list_documents` | List documents with optional filters and field selection |
| `update_document` | Update fields on an existing document |
| `delete_document` | Delete a document |

---

## Example — Create a Theme document via Claude

Once connected, you can ask Claude:

> "Create a new Theme document with theme_name 'Ocean Blue', primary_color '#0077b6', and is_active checked."

Claude will call `create_document` with `doctype="Theme"` and the appropriate
field values.

---

## Error Reference

| HTTP Status | Message |
|-------------|---------|
| 401 / 403 | Authentication failed. Check your API Key and Secret. |
| 404 | Document or DocType not found. |
| 417 | Frappe validation error — readable message is returned |

---

## Troubleshooting

**"Cannot connect to Frappe"** — Confirm `FRAPPE_URL` is reachable and the
Frappe server is running (`bench start` or via supervisor).

**"Authentication failed"** — Regenerate your API Key/Secret and update `.env`.
Make sure the user has the **System Manager** role.

**"Theme DocType already exists"** — This is normal on subsequent startups.

**DocType creation fails with 417** — The `module` field must match an existing
Frappe module name. Use `"frappe_theme"` for this app or `"Custom"` for a
generic custom module.
