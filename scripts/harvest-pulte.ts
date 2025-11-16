#!/usr/bin/env node
/**
 * harvest-pulte.ts
 * Playwright-based Blue Book scraper for Pulte BWP
 * Outputs data structure ready for ingestion (does not write to DB directly)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { chromium, Browser, Page, Locator } from 'playwright';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// ============================================================================
// Types
// ============================================================================

type HarvestOptions = {
  start: string;
  end: string;
  communities?: string[];
  headless: boolean;
  concurrency: number;
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
  accountCategory: string;
  planNumber: string;
  optionNumber: string;
  startDate: string | null;
  completedDate: string | null;
  lineAmount: number;
};

type JobCommunity = {
  communityCode: string | null;
  communityName: string | null;
  scarStartDate: string | null;
};

export type HarvestResult = {
  start: string;
  end: string;
  items: LineItem[];
  jobs: JobCommunity[];
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

function parseMoney(text?: string | null): number {
  if (!text) return 0;
  return Number(text.replace(/[,$]/g, '').trim()) || 0;
}

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

  // Save session state
  const stateDir = path.dirname(STATE_PATH);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  await page.context().storageState({ path: STATE_PATH });
  return true;
}

// ============================================================================
// Date range and filtering
// ============================================================================

async function setDateRange(page: Page, start: string, end: string) {
  await page.goto(PAYMENTS_URL, { waitUntil: 'domcontentloaded' });
  await assertNotBlocked(page);

  const startBox = page.locator('input[name="StartDate"], #check-start-date').first();
  const endBox = page.locator('input[name="EndDate"], #check-end-date').first();

  await Promise.all([
    startBox.waitFor({ state: 'attached' }),
    endBox.waitFor({ state: 'attached' }),
  ]);

  // Enable inputs if disabled
  await page.evaluate(() => {
    const s = document.querySelector('input[name="StartDate"], #check-start-date') as HTMLInputElement | null;
    const e = document.querySelector('input[name="EndDate"], #check-end-date') as HTMLInputElement | null;
    if (!s || !e) return;
    s.removeAttribute('disabled');
    e.removeAttribute('disabled');
  });

  // Fill start date
  await startBox.click({ clickCount: 3 });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(start);
  await page.keyboard.press('Tab');

  // Fill end date
  await endBox.click({ clickCount: 3 });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(end);
  await page.keyboard.press('Tab');

  // Trigger change events
  await page.evaluate(() => {
    const s = document.querySelector('input[name="StartDate"], #check-start-date') as HTMLInputElement | null;
    const e = document.querySelector('input[name="EndDate"], #check-end-date') as HTMLInputElement | null;
    if (!s || !e) return;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Click search button
  const searchButton = page.locator(
    'button:has-text("Search"), input[type="submit"][value="Search"], button[title*="Search"], button[aria-label*="Search"]'
  ).first();
  await searchButton.waitFor({ state: 'visible' });
  await searchButton.click({ force: true });

  await page.waitForLoadState('networkidle');
  
  // Wait for results
  await page
    .waitForFunction(() => {
      const table = document.querySelector('#checks-results-table') as HTMLTableElement | null;
      if (!table || table.classList.contains('hidden')) return false;
      const hasRows = table.querySelectorAll('tbody tr').length > 0;
      const noData = table.querySelector('tbody tr td')?.textContent?.toLowerCase().includes('no checks found');
      return hasRows || noData;
    }, null, { timeout: 20_000 })
    .catch(() => false);

  await assertNotBlocked(page);
}

// ============================================================================
// Expand all rows
// ============================================================================

async function expandAllPlusButtons(page: Page) {
  const clickAll = async (locator: Locator, description: string) => {
    const count = await locator.count();
    console.log(`  Expanding ${count} ${description}...`);
    for (let i = 0; i < count; i++) {
      try {
        await locator.nth(i).click({ timeout: 1000 });
        await page.waitForTimeout(150);
      } catch {
        // ignore elements that are already open or collapse immediately
      }
    }
  };

  // Expand check-level rows
  const checkAnchors = page.locator('#checks-results-table tr.open-row > td:first-child a');
  const checkCount = await checkAnchors.count();
  await clickAll(checkAnchors, 'check rows');
  
  // Wait for invoice data to load after expanding checks
  if (checkCount > 0) {
    await page.waitForResponse((res) => res.url().includes('/Payments/GetCheckInvoices'), { timeout: 15_000 }).catch(() => undefined);
    await page.waitForFunction(() => {
      return document.querySelectorAll('#checks-results-table table.invoices-datagrid tr.open-row').length > 0;
    }, null, { timeout: 10_000 }).catch(() => undefined);
  }

  // Expand invoice-level rows (using correct selector for nested tables)
  const invoiceAnchors = page.locator('#checks-results-table table.invoices-datagrid tr.open-row > td:first-child a');
  const invoiceCount = await invoiceAnchors.count();
  console.log(`  Expanding ${invoiceCount} invoice rows...`);
  await clickAll(invoiceAnchors, 'invoice rows');
  
  // Wait for line item rows to appear after expanding invoices
  if (invoiceCount > 0) {
    await page.waitForFunction(() => {
      return document.querySelectorAll('table.invoice-details-datagrid tbody tr').length > 0;
    }, null, { timeout: 10_000 }).catch(() => undefined);
  }
  
  await page.waitForTimeout(500);
}

// ============================================================================
// Scrape payments table
// ============================================================================

async function scrapePayments(page: Page): Promise<LineItem[]> {
  const items = await page.evaluate(() => {
    function parseMoney(text?: string | null): number {
      if (!text) return 0;
      const cleaned = text.replace(/[^0-9.-]/g, '');
      const value = Number(cleaned);
      return Number.isFinite(value) ? value : 0;
    }

    const results: any[] = [];
    const checkRows = document.querySelectorAll<HTMLTableRowElement>(
      '#checks-results-table tbody tr.open-row'
    );

    for (let i = 0; i < checkRows.length; i++) {
      const checkRow = checkRows[i];
      const checkDate =
        checkRow.querySelector<HTMLTableCellElement>('td:nth-child(2)')?.textContent?.trim() ?? '';
      const checkNumber =
        checkRow.querySelector<HTMLAnchorElement>('td:nth-child(3) a')?.textContent?.trim() ?? '';
      const achText =
        checkRow.querySelector<HTMLTableCellElement>('td:nth-child(4)')?.textContent?.trim() ?? '';
      const checkTotalText =
        checkRow.querySelector<HTMLSpanElement>('td:nth-child(5) span')?.textContent?.trim() ?? '';

      const checkDetailsTarget = checkRow.getAttribute('data-target');
      if (!checkDetailsTarget) continue;
      const invoiceTable = document.querySelector(
        `${checkDetailsTarget} table.invoices-datagrid tbody`
      ) as HTMLTableSectionElement | null;
      if (!invoiceTable) continue;

      const invoiceRows = invoiceTable.querySelectorAll<HTMLTableRowElement>('tr.open-row');

      for (let j = 0; j < invoiceRows.length; j++) {
        const invoiceRow = invoiceRows[j];
        const invoiceNumber =
          invoiceRow.querySelector<HTMLAnchorElement>('td:nth-child(2) a')?.textContent?.trim() ?? '';
        const invoiceDate =
          invoiceRow.querySelector<HTMLTableCellElement>('td:nth-child(3)')?.textContent?.trim() ?? '';
        const invoiceAmountText =
          invoiceRow.querySelector<HTMLSpanElement>('td:nth-child(5) span')?.textContent?.trim() ?? '';

        const detailsTarget = invoiceRow.getAttribute('data-target');
        if (!detailsTarget) continue;
        const lineTable = document.querySelector(
          `${detailsTarget} table.invoice-details-datagrid tbody`
        ) as HTMLTableSectionElement | null;
        if (!lineTable) continue;

        const lineRows = lineTable.querySelectorAll<HTMLTableRowElement>('tr');
        for (let k = 0; k < lineRows.length; k++) {
          const lineRow = lineRows[k];
          const cells = lineRow.querySelectorAll<HTMLTableCellElement>('td');
          if (cells.length < 9) continue;

          const lineAmountText = cells[8]?.textContent ?? '';

          results.push({
            checkDate,
            checkNumber,
            isACH: /yes/i.test(achText),
            checkTotal: parseMoney(checkTotalText),
            invoiceNumber,
            invoiceDate,
            invoiceAmount: parseMoney(invoiceAmountText),
            jobNumber: cells[1]?.textContent?.trim() ?? '',
            jobAddress: cells[2]?.textContent?.trim() ?? '',
            accountCategory: cells[3]?.textContent?.trim() ?? '',
            planNumber: cells[4]?.textContent?.trim() ?? '',
            optionNumber: cells[5]?.textContent?.trim() ?? '',
            startDate: cells[6]?.textContent?.trim() || null,
            completedDate: cells[7]?.textContent?.trim() || null,
            lineAmount: parseMoney(lineAmountText),
          });
        }
      }
    }

    return results;
  });

  return items;
}

// ============================================================================
// Scrape jobs/communities
// ============================================================================

async function scrapeJobs(page: Page): Promise<JobCommunity[]> {
  try {
    await page.goto(JOBS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const searchButton = page.getByRole('button', { name: /search/i }).first();
    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const jobs = await page.evaluate(() => {
      const results: Array<{
        communityCode: string | null;
        communityName: string | null;
        scarStartDate: string | null;
      }> = [];
      const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

      const rows = Array.from(
        document.querySelectorAll<HTMLTableRowElement>('#jobs-results-table tbody tr')
      );

      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          cell.textContent?.trim() ?? ''
        );

        if (!cells.length) return;

        const planRaw = cells[0] || '';
        const planLines = planRaw.split('\n').map((line) => line.trim()).filter(Boolean);
        const planLine = planLines[0] || '';
        const codeLine =
          planLines.slice(1).find((line) => /\d{3,}/.test(line)) ||
          cells.find((text) => /^\d{3,}$/.test(text)) ||
          '';

        let communityName = planLine.includes('-')
          ? planLine.split('-')[0]?.trim() || planLine
          : planLine;
        
        // Strip numeric suffixes from community names
        communityName = communityName.replace(/\s+\d+$/, '').trim();

        const communityCodeMatch = codeLine.match(/(\d{3,})/);
        const communityCode = communityCodeMatch ? communityCodeMatch[1] : null;

        const scarStartCell =
          cells.find((text) => dateRegex.test(text)) ||
          row
            .querySelector('[data-title*="SCAR Start"], [data-title*="Start Date"]')
            ?.textContent?.trim() ||
          null;

        const scarStartMatch = scarStartCell ? scarStartCell.match(dateRegex) : null;
        const scarStartDate = scarStartMatch ? scarStartMatch[0] : null;

        if (communityCode || communityName) {
          results.push({
            communityCode,
            communityName,
            scarStartDate,
          });
        }
      });

      return results;
    });

    return jobs;
  } catch (error) {
    console.warn('⚠️ Failed to scrape jobs/communities:', error instanceof Error ? error.message : error);
    return [];
  }
}

// ============================================================================
// Main harvest function
// ============================================================================

export async function harvestPulte(options: HarvestOptions): Promise<HarvestResult> {
  const { start, end, communities, headless } = options;
  
  // Validate credentials
  if (!USER || !PASS) {
    throw new Error('Missing PULTE_USERNAME and PULTE_PASSWORD in environment');
  }
  
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
    });

    await ctx.addInitScript(() => {
      (window as any).__name = (fn: any) => fn;
    });

    const page = await ctx.newPage();

    // Login if needed
    const loggedIn = await login(page);
    if (loggedIn) {
      console.log('🔐 Logged in and saved session state');
    }

    // Set date range and search
    console.log(`📅 Searching date range: ${start} → ${end}`);
    await setDateRange(page, start, end);

    // Expand all collapsible rows
    console.log('🔍 Expanding all check/invoice details...');
    await expandAllPlusButtons(page);

    // Scrape payment data
    console.log('📦 Scraping payment line items...');
    const items = await scrapePayments(page);

    // Scrape jobs/communities
    console.log('🏘️  Scraping jobs/communities...');
    const jobs = await scrapeJobs(page);

    console.log(`✅ Scraped ${items.length} line items, ${jobs.length} communities`);

    // Filter by communities if specified
    let filteredItems = items;
    if (communities && communities.length > 0) {
      const communityLower = communities.map((c) => c.toLowerCase());
      filteredItems = items.filter((item) => {
        const jobCode = item.jobNumber?.split('-')[0]?.toLowerCase() || '';
        const matchingJob = jobs.find((j) => j.communityCode === jobCode.toUpperCase());
        const communityName = matchingJob?.communityName?.toLowerCase() || '';
        return communityLower.some((c) => communityName.includes(c));
      });
      console.log(`📊 Filtered to ${filteredItems.length} items matching communities: ${communities.join(', ')}`);
    }

    return {
      start,
      end,
      items: filteredItems,
      jobs,
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
      default: dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
    })
    .option('end', {
      type: 'string',
      description: 'End date (YYYY-MM-DD)',
      default: dayjs().format('YYYY-MM-DD'),
    })
    .option('communities', {
      type: 'string',
      description: 'Comma-separated list of community names to filter (case-insensitive)',
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: true,
    })
    .option('concurrency', {
      type: 'number',
      description: 'Concurrency level (for future multi-tab support)',
      default: 4,
    })
    .help()
    .argv;

  const startDate = dayjs(argv.start).format('MM/DD/YYYY');
  const endDate = dayjs(argv.end).format('MM/DD/YYYY');
  const communitiesList = argv.communities
    ? argv.communities.split(',').map((c) => c.trim()).filter(Boolean)
    : undefined;

  const result = await harvestPulte({
    start: startDate,
    end: endDate,
    communities: communitiesList,
    headless: argv.headless,
    concurrency: argv.concurrency,
  });

  // Output JSON to stdout for programmatic use
  console.log('\n📄 Result JSON:');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Harvest failed:', error);
    process.exit(1);
  });
}
