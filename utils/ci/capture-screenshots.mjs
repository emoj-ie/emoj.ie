// Screenshot evidence capture from the built production output.
//
// Copied into the staging checkout's `astro-site/` directory by
// utils/ci/run-local-ci.mjs and run against the `astro preview` server for
// `dist/`. Screenshots are written straight to project-controlled local
// storage (the evidence directory) — never to GitHub Actions artifact storage.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.LOCAL_CI_BASE_URL;
const outputDir = process.env.LOCAL_CI_SHOTS_DIR;
const manifestFile = process.env.LOCAL_CI_SHOTS_JSON;

if (!baseUrl) throw new Error('LOCAL_CI_BASE_URL is required');
if (!outputDir) throw new Error('LOCAL_CI_SHOTS_DIR is required');
if (!manifestFile) throw new Error('LOCAL_CI_SHOTS_JSON is required');

const PAGES = [
  { id: 'home', route: '/' },
  { id: 'category', route: '/smileys-emotion/' },
  { id: 'detail', route: '/emoji/grinning-face/' },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const screenshots = [];
let exitCode = 0;

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      // Deterministic frames: no motion, no animation timing skew.
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    for (const target of PAGES) {
      const url = new URL(target.route, baseUrl).toString();
      const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
      const status = response?.status() ?? 0;
      if (status !== 200) {
        console.error(`FAIL ${target.route} (${viewport.id}): expected HTTP 200, got ${status}`);
        exitCode = 1;
        continue;
      }
      const file = `${target.id}-${viewport.id}.png`;
      await page.screenshot({ path: path.join(outputDir, file), fullPage: true });
      screenshots.push({ page: target.id, viewport: viewport.id, route: target.route, url, file });
      console.log(`captured ${file}`);
    }

    await context.close();
  }

  for (const target of PAGES) {
    if (!screenshots.some((s) => s.page === target.id)) {
      console.error(`FAIL: no screenshot captured for the ${target.id} page`);
      exitCode = 1;
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(
    manifestFile,
    `${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), screenshots }, null, 2)}\n`,
  );
}

console.log(`screenshots: ${screenshots.length} captured in ${outputDir}`);
process.exit(exitCode);
