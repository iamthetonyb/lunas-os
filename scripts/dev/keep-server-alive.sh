#!/bin/bash

# Lunas OS - Keep Server Alive Script
# This script monitors and automatically restarts the dev server if it crashes

PORT=4010
MAX_RETRIES=10
RETRY_COUNT=0

echo "🔄 Keep-Alive Script Started"
echo "   Monitoring port $PORT"
echo "   Will auto-restart on crashes"
echo ""

cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    pkill -P $$ 
    exit 0
}

trap cleanup SIGINT SIGTERM

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "▶️  Starting server (Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    
    # Start the server in background with increased memory
    cd /Users/abenton333/LUNAS-OS
    NODE_OPTIONS='--max-old-space-size=4096' NODE_ENV=development PORT=$PORT pnpm next dev --turbo -p $PORT &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Check if server is running
    if lsof -i :$PORT > /dev/null 2>&1; then
        echo "✅ Server running on http://localhost:$PORT"
        RETRY_COUNT=0  # Reset retry count on successful start
        
        # Monitor the server process
        while kill -0 $SERVER_PID 2>/dev/null; do
            sleep 10
            # Check if port is still listening
            if ! lsof -i :$PORT > /dev/null 2>&1; then
                echo "⚠️  Server stopped responding on port $PORT"
                kill $SERVER_PID 2>/dev/null
                break
            fi
        done
        
        echo "❌ Server crashed. Restarting in 3 seconds..."
        sleep 3
    else
        echo "❌ Failed to start server"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 3
    fi
done

echo "💥 Max retries reached. Exiting."
exit 1
