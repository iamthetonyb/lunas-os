# Pulte Blue-Book Data Issues & Solutions

## Current Status

### ✅ What's Working
- Harvest script successfully scrapes 49 line items
- Date filter applies correctly (Oct 1 - Nov 12)
- Data ingests to database without duplicates
- Services map correctly (22712, 22714, 22702)
- Idempotent upserts work properly

### ❌ What's Not Working Correctly

1. **Community Names Showing as Codes**
   - Database shows: `7539`, `8368`, `8175`, etc.
   - Should show: Full community names like "Sunset Hills", etc.
   - **Root cause**: Jobs scraper returns 0 communities

2. **Date Priority**
   - Currently using: `checkDate` and `startDate` from invoice
   - Should use: **SCAR Start Date** from Jobs tab (first line/top date)
   - **Current behavior**: Code tries to use SCAR date but gets null because jobs scraper fails

## Solutions

### Option 1: Fix Jobs Page Scraper (Recommended for automation)

The Jobs page contains the critical data:
- Community codes → friendly names mapping
- SCAR Start dates for each job
  
**Why it's currently failing:**
- Jobs page may require additional interaction (buttons, filters)
- Selectors may not match the actual page structure
- Page may load data via AJAX after initial render

**Action needed:**
1. Run with `--headless=false` to manually inspect Jobs page
2. Update selectors in `scrapeJobsCommunityMap()`  
3. Add waits for dynamic content
4. Map table columns correctly

### Option 2: Use Excel Export (Your Suggestion - Easiest)

You mentioned there's an export button on the Payments page that creates an Excel file with:
- ✅ Proper column labels
- ✅ Community names (not just codes)
- ✅ SCAR start dates
- ✅ All other data cleanly organized

**Benefits:**
- No complex web scraping needed
- Data comes pre-labeled from Pulte
- Less brittle than HTML parsing
- Likely includes more data fields

**I've created:** `scripts/harvest-pulte-excel.ts` - downloads Excel, parses it, ingests properly

### Option 3: Manual Data Enrichment

For immediate fix:
1. Export Excel file from Pulte manually
2. Create a mapping file: `community-codes-to-names.json`
3. Update ingest script to use mapping

## What's Actually Needed in the System

Based on your feedback, the critical data points are:

1. **Community Name** (friendly name, not code)
   - Example: "Sunset Hills" not "7539"
   - Source: Jobs tab or Excel export

2. **SCAR Start Date** (the real start date for the system)
   - This is the "first or top line date" you mentioned
   - NOT the invoice date
   - NOT the completed date
   - Source: Jobs tab or Excel export

3. **All other fields** (already working):
   - Check number, date, amount
   - Invoice details
   - Job address
   - Service codes
   - Plan numbers

## Immediate Action Plan

### If you can run with visible browser:

```bash
cd ~/LUNAS-OS
pnpm harvest:pulte --start "2025-10-01" --end "2025-11-12" --headless=false
```

While browser is open:
1. Look at the Payments page - is there an "Export" or "Export to Excel" button?
2. If yes, note its exact text/location
3. Look at the Jobs tab - how does the data appear? What are column headers?
4. Share screenshots or describe the structure

### If Excel export exists:

```bash
# Test the Excel harvester
cd ~/LUNAS-OS
pnpm tsx --env-file=.env.harvester scripts/harvest-pulte-excel.ts --start "2025-10-01" --end "2025-11-12" --headless=false
```

This will:
1. Log in to Pulte
2. Navigate to Payments
3. Set date range
4. Click Export button
5. Download Excel file
6. Parse it with proper labels
7. Get community names from Jobs tab
8. Merge data correctly with SCAR dates

## Database Schema Notes

The `blue_book_entries` table has:
- `startDate` field - this should store the **SCAR Start Date**
- `communityId` field - links to `communities.name` (friendly name)
- `checkDate` field - when the check was issued (for accounting)

Currently:
- `startDate` = getting invoice start date (wrong)
- `communities.name` = showing codes (wrong)

Should be:
- `startDate` = SCAR start date from Jobs tab
- `communities.name` = friendly names like "Sunset Hills"

## Next Steps

**Tell me:**
1. Is there an Export/Excel button on the Payments page?
2. What does the Jobs page look like? (Can you see it with --headless=false?)
3. Do you want me to:
   - Fix the Jobs scraper (need your help to identify correct selectors)
   - Use Excel export approach (simpler, cleaner)
   - Create manual mapping file for now

**I recommend:** Try the Excel export approach first. It's the cleanest and most reliable solution.
