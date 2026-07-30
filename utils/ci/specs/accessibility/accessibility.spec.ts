// Accessibility smoke checks against the built production output.
//
// Copied into the staging workspace by utils/ci/run-local-ci.mjs and executed
// with utils/ci/playwright.ci.config.mjs against the static server that serves
// `astro-site/dist`. These are deterministic DOM-level assertions rather than a
// third-party audit engine, because the local run may only use dependencies
// already present in astro-site/package-lock.json.

import { test, expect, type Page } from '@playwright/test';

type TargetPage = { name: string; path: string };

const TARGET_PAGES: TargetPage[] = [
  { name: 'home', path: '/' },
  { name: 'category', path: '/smileys-emotion/' },
  { name: 'detail', path: '/emoji/grinning-face/' },
];

/**
 * Block every request that does not belong to the server under test.
 * Fonts and analytics must never decide whether local CI passes, and the
 * worker may be offline.
 */
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

async function openPage(page: Page, baseURL: string | undefined, target: TargetPage) {
  expect(baseURL, 'baseURL must be configured').toBeTruthy();
  await isolateFromNetwork(page, baseURL!);
  const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${target.path} must return HTTP 200`).toBe(200);
  await page.waitForLoadState('load');
  await expect(page.locator('main#main-content')).toBeAttached();
}

/** Approximate accessible-name computation, sufficient for a smoke check. */
const ACCESSIBLE_NAME_FN = `(element) => {
  const labelled = element.getAttribute('aria-labelledby');
  if (labelled) {
    const text = labelled
      .split(/\\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ')
      .trim();
    if (text) return text;
  }
  const ariaLabel = (element.getAttribute('aria-label') || '').trim();
  if (ariaLabel) return ariaLabel;
  const title = (element.getAttribute('title') || '').trim();
  if (title) return title;
  const own = (element.textContent || '').replace(/\\s+/g, ' ').trim();
  if (own) return own;
  const img = element.querySelector('img[alt]');
  const alt = (img?.getAttribute('alt') || '').trim();
  if (alt) return alt;
  const svgTitle = (element.querySelector('svg > title')?.textContent || '').trim();
  if (svgTitle) return svgTitle;
  return '';
}`;

function describeElements(items: string[], limit = 10): string {
  return items.slice(0, limit).join('\n') + (items.length > limit ? `\n… and ${items.length - limit} more` : '');
}

for (const target of TARGET_PAGES) {
  test.describe(`accessibility: ${target.name} (${target.path})`, () => {
    test('document has a language and a non-empty title', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang?.trim(), 'html element must declare a lang').toBeTruthy();
      expect((await page.title()).trim().length, 'document title must not be empty').toBeGreaterThan(0);
    });

    test('has exactly one main landmark and exactly one non-empty h1', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      await expect(page.locator('main')).toHaveCount(1);
      const headings = page.locator('h1');
      await expect(headings).toHaveCount(1);
      const headingText = (await headings.first().textContent())?.trim() ?? '';
      expect(headingText.length, 'h1 must have text content').toBeGreaterThan(0);
    });

    test('every image declares an alt attribute', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const offenders = await page.$$eval('img', (images) =>
        images
          .filter((img) => !img.hasAttribute('alt'))
          .map((img) => `img[src="${img.getAttribute('src') ?? ''}"]`)
      );
      expect(offenders, `images without an alt attribute:\n${describeElements(offenders)}`).toEqual([]);
    });

    test('every link and button exposes an accessible name', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const offenders = await page.evaluate((nameFnSource) => {
        const accessibleName = eval(`(${nameFnSource})`) as (element: Element) => string;
        const results: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>('a[href], button');
        controls.forEach((control) => {
          if (control.getAttribute('aria-hidden') === 'true') return;
          if (control.hasAttribute('hidden')) return;
          if (!accessibleName(control)) {
            results.push(`${control.tagName.toLowerCase()}${control.className ? `.${String(control.className).split(/\s+/).join('.')}` : ''}`);
          }
        });
        return results;
      }, ACCESSIBLE_NAME_FN);
      expect(offenders, `links/buttons without an accessible name:\n${describeElements(offenders)}`).toEqual([]);
    });

    test('every visible form control is labelled', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const offenders = await page.evaluate(() => {
        const results: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>('input, select, textarea');
        controls.forEach((control) => {
          const type = (control.getAttribute('type') || '').toLowerCase();
          if (type === 'hidden') return;
          if (control.getAttribute('aria-hidden') === 'true') return;
          const id = control.getAttribute('id');
          const hasLabelElement = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
          const hasWrappingLabel = Boolean(control.closest('label'));
          const hasAriaLabel = Boolean((control.getAttribute('aria-label') || '').trim());
          const hasAriaLabelledBy = Boolean((control.getAttribute('aria-labelledby') || '').trim());
          const hasTitle = Boolean((control.getAttribute('title') || '').trim());
          if (!hasLabelElement && !hasWrappingLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
            results.push(`${control.tagName.toLowerCase()}[type="${type}"]#${id ?? '(no id)'}`);
          }
        });
        return results;
      });
      expect(offenders, `unlabelled form controls:\n${describeElements(offenders)}`).toEqual([]);
    });

    test('does not use positive tabindex values', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const offenders = await page.$$eval('[tabindex]', (elements) =>
        elements
          .filter((element) => Number(element.getAttribute('tabindex')) > 0)
          .map((element) => `${element.tagName.toLowerCase()}[tabindex="${element.getAttribute('tabindex')}"]`)
      );
      expect(offenders, `positive tabindex values break focus order:\n${describeElements(offenders)}`).toEqual([]);
    });

    test('allows pinch zoom', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const viewport = (await page.locator('meta[name="viewport"]').first().getAttribute('content')) ?? '';
      expect(viewport, 'viewport meta must exist').not.toBe('');
      expect(viewport.replace(/\s+/g, ''), 'viewport must not disable user scaling').not.toContain('user-scalable=no');
      const maximumScale = /maximum-scale=([\d.]+)/.exec(viewport);
      if (maximumScale) {
        expect(Number(maximumScale[1]), 'maximum-scale must allow at least 2x zoom').toBeGreaterThanOrEqual(2);
      }
    });

    test('heading levels do not skip', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (headings) =>
        headings.map((heading) => Number(heading.tagName.slice(1)))
      );
      expect(levels.length, 'page must contain at least one heading').toBeGreaterThan(0);
      const skips: string[] = [];
      for (let index = 1; index < levels.length; index += 1) {
        if (levels[index] - levels[index - 1] > 1) {
          skips.push(`h${levels[index - 1]} -> h${levels[index]} (heading #${index + 1})`);
        }
      }
      expect(skips, `heading level skips:\n${describeElements(skips)}`).toEqual([]);
    });

    test('has no duplicate element ids', async ({ page, baseURL }) => {
      await openPage(page, baseURL, target);
      const duplicates = await page.$$eval('[id]', (elements) => {
        const seen = new Map<string, number>();
        elements.forEach((element) => {
          const id = element.id;
          if (!id) return;
          seen.set(id, (seen.get(id) ?? 0) + 1);
        });
        return [...seen.entries()].filter(([, count]) => count > 1).map(([id, count]) => `#${id} x${count}`);
      });
      expect(duplicates, `duplicate ids break label and aria references:\n${describeElements(duplicates)}`).toEqual([]);
    });
  });
}
