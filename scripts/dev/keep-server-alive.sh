#!/bin/bash
set -euo pipefail

# Lunas OS - Keep Server Alive Script
# Keeps the dev server running by restarting it whenever it crashes.

PORT=${PORT:-4010}
MAX_RETRIES=${MAX_RETRIES:-10}
RETRY_COUNT=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "🔄 Keep-Alive Script Started"
echo "   Repo: $REPO_ROOT"
echo "   Port: $PORT"
echo ""

cleanup() {
  echo -e "\n🛑 Shutting down keep-alive..."
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  exit 0
}

trap cleanup SIGINT SIGTERM

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
  echo "▶️  Starting server (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
  NODE_OPTIONS='--max-old-space-size=4096' \
    NODE_ENV=development \
    PORT=$PORT \
    pnpm dev &
  SERVER_PID=$!

  sleep 5

  if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "✅ Server listening on http://localhost:$PORT"
    RETRY_COUNT=0

    while kill -0 "$SERVER_PID" 2>/dev/null; do
      sleep 10
      if ! lsof -i :"$PORT" >/dev/null 2>&1; then
        echo "⚠️  Port $PORT stopped responding; restarting..."
        kill "$SERVER_PID" 2>/dev/null || true
        break
      fi
    done

    wait "$SERVER_PID" || true
    echo "⚠️  Server exited; restarting shortly..."
    sleep 3
  else
    echo "❌ Failed to start server"
    kill "$SERVER_PID" 2>/dev/null || true
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 3
  fi
done

echo "💥 Max retries reached. Exiting."
exit 1
