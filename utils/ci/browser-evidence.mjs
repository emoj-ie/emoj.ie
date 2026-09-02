#!/usr/bin/env node
/**
 * Accessibility smoke checks and screenshots, taken from the BUILT production
 * output (`site/build`) served by a local static file server.
 *
 * There is no dev server here and no network access: the bytes under test are
 * exactly the bytes that get published. A missing browser, a missing page, or a
 * single accessibility violation fails the run loudly — checks never skip.
 *
 * Usage:
 *   node utils/ci/browser-evidence.mjs \
 *     --dist site/build \
 *     --screenshots <dir> \
 *     --report <file.json> \
 *     [--app-dir site]
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

/** Representative routes across every page template the site ships. */
const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/smileys-emotion/', name: 'category' },
  { path: '/smileys-emotion/face-smiling/', name: 'subgroup' },
  { path: '/emoji/grinning-face/', name: 'detail' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

/** Accessibility rules asserted on every route. */
const RULES = [
  'html-has-lang',
  'document-title',
  'single-h1',
  'heading-order',
  'image-alt',
  'link-name',
  'button-name',
  'form-field-label',
  'main-landmark',
  'unique-ids',
  'no-positive-tabindex',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function die(message) {
  process.stderr.write(`browser-evidence: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// static server over dist
// ---------------------------------------------------------------------------

function resolveDistFile(distDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const relative = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const target = path.join(distDir, relative);
  if (!target.startsWith(distDir)) return null;
  const candidates = decoded.endsWith('/')
    ? [path.join(target, 'index.html')]
    : [target, path.join(target, 'index.html'), `${target}.html`];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

async function startStaticServer(distDir) {
  const notFoundPage = path.join(distDir, '404.html');
  const server = http.createServer((req, res) => {
    const file = resolveDistFile(distDir, req.url || '/');
    if (!file) {
      const body = fs.existsSync(notFoundPage) ? fs.readFileSync(notFoundPage) : Buffer.from('Not Found');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// ---------------------------------------------------------------------------
// in-page accessibility smoke checks
// ---------------------------------------------------------------------------

/* c8 ignore start — runs inside the browser, not in Node */
function collectViolations() {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : '';
    const cls = element.className && typeof element.className === 'string'
      ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    return `${element.tagName.toLowerCase()}${id}${cls}`;
  };
  const accessibleName = (element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    const aria = element.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const text = element.textContent ? element.textContent.trim() : '';
    if (text) return text;
    const title = element.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const img = element.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return img.getAttribute('alt').trim();
    const svgTitle = element.querySelector('svg title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    return '';
  };
  const isHidden = (element) =>
    element.closest('[hidden], [aria-hidden="true"], template') !== null ||
    element.getAttribute('type') === 'hidden';

  // html-has-lang
  const lang = document.documentElement.getAttribute('lang');
  if (!lang || !lang.trim()) add('html-has-lang', '<html> has no lang attribute');

  // document-title
  if (!document.title || !document.title.trim()) add('document-title', 'page has no <title>');

  // single-h1
  const h1s = document.querySelectorAll('h1');
  if (h1s.length !== 1) add('single-h1', `expected exactly one <h1>, found ${h1s.length}`);

  // heading-order
  let previous = 0;
  for (const heading of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Number(heading.tagName.slice(1));
    if (previous && level > previous + 1) {
      add('heading-order', `h${previous} is followed by h${level} ("${heading.textContent.trim().slice(0, 40)}")`);
    }
    previous = level;
  }

  // image-alt
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) add('image-alt', `${describe(img)} has no alt attribute (src=${img.getAttribute('src')})`);
  }

  // link-name
  for (const link of document.querySelectorAll('a[href]')) {
    if (isHidden(link)) continue;
    if (!accessibleName(link)) add('link-name', `${describe(link)} (href=${link.getAttribute('href')}) has no accessible name`);
  }

  // button-name
  for (const button of document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')) {
    if (isHidden(button)) continue;
    const value = button.getAttribute('value');
    if (!accessibleName(button) && !(value && value.trim())) {
      add('button-name', `${describe(button)} has no accessible name`);
    }
  }

  // form-field-label
  for (const field of document.querySelectorAll('input, select, textarea')) {
    const type = (field.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'button', 'submit', 'reset', 'image'].includes(type)) continue;
    if (isHidden(field)) continue;
    const labelled =
      (field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`)) ||
      field.closest('label') ||
      accessibleName(field) ||
      (field.getAttribute('title') || '').trim();
    if (!labelled) add('form-field-label', `${describe(field)} has no associated label`);
  }

  // main-landmark
  const mains = document.querySelectorAll('main, [role="main"]');
  if (mains.length !== 1) add('main-landmark', `expected exactly one main landmark, found ${mains.length}`);

  // unique-ids
  const seen = new Set();
  for (const element of document.querySelectorAll('[id]')) {
    const id = element.getAttribute('id');
    if (seen.has(id)) add('unique-ids', `duplicate id "${id}"`);
    seen.add(id);
  }

  // no-positive-tabindex
  for (const element of document.querySelectorAll('[tabindex]')) {
    if (Number(element.getAttribute('tabindex')) > 0) {
      add('no-positive-tabindex', `${describe(element)} uses tabindex="${element.getAttribute('tabindex')}"`);
    }
  }

  return violations;
}
/* c8 ignore stop */

