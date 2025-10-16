# LUNAS-OS Repository Status

**Last Updated**: October 16, 2025  
**Status**: ⚠️ UNSTABLE - Crashes occurring frequently

---

## Quick Access

### Start Here
1. **HANDOFF-SUMMARY.md** - Quick overview for new developers (10KB, 5 min read)
2. **CRASH-ANALYSIS.md** - Detailed technical analysis (21KB, 20 min read)  
3. **README.md** - Complete project documentation (20KB)

### Commands
```bash
# Start application
pnpm dev

# Run tests  
pnpm test:e2e

# Access app
http://localhost:4010

# Database
docker compose up -d
```

---

## File Organization

### Root Documentation (Consolidated)
- ✅ **README.md** - Main documentation (780 lines)
- ✅ **CRASH-ANALYSIS.md** - Technical deep-dive (718 lines)
- ✅ **HANDOFF-SUMMARY.md** - Quick reference (380 lines)
- ✅ **REPO-STATUS.md** - This file

### Removed Files (Consolidated into README.md)
- ❌ CRASH-FIXES-FINAL.md (deleted - merged into README)
- ❌ FIXES-APPLIED.md (deleted - merged into README)
- ❌ STABILITY-FIXES.md (deleted - merged into README)  
- ❌ STABILITY-SUMMARY.md (deleted - merged into README)
- ❌ FINAL-STATUS.txt (deleted - redundant)

### Supporting Documentation
- docs/PROJECT-CLEANUP-2025-10-16.md
- docs/TEST-RESULTS-2025-10-16.md
- docs/E2E-TESTING-SETUP.md

---

## Application Structure

### Critical Paths (Known Crash Sites)
```
app/
├── contracts/page.tsx          ⚠️ PRIMARY CRASH LOCATION
├── contracts/error.tsx         ✅ Error boundary exists
├── dashboard/page.tsx          ⚠️ Secondary crash site
├── dashboard/error.tsx         ✅ Error boundary exists
├── layout.tsx                  ✅ Global error handlers added
├── error.tsx                   ✅ Root error boundary
└── global-error.tsx            ✅ Global error boundary

components/
├── services-crud.tsx           ⚠️ Fetcher issues
├── model-plans-crud.tsx        ⚠️ Fetcher issues  
├── rates-crud.tsx              ⚠️ Fetcher issues
├── intake-form.tsx             ⚠️ Fetcher issues
├── tubs-windows-import.tsx     ⚠️ Fetcher issues
└── swr-provider.tsx            ⚠️ Configuration issues

app/api/
├── services/route.ts           ❌ NO ERROR HANDLING
├── model-plans/route.ts        ❌ NO ERROR HANDLING
├── contract-rates/route.ts     ❌ NO ERROR HANDLING
└── builders/route.ts           ❌ NO ERROR HANDLING
```

### Database
```
db/
├── schema/                     ✅ Properly defined
├── index.ts                    ⚠️ No connection health checks
└── README.md                   ✅ Documentation exists

docker-compose.yml              ✅ PostgreSQL container defined
```

---

## Dependency Status

### Stable Versions (Current)
```json
{
  "next": "15.5.5",             ✅ Latest stable
  "react": "19.0.0",            ✅ Production release
  "react-dom": "19.0.0",        ✅ Matches React
  "tailwindcss": "3.4.3",       ✅ Stable v3
  "swr": "2.3.6",               ✅ Latest
  "drizzle-orm": "0.44.6",      ✅ Latest
  "typescript": "5.9.3"         ✅ Latest TS5
}
```

### Version History (Failed Attempts)
- ❌ Next 14.2.33 + React 18.3.1 - Config file incompatibility
- ❌ Tailwind v4 beta - Complete UI breakdown
- ❌ Mixed versions - Compatibility issues

---

## Git Status

### Branch: main (fe7d091)
```
Modified (not committed):
  M README.md                    (Crash analysis added)
  M app/contracts/page.tsx       (UI improvements)
  M app/layout.tsx               (Error handlers added)
  M components/*-crud.tsx        (Fetcher improvements)
  M components/swr-provider.tsx  (Config updates)

New files:
  ?? CRASH-ANALYSIS.md           (Comprehensive analysis)
  ?? HANDOFF-SUMMARY.md          (Quick reference)
  ?? REPO-STATUS.md              (This file)
  ?? app/dashboard/error.tsx     (Error boundary)
```

