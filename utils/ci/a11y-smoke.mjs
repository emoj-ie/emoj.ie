// Accessibility smoke checks against the built production output.
//
// Copied into the staging checkout's `astro-site/` directory by
// utils/ci/run-local-ci.mjs, then run with LOCAL_CI_BASE_URL pointing at the
// `astro preview` server for `dist/`.
//
// Only dependencies already present in astro-site/package-lock.json are used,
// so the rules below are deterministic DOM assertions rather than an axe-core
// audit. Every violation fails the run; nothing is downgraded to a warning.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.LOCAL_CI_BASE_URL;
const outputFile = process.env.LOCAL_CI_A11Y_JSON;

if (!baseUrl) throw new Error('LOCAL_CI_BASE_URL is required');
if (!outputFile) throw new Error('LOCAL_CI_A11Y_JSON is required');

const ROUTES = [
  { id: 'home', route: '/' },
  { id: 'category', route: '/smileys-emotion/' },
  { id: 'subgroup', route: '/smileys-emotion/face-smiling/' },
  { id: 'detail', route: '/emoji/grinning-face/' },
];

const RULES = [
  'html-has-lang',
  'document-has-title',
  'exactly-one-h1',
  'image-has-alt-attribute',
  'link-has-accessible-name',
  'button-has-accessible-name',
  'form-control-has-label',
  'has-main-landmark',
  'no-positive-tabindex',
  'no-duplicate-ids',
];

// Runs in the page. Returns one entry per violated rule.
function auditPage() {
  const violations = [];
  const add = (rule, message, element) => violations.push({ rule, message, element });

  const describe = (el) => {
    const attrs = ['id', 'class', 'href', 'name', 'type']
      .map((a) => (el.getAttribute(a) ? `${a}="${el.getAttribute(a)}"` : null))
      .filter(Boolean)
      .join(' ');
    return `<${el.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ''}>`;
  };

  const isHidden = (el) => {
    if (el.closest('[aria-hidden="true"]')) return true;
    if (el.hasAttribute('hidden')) return true;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    return false;
  };

  const accessibleName = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
      if (text) return text;
    }
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const text = (el.textContent ?? '').trim();
    if (text) return text;
    for (const img of el.querySelectorAll('img[alt]')) {
      const alt = img.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
    }
    for (const svg of el.querySelectorAll('svg[aria-label], svg > title')) {
      const label = svg.getAttribute?.('aria-label') ?? svg.textContent;
      if (label && label.trim()) return label.trim();
    }
    const value = el.getAttribute('value');
    if (value && value.trim()) return value.trim();
    return '';
  };

  // html-has-lang
  const lang = document.documentElement.getAttribute('lang');
  if (!lang || !lang.trim()) add('html-has-lang', 'the <html> element has no lang attribute', '<html>');

  // document-has-title
  if (!document.title || !document.title.trim()) {
    add('document-has-title', 'the document has an empty <title>', '<title>');
  }

  // exactly-one-h1
  const h1s = [...document.querySelectorAll('h1')].filter((el) => !isHidden(el));
  if (h1s.length !== 1) {
    add('exactly-one-h1', `expected exactly one visible <h1>, found ${h1s.length}`, '<h1>');
  }

  // image-has-alt-attribute (an empty alt is valid for decorative images)
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt') && img.getAttribute('aria-hidden') !== 'true' && img.getAttribute('role') !== 'presentation') {
      add('image-has-alt-attribute', 'image has no alt attribute', describe(img));
    }
  }

  // link-has-accessible-name
  for (const link of document.querySelectorAll('a[href]')) {
    if (isHidden(link)) continue;
    if (!accessibleName(link)) {
      add('link-has-accessible-name', 'link has no accessible name', describe(link));
    }
  }

  // button-has-accessible-name
  for (const button of document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')) {
    if (isHidden(button)) continue;
    if (!accessibleName(button)) {
      add('button-has-accessible-name', 'button has no accessible name', describe(button));
    }
  }

  // form-control-has-label
  for (const control of document.querySelectorAll('input, select, textarea')) {
    const type = (control.getAttribute('type') ?? '').toLowerCase();
    if (type === 'hidden' || isHidden(control)) continue;
    const id = control.getAttribute('id');
    const hasLabelElement = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
    const wrapped = Boolean(control.closest('label'));
    if (!hasLabelElement && !wrapped && !accessibleName(control) && !control.getAttribute('placeholder')) {
      add('form-control-has-label', 'form control has no associated label', describe(control));
    }
  }

  // has-main-landmark
  if (!document.querySelector('main, [role="main"]')) {
    add('has-main-landmark', 'page has no <main> landmark', '<body>');
  }

  // no-positive-tabindex
  for (const el of document.querySelectorAll('[tabindex]')) {
    const value = Number.parseInt(el.getAttribute('tabindex') ?? '', 10);
    if (Number.isInteger(value) && value > 0) {
      add('no-positive-tabindex', `tabindex="${value}" breaks natural focus order`, describe(el));
    }
  }

  // no-duplicate-ids
  const seen = new Map();
  for (const el of document.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    if (!id) continue;
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1) add('no-duplicate-ids', `id "${id}" is used ${count} times`, `#${id}`);
  }

  return violations;
}

const browser = await chromium.launch();
const report = { baseUrl, rules: RULES, pages: [], violations: 0, checkedAt: new Date().toISOString() };
let exitCode = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  for (const target of ROUTES) {
    const url = new URL(target.route, baseUrl).toString();
    const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    const status = response?.status() ?? 0;
    if (status !== 200) {
      report.pages.push({ ...target, url, status, violations: [{ rule: 'page-loads', message: `expected HTTP 200, got ${status}`, element: null }] });
      report.violations += 1;
      exitCode = 1;
      console.error(`FAIL ${target.route}: expected HTTP 200, got ${status}`);
      continue;
    }
    const violations = await page.evaluate(auditPage);
    report.pages.push({ ...target, url, status, violations });
    report.violations += violations.length;
    if (violations.length > 0) {
      exitCode = 1;
      console.error(`FAIL ${target.route}: ${violations.length} violation(s)`);
      for (const violation of violations) {
        console.error(`  [${violation.rule}] ${violation.message} ${violation.element ?? ''}`);
      }
    } else {
      console.log(`PASS ${target.route}: ${RULES.length} rules, 0 violations`);
    }
  }

  await context.close();
} finally {
  await browser.close();
  await fs.writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`accessibility smoke: ${report.pages.length} page(s), ${report.violations} violation(s)`);
process.exit(exitCode);
