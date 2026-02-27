import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUTPUT_ROOT = path.join(process.cwd(), 'press-kit');
const SCREENSHOT_DIR = path.join(OUTPUT_ROOT, 'screenshots');
const CLIP_DIR = path.join(OUTPUT_ROOT, 'clips');
const LOGO_DIR = path.join(OUTPUT_ROOT, 'logos');
const SCREENSHOT_VIEWPORT = { width: 1440, height: 900 };
const CLIP_VIEWPORT = { width: 1280, height: 720 };

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
  return spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}

async function ensureDirectories() {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.mkdir(CLIP_DIR, { recursive: true });
  await fs.mkdir(LOGO_DIR, { recursive: true });
}

async function copyLogos() {
  const logoFiles = [
    'android-chrome-512x512.png',
    'android-chrome-192x192.png',
    'apple-touch-icon.png',
    'favicon-32x32.png',
    'favicon-16x16.png',
    'favicon.ico',
  ];

  for (const logo of logoFiles) {
    const source = path.join(process.cwd(), logo);
    const target = path.join(LOGO_DIR, logo);
    try {
      await fs.copyFile(source, target);
    } catch {
      // Skip missing optional logos.
    }
  }
}

async function createContext(browser, themePreference, options = {}) {
  const context = await browser.newContext(options);
  await context.addInitScript((theme) => {
    try {
      localStorage.setItem('themePreference', theme);
    } catch {
      // Ignore storage write issues.
    }
  }, themePreference);
  return context;
}

async function captureScreenshot(browser, spec) {
  const context = await createContext(browser, spec.theme || 'light', {
    viewport: SCREENSHOT_VIEWPORT,
  });

  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${spec.path}`, { waitUntil: 'networkidle' });
    if (spec.selector) {
      await page.waitForSelector(spec.selector, { timeout: 20000 });
    }
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, spec.file),
      fullPage: false,
    });
  } finally {
    await context.close();
  }
}

async function captureClip(browser, spec) {
  const context = await createContext(browser, spec.theme || 'light', {
    viewport: CLIP_VIEWPORT,
    recordVideo: {
      dir: CLIP_DIR,
      size: CLIP_VIEWPORT,
    },
  });

  let videoPath = '';
  try {
    const page = await context.newPage();
    const video = page.video();

    await page.goto(`${BASE_URL}${spec.path}`, { waitUntil: 'networkidle' });
    if (spec.selector) {
      await page.waitForSelector(spec.selector, { timeout: 20000 });
    }
    await spec.run(page);

    await page.waitForTimeout(1200);
    await context.close();
    videoPath = await video.path();
  } catch (error) {
    await context.close();
    throw error;
  }

  const targetPath = path.join(CLIP_DIR, spec.file);
  await fs.rename(videoPath, targetPath);
}

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('Playwright not installed; skipping launch asset generation.');
    return;
  }

  await ensureDirectories();
  await copyLogos();

  const server = startStaticServer();
  let browser;
  try {
    await waitForServer(`${BASE_URL}/`);
    browser = await playwright.chromium.launch({ headless: true });

    const screenshotSpecs = [
      {
        file: 'home-light.png',
        path: '/',
        theme: 'light',
        selector: '#panel-grid .panel-card',
      },
      {
        file: 'home-dark.png',
        path: '/',
        theme: 'dark',
        selector: '#panel-grid .panel-card',
      },
      {
        file: 'emoji-detail-grinning.png',
        path: '/emoji/grinning-face--1f600/',
        theme: 'light',
        selector: '.emoji-detail',
      },
      {
        file: 'category-smileys-emotion.png',
        path: '/smileys-emotion/',
        theme: 'light',
        selector: '.panel-grid .panel-card-link',
      },
      {
        file: 'subcategory-face-smiling.png',
        path: '/smileys-emotion/face-smiling/',
        theme: 'light',
        selector: '.subgroup .panel-emoji-copy',
      },
      {
        file: 'alternatives-emojipedia.png',
        path: '/alternatives/emojipedia-alternatives/',
        theme: 'light',
        selector: '.about-page',
      },
    ];

    for (const spec of screenshotSpecs) {
      await captureScreenshot(browser, spec);
      console.log(`Captured screenshot: ${spec.file}`);
    }

    const clipSpecs = [
      {
        file: 'demo-search-copy.webm',
        path: '/',
        theme: 'light',
        selector: '#search',
        run: async (page) => {
          await page.fill('#search', 'cat');
          await page.waitForSelector('#home-results .emoji-copy', { timeout: 15000 });
          await page.locator('#home-results .emoji-copy').first().click();
          await page.waitForTimeout(800);
        },
      },
      {
        file: 'demo-browse-copy.webm',
        path: '/smileys-emotion/',
        theme: 'light',
        selector: '.panel-grid .panel-card-link',
        run: async (page) => {
          await page.locator('.panel-grid .panel-card-link').first().click();
          await page.waitForURL(/\/smileys-emotion\/[^/]+\/$/, { timeout: 10000 });
          await page.waitForSelector('.subgroup [data-copy-value]', { timeout: 15000 });
          await page.locator('.subgroup [data-copy-value]').first().click();
          await page.waitForTimeout(800);
        },
      },
      {
        file: 'demo-alternatives-tour.webm',
        path: '/alternatives/emojipedia-alternatives/',
        theme: 'light',
        selector: '.about-page',
        run: async (page) => {
          await page.locator('a[href="/vs/emojipedia/"]').first().click();
          await page.waitForURL(/\/vs\/emojipedia\/$/, { timeout: 10000 });
          await page.waitForSelector('.about-page', { timeout: 10000 });
        },
      },
    ];

    for (const spec of clipSpecs) {
      await captureClip(browser, spec);
      console.log(`Captured clip: ${spec.file}`);
    }

    console.log('Launch assets generated successfully.');
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
