#!/bin/bash

# Lunas OS Development Server Startup Script
# This script ensures proper environment configuration before starting the dev server

echo "🚀 Starting Lunas OS Development Server..."
echo ""

# Check if NODE_ENV is set to production
if [ "$NODE_ENV" = "production" ]; then
    echo "⚠️  Warning: NODE_ENV is set to 'production'"
    echo "   Unsetting for development mode..."
    unset NODE_ENV
fi

# Check if PostgreSQL is running
if ! lsof -i :5432 > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not running on port 5432"
    echo "   Starting database with docker-compose..."
    docker-compose up -d
    sleep 2
fi

# Check if port 4010 is already in use
if lsof -i :4010 > /dev/null 2>&1; then
    echo "⚠️  Port 4010 is already in use"
    echo "   Please stop the existing server or use: lsof -i :4010"
    exit 1
fi

echo "✅ Environment checks passed"
echo ""
echo "📦 Starting Next.js development server..."
echo "   URL: http://localhost:4010"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
pnpm dev
