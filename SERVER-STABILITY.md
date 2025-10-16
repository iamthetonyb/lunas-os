# Server Stability Guide

## Problem
The Next.js development server was crashing intermittently, likely due to:
1. Memory constraints (default ~2GB heap size)
2. Turbopack hot-reload issues
3. No automatic recovery

## Solutions Implemented

### 1. Increased Memory Allocation
- Increased Node.js heap size from 2GB to 4GB
- Added `NODE_OPTIONS='--max-old-space-size=4096'` to dev scripts

### 2. Keep-Alive Script
Created `keep-server-alive.sh` that:
- Automatically restarts the server if it crashes
- Monitors port 4010 for availability
- Provides up to 10 restart attempts
- Resets retry count on successful starts

### 3. Running the Server

**Option 1: Standard (with increased memory)**
```bash
pnpm dev
```

**Option 2: Auto-restart on crash**
```bash
pnpm dev:keepalive
```

**Option 3: Safe start with checks**
```bash
pnpm dev:safe
```

### 4. Monitoring Server Health

Check if server is running:
```bash
lsof -i :4010
```

View server logs:
```bash
# Logs are in terminal where server was started
```

Kill server if needed:
```bash
lsof -ti :4010 | xargs kill -9
```

### 5. Best Practices

1. **Use Keep-Alive in Development**: `pnpm dev:keepalive`
2. **Clear Port Before Starting**: If port 4010 is in use
3. **Monitor Memory**: Watch for memory warnings in console
4. **Restart Periodically**: If making major changes, manual restart is safer

### 6. Troubleshooting

**Server won't start:**
- Check port 4010: `lsof -i :4010`
- Check database: `docker-compose up -d`
- Clear .next: `rm -rf .next`

**Server keeps crashing:**
- Check console for errors
- Try webpack mode: `pnpm dev:webpack`
- Increase memory further in package.json

**Pages not updating:**
- Hard refresh browser: Cmd+Shift+R
- Clear browser cache
- Restart server

## Changes Made

1. **package.json**: Added memory allocation and new script
2. **keep-server-alive.sh**: New monitoring script
3. **UI Updates**: Invoicing and Contracts pages now match Dispatch page style

## Access URLs

- **Local**: http://localhost:4010
- **Network**: http://192.168.1.113:4010 (from other devices on network)

Default login:
- Email: dispatcher@lunas.com
- Password: password