// ---------------------------------------------------------------------------

async function loadChromium(appDir) {
  const require = createRequire(path.join(appDir, 'package.json'));
  let chromium;
  try {
    ({ chromium } = require('@playwright/test'));
  } catch (error) {
    die(`@playwright/test is not installed in ${appDir} (${error.message}) — browser evidence cannot be produced`);
  }
  if (!chromium) die('@playwright/test exports no chromium browser type — browser evidence cannot be produced');
  const executablePath = chromium.executablePath();
  if (!executablePath || !fs.existsSync(executablePath)) {
    die(
      `Playwright chromium binary is missing (expected at ${executablePath}). ` +
        'Run `npx playwright install --with-deps chromium` in site/. Browser checks must not be skipped.',
    );
  }
  return { chromium, executablePath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // The canonical application is `site/` since #2, and the flag is `--app-dir`.
  //
  // `--astro-site` was kept for one revision "for compatibility", which was
  // wrong: combined with the build/ default below it resolved to
  // `astro-site/build`, a path that has never existed under either framework.
  // A compatibility shim that points at nothing is worse than no shim, so it
  // is refused by name instead - loudly, rather than failing later with a
  // confusing "no built output".
  if (args['astro-site']) {
    die('--astro-site is gone; the canonical application is site/. Use --app-dir.');
  }
  const appDir = path.resolve(args['app-dir'] || path.join(REPO_ROOT, 'site'));
  // `build`, not `dist`. adapter-static writes there. run-local-ci always
  // passes --dist so the pipeline was unaffected, which is exactly why this
  // was easy to miss: only someone running this script BY HAND would have hit
  // it, and they would have got "no built output" pointing at a directory the
  // build never creates.
  const distDir = path.resolve(args.dist || path.join(appDir, 'build'));
  const screenshotsDir = path.resolve(args.screenshots || path.join(REPO_ROOT, '.local-ci', 'screenshots'));
  const reportFile = path.resolve(args.report || path.join(REPO_ROOT, '.local-ci', 'accessibility-report.json'));

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    die(`no built output at ${distDir} — run "npm run build" in site/ before collecting browser evidence`);
  }
  await fsp.mkdir(screenshotsDir, { recursive: true });
  await fsp.mkdir(path.dirname(reportFile), { recursive: true });

  const { chromium, executablePath } = await loadChromium(appDir);
  const { server, baseUrl } = await startStaticServer(distDir);
  process.stdout.write(`browser-evidence: serving ${distDir} at ${baseUrl}\n`);

  const startedAt = new Date().toISOString();
  const pages = [];
  const screenshots = [];
  let browser;
  try {
    browser = await chromium.launch();
    for (const route of ROUTES) {
      if (!resolveDistFile(distDir, route.path)) {
        die(`built output has no page for ${route.path} — expected route missing from dist`);
      }
      const pageReport = { route: route.path, name: route.name, violations: [], screenshots: [] };

      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const consoleErrors = [];
        page.on('pageerror', (error) => consoleErrors.push(String(error.message || error)));

        const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'load' });
        if (!response || response.status() !== 200) {
          die(`${route.path} returned HTTP ${response ? response.status() : 'no response'} from built output`);
        }

        const file = path.join(screenshotsDir, `${route.name}-${viewport.name}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        pageReport.screenshots.push(path.basename(file));
        screenshots.push(file);

        if (viewport.name === 'desktop') {
          const violations = await page.evaluate(collectViolations);
          pageReport.violations = violations;
          if (consoleErrors.length > 0) {
            pageReport.pageErrors = consoleErrors;
          }
        }
        await context.close();
      }

      pages.push(pageReport);
      const count = pageReport.violations.length;
      process.stdout.write(
        `browser-evidence: ${route.path} — ${count} violation(s), ${pageReport.screenshots.length} screenshot(s)\n`,
      );
      for (const violation of pageReport.violations) {
        process.stdout.write(`  ✖ ${violation.rule}: ${violation.detail}\n`);
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  const totalViolations = pages.reduce((sum, page) => sum + page.violations.length, 0);
  const pageErrors = pages.reduce((sum, page) => sum + (page.pageErrors?.length ?? 0), 0);
  const report = {
    schemaVersion: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    distDir,
    browser: { name: 'chromium', executablePath },
    rules: RULES,
    viewports: VIEWPORTS,
    pages,
    screenshotsDir,
    screenshots: screenshots.map((file) => path.relative(screenshotsDir, file)),
    totalViolations,
    pageErrors,
  };
  await fsp.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`browser-evidence: report ${reportFile} (${totalViolations} violation(s))\n`);

  if (screenshots.length === 0) die('no screenshots were captured');
  if (totalViolations > 0) die(`${totalViolations} accessibility violation(s) in the built production output`);
  if (pageErrors > 0) die(`${pageErrors} uncaught page error(s) in the built production output`);
}

main().catch((error) => die(error && error.stack ? error.stack : String(error)));
