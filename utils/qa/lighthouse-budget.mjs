import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();

const FILE_BUDGETS = [
  { file: 'index.html', maxBytes: 30000 },
  { file: 'style.css', maxBytes: 120000 },
  { file: 'generated-pages.js', maxBytes: 40000 },
  { file: 'home-app.mjs', maxBytes: 65000 },
  { file: 'home-utils.mjs', maxBytes: 20000 },
  { file: 'sw.js', maxBytes: 30000 },
];

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const VITAL_BUDGETS = [
  { route: '/', fcp: 1800, lcp: 2500, cls: 0.05, domComplete: 3200 },
  { route: '/people-body/', fcp: 2200, lcp: 3000, cls: 0.05, domComplete: 3600 },
  { route: '/emoji/grinning-face--1f600/', fcp: 1800, lcp: 2500, cls: 0.05, domComplete: 3200 },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || response.status === 304) {
        return;
      }
    } catch {
      // Keep waiting until timeout.
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for static server at ${url}`);
}

function startStaticServer() {
  const processHandle = spawn('python3', ['-m', 'http.server', String(PORT)], {
    stdio: 'ignore',
    cwd: root,
  });
  processHandle.on('error', (error) => {
    throw error;
  });
  return processHandle;
}

function checkFileBudgets() {
  const failures = [];
  for (const budget of FILE_BUDGETS) {
    const filePath = path.join(root, budget.file);
    const size = fs.statSync(filePath).size;
    if (size > budget.maxBytes) {
      failures.push(`${budget.file}: ${size} bytes > ${budget.maxBytes} bytes`);
    }
  }

  return failures;
}

function formatMillis(value) {
  return `${Math.round(value)}ms`;
}

async function runVitalsBudgets() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('Playwright not installed; skipping runtime vitals budget check.');
    return [];
  }

  const server = startStaticServer();
  const failures = [];
  let browser;

  try {
    await waitForServer(`${BASE_URL}/`);
    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    for (const budget of VITAL_BUDGETS) {
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__emojiVitals = {
          cls: 0,
          lcp: 0,
          fcp: 0,
        };

        try {
          const paintObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                window.__emojiVitals.fcp = entry.startTime;
              }
            }
          });
          paintObserver.observe({ type: 'paint', buffered: true });
        } catch {
          // Ignore unsupported performance observers.
        }

        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last && last.startTime > window.__emojiVitals.lcp) {
              window.__emojiVitals.lcp = last.startTime;
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
          // Ignore unsupported performance observers.
        }

        try {
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                window.__emojiVitals.cls += entry.value;
              }
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch {
          // Ignore unsupported performance observers.
        }
      });

      const url = `${BASE_URL}${budget.route}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          fcp: Number(window.__emojiVitals?.fcp || 0),
          lcp: Number(window.__emojiVitals?.lcp || 0),
          cls: Number(window.__emojiVitals?.cls || 0),
          domComplete: Number(nav?.domComplete || 0),
        };
      });

      await page.close();

      if (metrics.fcp > budget.fcp) {
        failures.push(`${budget.route} FCP ${formatMillis(metrics.fcp)} > ${formatMillis(budget.fcp)}`);
      }
      if (metrics.lcp > budget.lcp) {
        failures.push(`${budget.route} LCP ${formatMillis(metrics.lcp)} > ${formatMillis(budget.lcp)}`);
      }
      if (metrics.cls > budget.cls) {
        failures.push(`${budget.route} CLS ${metrics.cls.toFixed(4)} > ${budget.cls.toFixed(4)}`);
      }
      if (metrics.domComplete > budget.domComplete) {
        failures.push(
          `${budget.route} DOM complete ${formatMillis(metrics.domComplete)} > ${formatMillis(budget.domComplete)}`
        );
      }
    }

    await browser.close();
    browser = null;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  }

  return failures;
}

async function main() {
  const failures = [...checkFileBudgets(), ...(await runVitalsBudgets())];

  if (failures.length > 0) {
    console.error('Performance budget check failed:\n' + failures.join('\n'));
    process.exit(1);
  }

  console.log('Performance budgets passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
