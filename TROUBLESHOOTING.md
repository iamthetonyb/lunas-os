# LUNAS-OS Troubleshooting Guide

## Table of Contents
- [Server Issues](#server-issues)
- [Database Problems](#database-problems)
- [CSS & Build Errors](#css--build-errors)
- [Crash Recovery](#crash-recovery)
- [API & Network Issues](#api--network-issues)
- [Development Environment](#development-environment)

---

## Server Issues

### Port 4010 Already in Use

**Symptom**: `EADDRINUSE: address already in use :::4010`

**Solution**:
```bash
# Find process using port 4010
lsof -ti:4010

# Kill the process
lsof -ti:4010 | xargs kill -9

# Or use pkill for all Next.js processes
pkill -f next
```

### Server Crashes on Navigation

**Symptom**: Server crashes when clicking tabs or navigating between pages

**Root Cause**: Fetch errors not being caught, SWR aggressive revalidation, or unhandled promise rejections

**Solution**: This has been fixed in the current version with:
1. Robust fetchers with 10s timeout and abort controllers
2. Stable SWR configuration (no aggressive revalidation)
3. Global error handlers for unhandled rejections
4. Error boundaries on all pages

**If still experiencing crashes**:
```bash
# 1. Check browser console for errors
# 2. Check terminal for server errors
# 3. Restart fresh:
pkill -f next
rm -rf .next
pnpm build
PORT=4010 pnpm start
```

### Internal Server Error (500)

**Symptom**: Pages return 500 Internal Server Error

**Common Causes**:
1. Database connection lost
2. Missing environment variables
3. API route errors
4. Unhandled exceptions in server components

**Solution**:
```bash
# 1. Check environment variables
cat .env.local
# Ensure NEXTAUTH_URL, BASE_URL, SQLITE_PATH are set

# 2. Check database connection
ls -lh dev.db
# Should exist and be readable

# 3. Check terminal logs for specific error
# Look for stack traces or error messages

# 4. Restart with clean build
rm -rf .next
pnpm build
pnpm start
```

---

## Database Problems

### Database Locked Error

**Symptom**: `SQLITE_BUSY: database is locked`

**Cause**: Another process has the database file open, or a previous process didn't close properly

**Solution**:
```bash
# Option 1: Kill all processes using the database
lsof dev.db | awk 'NR>1 {print $2}' | xargs kill -9

# Option 2: Remove lock files
rm -f dev.db-shm dev.db-wal

# Option 3: Recreate database
rm dev.db dev.db-*
pnpm db:setup:sqlite
```

### Connection Refused / ECONNREFUSED

**Symptom**: `connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: Trying to connect to PostgreSQL when using SQLite

**Solution**:
```bash
# Edit .env.local - remove or comment out DATABASE_URL
# DATABASE_URL=postgresql://...  # <- Comment this out

# Add SQLite path instead
echo "SQLITE_PATH=dev.db" >> .env.local

# Restart server
pkill -f next
pnpm start
```

### Migrations Won't Run

**Symptom**: `Migration failed` or `Error: Cannot find module 'drizzle'`

**Solution**:
```bash
# 1. Build TypeScript scripts first
pnpm build:scripts

# 2. Run SQLite migrations
pnpm db:generate:sqlite
pnpm db:migrate:sqlite

# 3. If still failing, check schema files
ls -la db/schema/
# All .ts files should be present

# 4. Check drizzle config
cat drizzle.config.sqlite.ts
# Should point to correct schema path
```

---

## CSS & Build Errors

### "Unexpected character '@'" Error

**Symptom**: `Module parse failed: Unexpected character '@'` in CSS files

**Cause**: PostCSS/Tailwind not being processed correctly in dev mode (especially on Node 24.x)

**Solution 1 - Use Production Mode** (Recommended):
```bash
pnpm build
PORT=4010 pnpm start
```

**Solution 2 - Switch to Node 20 LTS**:
```bash
# Install Node 20 if using nvm
nvm install 20
nvm use 20
node -v  # Should show v20.x.x

# Clean and rebuild
rm -rf node_modules .next pnpm-lock.yaml
pnpm install
pnpm dev
```

**Solution 3 - Verify PostCSS Config**:
```bash
# Check postcss.config.js exists
cat postcss.config.js
# Should contain: { plugins: { tailwindcss: {}, autoprefixer: {} } }

# Check globals.css uses Tailwind v3 syntax
head -5 app/globals.css
# Should show: @tailwind base; @tailwind components; @tailwind utilities;
```

### UI Completely Broken / No Styling

**Symptom**: All styling missing, app looks unstyled HTML

**Cause**: Tailwind CSS not compiled or loaded

**Diagnosis**:
```bash
# Check if CSS file generated
ls -la .next/static/css/
# Should show generated CSS files

# Check browser network tab
# Look for successful CSS file load (200 status)
```

**Solution**:
```bash
# 1. Clear Next.js cache
rm -rf .next

# 2. Rebuild
pnpm build

# 3. Check for build errors in terminal
# Fix any compilation errors shown

# 4. Start server
pnpm start

# 5. Access app and check browser console for CSS load errors
```

### Build Fails with TypeScript Errors

**Symptom**: `Type error: ...` during build

**Solution**:
```bash
# 1. Check TypeScript version
pnpm list typescript

# 2. Run TypeScript compiler to see all errors
pnpm tsc --noEmit

# 3. Fix errors one by one, or skip type checking for quick build
pnpm build --no-lint

# 4. For persistent errors, check tsconfig.json
cat tsconfig.json
```

---

## Crash Recovery

### App Crashes When Refreshing Page

**Symptom**: Page works initially, crashes on refresh

**Cause**: Usually hydration mismatch or data fetching during SSR

**Solution**:
```bash
# Check browser console for hydration errors
# Look for: "Hydration failed" or "Text content does not match"

# Common fixes:
# 1. Ensure client-only code uses useEffect
# 2. Check data fetching is properly handled
# 3. Verify no localStorage/window usage during SSR
```

**Code Fix**:
```typescript
// Bad (causes hydration error)
const data = localStorage.getItem('key');

// Good (client-only)
const [data, setData] = useState(null);
useEffect(() => {
  setData(localStorage.getItem('key'));
}, []);
```

### Repeated Crashes on Contracts/Specific Page

**Symptom**: Specific page always crashes

**Diagnosis Steps**:
1. Check browser console (F12 → Console tab)
2. Check terminal for server errors
3. Check Network tab for failed API calls

**Common Issues & Fixes**:

**Issue 1: API Timeout**
```typescript
// Problem: API takes too long
// Solution: Already fixed with 10s timeout + abort controller
```

**Issue 2: Tab Unmount/Remount**
```typescript
// Problem: Tabs unmount and lose state
// Solution: Use visibility toggle instead of conditional rendering

// Bad
{activeTab === 'tab1' && <TabContent />}

// Good  
<TabContent className={activeTab === 'tab1' ? 'block' : 'hidden'} />
```

**Issue 3: SWR Revalidation Storm**
```typescript
// Problem: SWR keeps refetching
// Solution: Already configured in swr-provider.tsx with:
// - revalidateOnFocus: false
// - revalidateOnReconnect: false
// - errorRetryCount: 0
```

### Memory Leak / High Memory Usage

**Symptom**: Memory usage keeps climbing, app slows down

**Diagnosis**:
```bash
# Monitor Node memory
node --expose-gc --max-old-space-size=4096 .next/standalone/server.js

# Watch memory in terminal while using app
# Look for continuously climbing heap usage
```

**Solutions**:
```bash
# 1. Increase heap size (temporary)
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm start

# 2. Check for memory leaks in code
# - Unclosed connections
# - Event listeners not removed
# - Large data structures kept in memory

# 3. Restart server periodically in production
# Use process manager like PM2 with restart policies
```

---

## API & Network Issues

### "Failed to fetch" Errors

**Symptom**: API calls fail with "Failed to fetch"

**Cause**: Network issues, API timeout, or CORS problems

**Solution**:
```bash
# 1. Test API endpoint directly
curl http://localhost:4010/api/services

# 2. Check if API route exists
ls -la app/api/services/route.ts

# 3. Verify API route exports GET/POST
cat app/api/services/route.ts
# Should export: export async function GET() {...}

# 4. Check API returns JSON
# All API routes should return: NextResponse.json(...)
```

**Code Fix** (in API route):
```typescript
// Bad - can crash
export async function GET() {
  const data = await db.select().from(services);
  return NextResponse.json(data);
}

// Good - crash-proof
export async function GET() {
  try {
    const data = await db.select().from(services);
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
```

### API Timeouts

**Symptom**: Requests hang for 30+ seconds then fail

**Cause**: Database query too slow or deadlock

**Solution**:
```bash
# 1. Check if database is responding
# For SQLite:
sqlite3 dev.db "SELECT COUNT(*) FROM services;"

# 2. Check for long-running queries
# Add logging to API routes:
console.time('API /api/services');
// ... db query ...
console.timeEnd('API /api/services');

# 3. Optimize slow queries
# - Add database indexes
# - Limit result sets
# - Use pagination
```

### CORS Errors

**Symptom**: `Access-Control-Allow-Origin` error in browser

**Cause**: API calls from different origin

**Solution**:
```typescript
// Add CORS headers to API route
export async function GET(request: Request) {
  const response = NextResponse.json(data);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  return response;
}
```

---

## Development Environment

### pnpm Install Fails

**Symptom**: `pnpm install` errors or warnings

**Solution**:
```bash
# 1. Clear pnpm cache
pnpm store prune

# 2. Remove node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# 3. Reinstall
pnpm install

# 4. Approve build scripts if needed
pnpm approve-builds
# Select: better-sqlite3, esbuild, puppeteer
```

### Husky Git Hooks Not Working

**Symptom**: Pre-commit hooks don't run

**Solution**:
```bash
# 1. Reinstall Husky
pnpm husky install

# 2. Check hooks are executable
ls -la .husky/
chmod +x .husky/pre-commit

# 3. Test hook manually
./.husky/pre-commit
```

### ESLint Errors Blocking Commit

**Symptom**: Can't commit due to linting errors

**Solution**:
```bash
# 1. See all errors
pnpm lint

# 2. Auto-fix what's possible
pnpm lint:fix

# 3. For urgent commits, skip hooks (use sparingly)
git commit --no-verify -m "message"

# 4. Then fix linting issues
pnpm lint:fix
```

### Hot Reload Not Working

**Symptom**: Changes don't appear in browser

**Solution**:
```bash
# 1. Check terminal for compilation errors
# Look for: ✓ Compiled in Xms

# 2. Hard refresh browser
# Mac: Cmd+Shift+R
# Windows/Linux: Ctrl+Shift+R

# 3. Restart dev server
pkill -f next
pnpm dev

# 4. Clear browser cache
# DevTools → Network tab → Disable cache checkbox
```

### Node Version Issues

**Symptom**: Different errors on different machines

**Cause**: Using different Node versions

**Solution**:
```bash
# 1. Check current version
node -v

# 2. Install recommended version (Node 20 LTS)
nvm install 20
nvm use 20

# 3. Create .nvmrc in project root
echo "20" > .nvmrc

# 4. Auto-use when entering directory
# Add to ~/.zshrc or ~/.bashrc:
# autoload -U add-zsh-hook
# load-nvmrc() { nvm use }
# add-zsh-hook chpwd load-nvmrc
```

---

## Emergency Recovery

### Nuclear Option - Complete Reset

If nothing else works:

```bash
# 1. Save your .env.local
cp .env.local .env.local.backup

# 2. Kill all Node processes
pkill -f node
pkill -f next

# 3. Remove all generated files
rm -rf node_modules .next .turbo pnpm-lock.yaml dist
rm dev.db dev.db-*

# 4. Clear pnpm cache
pnpm store prune

# 5. Reinstall from scratch
pnpm install
pnpm approve-builds

# 6. Rebuild database
pnpm db:setup:sqlite

# 7. Build and start
pnpm build
PORT=4010 pnpm start

# 8. Restore environment
cp .env.local.backup .env.local
```

---

## Getting Help

### Before Asking for Help

Gather this information:

1. **Error Message** (exact text from terminal or browser console)
2. **Steps to Reproduce** (what did you click/do before the error?)
3. **Environment Info**:
   ```bash
   node -v
   pnpm -v
   cat package.json | grep "\"next\""
   cat package.json | grep "\"react\""
   ```
4. **Recent Changes** (what was edited recently?)
   ```bash
   git log --oneline -5
   git status
   ```

### How to Report Crashes

Include:
- Browser console output (F12 → Console → copy all errors)
- Terminal output (server logs)
- Network tab (F12 → Network → failed requests)
- Screenshot of the error page
- Steps that trigger the crash consistently

---

**Last Updated**: October 17, 2025  
**For More Info**: See [README.md](./README.md)  
**Quick Start**: See [QUICK-START.md](./QUICK-START.md)
