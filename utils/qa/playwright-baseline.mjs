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
    await page.waitForTimeout(250);
    const selectedGroup = await page.inputValue('#group-filter');
    assert.ok(selectedGroup.length > 0, 'Expected category selection after category click');

    const subgroupCards = page.locator('#panel-grid .panel-card');
    assert.ok((await subgroupCards.count()) > 0, 'Expected subgroup cards after category click');
    await subgroupCards.first().click();
    await page.waitForSelector('#home-results .emoji-copy', { timeout: 20000 });
    assert.ok(await page.isHidden('#panel-grid'), 'Panel grid should hide when viewing emoji list');

    await page.click('#header-menu-toggle');
    await page.waitForSelector('#advanced-menu:not([hidden])', { timeout: 5000 });
    await page.click('#clear-filters');
    await page.waitForTimeout(220);
    await page.click('#advanced-close');
    assert.ok(await page.isVisible('#panel-grid'), 'Panel grid should be visible again after reset');

    await page.click('#header-menu-toggle');
    await page.waitForSelector('#advanced-menu:not([hidden])', { timeout: 5000 });
    await page.selectOption('#group-filter', 'smileys-emotion');
    await page.waitForTimeout(250);
    await page.selectOption('#subgroup-filter', 'face-smiling');
    await page.selectOption('#copy-mode', 'unicode');
    await page.click('#advanced-close');
    await page.waitForSelector('#home-results .emoji-copy', { timeout: 20000 });

    const initialCount = await page.locator('#home-results .emoji-copy').count();
    assert.ok(initialCount > 0, 'Expected emoji results in selected subgroup');

    await page.fill('#search', 'face');
    await page.waitForTimeout(250);
    const searchedCount = await page.locator('#home-results .emoji-copy').count();
    assert.ok(searchedCount > 0, 'Expected non-empty results for "face" query');

    const filteredButtons = page.locator('#home-results .emoji-copy');
    const filteredCount = await filteredButtons.count();
    assert.ok(filteredCount > 0, 'Expected filtered results for group selection');

    const sampleGroups = await filteredButtons.evaluateAll((elements) =>
      elements.slice(0, 20).map((element) => element.getAttribute('data-group'))
    );
    assert.ok(sampleGroups.every((group) => group === 'smileys-emotion'), 'Group filter should constrain results');

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
    const expectedHexCopy = (await filteredButtons.first().getAttribute('data-hex')) || '';
    assert.equal(copiedValue, expectedHexCopy, 'Unicode copy mode should copy emoji hexcode');

    const favoriteButtons = page.locator('#home-results .emoji-favorite');
    assert.ok((await favoriteButtons.count()) > 0, 'Expected favorite buttons in search results');
    await favoriteButtons.first().click();
    await page.waitForTimeout(150);
    const activeFavorite = await favoriteButtons.first().getAttribute('aria-pressed');
    assert.equal(activeFavorite, 'true', 'Favorite toggle should activate selected emoji');

    const favoritesCount = await page.locator('#favorite-results .emoji-copy').count();
    assert.ok(favoritesCount > 0, 'Expected favorites list to populate after starring');

    await page.waitForTimeout(200);
    const recentCount = await page.locator('#recent-results .emoji-copy').count();
    assert.ok(recentCount > 0, 'Expected recents list to populate after copy');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#recent-results .emoji-copy, #recent-results .emoji-empty', { timeout: 10000 });
    await page.click('#header-menu-toggle');
    await page.waitForSelector('#advanced-menu:not([hidden])', { timeout: 5000 });
    const storedThemePreference = (await page.getAttribute('#advanced-theme-toggle', 'data-theme-preference')) || '';
    assert.equal(storedThemePreference, toggledThemePreference, 'Theme preference should persist after reload');
    await page.click('#advanced-close');
    const recentReloadCount = await page.locator('#recent-results .emoji-copy').count();
    assert.ok(recentReloadCount > 0, 'Expected recents persistence after reload');
    const favoritesReloadCount = await page.locator('#favorite-results .emoji-copy').count();
    assert.ok(favoritesReloadCount > 0, 'Expected favorites persistence after reload');

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
