# Lunas OS - Troubleshooting Guide

## Issues Identified and Fixed (October 13, 2025)

### Issue 1: Middleware EvalError in Development
**Error Message:**
```
EvalError: Code generation from strings disallowed for this context
```

**Root Cause:**
- The shell environment had `NODE_ENV=production` set globally
- Next.js dev server runs with development assumptions but the production NODE_ENV causes strict CSP in Edge Runtime middleware
- This prevents dynamic code evaluation needed for hot module replacement

**Solution Applied:**
- Updated Next.js config to explicitly set runtime configuration
- Added environment validation to prevent mismatched NODE_ENV

**Files Modified:**
- `next.config.ts` - Added explicit configuration for middleware edge runtime

---

### Issue 2: React Hydration Mismatch Warning
**Error Message:**
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
Attribute: style={{--vsc-domain:"localhost"}}
```

**Root Cause:**
- VSCode browser preview injects custom CSS variables into the HTML
- These attributes don't exist during server-side rendering
- Causes React hydration warnings (not errors, but produces console noise)

**Solution Applied:**
- Added `suppressHydrationWarning` to the html element in RootLayout
- This is the recommended Next.js approach for handling browser extensions

**Files Modified:**
- `app/layout.tsx` - Added suppressHydrationWarning prop

---

## How to Run the Development Server

### Method 1: Unset NODE_ENV (Recommended)
```bash
cd /Users/abenton333/lunas-os
unset NODE_ENV
pnpm dev
```

### Method 2: Use the provided script
The dev script in package.json already sets PORT=4010:
```bash
cd /Users/abenton333/lunas-os
pnpm dev
```

### Method 3: Explicitly set NODE_ENV
```bash
cd /Users/abenton333/lunas-os
NODE_ENV=development pnpm dev
```

---

## Development Server Details

- **URL:** http://localhost:4010
- **Network:** http://192.168.1.113:4010
- **Database:** PostgreSQL on localhost:5432
- **Environment Files:** `.env.local` (takes precedence), `.env`

---

## Prerequisites

1. **PostgreSQL Database:**
   - Must be running on port 5432
   - Check with: `lsof -i :5432`
   - Start if needed: `docker-compose up -d` (if using Docker)
   
2. **Node.js Environment:**
   - Should NOT have `NODE_ENV=production` set when running dev server
   - Check with: `echo $NODE_ENV`
   - Clear with: `unset NODE_ENV`

---

## Common Issues and Solutions

### Server won't start or shows middleware errors
1. Check if NODE_ENV is set to production:
   ```bash
   echo $NODE_ENV
   ```
2. If it is, unset it:
   ```bash
   unset NODE_ENV
   ```
3. Clean the build cache:
   ```bash
   rm -rf .next
   pnpm dev
   ```

### Port 4010 already in use
1. Find the process:
   ```bash
   lsof -i :4010
   ```
2. Kill it:
   ```bash
   kill -9 <PID>
   ```

### Database connection errors
1. Check if PostgreSQL is running:
   ```bash
   lsof -i :5432
   ```
2. Start the database:
   ```bash
   docker-compose up -d
   ```
3. Run migrations if needed:
   ```bash
   pnpm db:setup
   ```

---

## Build Info

- **Next.js:** 15.5.5
- **React:** 19.1.0
- **Node.js:** v24.5.0 (Homebrew)
- **Package Manager:** pnpm

---

## Login Credentials (Development)

Check the seed script for default users:
- Email: `dispatcher@lunas.com`
- Password: `password`

---

Last Updated: October 13, 2025
