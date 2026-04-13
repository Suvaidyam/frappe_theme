#!/bin/bash
# Cloudflare tunnel wrapper for bench Procfile.
# Kills any stale cloudflared process, then starts a fresh tunnel and prints the URL.

MCP_PORT="${MCP_PORT:-9000}"
BENCH_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG_FILE="$BENCH_DIR/logs/mcp.log"

# Kill any stale cloudflared instances
pkill -f "cloudflared tunnel" 2>/dev/null && echo "[mcp-tunnel] Killed stale cloudflared process."
sleep 0.5

# Wait until the MCP server is accepting connections (max 30s)
echo "[mcp-tunnel] Waiting for MCP server on port $MCP_PORT..."
for i in $(seq 1 30); do
    if curl -s --max-time 1 "http://localhost:$MCP_PORT/mcp" -X POST \
        -H "Content-Type: application/json" \
        -d '{}' -o /dev/null 2>&1; then
        break
    fi
    sleep 1
done
echo "[mcp-tunnel] MCP server is up."

# Run cloudflared and watch for the tunnel URL
cloudflared tunnel --url "http://localhost:$MCP_PORT" 2>&1 | while IFS= read -r line; do
    echo "$line"
    if [[ "$line" =~ (https://[a-zA-Z0-9-]+\.trycloudflare\.com) ]]; then
        TUNNEL_URL="${BASH_REMATCH[1]}"
        MCP_URL="${TUNNEL_URL}/mcp"
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║              Frappe MCP Server — Ready                      ║"
        echo "╠══════════════════════════════════════════════════════════════╣"
        echo "║  MCP URL : $MCP_URL"
        echo "║  Add to  : claude.ai → Settings → Integrations              ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
        # Also write to bench log file for persistence
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] MCP URL: $MCP_URL" >> "$LOG_FILE"
    fi
done
