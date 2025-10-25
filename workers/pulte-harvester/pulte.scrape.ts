import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { chromium, Browser, Locator, Page } from 'playwright';

const PULTE_URL = 'https://bwp.pulte.com';
const PAYMENTS_URL = `${PULTE_URL}/Payments`;
const JOBS_URL = `${PULTE_URL}/Jobs`;
const STATE_PATH = 'workers/pulte-harvester/pulte-state.json';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const NEEDS_LOGIN_PATH = 'workers/pulte-harvester/NEEDS_LOGIN';
const OUTBOX_DIR = 'workers/pulte-harvester/outbox';

const USER = process.env.PULTE_USER;
const PASS = process.env.PULTE_PASS;
const INGEST_URL = process.env.INGEST_URL;
const INGEST_TOKEN = process.env.INGEST_TOKEN ?? '';
const DEBUG_MODE = String(process.env.HARVEST_DEBUG || 'false').toLowerCase() === 'true';

if (!USER || !PASS || !INGEST_URL) {
  throw new Error('Missing required env vars: PULTE_USER, PULTE_PASS, INGEST_URL');
}
const AUTH_USER = USER as string;
const AUTH_PASS = PASS as string;
const INGEST_ENDPOINT = INGEST_URL as string;

type HarvestWindow = { start: string; end: string };

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

type HarvestPayload = {
  start: string;
  end: string;
  items: LineItem[];
  jobs?: JobCommunity[];
};

type JobCommunity = {
  communityCode: string | null;
  communityName: string | null;
  scarStartDate: string | null;
};

function fridayWindowPST(): HarvestWindow {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';

  const todayPacific = dayjs(`${year}-${month}-${day}`);
  const end = todayPacific.format('MM/DD/YYYY');
  const start = todayPacific.subtract(7, 'day').format('MM/DD/YYYY');
  return { start, end };
}

function ensureOutboxDir() {
  if (!fs.existsSync(OUTBOX_DIR)) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  }
}

async function flushOutbox() {
  ensureOutboxDir();
  const files = fs.readdirSync(OUTBOX_DIR).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    const fullPath = path.join(OUTBOX_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const { payload } = JSON.parse(raw) as { payload: HarvestPayload };
      if (!payload) {
        throw new Error('Missing payload data');
      }
      await sendToIngest(payload);
      fs.unlinkSync(fullPath);
      console.log(`📤 Flushed queued harvest (${file})`);
    } catch (err) {
      console.error(`⚠️ Failed to flush ${file}:`, err instanceof Error ? err.message : err);
      break;
    }
  }
}

