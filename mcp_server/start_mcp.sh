#!/bin/bash
# MCP server launcher for bench Procfile.
# Kills any stale instance on the target port before starting fresh.

MCP_PORT="${MCP_PORT:-9000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON="/home/frappe/.pyenv/versions/3.11.6/bin/python"

# Kill any process already holding the port (via /proc — no lsof/ss needed)
PORT_HEX=$(printf "%04X" "$MCP_PORT")
for tcp_file in /proc/*/net/tcp /proc/*/net/tcp6; do
    while IFS= read -r line; do
        local_addr=$(echo "$line" | awk '{print $2}')
        port="${local_addr##*:}"
        if [[ "${port^^}" == "$PORT_HEX" ]]; then
            inode=$(echo "$line" | awk '{print $10}')
            pid=$(grep -rl "socket:\[$inode\]" /proc/*/fd 2>/dev/null \
                  | head -1 | cut -d/ -f3)
            if [[ -n "$pid" && "$pid" -ne $$ ]]; then
                echo "[mcp] Killing stale process $pid on port $MCP_PORT"
                kill "$pid" 2>/dev/null
            fi
        fi
    done < <(tail -n +2 "$tcp_file" 2>/dev/null)
done

# Also kill by name as a safety net
pkill -f "server.py --transport streamable-http" 2>/dev/null
sleep 0.5

echo "[mcp] Starting MCP server on port $MCP_PORT"
cd "$SCRIPT_DIR"
exec "$PYTHON" server.py --transport streamable-http --port "$MCP_PORT"