### Recent Commits
```
fe7d091 Stability improvements and UI enhancements
6f01a19 Fix server crashes and improve stability
d474db9 docs: Update README badges and stability report
6bc2141 Fix: Resolve Tailwind CSS and package.json issues
e5cdc90 docs: Add comprehensive stability report
```

---

## Environment

### Development
```bash
Node.js:        v24.5.0
pnpm:           v10.14.0
Port:           4010
Memory:         4096MB allocated
Database:       PostgreSQL 15 (Docker)
DB Port:        5432
Build Tool:     Turbopack (dev), Webpack (prod)
```

### Database
```bash
Container:      lunas-postgres
Image:          postgres:15
Port:           5432:5432
Volume:         postgres_data
Database:       lunas_db
User:           postgres
Password:       postgres
```

---

## Issue Summary

### Current State: UNSTABLE

**Symptoms:**
- ⚠️ Crashes when navigating to Contracts page
- ⚠️ Crashes when switching tabs
- ⚠️ Crashes when refreshing during data fetch
- ⚠️ "Failed to fetch" errors in console
- ⚠️ "Internal Server Error" responses

**Attempted Fixes (12+ hours):**
- ✅ Added 5 error boundaries
- ✅ Enhanced all fetchers with timeout protection
- ✅ Improved SWR configuration  
- ✅ Added global error handlers
- ✅ Tried different framework versions
- ⚠️ **Still crashing frequently**

**Confidence in Root Cause:**
- 90% - API routes with no error handling
- 80% - Fetchers still throwing in edge cases
- 70% - Database connection/timeout issues
- 40% - React 19 / Next.js 15 compatibility
- 30% - SWR error propagation

---

## Immediate Actions Required

### Priority 1: Fix API Routes (CRITICAL)
Add try/catch with timeout to ALL API routes in `app/api/*/route.ts`

### Priority 2: Fix Fetchers (CRITICAL)  
Ensure fetchers NEVER throw, catch ALL error types including AbortError

### Priority 3: Fix Contracts Page (HIGH)
Keep tab components mounted, prevent unmount/remount cycle

### Priority 4: Add Logging (HIGH)
Comprehensive structured logging to identify failure points

### Priority 5: Monitor Database (MEDIUM)
Add connection health checks and query timeouts

---

## Testing Checklist

Before declaring stable:
- [ ] All API endpoints return 200 or proper error JSON
- [ ] No hanging requests (all complete within 10s)
- [ ] Contracts page tab switching works 20+ times
- [ ] Page refreshes don't cause crashes
- [ ] Network disconnection handled gracefully
- [ ] 30+ minutes of continuous use without crash
- [ ] All pages accessible without errors
- [ ] Console shows no unhandled rejections

---

## Documentation Quality

### Consolidated Documentation: ✅ COMPLETE
- All status files merged into README.md
- Technical analysis in CRASH-ANALYSIS.md
- Quick reference in HANDOFF-SUMMARY.md
- Repository overview in REPO-STATUS.md (this file)

### No Redundant Files: ✅ CLEAN
- Removed 4 duplicate status markdown files
- Removed old FINAL-STATUS.txt
- Single source of truth: README.md

### AI Agent Friendly: ✅ OPTIMIZED
- Clear file structure
- Prioritized information
- Code examples included
- Testing strategies provided
- Alternative approaches documented

---

## Success Metrics

**When Fixed:**
- ✅ Application runs 24+ hours without crash
- ✅ All pages accessible and functional
- ✅ Error states show gracefully, not crashes
- ✅ API responses within 5 seconds or proper error
- ✅ Database queries complete or timeout properly
- ✅ Console shows warnings only, no errors
- ✅ Memory usage stable over time

**When Production Ready:**
- ✅ All above + comprehensive test suite passing
- ✅ Error monitoring integrated (Sentry/LogRocket)
- ✅ Performance monitoring in place
- ✅ Database backups configured
- ✅ Deployment pipeline tested
- ✅ Security audit completed

---

## Resources

### Documentation
- README.md - Complete guide
- CRASH-ANALYSIS.md - Technical deep-dive
- HANDOFF-SUMMARY.md - Quick reference

### External Links
- [Next.js 15 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [SWR Docs](https://swr.vercel.app)
- [Drizzle ORM Docs](https://orm.drizzle.team)

### Community
- GitHub Issues (if repository has remote)
- Team communication channel
- Stack Overflow (Next.js, React tags)

---

**Repository is clean, documented, and ready for expert review.**

**Status**: Documentation complete, application unstable, awaiting fixes.
