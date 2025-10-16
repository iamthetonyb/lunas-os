# LUNAS-OS: Issue Handoff Summary

**Date**: October 16, 2025  
**Priority**: CRITICAL  
**Status**: Unstable - Requires Expert Review & Fix

---

## Quick Overview

**Problem**: LUNAS-OS web application is experiencing repeated crashes despite multiple stabilization attempts over the past 12 hours.

**Impact**: Application is unusable - crashes occur when:
- Navigating to Contracts page
- Clicking on tabs or navigation items  
- Refreshing pages during data fetching
- After ~1-2 minutes of use

**What's Been Tried**: 
- Added error boundaries (5+ files)
- Enhanced all data fetchers with timeout protection
- Improved SWR configuration
- Added global error handlers
- Tried different React/Next.js versions
- Multiple debugging sessions

**Result**: Still crashing frequently

---

## Critical Information

### Repository Details
- **Location**: `/Users/abenton333/LUNAS-OS`
- **Main Branch**: `main`
- **Last Stable**: Never fully stable
- **Git User**: Tony B. (iam@thetonyb.com)

### Technology Stack
```json
{
  "next": "15.5.5",
  "react": "19.0.0", 
  "react-dom": "19.0.0",
  "tailwindcss": "3.4.3",
  "database": "PostgreSQL 15 (Docker)",
  "orm": "drizzle-orm",
  "state": "SWR 2.3.6",
  "node": "v24.5.0",
  "port": "4010"
}
```

### How to Start
```bash
cd /Users/abenton333/LUNAS-OS

# Start database
docker compose up -d

# Start dev server
pnpm dev

# Access app
# http://localhost:4010
```

---

## Documentation Overview

### Primary Documents (Read These First)

1. **README.md** (20KB)
   - Complete project overview
   - Setup instructions
   - Architecture details
   - Recently updated with crash analysis section

2. **CRASH-ANALYSIS.md** (21KB) 
   - **MOST IMPORTANT** - Start here
   - Comprehensive technical analysis
   - Root cause hypotheses  
   - Recommended solutions (prioritized)
   - Testing strategies
   - Alternative approaches if fixes don't work

3. **HANDOFF-SUMMARY.md** (this file)
   - Quick reference for handoff

### Supporting Documents

4. **docs/PROJECT-CLEANUP-2025-10-16.md**
   - Recent refactoring history
   - What was cleaned up

5. **docs/TEST-RESULTS-2025-10-16.md**
   - E2E test results
   - Known working features

6. **docs/E2E-TESTING-SETUP.md**
   - How to run automated tests

---

## Key Files to Investigate

### Crash-Prone Components (Priority Order)

1. **app/contracts/page.tsx** - PRIMARY CRASH SITE
   - Tab switching causes crashes
   - Mounts/unmounts components repeatedly
   - No data persistence between tabs

2. **components/services-crud.tsx** - Fetching issues
   - Uses SWR with fetcher that may still throw
   - Optimistic updates can fail
   - Error handling incomplete

