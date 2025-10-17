#!/bin/bash
# Quick Server Status Check
# Run: ./check-server.sh

echo "🔍 Lunas OS Server Status Check"
echo "================================"
echo ""

# Check if port 4010 is listening
if lsof -ti:4010 >/dev/null 2>&1; then
    echo "✅ Server is RUNNING on port 4010"
    echo "   Process IDs: $(lsof -ti:4010 | tr '\n' ' ')"
else
    echo "❌ Server is NOT running"
    echo "   To start: cd /Users/abenton333/LUNAS-OS && pnpm build && PORT=4010 pnpm start"
    exit 1
fi

echo ""
echo "📊 Testing Endpoints:"
echo ""

# Test readiness
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4010/__e2e-ready 2>/dev/null)
if [ "$STATUS" = "200" ]; then
    echo "  ✅ Readiness endpoint: OK"
else
    echo "  ⚠️  Readiness endpoint: $STATUS"
fi

# Test login page
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4010/login 2>/dev/null)
if [ "$STATUS" = "200" ]; then
    echo "  ✅ Login page: OK"
else
    echo "  ⚠️  Login page: $STATUS"
fi

# Test API
SERVICES=$(curl -s http://localhost:4010/api/services 2>/dev/null | jq length 2>/dev/null)
if [ ! -z "$SERVICES" ]; then
    echo "  ✅ API /services: $SERVICES items"
else
    echo "  ⚠️  API /services: Failed"
fi

echo ""
echo "🌐 Access URLs:"
echo "   • Main: http://localhost:4010"
echo "   • Login: http://localhost:4010/login"
echo "   • Dashboard: http://localhost:4010/dashboard"
echo "   • Contracts: http://localhost:4010/contracts"
echo ""
echo "💾 Database: dev.db (SQLite)"
echo "   Tables: $(sqlite3 dev.db '.tables' 2>/dev/null || echo 'N/A')"
echo ""
