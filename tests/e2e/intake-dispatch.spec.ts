import { BASE_URL } from './_env';
import puppeteer from 'puppeteer';

describe('Intake to Dispatch flow', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    // Login as dispatcher
    await page.goto(`${BASE_URL}/login`);
    await page.type('input[name="email"]', 'admin@lunas.local');
    await page.type('input[name="password"]', 'dev');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should create job requests, auto-draft, and approve-send', async () => {
    // This is a complex test case that will be implemented later
    expect(true).toBe(true);
  });
});
