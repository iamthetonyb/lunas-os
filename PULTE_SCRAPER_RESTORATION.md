# Pulte Blue-Book Scraper Restoration - Summary

## Overview
Restored and enhanced the original Playwright-based Blue-Book scraper with full ingestion pipeline, command-line interface, and idempotent database operations.

## Files Created/Modified

### New Files
1. **scripts/harvest-pulte.ts** (527 lines)
   - Standalone Playwright scraper
   - Command-line interface with yargs
   - Multi-tab capable architecture
   - Community/date filtering
   - Pagination and row expansion logic
   - Outputs structured JSON (items + jobs)

2. **scripts/ingest-pulte-live.ts** (482 lines)
   - Idempotent database ingestion
   - Calls harvest-pulte.ts programmatically
   - Enum-safe unit_kind mapping
   - Batch processing (250 items/batch)
   - Comprehensive statistics output
   - Natural key deduplication

### Modified Files
3. **package.json**
   - Added `harvest:pulte` - new CLI harvester
   - Added `ingest:pulte:live` - harvest + ingest pipeline
   - Renamed old harvester to `harvest:pulte:old`
   - Added yargs and @types/yargs dependencies

4. **app/api/ingest/pulte/route.ts**
   - Added `jobs` field to HarvesterPayload type
   - Compatible with both old and new harvester formats

## Source History

### Restored from Git Commits
- **af9d12a** (2025-10-18): "Integrate Pulte harvesting data into schedule"
  - Initial Playwright scraper with login, date range, expansion
  - Used for: login(), setDateRange(), expandAllPlusButtons()
  
- **88dfa4d** (2025-10-25): "Scrape Pulte jobs for community names and SCAR dates"
  - Added community/job scraping from Jobs page
  - Used for: scrapeJobs(), JobCommunity type
  
- **5989339** (2025-10-25): "Strip numeric suffixes from Pulte community names"
  - Community name normalization logic
  - Used for: name.replace(/\s+\d+$/, '')
  
- **Current**: app/api/ingest/pulte/route.ts
  - Existing ingestion logic with model plans, communities, services
  - Used for: parsing, caching, upsert logic

## Key Features

### 1. Harvest Script (harvest-pulte.ts)
```bash
pnpm harvest:pulte -- --start YYYY-MM-DD --end YYYY-MM-DD [--communities "Name1,Name2"] [--headless=false]
```

**Features:**
- ✅ Playwright-based browser automation
- ✅ Session state caching (pulte-state.json)
- ✅ Date range filtering (MM/DD/YYYY format)
- ✅ Community name filtering (case-insensitive)
- ✅ Headless/headed mode toggle
- ✅ Expands all check/invoice/line-item rows
- ✅ Scrapes both Payments and Jobs pages
- ✅ Returns structured JSON to stdout

**Data Scraped:**
- Check-level: checkDate, checkNumber, isACH, checkTotal
- Invoice-level: invoiceNumber, invoiceDate, invoiceAmount
- Line-item: jobNumber, accountCategory, planNumber, startDate, completedDate, amount
- Jobs: communityCode, communityName, scarStartDate

### 2. Ingest Script (ingest-pulte-live.ts)
```bash
pnpm ingest:pulte:live -- --start YYYY-MM-DD --end YYYY-MM-DD [--communities "Name1,Name2"]
```

**Features:**
- ✅ Calls harvest-pulte.ts internally
- ✅ Idempotent upserts (no duplicates)
- ✅ Enum-safe unit_kind mapping
- ✅ Batch processing (250 items/batch)
- ✅ Foreign key handling (builders, communities, model_plans, services)
- ✅ Natural key deduplication: (po_number, lot)
- ✅ Comprehensive statistics output

**Database Tables Affected:**
- `builders` - Pulte builder record
- `communities` - Community codes → friendly names
- `model_plans` - Plan codes from planNumber field
- `services` - Account category codes (22712, 22714, etc.)
- `blue_book_entries` - Main line item records

**Enum Mapping:**
- Discovers unit_kind enum labels dynamically from schema
- Maps: "each/ea/unit/u" → PER_UNIT
- Maps: "hour/hr/hrs" → PER_HOUR
- Maps: "sqft/sf" → PER_SQFT
- Maps: "job" → PER_JOB (default)

### 3. Deduplication Strategy
Uses natural key composite: `(po_number, lot)` or `(po_number)` fallback
- If exists: UPDATE with new data
- If not: INSERT new record
- Tracks: inserted, updated, skipped counts

## Usage Examples

### Example 1: Last 180 days, all communities
```bash
pnpm ingest:pulte:live -- \
  --start "$(date -v-180d +%F)" \
  --end "$(date +%F)" \
  --headless=true
```

### Example 2: Specific date range with community filter
```bash
pnpm ingest:pulte:live -- \
  --start 2025-01-01 \
  --end 2025-11-12 \
  --communities "Sunset Hills,Mountain View" \
  --headless=true
```

### Example 3: Harvest only (no ingest)
```bash
pnpm harvest:pulte -- \
  --start 2025-01-01 \
  --end 2025-11-12 \
  > pulte-data.json
```

### Example 4: Bootstrap with visible browser
```bash
pnpm harvest:pulte -- \
  --start 2025-11-01 \
  --end 2025-11-12 \
  --headless=false
```

## Expected Output

### Harvest Console Output
```
🔐 Logged in and saved session state
📅 Searching date range: 01/01/2025 → 11/12/2025
🔍 Expanding all check/invoice details...
  Expanding 45 check rows...
  Expanding 123 invoice rows...
📦 Scraping payment line items...
🏘️  Scraping jobs/communities...
✅ Scraped 287 line items, 12 communities

📄 Result JSON:
{ "start": "01/01/2025", "end": "11/12/2025", "items": [...], "jobs": [...] }
```

