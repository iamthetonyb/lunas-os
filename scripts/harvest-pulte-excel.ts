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
  communityName: string | null;
  accountCategory: string;
  planNumber: string;
  optionNumber: string;
  scarStartDate: string | null;
  completedDate: string | null;
  lineAmount: number;
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
// Jobs scraping with community names
// ============================================================================

async function scrapeJobsCommunityMap(page: Page): Promise<Map<string, { name: string; scarDate: string | null }>> {
  const communityMap = new Map<string, { name: string; scarDate: string | null }>();
  
  try {
    console.log('🏘️  Navigating to Jobs page for community names...');
    await page.goto(JOBS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Click search to load all jobs
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    const jobs = await page.evaluate(() => {
      const results: Array<{
        jobNumber: string | null;
        communityName: string | null;
        scarStartDate: string | null;
      }> = [];
      
      const rows = Array.from(
        document.querySelectorAll<HTMLTableRowElement>('#jobs-results-table tbody tr')
      );

      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          cell.textContent?.trim() ?? ''
        );

        if (cells.length < 3) return;

        // First column typically has community name and job number
        const firstCol = cells[0] || '';
        const jobNumberCell = cells[1] || cells[0];
        
        // Extract job number (format: XXXX-XXXXX)
        const jobMatch = jobNumberCell.match(/(\d{4})-(\d{5})/);
        const jobNumber = jobMatch ? jobMatch[0] : null;
        
        // Extract community code from job number
        const communityCode = jobMatch ? jobMatch[1] : null;
        
        // Community name is usually in first column or as part of a compound field
        let communityName = firstCol.split('\n')[0]?.trim() || null;
        if (communityName) {
          // Remove trailing numbers and clean up
          communityName = communityName.replace(/\s+\d+$/, '').replace(/-\s*$/, '').trim();
        }
        
        // Look for SCAR start date (usually in later columns)
        const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        let scarStartDate = null;
        for (const cell of cells) {
          const match = cell.match(dateRegex);
          if (match) {
            scarStartDate = match[0];
            break;
          }
        }

        if (communityCode && communityName) {
          results.push({
            jobNumber: communityCode,
            communityName,
            scarStartDate,
          });
        }
      });

      return results;
    });

    console.log(`  Found ${jobs.length} job entries`);
    
    jobs.forEach((job) => {
      if (job.jobNumber && job.communityName) {
        if (!communityMap.has(job.jobNumber)) {
          communityMap.set(job.jobNumber, {
            name: job.communityName,
            scarDate: job.scarStartDate,
          });
        }
      }
    });

    console.log(`  Mapped ${communityMap.size} unique communities`);
  } catch (error) {
    console.warn('⚠️ Failed to scrape jobs:', error instanceof Error ? error.message : error);
  }

  return communityMap;
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

function parseExcelFile(filepath: string, communityMap: Map<string, { name: string; scarDate: string | null }>): LineItem[] {
  const workbook = XLSX.readFile(filepath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  const items: LineItem[] = [];

  data.forEach((row: any) => {
    // Map Excel columns to our structure
    // Adjust these field names based on actual Excel export structure
    const jobNumber = String(row['Job Number'] || row['Job'] || row['JobNumber'] || '').trim();
    const communityCode = jobNumber.split('-')[0];
    const communityInfo = communityMap.get(communityCode);

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
      communityName: communityInfo?.name || communityCode,
      accountCategory: row['Account Category'] || row['Category'] || '',
      planNumber: String(row['Plan'] || row['Plan Number'] || ''),
      optionNumber: String(row['Option'] || row['Option Number'] || ''),
      scarStartDate: communityInfo?.scarDate || row['SCAR Start'] || row['Start Date'] || null,
      completedDate: row['Completed Date'] || row['Completed'] || null,
      lineAmount: Number(row['Amount'] || row['Line Amount'] || row['LineAmount'] || 0),
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

    // Get community names from Jobs tab
    const communityMap = await scrapeJobsCommunityMap(page);

    // Try Excel export first
    console.log(`📅 Searching date range: ${start} → ${end}`);
    const excelFile = await downloadExcelExport(page, start, end);

    let items: LineItem[] = [];

    if (excelFile && fs.existsSync(excelFile)) {
      console.log('📊 Parsing Excel file...');
      items = parseExcelFile(excelFile, communityMap);
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
