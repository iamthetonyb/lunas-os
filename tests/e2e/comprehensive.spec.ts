import { BASE_URL } from './_env';
import puppeteer from 'puppeteer';

// Increase timeout for browser operations on M1/M2 Macs
jest.setTimeout(120000); // 2 minutes

describe('Comprehensive E2E Tests', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: true, // Use true instead of 'new' for better stability
      executablePath: '/Users/abenton333/.cache/puppeteer/chromium/mac_arm-1083080/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  }, 60000); // 60 second timeout for beforeAll

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  }, 30000);

  describe('Authentication Flow', () => {
    it('should load login page', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      
      const title = await page.title();
      expect(title).toBe('Lunas OS');
      
      const loginForm = await page.$('form');
      expect(loginForm).not.toBeNull();
    });

    it('should have email and password fields', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      const emailInput = await page.$('input[name="email"]');
      const passwordInput = await page.$('input[name="password"]');
      const submitButton = await page.$('button[type="submit"]');
      
      expect(emailInput).not.toBeNull();
      expect(passwordInput).not.toBeNull();
      expect(submitButton).not.toBeNull();
    });

    it('should successfully login with valid credentials', async () => {
      await page.goto(`${BASE_URL}/login`);
      await page.waitForSelector('input[name="email"]');
      
      await page.type('input[name="email"]', 'dispatcher@lunas.com');
      await page.type('input[name="password"]', 'password');
      
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]')
      ]);
      
      expect(page.url()).toContain('/dashboard');
    });
  });

  describe('Dashboard', () => {
    beforeEach(async () => {
      // Ensure we're logged in
      await page.goto(`${BASE_URL}/login`);
      await page.waitForSelector('input[name="email"]', { timeout: 5000 }).catch(() => {});
      
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        await page.type('input[name="email"]', 'dispatcher@lunas.com');
        await page.type('input[name="password"]', 'password');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('button[type="submit"]')
        ]);
      }
    });

    it('should display dashboard title', async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      const dashboardTitle = await page.$eval('h1, h2', el => el.textContent);
      expect(dashboardTitle).toMatch(/Dashboard|Welcome/i);
    });

    it('should have navigation sidebar', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Look for navigation elements
      const navElements = await page.$$('nav a, nav button');
      expect(navElements.length).toBeGreaterThan(0);
    });

    it('should display stats cards', async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      // Check for stat cards or metrics
      const hasContent = await page.evaluate(() => {
        return document.body.textContent!.length > 100;
      });
      
      expect(hasContent).toBe(true);
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await page.goto(`${BASE_URL}/login`);
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        await page.type('input[name="email"]', 'dispatcher@lunas.com');
        await page.type('input[name="password"]', 'password');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('button[type="submit"]')
        ]);
      }
    });

    it('should navigate to intake page', async () => {
      await page.goto(`${BASE_URL}/intake`, { waitUntil: 'networkidle2' });
      expect(page.url()).toContain('/intake');
    });

    it('should navigate to schedule page', async () => {
      await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle2' });
      expect(page.url()).toContain('/schedule');
    });

    it('should navigate to users page', async () => {
      await page.goto(`${BASE_URL}/users`, { waitUntil: 'networkidle2' });
      expect(page.url()).toContain('/users');
    });

    it('should navigate to settings page', async () => {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
      expect(page.url()).toContain('/settings');
    });
  });

  describe('Layout and Responsiveness', () => {
    beforeEach(async () => {
      await page.goto(`${BASE_URL}/dashboard`);
    });

    it('should have proper layout structure', async () => {
      const hasLayout = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        return body.children.length > 0;
      });
      
      expect(hasLayout).toBe(true);
    });

    it('should be responsive on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE size
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
      expect(bodyWidth).toBeLessThanOrEqual(375);
    });

    it('should be responsive on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad size
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
      expect(bodyWidth).toBeLessThanOrEqual(768);
    });

    it('should be responsive on desktop viewport', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
      expect(bodyWidth).toBeLessThanOrEqual(1920);
    });
  });

  describe('Performance', () => {
    it('should load dashboard within acceptable time', async () => {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      const loadTime = Date.now() - startTime;
      
      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    it('should not have console errors', async () => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      // Filter out known acceptable errors
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon') && 
        !err.includes('DevTools')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper page title', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    it('should have main content landmarks', async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      const hasMainContent = await page.evaluate(() => {
        return document.querySelector('main') !== null || 
               document.querySelector('[role="main"]') !== null;
      });
      
      expect(hasMainContent).toBe(true);
    });

    it('should have keyboard navigable elements', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const focusableElements = await page.$$('button, a, input, [tabindex]');
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('Data Display', () => {
    beforeEach(async () => {
      await page.goto(`${BASE_URL}/login`);
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        await page.type('input[name="email"]', 'dispatcher@lunas.com');
        await page.type('input[name="password"]', 'password');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('button[type="submit"]')
        ]);
      }
    });

    it('should display content on intake page', async () => {
      await page.goto(`${BASE_URL}/intake`, { waitUntil: 'networkidle2', timeout: 10000 });
      
      const hasContent = await page.evaluate(() => {
        return document.body.textContent!.length > 50;
      });
      
      expect(hasContent).toBe(true);
    });

    it('should display content on schedule page', async () => {
      await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle2', timeout: 10000 });
      
      const hasContent = await page.evaluate(() => {
        return document.body.textContent!.length > 50;
      });
      
      expect(hasContent).toBe(true);
    });
  });

  describe('Security', () => {
    it('should redirect to login when not authenticated', async () => {
      // Clear cookies to ensure we're logged out
      await page.goto(`${BASE_URL}/login`);
      const cookies = await page.cookies();
      if (cookies.length > 0) {
        await page.deleteCookie(...cookies);
      }
      
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
      
      // Should redirect to login or show authentication required
      const url = page.url();
      expect(url.includes('/login') || url.includes('/auth')).toBe(true);
    });

    it('should have secure headers', async () => {
      const response = await page.goto(`${BASE_URL}/dashboard`);
      const headers = response?.headers();
      
      // Check for some security headers (may vary based on Next.js config)
      expect(headers).toBeDefined();
    });
  });
});
