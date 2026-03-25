/**
 * LUNAS-OS Client Demo — Full End-to-End Workflow Recording
 *
 * Flow: Login → New Intake → Schedule → Dispatch → Blue Book → Phases → Edit
 *
 * How it works:
 *   1. Opens a VISIBLE browser window (not headless)
 *   2. Shows login — you sign in manually
 *   3. Press ENTER in terminal when logged in
 *   4. Script automates the full walkthrough with real data
 *   5. Each scene saves as a separate .webm → convert to .mp4 for Remotion
 *
 * Usage:
 *   pnpm tsx scripts/record-demo.ts                    # full walkthrough
 *   pnpm tsx scripts/record-demo.ts --scene 3          # single scene
 *   DEMO_URL=https://lunas-os.vercel.app pnpm tsx scripts/record-demo.ts
 *
 * Output: recordings/scenes/scene-{N}-{name}.webm + .mp4
 */

import { chromium, type BrowserContext, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const BASE_URL = process.env.DEMO_URL ?? 'http://localhost:4010';
const OUTPUT_DIR = path.resolve(__dirname, '../recordings/scenes');
const VIEWPORT = { width: 1920, height: 1080 };
const SLOW_MO = 60;

// ── Helpers ──────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => { rl.close(); resolve(answer); });
    });
}