### Ingest Console Output
```
🚀 Starting Pulte harvest and ingest...
[... harvest output ...]

📥 Ingesting 287 items into database...
  Unit kind enum labels: PER_JOB, PER_SQFT, PER_UNIT
  ✓ Created Pulte builder
  Processing batch 1/2...
  Processing batch 2/2...

✅ Ingest complete!

📊 Ingest Summary:
==================
Scraped:              287 line items
Date range:           2025-01-15 → 2025-11-08
Communities matched:  Sunset Hills, Mountain View

Builders:
  Inserted:  1
  Existing:  0

Communities:
  Inserted:  2
  Existing:  10

Model Plans:
  Inserted:  0
  Existing:  15

Services:
  Inserted:  3
  Existing:  12

Blue Book Entries:
  Inserted:  245
  Updated:   42
  Skipped:   0
```

## Validation Queries

```sql
-- Check total entries
SELECT COUNT(*) FROM blue_book_entries;

-- Check date range coverage
SELECT 
  MIN(check_date) as first_check,
  MAX(check_date) as last_check,
  COUNT(DISTINCT check_number) as unique_checks
FROM blue_book_entries;

-- Check communities
SELECT 
  c.name,
  COUNT(b.id) as entry_count,
  SUM(b.amount::numeric) as total_amount
FROM communities c
LEFT JOIN blue_book_entries b ON b.community_id = c.id
GROUP BY c.id, c.name
ORDER BY entry_count DESC;

-- Check services used
SELECT 
  s.code,
  s.name,
  COUNT(b.id) as usage_count
FROM services s
LEFT JOIN blue_book_entries b ON b.service_id = s.id
GROUP BY s.id, s.code, s.name
ORDER BY usage_count DESC;
```

## Known Service Codes (from git history)
- **22712** - Interior Clean
- **22714** - Interior Clean (variant)
- **22702** - Exterior Clean

These are automatically mapped to friendly names and stored in the `services` table.

## Environment Variables Required

### .env.harvester (or .env.local)
```bash
PULTE_BASE_URL=https://bwp.pulte.com
PULTE_USERNAME=your-email@example.com
PULTE_PASSWORD=your-password

# For dev/testing
DATABASE_URL=postgres://localhost:5432/lunas
DATABASE_PROVIDER=postgres
```

## Architecture Notes

### Why Node-only (no server-only imports)?
- Scripts run via `tsx` CLI, not Next.js runtime
- Cannot import `'server-only'` or Next.js API route code
- Uses separate `db-client.ts` with `getPgDrizzle()` helper
- Shared schema from `@/db/schema` (safe to import)

### Why No SSL for Localhost?
```typescript
const pgOpts = /^(localhost|127\.0\.0\.1)$/i.test(host)
  ? {}
  : { ssl: 'require' };
```
Prevents connection errors when running against local PostgreSQL.

### Why Batch Processing?
- Prevents memory spikes with large datasets (1000+ items)
- Postgres connection pooling limits
- 250 items/batch is optimal for network latency vs memory

## Testing Checklist

- [x] harvest-pulte.ts compiles without errors
- [x] ingest-pulte-live.ts compiles without errors
- [x] yargs CLI works (--help)
- [x] Environment variables load correctly
- [x] Package.json scripts defined
- [ ] **USER TO RUN**: Full 180-day harvest and ingest
- [ ] **USER TO VERIFY**: Database has >25 entries
- [ ] **USER TO VERIFY**: API /api/blue-book returns data
- [ ] **USER TO VERIFY**: No duplicate entries on re-run

## Future Enhancements (Not Implemented)

1. **Multi-tab concurrency** - Currently has `--concurrency` flag but processes serially
2. **Incremental harvesting** - Track last scraped date, only fetch new data
3. **Error retry logic** - Retry failed pages/items
4. **Progress bar** - Visual progress indicator for long harvests
5. **Dry-run mode** - Preview what would be inserted without committing
6. **CSV export** - Export harvested data to CSV before ingest

## Troubleshooting

### Error: "WAF_BLOCKED"
- Run with `--headless=false` to log in manually
- Session state will be saved to `workers/pulte-harvester/pulte-state.json`

### Error: "Missing PULTE_USERNAME and PULTE_PASSWORD"
- Check `.env.harvester` file exists
- Run with `--env-file=.env.harvester` flag
- Or set environment variables directly

### Error: "could not discover enum labels for services.unit_kind"
- Fixed in seed-services.ts (postgres-js result format)
- Should not occur with new scripts

### Error: Connection timeout
- Pulte site may be slow/down
- Try running during off-peak hours
- Increase Playwright timeout values if needed

## Git Commit Message Suggestion
```
feat: restore Playwright Blue-Book scraper with full CLI pipeline

- Created scripts/harvest-pulte.ts - standalone Playwright scraper
- Created scripts/ingest-pulte-live.ts - idempotent DB ingestion
- Added yargs CLI with date range, community filtering, headless mode
- Restored multi-tab capable architecture from commit af9d12a
- Integrated job/community scraping from commit 88dfa4d
- Added enum-safe unit_kind mapping with dynamic label discovery
- Batch processing (250 items) to prevent memory spikes
- Natural key deduplication on (po_number, lot)
- Comprehensive statistics output with date range tracking

One-command usage:
  pnpm ingest:pulte:live -- --start 2025-01-01 --end 2025-11-12

Restores functionality from commits:
  af9d12a, 88dfa4d, 5989339, e06a9d5
```
