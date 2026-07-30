// Screenshot capture from the built production output.
//
// Copied into the staging workspace by utils/ci/run-local-ci.mjs. Files are
// written straight into the evidence directory (LOCAL_CI_SCREENSHOT_DIR) so the
// manifest can hash exactly the bytes that were produced, and so nothing is
// ever uploaded through GitHub Actions artifact storage.

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const SCREENSHOT_DIR = process.env.LOCAL_CI_SCREENSHOT_DIR;

type Shot = { name: string; path: string };

const SHOTS: Shot[] = [
  { name: 'home', path: '/' },
  { name: 'category', path: '/smileys-emotion/' },
  { name: 'detail', path: '/emoji/grinning-face/' },
];

const VIEWPORTS = [
  { suffix: 'desktop', width: 1280, height: 900 },
  { suffix: 'mobile', width: 390, height: 844 },
];

async function isolateFromNetwork(page: Page, baseURL: string) {
  const allowedOrigin = new URL(baseURL).origin;
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(allowedOrigin) || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });
}

test.describe('screenshots', () => {
  for (const shot of SHOTS) {
    for (const viewport of VIEWPORTS) {
      test(`${shot.name} @ ${viewport.suffix}`, async ({ page, baseURL }) => {
        expect(SCREENSHOT_DIR, 'LOCAL_CI_SCREENSHOT_DIR must be set').toBeTruthy();
        expect(baseURL, 'baseURL must be configured').toBeTruthy();

        await isolateFromNetwork(page, baseURL!);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const response = await page.goto(shot.path, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${shot.path} must return HTTP 200`).toBe(200);
        await page.waitForLoadState('load');
        await expect(page.locator('main#main-content')).toBeVisible();

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR!, `${shot.name}-${viewport.suffix}.png`),
          fullPage: viewport.suffix === 'desktop',
          animations: 'disabled',
          caret: 'hide',
        });
      });
    }
  }
});
