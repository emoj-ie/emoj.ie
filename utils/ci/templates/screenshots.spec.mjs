// Screenshot capture from the built production output.
//
// Copied into the staging workspace by utils/ci/run-local-ci.mjs. Files are
// written straight into the evidence directory (PW_CI_SCREENSHOT_DIR) so the
// manifest can hash them; nothing is uploaded to GitHub Actions artifacts.

import path from 'node:path';
import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = process.env.PW_CI_SCREENSHOT_DIR;
if (!SCREENSHOT_DIR) {
  throw new Error('screenshots.spec.mjs: missing required env var PW_CI_SCREENSHOT_DIR');
}

const TARGETS = [
  { id: 'home', path: '/' },
  { id: 'category', path: '/smileys-emotion/' },
  { id: 'detail', path: '/emoji/grinning-face/' },
];

for (const target of TARGETS) {
  test(`screenshot: ${target.id} (${target.path})`, async ({ page }) => {
    const response = await page.goto(target.path, { waitUntil: 'load' });
    expect(response, `no response for ${target.path}`).not.toBeNull();
    expect(response.status(), `unexpected status for ${target.path}`).toBe(200);

    // Deterministic rendering: no CSS animations or transitions in the capture.
    await page.addStyleTag({
      content: `*, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }`,
    });
    await expect(page.locator('main')).toBeVisible();

    const file = path.join(SCREENSHOT_DIR, `${target.id}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  });
}