3. **components/model-plans-crud.tsx** - Same pattern as above
4. **components/rates-crud.tsx** - Same pattern as above
5. **components/swr-provider.tsx** - SWR configuration
6. **app/layout.tsx** - Global error handlers
7. **app/api/** - All API routes have NO error handling

### Critical API Routes (NO ERROR HANDLING)

```
app/api/services/route.ts
app/api/model-plans/route.ts  
app/api/contract-rates/route.ts
app/api/builders/route.ts
```

All follow this dangerous pattern:
```typescript
export async function GET() {
  const data = await db.select().from(table); // Can throw/hang
  return NextResponse.json(data); // No try/catch
}
```

---

## Suspected Root Causes (From Analysis)

### 1. API Routes with Zero Error Handling (90% confidence)
- Database queries can hang indefinitely
- No timeouts on DB calls
- Unhandled exceptions crash the API route
- Returns 500 errors that fetcher doesn't handle well

### 2. Fetchers Still Throwing Errors (80% confidence)
- Despite enhancements, fetchers throw in edge cases
- AbortError not specifically handled
- JSON parsing can fail without try/catch
- Some error paths still throw instead of returning empty array

### 3. Database Connection Issues (70% confidence)
- No connection health checks
- No retry logic
- Connection pool may be exhausting
- Queries can hang forever

### 4. React 19 / Next.js 15 Edge Cases (40% confidence)
- Newer versions have different error handling
- Hydration mismatches more visible
- Suspense behavior changed
- Error boundaries may not catch all errors

### 5. SWR Error Propagation (30% confidence)
- Despite configuration, errors may still bubble up
- Multiple components fetching simultaneously
- Race conditions on tab switching

---

## Recommended Fix Approach (From CRASH-ANALYSIS.md)

### Phase 1: Fix API Routes (CRITICAL - Do This First)
Add try/catch with timeout to ALL API routes:

```typescript
export async function GET() {
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB timeout')), 5000)
    );
    const queryPromise = db.select().from(table);
    const data = await Promise.race([queryPromise, timeoutPromise]);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch', details: error.message },
      { status: 500 }
    );
  }
}
```

Apply to: `/api/services`, `/api/model-plans`, `/api/contract-rates`, `/api/builders`, all others

### Phase 2: Fix Fetcher to NEVER Throw (CRITICAL)
Ensure fetcher catches ALL errors including AbortError and JSON parse errors:

```typescript
const fetcher = async (url: string) => {
  try {
    // ... fetch logic
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Timeout:', url);
    } else {
      console.error('Fetch error:', url, error);
    }
    return []; // ALWAYS return empty array, NEVER throw
  }
};
```

Apply to: All CRUD components (5 files)

### Phase 3: Fix Contracts Page Data Persistence
Keep all tab components mounted, just hide them:

```typescript
<div style={{ display: activeTab === 'services' ? 'block' : 'none' }}>
  <ServicesCRUD />
</div>
```

This prevents unmounting/remounting which causes re-fetching.

### Phase 4: Add Comprehensive Logging
Add structured logging to see exactly where failures occur.

---

## Testing Strategy

### Step 1: Verify Each API Endpoint
```bash
curl http://localhost:4010/api/services
curl http://localhost:4010/api/model-plans  
curl http://localhost:4010/api/contract-rates
```

Should return 200 with data or 500 with error JSON. Should NEVER hang.

### Step 2: Test Contracts Page
- Navigate to http://localhost:4010/contracts
- Switch between all 3 tabs (Services, Model Plans, Rates)
- Refresh page multiple times
- Should not crash

### Step 3: Stress Test
- Navigate between all pages rapidly
- Refresh during data loading
- Disconnect network mid-request
- Should gracefully handle all scenarios

---

## Environment Details

### Database
```bash
# PostgreSQL running in Docker
docker ps | grep postgres

# Connection string (from .env.local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lunas_db
```

### Development Server
```bash
# Port: 4010
# Memory: 4096MB allocated
# Using Turbopack (can try Webpack if issues persist)
```

### Recent Changes
- Git log shows 20+ commits with stability fixes
- Latest: "Stability improvements and UI enhancements" (fe7d091)
- Multiple version downgrades/upgrades attempted
- Tailwind v4 → v3 rollback due to breaking changes

---

## Alternative Approaches if Fixes Don't Work

1. **Replace SWR with React Query** - Better error handling built-in
2. **Move to Server-Side Data Fetching** - Fetch in page.tsx instead of components
3. **Separate Backend** - Move API routes to Express.js
4. **Add Redis Caching Layer** - Reduce database load
5. **Downgrade to Next 14 + React 18** - But requires config file changes

---

## What NOT to Do

❌ **Don't create more status/fix files** - Documentation is now consolidated  
❌ **Don't try version changes first** - Fix the code issues first  
❌ **Don't add more error boundaries** - Already have 5, not the issue  
❌ **Don't modify node_modules** - Use proper fixes only  
❌ **Don't commit secrets** - Already in .gitignore  

---

## Success Criteria

The fix is successful when:
- ✅ No crashes for 30+ minutes of continuous use
- ✅ Can navigate between all pages without errors
- ✅ Can switch tabs in Contracts page repeatedly
- ✅ Can refresh pages during data fetch without crash
- ✅ Network failures show empty states, not crashes
- ✅ Console shows warnings/errors but no unhandled rejections

---

## Current Git State

Modified files (not committed):
```
M README.md                          (Updated with crash analysis)
M app/contracts/page.tsx             (UI improvements, still crashes)
M app/layout.tsx                     (Global error handlers added)
M components/*-crud.tsx              (Enhanced fetchers, still issues)
M components/swr-provider.tsx       (Stable config, still issues)
?? CRASH-ANALYSIS.md                 (New - comprehensive analysis)
?? HANDOFF-SUMMARY.md                (This file)
?? app/dashboard/error.tsx           (Error boundary added)
```

All changes are improvements but haven't resolved crashes.

---

## Contact Information

**Project Owner**: Tony B.
- Email: iam@thetonyb.com
- Git User: Tony B. <iam@thetonyb.com>

**Repository**: `/Users/abenton333/LUNAS-OS`  
**Remote**: (if applicable, check with `git remote -v`)

---

## Next Steps for Receiving AI

1. **Read CRASH-ANALYSIS.md in full** - Contains detailed technical analysis
2. **Start development server** - `cd /Users/abenton333/LUNAS-OS && pnpm dev`
3. **Reproduce the crash** - Navigate to Contracts page, click tabs, refresh
4. **Apply Priority 1 fixes** - Start with API route error handling
5. **Test thoroughly** - Use testing strategy above
6. **Monitor terminal output** - Look for specific error patterns
7. **Consider alternatives** - If fixes don't work after 2-3 attempts

---

## Questions to Investigate

1. Are database queries actually hanging, or returning quickly?
2. What's the exact error in the terminal when it crashes?
3. Does it crash in production build or only dev?
4. Is Turbopack the issue? (Try Webpack)
5. Is PostgreSQL container healthy?
6. Are there memory leaks causing gradual degradation?
7. Is it a specific API route or all of them?

---

**This handoff document summarizes 12+ hours of debugging attempts. The crash persists despite multiple fix attempts. Fresh perspective needed.**

**Last Updated**: October 16, 2025  
**Prepared By**: GitHub Copilot CLI  
**Status**: Ready for handoff to expert
