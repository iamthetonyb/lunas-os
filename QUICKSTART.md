# Pulte Blue-Book Scraper - Quick Start Guide

## ✅ Ready to Run Commands

All code work is complete. You only need to run the final command(s).

## Command to Run - Last 180 Days, Full Harvest

```bash
cd ~/LUNAS-OS

# Single command to scrape and ingest last 180 days
pnpm ingest:pulte:live -- \
  --start "$(date -v-180d +%F)" \
  --end "$(date +%F)" \
  --headless=true \
  --concurrency=4
```

## Alternative Commands

### Last 30 Days (Faster Test)
```bash
pnpm ingest:pulte:live -- \
  --start "$(date -v-30d +%F)" \
  --end "$(date +%F)"
```

### Specific Date Range
```bash
pnpm ingest:pulte:live -- \
  --start 2025-01-01 \
  --end 2025-11-12
```

### With Community Filter
```bash
pnpm ingest:pulte:live -- \
  --start 2025-01-01 \
  --end 2025-11-12 \
  --communities "Sunset Hills"
```

### Visible Browser (for debugging/login)
```bash
pnpm ingest:pulte:live -- \
  --start 2025-11-01 \
  --end 2025-11-12 \
  --headless=false
```

### Harvest Only (no database insert)
```bash
pnpm harvest:pulte -- \
  --start 2025-01-01 \
  --end 2025-11-12 \
  > ~/pulte-harvest-$(date +%F).json
```

## Expected Runtime

- **Last 30 days**: ~2-3 minutes
- **Last 180 days**: ~8-12 minutes
- Depends on number of checks/invoices in date range

## What Happens During Execution

1. **Harvest Phase** (~60-80% of time)
   - Launches Playwright browser
   - Logs into Pulte BWP
   - Navigates to Payments page
   - Sets date range and searches
   - Expands all check/invoice/line-item rows
   - Scrapes table data
   - Navigates to Jobs page
   - Scrapes community names and codes

2. **Ingest Phase** (~20-40% of time)
   - Connects to PostgreSQL
   - Discovers enum labels
   - Creates/finds Pulte builder
   - Upserts communities with friendly names
   - Upserts services from account categories
   - Looks up model plans
   - Processes line items in batches of 250
   - Updates existing records or inserts new ones

3. **Summary Output**
   - Scraped count
   - Date range covered
   - Communities matched
   - Insert/update/skip counts per table

## Verify Results

### Check Database
```bash
cd ~/LUNAS-OS

# Count total entries
psql -h localhost -d lunas -c "SELECT COUNT(*) FROM blue_book_entries;"

# Check date range
psql -h localhost -d lunas -c "
SELECT 
  MIN(check_date) as first_check,
  MAX(check_date) as last_check,
  COUNT(DISTINCT check_number) as checks,
  SUM(amount::numeric) as total_amount
FROM blue_book_entries;"

# List communities
psql -h localhost -d lunas -c "
SELECT 
  c.name,
  COUNT(b.id) as entries
FROM communities c
LEFT JOIN blue_book_entries b ON b.community_id = c.id
GROUP BY c.id, c.name
ORDER BY entries DESC;"
```

### Check via API (requires dev server)
```bash
# Terminal 1: Start dev server (if not running)
cd ~/LUNAS-OS && pnpm dev

# Terminal 2: Test API
curl -s http://localhost:4010/api/blue-book | head -50
# Note: May require authentication token
```

### View in App
Open http://localhost:4010/blue-book in your browser

## Troubleshooting

### Problem: "Missing PULTE_USERNAME and PULTE_PASSWORD"
**Solution:** Check `.env.harvester` file has credentials:
```bash
cat ~/LUNAS-OS/.env.harvester | grep PULTE
```

### Problem: "WAF_BLOCKED" error
**Solution:** Run with visible browser to manually solve CAPTCHA:
```bash
pnpm ingest:pulte:live -- \
  --start 2025-11-01 \
  --end 2025-11-12 \
  --headless=false
```
Session will be saved to `workers/pulte-harvester/pulte-state.json`

### Problem: Connection timeout
**Solution:** 
- Check internet connection
- Try during off-peak hours
- Reduce date range (e.g., 30 days instead of 180)

### Problem: Duplicate entries on re-run
**Expected:** Should NOT create duplicates. Script uses natural key (po_number, lot).
**If happens:** Report as bug - deduplication logic may need adjustment

### Problem: Some communities not appearing
**Possible causes:**
1. Community filter is case-sensitive internally - try without filter first
2. Date range doesn't include those communities
3. Job scraping failed (check for warnings in output)

## Files Created by This Restoration

- ✅ `scripts/harvest-pulte.ts` - Standalone Playwright scraper (527 lines)
- ✅ `scripts/ingest-pulte-live.ts` - Database ingestion (482 lines)
- ✅ `PULTE_SCRAPER_RESTORATION.md` - Full documentation
- ✅ `QUICKSTART.md` - This file
- ✅ Modified `package.json` - Added scripts
- ✅ Modified `app/api/ingest/pulte/route.ts` - Added jobs field

## NPM Scripts Available

```bash
# New canonical scripts
pnpm harvest:pulte -- [args]           # Harvest only (JSON output)
pnpm ingest:pulte:live -- [args]       # Harvest + ingest to DB

# Legacy scripts (still work)
pnpm harvest:pulte:old                 # Old harvester (no CLI args)
pnpm harvest:pulte:bootstrap           # Old harvester with visible browser

# Helpers
pnpm --help                            # Show all scripts
```

## Success Criteria

After running the command, you should see:

✅ "✅ Scraped X line items, Y communities"  
✅ "✅ Ingest complete!"  
✅ Summary table with insert/update counts  
✅ No error messages  
✅ Database query returns entries:
   ```sql
   SELECT COUNT(*) FROM blue_book_entries;
   -- Should be > 25 (previously had 25)
   ```

## Next Steps After Successful Run

1. Verify data in database (see "Verify Results" section)
2. Test the app's blue-book page: http://localhost:4010/blue-book
3. Consider scheduling regular harvests (e.g., daily cron job)
4. Adjust date range as needed for ongoing operations

## Questions?

Refer to `PULTE_SCRAPER_RESTORATION.md` for:
- Complete technical details
- Git commit history
- Architecture decisions
- Validation queries
- Future enhancements
