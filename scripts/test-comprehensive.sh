#!/bin/bash
set -e

echo "================================================"
echo "  LUNAS-OS Comprehensive E2E Test Suite"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure Chromium is installed
echo -e "${BLUE}[1/4] Ensuring Chromium is installed...${NC}"
npx puppeteer browsers install chromium@1083080 || true
echo ""

# Check if server is already running
echo -e "${BLUE}[2/4] Checking if server is running on port 4010...${NC}"
if lsof -Pi :4010 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓ Server already running on port 4010${NC}"
    STARTED_SERVER=false
else
    echo -e "${YELLOW}Starting development server...${NC}"
    PORT=4010 pnpm dev > /tmp/lunas-dev.log 2>&1 &
    DEV_PID=$!
    STARTED_SERVER=true
    
    # Wait for server to be ready
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:4010/login > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is ready!${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi
echo ""

# Run the tests
echo -e "${BLUE}[3/4] Running comprehensive E2E tests...${NC}"
echo "================================================"
echo ""

BASE_URL=http://localhost:4010 pnpm jest tests/e2e/comprehensive.spec.ts --runInBand --verbose
TEST_EXIT_CODE=$?

echo ""
echo "================================================"
echo -e "${BLUE}[4/4] Test Results Summary${NC}"
echo "================================================"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
fi

echo ""
echo "================================================"
echo -e "${BLUE}Server Status:${NC} Running on http://localhost:4010"
echo "================================================"
echo ""

if [ "$STARTED_SERVER" = true ]; then
    echo -e "${YELLOW}Note: Server was started by test script (PID: $DEV_PID)${NC}"
    echo "The server will continue running for manual testing."
    echo "To stop it: kill $DEV_PID"
else
    echo -e "${GREEN}Note: Using existing server instance${NC}"
    echo "Server will continue running after tests."
fi

echo ""
exit $TEST_EXIT_CODE
