import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

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
      // Keep retrying until timeout.
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for static server at ${url}`);
}

function startStaticServer() {
  const processHandle = spawn('python3', ['-m', 'http.server', String(PORT)], {
    stdio: 'ignore',
    cwd: process.cwd(),
  });

  processHandle.on('error', (error) => {
    throw error;
  });

  return processHandle;
}

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('Playwright not installed; skipping baseline e2e.');
    return;
  }

  const server = startStaticServer();
  let browser;

  try {
    await waitForServer(BASE_URL);

    browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const clipboardStub = {
        writeText: async (value) => {
          window.__copiedValue = String(value || '');
        },
      };

      try {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          get() {
            return clipboardStub;
          },
        });
      } catch {
        // Fall back to native clipboard when descriptor cannot be replaced.
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#panel-grid .panel-card, #panel-grid .panel-card-link', { timeout: 20000 });

    await page.click('#header-menu-toggle');
    await page.waitForSelector('#advanced-menu:not([hidden])', { timeout: 5000 });
    const initialThemePreference = (await page.getAttribute('#advanced-theme-toggle', 'data-theme-preference')) || 'system';
    await page.click('#advanced-theme-toggle');
    await page.waitForTimeout(120);
    const toggledThemePreference = (await page.getAttribute('#advanced-theme-toggle', 'data-theme-preference')) || '';
    await page.click('#advanced-close');
    assert.notEqual(toggledThemePreference, initialThemePreference, 'Theme toggle should cycle preference');

    const categoryCards = page.locator('#panel-grid .panel-card');
    assert.ok((await categoryCards.count()) >= 10, 'Expected category cards on landing view');
    await categoryCards.first().click();
    await page.waitForURL(/\/[^/]+\/$/, { timeout: 10000 });
    await page.waitForSelector('.breadcrumbs', { timeout: 10000 });
    const categoryPath = new URL(page.url()).pathname;
    assert.match(
      categoryPath,
      /^\/[^/]+\/$/,
      'Category card should navigate to canonical category path'
    );
    const categoryCrumbs = await page.locator('.breadcrumbs').innerText();
    assert.match(categoryCrumbs, /^Home\s*\/\s*[A-Z]/);

    const subgroupLinks = page.locator('.panel-grid .panel-card-link');
    assert.ok((await subgroupLinks.count()) > 0, 'Expected subgroup links on category page');
    const firstSubgroupHref = (await subgroupLinks.first().getAttribute('href')) || '';
    assert.match(
      firstSubgroupHref,
      /^\/[^/]+\/[^/]+\/$/,
      'Subgroup link should use canonical category/subcategory route'
    );
    await subgroupLinks.first().click();
    await page.waitForURL(/\/[^/]+\/[^/]+\/$/, { timeout: 10000 });
    await page.waitForSelector('.subgroup .panel-emoji-copy', { timeout: 10000 });
    const subgroupCrumbs = await page.locator('.breadcrumbs').innerText();
    assert.match(subgroupCrumbs, /^Home\s*\/\s*[A-Z]/);

    const filteredButtons = page.locator('.subgroup .panel-emoji-copy');
    const filteredCount = await filteredButtons.count();
    assert.ok(filteredCount > 0, 'Expected emoji results on subgroup page');

    const firstHex = (await filteredButtons.first().getAttribute('data-hex')) || '';
    await filteredButtons.first().focus();
    await page.keyboard.press('ArrowRight');
    const focusedHex = await page.evaluate(() => document.activeElement?.getAttribute('data-hex') || '');
    assert.ok(focusedHex.length > 0, 'Expected keyboard navigation to focus an emoji card');
    if (filteredCount > 1) {
      assert.ok(firstHex.length > 0, 'Expected first emoji hex to be available');
    }

    await filteredButtons.first().click();
    await page.waitForSelector('.toast', { timeout: 5000 });
    const toastText = await page.locator('.toast').last().innerText();
    assert.match(toastText, /Copied:/, 'Expected copy toast after selecting emoji');
    const copiedValue = await page.evaluate(() => window.__copiedValue || '');
    assert.ok(copiedValue.length > 0, 'Expected clipboard stub to receive copied value');
    const expectedEmojiCopy = (await filteredButtons.first().getAttribute('data-emoji')) || '';
    assert.equal(copiedValue, expectedEmojiCopy, 'Default emoji copy mode should copy emoji glyph');

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.click('#header-menu-toggle');
    await page.waitForSelector('#advanced-menu:not([hidden])', { timeout: 5000 });
    const storedThemePreference = (await page.getAttribute('#advanced-theme-toggle', 'data-theme-preference')) || '';
    assert.equal(storedThemePreference, toggledThemePreference, 'Theme preference should persist after reload');
    await page.click('#advanced-close');

    await browser.close();
    browser = null;
    console.log('Playwright baseline e2e passed.');
  } finally {
    if (browser) {
      await browser.close();
    }
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
