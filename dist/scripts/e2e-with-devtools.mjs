"use strict";
// scripts/e2e-with-devtools.mjs
// Enhanced E2E runner with Chrome DevTools MCP integration
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import http from 'node:http';
import process from 'node:process';
const PORT = process.env.PORT || '4010';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DEV_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const log = (m) => console.log(`[e2e-devtools] ${m}`);
function waitForServer(url, { timeoutMs = 60000, intervalMs = 500 } = {}) {
    return new Promise(async (resolve, reject) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                await new Promise((res, rej) => {
                    const req = http.get(url, (res2) => {
                        if (res2.statusCode >= 200 && res2.statusCode < 500)
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
        reject(new Error(`Server readiness timeout after ${timeoutMs}ms -> ${url}`));
    });
}
function spawnDev() {
    log(`Starting development server: PORT=${PORT}`);
    const child = spawn(DEV_CMD, ['dev'], {
        env: Object.assign(Object.assign({}, process.env), { PORT, BASE_URL, NEXTAUTH_URL: BASE_URL }),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => process.stdout.write(`[dev] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[dev] ${d}`));
    child.on('exit', (code) => log(`Dev server exited with code ${code}`));
    return child;
}
function runTests() {
    log('Running comprehensive E2E tests with Jest');
    return new Promise((resolve) => {
        const j = spawn(DEV_CMD, ['jest', '--runInBand', 'tests/e2e/comprehensive.spec.ts'], {
            stdio: 'inherit',
            env: Object.assign(Object.assign({}, process.env), { BASE_URL })
        });
        j.on('exit', (code) => resolve(code !== null && code !== void 0 ? code : 1));
    });
}
async function startChromeDevTools() {
    log('Starting Chrome DevTools MCP server...');
    return new Promise((resolve) => {
        const devtools = spawn('chrome-devtools-mcp', [], {
            stdio: 'inherit',
            detached: true
        });
        devtools.on('spawn', () => {
            log('Chrome DevTools MCP server started');
            resolve(devtools);
        });
        devtools.on('error', (err) => {
            log(`Chrome DevTools MCP warning: ${err.message}`);
            resolve(null); // Continue even if DevTools MCP fails
        });
    });
}
(async () => {
    let devServer = null;
    let devtools = null;
    try {
        // 1) Ensure Chromium is installed
        log('Ensuring Chromium is installed for Puppeteer...');
        await new Promise((resolve) => {
            const p = spawn('npx', ['puppeteer', 'browsers', 'install', 'chromium@1083080'], {
                stdio: 'inherit'
            });
            p.on('exit', () => resolve());
        });
        // 2) Start Chrome DevTools MCP (optional enhancement)
        devtools = await startChromeDevTools();
        await sleep(1000); // Give it time to start
        // 3) Start development server
        devServer = spawnDev();
        // Wait for server to be ready
        log('Waiting for server to be ready...');
        await waitForServer(`${BASE_URL}/login`, { timeoutMs: 90000, intervalMs: 1000 });
        log(`Server is ready at ${BASE_URL}`);
        await sleep(2000); // Extra time for Next.js to stabilize
        // 4) Run comprehensive tests
        log('Starting test suite...');
        const code = await runTests();
        // 5) Cleanup
        log('Tests completed, cleaning up...');
        if (devServer) {
            devServer.kill('SIGINT');
        }
        if (devtools) {
            devtools.kill('SIGINT');
        }
        await sleep(1500);
        if (code === 0) {
            log('✅ All tests passed!');
        }
        else {
            log(`❌ Tests failed with code ${code}`);
        }
        process.exit(code);
    }
    catch (error) {
        console.error('[e2e-devtools] Fatal error:', (error === null || error === void 0 ? void 0 : error.message) || error);
        // Cleanup on error
        if (devServer)
            devServer.kill('SIGKILL');
        if (devtools)
            devtools.kill('SIGKILL');
        process.exit(1);
    }
})();