async function injectCursor(page: Page) {
    await page.addInitScript(() => {
        if ((window as any).__cursorInjected) return;
        (window as any).__cursorInjected = true;

        const style = document.createElement('style');
        style.textContent = `
            .pw-cursor {
                position: fixed;
                width: 20px; height: 20px;
                background: rgba(59,130,246,0.4);
                border: 2px solid rgba(59,130,246,0.8);
                border-radius: 50%;
                pointer-events: none;
                z-index: 999999;
                transform: translate(-50%, -50%);
                transition: left 0.12s ease, top 0.12s ease;
            }
            .pw-cursor--click {
                transform: translate(-50%, -50%) scale(0.5);
                background: rgba(59,130,246,0.7);
            }
            .pw-ripple {
                position: fixed;
                width: 40px; height: 40px;
                border: 2px solid rgba(59,130,246,0.6);
                border-radius: 50%;
                pointer-events: none;
                z-index: 999998;
                transform: translate(-50%, -50%) scale(0);
                animation: pw-ripple-out 0.5s ease-out forwards;
            }
            @keyframes pw-ripple-out {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        const cursor = document.createElement('div');
        cursor.className = 'pw-cursor';
        document.body.appendChild(cursor);

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });
        document.addEventListener('mousedown', (e) => {
            cursor.classList.add('pw-cursor--click');
            const ripple = document.createElement('div');
            ripple.className = 'pw-ripple';
            ripple.style.left = e.clientX + 'px';
            ripple.style.top = e.clientY + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
        document.addEventListener('mouseup', () => cursor.classList.remove('pw-cursor--click'));
    });
}

/** Move cursor visually to an element before clicking */
async function moveTo(page: Page, selector: string) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await el.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
            await page.waitForTimeout(300);
        }
    }
}

/** Click with visible cursor movement */
async function clickVisible(page: Page, selector: string, opts?: { timeout?: number }) {
    const el = page.locator(selector).first();
    const timeout = opts?.timeout ?? 5000;
    await el.waitFor({ state: 'visible', timeout }).catch(() => {});
    await moveTo(page, selector);
    await el.click();
    await page.waitForTimeout(400);
}

/** Type text with visible cursor + realistic speed */
async function typeVisible(page: Page, selector: string, text: string) {
    await moveTo(page, selector);
    await page.locator(selector).first().click();
    await page.waitForTimeout(200);
    // Clear existing text first
    await page.locator(selector).first().fill('');
    await page.waitForTimeout(100);
    await page.keyboard.type(text, { delay: 50 });
    await page.waitForTimeout(300);
}

/** Smooth scroll */
async function smoothScroll(page: Page, direction: 'down' | 'up' | 'top' | 'bottom', amount = 400) {
    if (direction === 'top') {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } else if (direction === 'bottom') {
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    } else {
        const y = direction === 'down' ? amount : -amount;
        await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), y);
    }
    await page.waitForTimeout(700);
}

/** Scroll element into view */
async function scrollIntoView(page: Page, selector: string) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
    }
}

/** Wait for page to stabilize */
async function waitStable(page: Page, ms = 1000) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(ms);
}

/** Pause for the viewer to read/absorb */
async function pause(page: Page, seconds = 2) {
    await page.waitForTimeout(seconds * 1000);
}

/** Save recording and rename to proper filename */
async function finishScene(context: BrowserContext, browser: Browser, name: string) {
    const pages = context.pages();
    await context.close();
    for (const p of pages) {
        const video = p.video();
        if (!video) continue;
        const src = await video.path();
        if (!src) continue;
        const dest = path.join(OUTPUT_DIR, `${name}.webm`);
        fs.renameSync(src, dest);
        // Convert to mp4
        const { execSync } = require('child_process');
        const mp4 = dest.replace('.webm', '.mp4');
        try {
            execSync(`ffmpeg -y -i "${dest}" -c:v libx264 -crf 18 -preset medium -movflags faststart "${mp4}" 2>/dev/null`);
            console.log(`  ✓ ${name}.webm + .mp4`);
        } catch {
            console.log(`  ✓ ${name}.webm (ffmpeg conversion skipped)`);
        }
    }
    await browser.close();
}

/** Create a new recording context */
async function newScene(name: string, storageState?: string) {
    const browser = await chromium.launch({
        slowMo: SLOW_MO,
        headless: false, // VISIBLE browser for real interaction
    });
    const contextOpts: any = {
        viewport: VIEWPORT,
        recordVideo: { dir: OUTPUT_DIR, size: VIEWPORT },
        colorScheme: 'light',
    };
    if (storageState && fs.existsSync(storageState)) {
        contextOpts.storageState = storageState;
    }
    const context = await browser.newContext(contextOpts);
    const page = await context.newPage();
    await injectCursor(page);
    return { browser, context, page };
}

const STORAGE_PATH = path.resolve(__dirname, '../recordings/auth-state.json');

// ── Scenes ───────────────────────────────────────────────────────────

async function scene0_login() {
    console.log('\n📋 Scene 0: Authentication');
    console.log('   A browser will open. Log into LUNAS OS.');
    console.log('   Once you see the dashboard, come back here and press ENTER.\n');

    const { browser, context, page } = await newScene('scene-0-auth');

    await page.goto(`${BASE_URL}/login`);
    await waitStable(page, 2000);

    await ask('   → Press ENTER after you have logged in... ');

    // Save auth state for subsequent scenes
    await context.storageState({ path: STORAGE_PATH });
    console.log('   ✓ Auth state saved.\n');

    await finishScene(context, browser, 'scene-0-auth');
}

async function scene1_dashboard() {
    console.log('🎥 Scene 1: Dashboard Overview');
    const { browser, context, page } = await newScene('scene-1', STORAGE_PATH);

    await page.goto(`${BASE_URL}/dashboard`);
    await waitStable(page, 1500);

    // Pan across the dashboard
    await pause(page, 2);

    // Hover over stat cards
    const cards = page.locator('.rounded-lg, .rounded-xl').filter({ hasText: /Active|Pending|Scheduled|Dispatch/i });
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
        await cards.nth(i).hover();
        await page.waitForTimeout(600);
    }

    await pause(page, 1);

    // Scroll to recent activity
    await smoothScroll(page, 'down', 500);
    await pause(page, 2);

    await smoothScroll(page, 'top');
    await pause(page, 1);

    await finishScene(context, browser, 'scene-1-dashboard');
}

async function scene2_newIntake() {
    console.log('🎥 Scene 2: New Intake — Create a Job Request');
    const { browser, context, page } = await newScene('scene-2', STORAGE_PATH);

    // Start at intake list
    await page.goto(`${BASE_URL}/intake`);
    await waitStable(page, 1500);
    await pause(page, 1.5);

    // Click "New Intake"
    const newBtn = page.locator('a[href="/intake/new"]').first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickVisible(page, 'a[href="/intake/new"]');
    } else {
        await page.goto(`${BASE_URL}/intake/new`);
    }
    await waitStable(page, 1500);
    await pause(page, 1);

    // ── Fill the form ──

    // 1. Builder dropdown — click to open, pick the first option
    const builderInput = page.locator('[class*="SearchableSelect"] input, input[placeholder*="builder" i]').first();
    if (await builderInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moveTo(page, '[class*="SearchableSelect"] input');
        await builderInput.click();
        await page.waitForTimeout(800);
        // Pick first option in dropdown
        const firstOption = page.locator('[class*="SearchableSelect"] [role="option"], [class*="SearchableSelect"] li, [class*="option"]').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await firstOption.click();
            await page.waitForTimeout(500);
        } else {
            await page.keyboard.press('Escape');
        }
    }
    await pause(page, 0.5);

    // 2. Community
    const communityInputs = page.locator('input[placeholder*="community" i], input[placeholder*="typing" i]');
    if (await communityInputs.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await communityInputs.first().click();
        await page.waitForTimeout(800);
        const opt = page.locator('[role="option"], [class*="option"] li').first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
            await opt.click();
            await page.waitForTimeout(500);
        } else {
            await page.keyboard.press('Escape');
        }
    }
    await pause(page, 0.5);

    // 3. Lot number
    const lotInput = page.locator('input[name="lot"], #lot').first();
    if (await lotInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeVisible(page, 'input[name="lot"], #lot', '142');
    }

    // 4. Services — multi-select
    await smoothScroll(page, 'down', 300);
    await pause(page, 0.5);

    const svcInput = page.locator('input[placeholder*="service" i], input[placeholder*="Select" i]').first();
    if (await svcInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await svcInput.click();
        await page.waitForTimeout(800);
        // Pick first two services
        const svcOpt1 = page.locator('[role="option"], [class*="option"]').first();
        if (await svcOpt1.isVisible({ timeout: 2000 }).catch(() => false)) {
            await svcOpt1.click();
            await page.waitForTimeout(400);
            // Try clicking the input again for a second service
            await svcInput.click();
            await page.waitForTimeout(600);
            const svcOpt2 = page.locator('[role="option"], [class*="option"]').first();
            if (await svcOpt2.isVisible({ timeout: 1500 }).catch(() => false)) {
                await svcOpt2.click();
                await page.waitForTimeout(400);
            }
        }
        await page.keyboard.press('Escape');
    }

    // 5. Due date (should have default already)
    await pause(page, 0.5);

    // 6. Scroll to contact section
    await smoothScroll(page, 'down', 300);
    await pause(page, 0.5);

    // Requested By
    const reqByInput = page.locator('input[placeholder*="requester" i], input[placeholder*="Select" i]').nth(0);
    if (await reqByInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // It might be further down the page, try the last visible SearchableSelect
    }

    // 7. Contact
    const contactInput = page.locator('input[name="contact"], #contact').first();
    if (await contactInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeVisible(page, 'input[name="contact"], #contact', '(480) 555-0123');
    }

    // 8. Scroll to notes + submit
    await smoothScroll(page, 'down', 300);
    await pause(page, 1);

    // Show the submit button
    await scrollIntoView(page, 'button[type="submit"]');
    await pause(page, 1.5);

    // Click submit (this creates a real job request)
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moveTo(page, 'button[type="submit"]');
        await pause(page, 0.5);
        await submitBtn.click();
        await waitStable(page, 2000);
    }

    // Show the success toast / redirect back to intake list
    await pause(page, 2);

    await finishScene(context, browser, 'scene-2-new-intake');
}

async function scene3_scheduleDispatch() {
    console.log('🎥 Scene 3: Schedule → Assign → Dispatch');
    const { browser, context, page } = await newScene('scene-3', STORAGE_PATH);

    // Navigate to Schedule
    await page.goto(`${BASE_URL}/schedule`);
    await waitStable(page, 1500);
    await pause(page, 2);

    // Show the schedule page layout
    await smoothScroll(page, 'down', 300);
    await pause(page, 1.5);

    // Click on foreman tabs if they exist
    const tabs = page.locator('button[role="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 1) {
        await clickVisible(page, 'button[role="tab"] >> nth=1');
        await pause(page, 1.5);
        await clickVisible(page, 'button[role="tab"] >> nth=0');
        await pause(page, 1);
    }

    // Show jobs in the table
    await smoothScroll(page, 'top');
    await pause(page, 1);

    // Look for an assign button or drag-drop area
    const assignBtn = page.locator('button:has-text("Assign"), button:has-text("Dispatch"), button:has-text("Send")').first();
    if (await assignBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await scrollIntoView(page, 'button:has-text("Assign"), button:has-text("Dispatch")');
        await moveTo(page, 'button:has-text("Assign"), button:has-text("Dispatch")');
        await pause(page, 1);
    }

    await smoothScroll(page, 'down', 300);
    await pause(page, 1.5);

    // Navigate to Dispatch
    await page.goto(`${BASE_URL}/dispatch`);
    await waitStable(page, 1500);
    await pause(page, 2);

    // Show dispatch batches
    await smoothScroll(page, 'down', 300);
    await pause(page, 1.5);

    // Click on a batch if available
    const batchLink = page.locator('a[href*="/dispatch/"]').first();
    if (await batchLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickVisible(page, 'a[href*="/dispatch/"]');
        await waitStable(page, 1500);
        await pause(page, 2);

        // Show batch detail — run sheet, assignments
        await smoothScroll(page, 'down', 400);
        await pause(page, 2);

        // Show approve button
        const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Send")').first();
        if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await moveTo(page, 'button:has-text("Approve"), button:has-text("Send")');
            await pause(page, 1.5);
        }
    }

    await pause(page, 1);
    await finishScene(context, browser, 'scene-3-schedule-dispatch');
}

async function scene4_blueBookPhases() {
    console.log('🎥 Scene 4: Blue Book — Phases & Service Check-off');
    const { browser, context, page } = await newScene('scene-4', STORAGE_PATH);

    await page.goto(`${BASE_URL}/blue-book`);
    await waitStable(page, 1500);
    await pause(page, 1.5);

    // Click on a builder tab
    const builderTabs = page.locator('button').filter({ hasText: /Pulte|KB|Builder/i });
    if (await builderTabs.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickVisible(page, 'button >> text=/Pulte|KB|Builder/i');
        await waitStable(page, 1500);
    }

    await pause(page, 1.5);

    // Show community groups
    await smoothScroll(page, 'down', 200);
    await pause(page, 1);

    // Expand a community if collapsed
    const communityToggle = page.locator('button:has(svg)').filter({ hasText: /[A-Z]/ }).first();
    if (await communityToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Already expanded usually, just show it
    }

    // Click on a PHASE PILL to expand it
    const phasePills = page.locator('button[title]').filter({ has: page.locator('span') });
    const pillCount = await phasePills.count();
    if (pillCount > 0) {
        // Click the first phase pill
        const firstPill = phasePills.first();
        await scrollIntoView(page, 'button[title]');
        await pause(page, 0.5);
        await firstPill.click();
        await page.waitForTimeout(800);
        await pause(page, 1.5);

        // Show the expanded service list
        // Click a service checkbox to toggle it
        const serviceCheckbox = page.locator('button:has(span.w-4)').first();
        if (await serviceCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
            await serviceCheckbox.click();
            await page.waitForTimeout(500);
            await pause(page, 1.5);

            // Click another one
            const secondCheckbox = page.locator('button:has(span.w-4)').nth(1);
            if (await secondCheckbox.isVisible({ timeout: 1500 }).catch(() => false)) {
                await secondCheckbox.click();
                await page.waitForTimeout(500);
                await pause(page, 1);
            }
        }

        // Show the "Mark Complete" button
        const markBtn = page.locator('button:has-text("Mark Complete"), button:has-text("Marcar Completo")').first();
        if (await markBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await moveTo(page, 'button:has-text("Mark Complete"), button:has-text("Marcar Completo")');
            await pause(page, 1);
            // Hover to show color change
            await markBtn.hover();
            await pause(page, 0.8);
            // Click it
            await markBtn.click();
            await page.waitForTimeout(500);
            await pause(page, 2);
        }

        // Click another phase pill to show it's different
        if (pillCount > 1) {
            const secondPill = phasePills.nth(1);
            await secondPill.click();
            await page.waitForTimeout(500);
            await pause(page, 1.5);
        }
    }

    // Show the progress bar changing
    await smoothScroll(page, 'top');
    await pause(page, 2);

    await finishScene(context, browser, 'scene-4-bluebook-phases');
}

async function scene5_blueBookEdit() {
    console.log('🎥 Scene 5: Blue Book — Edit Entry & Model Plan');
    const { browser, context, page } = await newScene('scene-5', STORAGE_PATH);

    await page.goto(`${BASE_URL}/blue-book`);
    await waitStable(page, 1500);

    // Select builder
    const builderTabs = page.locator('button').filter({ hasText: /Pulte|KB|Builder/i });
    if (await builderTabs.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickVisible(page, 'button >> text=/Pulte|KB|Builder/i');
        await waitStable(page, 1500);
    }

    await pause(page, 1);

    // Find an entry table and click Edit
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scrollIntoView(page, 'button:has-text("Edit")');
        await pause(page, 0.5);
        await clickVisible(page, 'button:has-text("Edit")');
        await waitStable(page, 800);
        await pause(page, 1.5);

        // Show the edit modal — scroll through fields
        const modal = page.locator('[role="dialog"], [class*="Dialog"]').first();
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await pause(page, 1);

            // Show status dropdown
            const statusSelect = modal.locator('select').first();
            if (await statusSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
                await statusSelect.click();
                await page.waitForTimeout(600);
                await page.keyboard.press('Escape');
                await pause(page, 0.5);
            }

            // Show the Model Plan dropdown
            const allSelects = modal.locator('select');
            const selectCount = await allSelects.count();
            // Model Plan is the last select
            if (selectCount > 1) {
                const modelPlanSelect = allSelects.last();
                await modelPlanSelect.scrollIntoViewIfNeeded();
                await pause(page, 0.5);
                await modelPlanSelect.click();
                await page.waitForTimeout(1000);
                // Show options
                await pause(page, 1);
                await page.keyboard.press('Escape');
                await pause(page, 0.5);
            }

            // Show amount field
            const amountInput = modal.locator('input[type="text"]').nth(0);
            if (await amountInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await amountInput.click();
                await pause(page, 0.5);
            }

            await pause(page, 1);

            // Close modal with Cancel
            const cancelBtn = modal.locator('button:has-text("Cancel")').first();
            if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await clickVisible(page, '[role="dialog"] button:has-text("Cancel")');
            }
        }
    }

    await pause(page, 1);

    // Show the Phase Config gear icon
    const gearBtn = page.locator('button[title*="phase" i], button[title*="Configure" i], button[title*="config" i]').first();
    if (await gearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await scrollIntoView(page, 'button[title*="phase" i], button[title*="Configure" i]');
        await clickVisible(page, 'button[title*="phase" i], button[title*="Configure" i]');
        await waitStable(page, 800);
        await pause(page, 2);

        // Show phase configuration
        await pause(page, 1.5);

        // Close
        const closeBtn = page.locator('button:has-text("Close")').first();
        if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await clickVisible(page, 'button:has-text("Close")');
        }
    }

    await pause(page, 0.5);

    // Show "+ New Entry" button
    const newEntryBtn = page.locator('button:has-text("New Entry"), button:has-text("+ New")').first();
    if (await newEntryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await scrollIntoView(page, 'button:has-text("New Entry"), button:has-text("+ New")');
        await moveTo(page, 'button:has-text("New Entry"), button:has-text("+ New")');
        await pause(page, 1);
        // Click to show create modal
        await newEntryBtn.click();
        await waitStable(page, 800);
        await pause(page, 2);

        // Close it
        const cancelCreate = page.locator('[role="dialog"] button:has-text("Cancel")').first();
        if (await cancelCreate.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelCreate.click();
        }
    }

    // Show pagination at the bottom
    await smoothScroll(page, 'bottom');
    await pause(page, 1.5);

    // Final pan back to top
    await smoothScroll(page, 'top');
    await pause(page, 2);

    await finishScene(context, browser, 'scene-5-bluebook-edit');
}

// ── Scene Registry ───────────────────────────────────────────────────

const allScenes = [
    { num: 0, name: 'Login (auth setup)', fn: scene0_login },
    { num: 1, name: 'Dashboard Overview', fn: scene1_dashboard },
    { num: 2, name: 'New Intake → Submit', fn: scene2_newIntake },
    { num: 3, name: 'Schedule → Dispatch', fn: scene3_scheduleDispatch },
    { num: 4, name: 'Blue Book — Phases', fn: scene4_blueBookPhases },
    { num: 5, name: 'Blue Book — Edit', fn: scene5_blueBookEdit },
];

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Parse --scene N
    const args = process.argv.slice(2);
    const sceneIdx = args.indexOf('--scene');
    const sceneNum = sceneIdx >= 0 ? parseInt(args[sceneIdx + 1]) : -1;

    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║     🎬 LUNAS-OS — Client Demo Recording     ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  URL:    ${BASE_URL.padEnd(36)}║`);
    console.log(`║  Output: recordings/scenes/                  ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    // Skip auth scene when BYPASS_AUTH is set (local dev recording)
    const bypassAuth = process.env.BYPASS_AUTH === 'true';
    const needsAuth = !bypassAuth && !fs.existsSync(STORAGE_PATH);

    if (sceneNum >= 0) {
        const scene = allScenes.find(s => s.num === sceneNum);
        if (!scene) {
            console.error(`Scene ${sceneNum} not found. Available: 0-5`);
            process.exit(1);
        }
        if (needsAuth && sceneNum > 0) {
            await scene0_login();
        }
        await scene.fn();
    } else {
        // Run all scenes in order — skip login when auth is bypassed
        const scenes = bypassAuth ? allScenes.filter(s => s.num > 0) : allScenes;
        for (const scene of scenes) {
            console.log(`\n── Scene ${scene.num}: ${scene.name} ──`);
            await scene.fn();
        }
    }

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ Recording complete!                      ║');
    console.log('║                                              ║');
    console.log('║  Files ready for Remotion in:                ║');
    console.log('║  recordings/scenes/*.mp4                     ║');
    console.log('║                                              ║');
    console.log('║  Import into Remotion composition:           ║');
    console.log('║  - scene-1-dashboard.mp4                     ║');
    console.log('║  - scene-2-new-intake.mp4                    ║');
    console.log('║  - scene-3-schedule-dispatch.mp4             ║');
    console.log('║  - scene-4-bluebook-phases.mp4               ║');
    console.log('║  - scene-5-bluebook-edit.mp4                 ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch(console.error);
