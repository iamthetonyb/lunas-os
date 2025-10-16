import { BASE_URL } from './_env';
import puppeteer from 'puppeteer';

describe('Auth smoke test', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new', executablePath: '/Users/abenton333/.cache/puppeteer/chromium/mac_arm-1083080/chrome-mac/Chromium.app/Contents/MacOS/Chromium' });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should login and redirect to dashboard', async () => {
    await page.goto(`${BASE_URL}/login`);

    // Wait for the login form to be visible
    await page.waitForSelector('form');

    // Check if the email and password inputs are visible
    const emailInput = await page.$('input[name="email"]');
    const passwordInput = await page.$('input[name="password"]');
    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();

    // Type into the inputs
    await page.type('input[name="email"]', 'dispatcher@lunas.com');
    await page.type('input[name="password"]', 'password');

    // Click the submit button
    await page.click('button[type="submit"]');

    // Wait for navigation to the dashboard
    await page.waitForNavigation();

    // Check if the URL is the dashboard
    expect(page.url()).toBe(`${BASE_URL}/dashboard`);

    // Check if the dashboard content is visible
    await page.waitForSelector('h1');
    const dashboardTitle = await page.$eval('h1', (el) => el.textContent);
    expect(dashboardTitle).toBe('Dashboard');
  });
});
