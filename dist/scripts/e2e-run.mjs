"use strict";
// scripts/e2e-run.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import http from 'node:http';
import process from 'node:process';
const PORT = process.env.PORT || '4010';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const READY_URL = `${BASE_URL}/__e2e-ready`;
const DEV_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const log = (m) => console.log(`[e2e-run] ${m}`);
function waitFor(url, { timeoutMs = 60000, intervalMs = 500 } = {}) {
    return new Promise(async (resolve, reject) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                await new Promise((res, rej) => {
                    const req = http.get(url, (res2) => {
                        if (res2.statusCode === 200)
                            res();
                        else
                            rej(new Error(`HTTP ${res2.statusCode}`));
                    });
                    req.on('error', rej);
                    req.setTimeout(4000, () => req.destroy(new Error('timeout')));
                });
                return resolve();
            }
            catch (_a) {
                await sleep(intervalMs);
            }
        }
        reject(new Error(`readiness timeout after ${timeoutMs}ms -> ${url}`));
    });
}
function spawnDev() {
    log(`starting dev: PORT=${PORT}`);
    const child = spawn(DEV_CMD, ['dev'], {
        env: Object.assign(Object.assign({}, process.env), { PORT, BASE_URL, NEXTAUTH_URL: BASE_URL }),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => process.stdout.write(`[dev] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[dev] ${d}`));
    child.on('exit', (code) => log(`dev exited with code ${code}`));
    return child;
}
function runJest() {
    log('running jest in-band');
    return new Promise((resolve) => {
        const j = spawn(DEV_CMD, ['jest', '--runInBand'], { stdio: 'inherit', env: Object.assign(Object.assign({}, process.env), { BASE_URL }) });
        j.on('exit', (code) => resolve(code !== null && code !== void 0 ? code : 1));
    });
}
(async () => {
    // 0) ensure a browser is available (pnpm often ignores postinstall)
    log('ensuring Chromium is installed for puppeteer');
    await new Promise((resolve) => {
        const p = spawn('npx', ['puppeteer', 'browsers', 'install', 'chromium'], { stdio: 'inherit' });
        p.on('exit', () => resolve());
    });
    // 1) start dev and wait for readiness
    const dev = spawnDev();
    // try {
    //   await waitFor(READY_URL, { timeoutMs: 90000, intervalMs: 750 });
    //   log(`readiness OK -> ${READY_URL}`);
    // } catch (e) {
    //   log(`readiness FAILED: ${e?.message || e}`);
    //   dev.kill('SIGINT');
    //   process.exit(1);
    // }
    // 2) run tests
    const code = await runJest();
    // 3) shutdown dev
    dev.kill('SIGINT');
    await sleep(1500);
    process.exit(code);
})().catch((e) => {
    // IMPORTANT: don’t assume e.error exists
    console.error('[e2e-run] fatal:', (e === null || e === void 0 ? void 0 : e.message) || e);
    process.exit(1);
});
