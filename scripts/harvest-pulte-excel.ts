#!/usr/bin/env node
/**
 * harvest-pulte-excel.ts
 * Downloads Pulte Blue Book data via Excel export button
 * Provides cleaner data with proper labels and community names
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { chromium, Browser, Page } from 'playwright';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as XLSX from 'xlsx';

// ============================================================================
// Types
// ============================================================================

type HarvestOptions = {
  start: string;
  end: string;
  headless: boolean;
};

type LineItem = {
  checkDate: string;
  checkNumber: string;
  isACH: boolean;
  checkTotal: number;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  jobNumber: string;
  jobAddress: string;
  communityCode: string;
  communityName: string;
  accountCategory: string;
  planName: string;
  planNumber: string;
  optionNumber: string;
  scarStartDate: string | null;
  completedDate: string | null;
  lineAmount: number;
  lot: string;
};

export type HarvestResult = {
  start: string;
  end: string;
  items: LineItem[];
};

// ============================================================================
// Config
// ============================================================================

const PULTE_URL = process.env.PULTE_BASE_URL || 'https://bwp.pulte.com';
const PAYMENTS_URL = `${PULTE_URL}/Payments`;
const JOBS_URL = `${PULTE_URL}/Jobs`;
const STATE_PATH = path.join(process.cwd(), 'workers/pulte-harvester/pulte-state.json');
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const USER = process.env.PULTE_USERNAME || process.env.PULTE_USER;
const PASS = process.env.PULTE_PASSWORD || process.env.PULTE_PASS;

// Community code to name mapping from Pulte system
const COMMUNITY_MAP: Record<string, string> = {
  '8752': 'Brantley KL - 3500',
  '8753': 'Brantley KL - 4500',
  '8754': 'Brantley KL - 5500',
  '8102': 'Caprock - 5500s',
  '8352': 'Daylight at Cameron - 50/70',
  '8354': 'Daylight at Warm Spring -50/70',
  '7538': 'Delamar',
  '8360': 'Delamar at Polaris - 3600',
  '6937': 'DW Lake Las Vegas S1-4000',
  '6938': 'DW Lake Las Vegas S2-4500',
  '6939': 'DW Lake Las Vegas S3-5400',
  '7768': 'DW LLV C2-3000',
  '7769': 'DW LLV C2-4500',
  '7770': 'DW LLV M5-5400',
  '8361': 'Hayford at Polaris - 4500',
  '7438': 'Hayford Collection',
  '8101': 'Incline - 5500s',
  '7893': 'Liberty Ct 8 - 3600',
  '7892': 'Liberty Ct 8 - 4500',
  '7891': 'Liberty Ct 8 - 5500',
  '7002': 'Liberty-3600',
  '8368': 'Luxury at Russell - 3600',
  '8175': 'Luxury at Warm Springs - 3600',
  '6231': 'Monument at Reverence',
  '8367': 'Paldona at Buffalo - 3000',
  '8366': 'Paldona at Cimarron - 3000',
  '8174': 'Paldona at Warm Springs - 3000',
  '7539': 'Quinn Canyon',
  '7003': 'Rainbow Crossing Luxury-3600',
  '3319': 'SCM North- 4200s/4500s',
  '3320': 'SCM North- 5400s',
  '3318': 'SCM North-3000s',
  '3567': 'Suntero-4500',
  '8365': 'Tenaya Spring at Cimarron-2500',
  '8103': 'The Pointe - 7000s',
  '7428': 'Wesley Park',
};

// ============================================================================
// Utility functions
// ============================================================================

async function assertNotBlocked(page: Page) {
  const text = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  if (/request is blocked|access denied|blocked by/i.test(text)) {
    throw new Error('WAF_BLOCKED');
  }
}

// ============================================================================
// Login
// ============================================================================

async function login(page: Page): Promise<boolean> {
  if (!USER || !PASS) {
    throw new Error('Missing PULTE_USERNAME and PULTE_PASSWORD in environment');
  }

  await page.goto(PULTE_URL, { waitUntil: 'domcontentloaded' });
  await assertNotBlocked(page);

  const paymentsLink = page.locator('a[href="/Payments"]').first();
  const alreadyAuthed = await paymentsLink.isVisible().catch(() => false);
  if (alreadyAuthed) return false;

  const emailInput = page.getByRole('textbox', { name: /email|user/i });
  const passwordInput = page.getByRole('textbox', { name: /password/i });
  const signInButton = page.getByRole('button', { name: /sign in|log in/i });

  await emailInput.fill(USER!);
  await passwordInput.fill(PASS!);
  await signInButton.click();

  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.waitForSelector('a[href="/Payments"]', { timeout: 60_000 });
  await assertNotBlocked(page);

  const stateDir = path.dirname(STATE_PATH);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  await page.context().storageState({ path: STATE_PATH });
  return true;
}

// ============================================================================
// Jobs scraping with community names and plan info
// ============================================================================

async function scrapeJobsDetailMap(page: Page): Promise<Map<string, { 
  communityCode: string;
  communityName: string; 
  planName: string | null;
  scarDate: string | null;
  lot: string | null;
}>> {
  const jobMap = new Map<string, { 
    communityCode: string;
    communityName: string; 
    planName: string | null;
    scarDate: string | null;
    lot: string | null;
  }>();
  
  try {
    console.log('🏘️  Navigating to Jobs page for detailed info...');
    await page.goto(JOBS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Click search button (the blue one) to load all jobs
    const searchButton = page.locator('button:has-text("Search"), button[type="submit"]').first();
    if (await searchButton.isVisible().catch(() => false)) {
      console.log('  Clicking search button...');
      await searchButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }

    // Extract job details from the table
    const jobs = await page.evaluate((communityMapData: Record<string, string>) => {
      const results: Array<{
        jobNumber: string;
        communityCode: string;
        communityName: string;
        planName: string | null;
        scarStartDate: string | null;
        lot: string | null;
      }> = [];
      
      const rows = Array.from(
        document.querySelectorAll<HTMLTableRowElement>('#jobs-results-table tbody tr, table tbody tr')
      );

      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          cell.textContent?.trim() ?? ''
        );

        if (cells.length < 3) return;

        // Extract job number (format: XXXX-XXXXX)
        let jobNumber: string | null = null;
        let communityCode: string | null = null;
        
        for (const cell of cells) {
          const jobMatch = cell.match(/(\d{4})-(\d{5})/);
          if (jobMatch) {
            jobNumber = jobMatch[0];
            communityCode = jobMatch[1];
            break;
          }
        }
        
        if (!jobNumber || !communityCode) return;
        
        // Get community name from mapping
        const communityName = communityMapData[communityCode] || communityCode;
        
        // Extract plan name (usually after "Plan Name" header or in specific column)
        let planName: string | null = null;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          if (cell && cell.length > 0 && cell.length < 50 && /^[A-Z0-9\s\-]+$/i.test(cell) && cell !== jobNumber) {
            // Likely plan name - exclude dates, job numbers, etc
            if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(cell) && !/^\d{4}-\d{5}$/.test(cell)) {
              planName = cell;
              break;
            }
          }
        }
        
        // Extract lot number from job number (last 5 digits)
        const lot = jobNumber.split('-')[1] || null;
        
        // Look for SCAR start date (first date column, not invoice date)
        const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        let scarStartDate: string | null = null;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const match = cell.match(dateRegex);
          if (match) {
            scarStartDate = match[0];
            break; // Take first date as SCAR start date
          }
        }

        results.push({
          jobNumber,
          communityCode,
          communityName,
          planName,
          scarStartDate,
          lot,
        });
      });

      return results;
    }, COMMUNITY_MAP);

    console.log(`  Found ${jobs.length} job entries with details`);
    
    jobs.forEach((job) => {
      if (job.jobNumber) {
        jobMap.set(job.jobNumber, {
          communityCode: job.communityCode,
          communityName: job.communityName,
          planName: job.planName,
          scarDate: job.scarStartDate,
          lot: job.lot,
        });
      }
    });

    console.log(`  Mapped ${jobMap.size} unique jobs with community names and plans`);
  } catch (error) {
    console.warn('⚠️ Failed to scrape jobs:', error instanceof Error ? error.message : error);
  }

  return jobMap;
}

// ============================================================================
// Excel export and parsing
// ============================================================================

async function downloadExcelExport(page: Page, start: string, end: string): Promise<string | null> {
  try {
    await page.goto(PAYMENTS_URL, { waitUntil: 'domcontentloaded' });
    await assertNotBlocked(page);

    // Set date range
    const startBox = page.locator('input[name="StartDate"], #check-start-date').first();
    const endBox = page.locator('input[name="EndDate"], #check-end-date').first();

    await Promise.all([
      startBox.waitFor({ state: 'attached' }),
      endBox.waitFor({ state: 'attached' }),
    ]);

    await page.evaluate(() => {
      const s = document.querySelector('input[name="StartDate"], #check-start-date') as HTMLInputElement | null;
      const e = document.querySelector('input[name="EndDate"], #check-end-date') as HTMLInputElement | null;
      if (!s || !e) return;
      s.removeAttribute('disabled');
      e.removeAttribute('disabled');
    });

    await startBox.click({ clickCount: 3 });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(start);
    await page.keyboard.press('Tab');

    await endBox.click({ clickCount: 3 });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(end);
    await page.keyboard.press('Tab');

    await page.evaluate(() => {
      const s = document.querySelector('input[name="StartDate"], #check-start-date') as HTMLInputElement | null;
      const e = document.querySelector('input[name="EndDate"], #check-end-date') as HTMLInputElement | null;
      if (!s || !e) return;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const searchButton = page.locator(
      'button:has-text("Search"), input[type="submit"][value="Search"]'
    ).first();
    await searchButton.waitFor({ state: 'visible' });
    await searchButton.click({ force: true });
    await page.waitForLoadState('networkidle');

    // Look for Excel export button
    console.log('🔍 Looking for Excel export button...');
    const exportButton = page.locator(
      'button:has-text("Export"), a:has-text("Export"), button:has-text("Excel"), a:has-text("Excel"), button[title*="Export"], a[title*="Export"]'
    ).first();

    const hasExport = await exportButton.isVisible().catch(() => false);
    if (!hasExport) {
      console.warn('⚠️ Excel export button not found');
      return null;
    }

    // Set up download handler
    const downloadPath = path.join(process.cwd(), 'workers/pulte-harvester/downloads');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await exportButton.click();
    const download = await downloadPromise;
    
    const filename = `pulte-export-${Date.now()}.xlsx`;
    const filepath = path.join(downloadPath, filename);
    await download.saveAs(filepath);
    
    console.log(`✅ Downloaded Excel file to ${filepath}`);
    return filepath;
  } catch (error) {
    console.warn('⚠️ Failed to download Excel export:', error instanceof Error ? error.message : error);
    return null;
  }
}

function parseExcelFile(filepath: string, jobMap: Map<string, { 
  communityCode: string;
  communityName: string; 
  planName: string | null;
  scarDate: string | null;
  lot: string | null;
}>): LineItem[] {
  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const items: LineItem[] = [];

  data.forEach((row: any) => {
    // Map Excel columns to our structure
    const jobNumber = String(row['Job Number'] || row['Job'] || row['JobNumber'] || '').trim();
    const communityCode = jobNumber.split('-')[0];
    const lot = jobNumber.split('-')[1] || 'Unknown';
    const jobInfo = jobMap.get(jobNumber);

    // Use mapped community name, fallback to code mapping, then code itself
    const communityName = jobInfo?.communityName || COMMUNITY_MAP[communityCode] || communityCode;
    const planName = jobInfo?.planName || String(row['Plan'] || row['Plan Name'] || row['Plan Number'] || '');
    const scarStartDate = jobInfo?.scarDate || row['SCAR Start'] || row['Start Date'] || null;

    items.push({
      checkDate: row['Check Date'] || row['CheckDate'] || '',
      checkNumber: String(row['Check Number'] || row['CheckNumber'] || ''),
      isACH: /ach|yes/i.test(String(row['ACH'] || row['Payment Type'] || '')),
      checkTotal: Number(row['Check Total'] || row['CheckTotal'] || 0),
      invoiceNumber: String(row['Invoice Number'] || row['InvoiceNumber'] || ''),
      invoiceDate: row['Invoice Date'] || row['InvoiceDate'] || '',
      invoiceAmount: Number(row['Invoice Amount'] || row['InvoiceAmount'] || 0),
      jobNumber,
      jobAddress: row['Address'] || row['Job Address'] || row['JobAddress'] || '',
      communityCode,
      communityName,
      accountCategory: row['Account Category'] || row['Category'] || '',
      planName,
      planNumber: String(row['Plan Number'] || communityCode || ''),
      optionNumber: String(row['Option'] || row['Option Number'] || ''),
      scarStartDate,
      completedDate: row['Completed Date'] || row['Completed'] || null,
      lineAmount: Number(row['Amount'] || row['Line Amount'] || row['LineAmount'] || 0),
      lot,
    });
  });

  return items;
}

// ============================================================================
// Main harvest function
// ============================================================================

export async function harvestPulteExcel(options: HarvestOptions): Promise<HarvestResult> {
  const { start, end, headless } = options;
  const useState = fs.existsSync(STATE_PATH);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      userAgent: CHROME_UA,
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles',
      storageState: useState ? STATE_PATH : undefined,
      acceptDownloads: true,
    });

    const page = await ctx.newPage();

    // Login
    const loggedIn = await login(page);
    if (loggedIn) {
      console.log('🔐 Logged in and saved session state');
    }

    // Get job details including community names and plan info from Jobs tab
    const jobMap = await scrapeJobsDetailMap(page);

    // Try Excel export first
    console.log(`📅 Searching date range: ${start} → ${end}`);
    const excelFile = await downloadExcelExport(page, start, end);

    let items: LineItem[] = [];

    if (excelFile && fs.existsSync(excelFile)) {
      console.log('📊 Parsing Excel file...');
      items = parseExcelFile(excelFile, jobMap);
      console.log(`✅ Parsed ${items.length} line items from Excel`);
    } else {
      console.warn('⚠️ Excel export not available, falling back to web scraping');
      // Could fall back to the web scraping method here if needed
    }

    return {
      start,
      end,
      items,
    };
  } finally {
    await browser?.close();
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('start', {
      type: 'string',
      description: 'Start date (YYYY-MM-DD)',
      default: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    })
    .option('end', {
      type: 'string',
      description: 'End date (YYYY-MM-DD)',
      default: dayjs().format('YYYY-MM-DD'),
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: true,
    })
    .help()
    .argv;

  const startDate = dayjs(argv.start).format('MM/DD/YYYY');
  const endDate = dayjs(argv.end).format('MM/DD/YYYY');

  const result = await harvestPulteExcel({
    start: startDate,
    end: endDate,
    headless: argv.headless,
  });

  console.log('\n📄 Result JSON:');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Harvest failed:', error);
    process.exit(1);
  });
}