async function sendToIngest(payload: HarvestPayload) {
  const response = await fetch(INGEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(INGEST_TOKEN ? { authorization: `Bearer ${INGEST_TOKEN}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ingest failed (${response.status}): ${text}`);
  }
}

function persistPendingPayload(payload: HarvestPayload, reason: string) {
  ensureOutboxDir();
  const fileName = `pending-${Date.now()}.json`;
  const fullPath = path.join(OUTBOX_DIR, fileName);
  fs.writeFileSync(fullPath, JSON.stringify({ reason, payload }, null, 2));
  console.warn(`📦 Saved payload for retry (${fullPath})`);
}

async function login(page: Page): Promise<boolean> {
  await page.goto(PULTE_URL, { waitUntil: 'domcontentloaded' });
  await assertNotBlocked(page);

  const paymentsLink = page.locator('a[href="/Payments"]').first();
  const alreadyAuthed = await paymentsLink.isVisible().catch(() => false);
  if (alreadyAuthed) return false;

  await page.getByRole('textbox', { name: /email|user/i }).fill(AUTH_USER);
  await page.getByRole('textbox', { name: /password/i }).fill(AUTH_PASS);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.waitForSelector('a[href="/Payments"]', { timeout: 60_000 });
  await assertNotBlocked(page);

  await page.context().storageState({ path: STATE_PATH });
  return true;
}

async function setDateRange(page: Page, start: string, end: string) {
  await page.goto(PAYMENTS_URL, { waitUntil: 'domcontentloaded' });
  await assertNotBlocked(page);

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
  if (DEBUG_MODE) {
    const startValue = await startBox.inputValue().catch(() => '');
    const endValue = await endBox.inputValue().catch(() => '');
    console.log(`[DEBUG] Checks date inputs set to ${startValue} → ${endValue}`);
  }

  const searchButton = page.locator(
    'button:has-text("Search"), input[type="submit"][value="Search"], button[title*="Search"], button[aria-label*="Search"]'
  ).first();
  await searchButton.waitFor({ state: 'visible' });
  const enabled = await searchButton.isEnabled().catch(() => true);
  if (DEBUG_MODE) {
    console.log(`[DEBUG] Search button enabled: ${enabled}`);
  }
  await searchButton.click({ force: true });

  if (DEBUG_MODE) {
    console.log('[DEBUG] Search button clicked');
  }

  await page.waitForLoadState('networkidle');
  const gridReady = await page
    .waitForFunction(() => {
      const table = document.querySelector('#checks-results-table') as HTMLTableElement | null;
      if (!table || table.classList.contains('hidden')) return false;
      const hasRows = table.querySelectorAll('tbody tr').length > 0;
      const noData = table.querySelector('tbody tr td')?.textContent?.toLowerCase().includes('no checks found');
      return hasRows || noData;
    }, null, { timeout: 20_000 })
    .catch(() => false);

  if (DEBUG_MODE) {
    console.log(`[DEBUG] Checks grid ready: ${gridReady}`);
    const warningVisible = await page.locator('#check-search-results-warning').isVisible().catch(() => false);
    console.log(`[DEBUG] Warning visible: ${warningVisible}`);
  }
  await assertNotBlocked(page);
}

function parseMoney(text?: string | null) {
  if (!text) return 0;
  return Number(text.replace(/[,$]/g, '').trim());
}

async function assertNotBlocked(page: Page) {
  const text = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  if (/request is blocked|access denied|blocked by/i.test(text)) {
    throw new Error('WAF_BLOCKED');
  }
}

async function expandAllPlusButtons(page: Page) {
  const clickAll = async (locator: Locator, description: string) => {
    const count = await locator.count();
    if (DEBUG_MODE) {
      console.log(`[DEBUG] Clicking ${count} elements for ${description}`);
    }
    for (let i = 0; i < count; i++) {
      try {
        await locator.nth(i).click({ timeout: 1000 });
        await page.waitForTimeout(150);
      } catch {
        // ignore elements that collapse immediately or are already open
      }
    }
  };

  // Expand check-level rows
  const checkAnchors = page.locator('#checks-results-table tr.open-row > td:first-child a');
  const checkCount = await checkAnchors.count();
  if (DEBUG_MODE) {
    console.log(`[DEBUG] Found ${checkCount} check rows`);
  }
  await clickAll(checkAnchors, 'check expanders');
  if (checkCount > 0) {
    await page.waitForResponse((res) => res.url().includes('/Payments/GetCheckInvoices'), { timeout: 15_000 }).catch(() => undefined);
    await page.waitForFunction(() => {
      return document.querySelectorAll('#checks-results-table table.invoices-datagrid tr.open-row').length > 0;
    }).catch(() => undefined);
  }

  // Expand invoice-level rows under each check
  const invoiceAnchors = page.locator(
    '#checks-results-table table.invoices-datagrid tr.open-row > td:first-child a'
  );
  const invoiceCount = await invoiceAnchors.count();
  if (DEBUG_MODE) {
    console.log(`[DEBUG] Found ${invoiceCount} invoice rows`);
  }
  await clickAll(invoiceAnchors, 'invoice expanders');
  if (invoiceCount > 0) {
    await page.waitForFunction(() => {
      return document.querySelectorAll('table.invoice-details-datagrid tbody tr').length > 0;
    }).catch(() => undefined);
  }

  await page.waitForTimeout(300);
}

async function scrape(page: Page): Promise<LineItem[]> {
  const items = await page.evaluate(function () {
    const __name = (fn: any) => fn;
    function parseMoneyFrom(text?: string | null) {
      if (!text) return 0;
      const cleaned = text.replace(/[^0-9.-]/g, '');
      const value = Number(cleaned);
      return Number.isFinite(value) ? value : 0;
    }

    const data: any[] = [];
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

          data.push({
            checkDate,
            checkNumber,
            isACH: /yes/i.test(achText),
            checkTotal: parseMoneyFrom(checkTotalText),
            invoiceNumber,
            invoiceDate,
            invoiceAmount: parseMoneyFrom(invoiceAmountText),
            jobNumber: cells[1]?.textContent?.trim() ?? '',
            jobAddress: cells[2]?.textContent?.trim() ?? '',
            accountCategory: cells[3]?.textContent?.trim() ?? '',
            planNumber: cells[4]?.textContent?.trim() ?? '',
            optionNumber: cells[5]?.textContent?.trim() ?? '',
            startDate: cells[6]?.textContent?.trim() || null,
            completedDate: cells[7]?.textContent?.trim() || null,
            lineAmount: parseMoneyFrom(lineAmountText),
          });
        }
      }
    }

    return data;
  });

  return items;
}

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

    if (DEBUG_MODE) {
      try {
        const html = await page.content();
        fs.writeFileSync('workers/pulte-harvester/jobs-debug.html', html);
      } catch (err) {
        console.warn('Failed to write jobs debug HTML:', err instanceof Error ? err.message : err);
      }
    }

    const jobs = await page.evaluate(() => {
      const map = new Map<
        string,
        {
          communityCode: string | null;
          communityName: string | null;
          scarStartDate: string | null;
        }
      >();
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

        const communityName = planLine?.trim() || null;
        const communityCodeMatch = codeLine.match(/(\d{3,})/);
        const communityCode = communityCodeMatch ? communityCodeMatch[1] : null;

        const scarStartCell =
          cells.find((text) => dateRegex.test(text)) ||
          row
            .querySelector('[data-title*="SCAR Start"], [data-title*="Start Date"]')
            ?.textContent?.trim() ||
          null;

        const scarStartDate = scarStartCell && dateRegex.test(scarStartCell)
          ? scarStartCell.match(dateRegex)?.[0] ?? null
          : null;

        if (communityCode) {
          const existing = map.get(communityCode);
          if (!existing || scarStartDate) {
            map.set(communityCode, {
              communityCode,
              communityName: communityName || existing?.communityName || null,
              scarStartDate: scarStartDate || existing?.scarStartDate || null,
            });
          }
        }
      });

      const filterItems = Array.from(
        document.querySelectorAll<HTMLLabelElement>('#community-options label')
      );

      filterItems.forEach((item) => {
        const text = item.textContent?.trim() ?? '';
        if (!text) return;
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        const title = lines[0] || '';
        const communityName = title?.trim() || null;

        const codeMatch =
          lines
            .slice(1)
            .map((line) => line.match(/\d{3,}/)?.[0])
            .find(Boolean) || title.match(/\d{3,}/)?.[0];

        if (!codeMatch) return;
        if (!map.has(codeMatch)) {
          map.set(codeMatch, {
            communityCode: codeMatch,
            communityName,
            scarStartDate: null,
          });
        }
      });

      return Array.from(map.values());
    });

    return jobs;
  } catch (error) {
    console.warn('⚠️ Failed to scrape Jobs tab:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function run() {
  const headless = String(process.env.HEADLESS || 'true') !== 'false';
  const useState = fs.existsSync(STATE_PATH);
  const harvestWindow: HarvestWindow = process.env.START_DATE && process.env.END_DATE
    ? { start: process.env.START_DATE, end: process.env.END_DATE }
    : fridayWindowPST();

  let browser: Browser | null = null;

  try {
    ensureOutboxDir();
    await flushOutbox();
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
      (window as unknown as { __name?: (fn: any, name?: string) => any }).__name = (fn: any) => fn;
    });

    const page = await ctx.newPage();
    if (DEBUG_MODE) {
      page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/Payments') || url.includes('/payments')) {
          console.log(`[DEBUG] Response ${res.status()} ${url}`);
        }
      });
    }

    const loggedIn = await login(page);
    if (loggedIn) {
      console.log('🔐 Saved new session state to pulte-state.json');
    }

    await setDateRange(page, harvestWindow.start, harvestWindow.end);
    await expandAllPlusButtons(page);
    if (DEBUG_MODE) {
      await page.screenshot({ path: 'workers/pulte-harvester/pulte-debug.png', fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => '');
      if (html) {
        fs.writeFileSync('workers/pulte-harvester/pulte-debug.html', html);
      }
    }

    const items = await scrape(page);
    const jobs = await scrapeJobs(page);
    if (DEBUG_MODE) {
      console.log('Jobs scraped sample:', jobs.slice(0, 5));
    }

    const payload: HarvestPayload = {
      start: harvestWindow.start,
      end: harvestWindow.end,
      items,
      jobs,
    };

    try {
      await sendToIngest(payload);
      console.log(`✅ Sent ${items.length} line items (${harvestWindow.start} → ${harvestWindow.end})`);
    } catch (ingestError) {
      const reason = ingestError instanceof Error ? ingestError.message : String(ingestError);
      persistPendingPayload(payload, reason);
      throw new Error(`INGEST_DEFERRED: ${reason}`);
    }

    if (fs.existsSync(NEEDS_LOGIN_PATH)) {
      fs.rmSync(NEEDS_LOGIN_PATH);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('WAF_BLOCKED')) {
      fs.writeFileSync(NEEDS_LOGIN_PATH, new Date().toISOString());
      console.error('❌ Blocked by WAF. Run bootstrap: pnpm harvest:pulte:bootstrap');
    } else if (message.includes('INGEST_DEFERRED')) {
      console.warn('⚠️ App offline; data queued for retry once ingest endpoint returns.');
    } else {
      console.error('❌ Harvester error:', message);
    }

    const firstContext = browser?.contexts()[0];
    const firstPage = firstContext?.pages()[0];
    if (firstPage) {
      try {
        await firstPage.screenshot({ path: 'pulte-error.png', fullPage: true });
      } catch (screenshotError) {
        console.error('Failed to capture screenshot:', screenshotError);
      }
    }

    if (!message.includes('INGEST_DEFERRED')) {
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
  }
}

run();
