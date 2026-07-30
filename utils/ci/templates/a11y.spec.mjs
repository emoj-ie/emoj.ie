// Accessibility smoke checks against the built production output.
//
// Copied into the staging workspace by utils/ci/run-local-ci.mjs. These are
// deterministic structural checks only - they use no dependency outside
// astro-site's lockfile. Every assertion fails loudly; nothing is skipped.

import { test, expect } from '@playwright/test';

const PAGES = [
  { id: 'home', path: '/' },
  { id: 'category', path: '/smileys-emotion/' },
  { id: 'subgroup', path: '/smileys-emotion/face-smiling/' },
  { id: 'detail', path: '/emoji/grinning-face/' },
];

for (const target of PAGES) {
  test.describe(`a11y smoke: ${target.id} (${target.path})`, () => {
    test.beforeEach(async ({ page }) => {
      const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${target.path}`).not.toBeNull();
      expect(response.status(), `unexpected status for ${target.path}`).toBe(200);
    });

    test('document has a language and a non-empty title', async ({ page }) => {
      const lang = await page.locator('html').getAttribute('lang');
      expect((lang || '').trim().length, 'html[lang] must be set').toBeGreaterThan(0);
      const title = await page.title();
      expect(title.trim().length, '<title> must be non-empty').toBeGreaterThan(0);
    });

    test('has exactly one main landmark and one non-empty h1', async ({ page }) => {
      await expect(page.locator('main')).toHaveCount(1);
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      const h1Text = (await h1.first().textContent()) || '';
      expect(h1Text.trim().length, 'h1 must have text').toBeGreaterThan(0);
    });

    test('has a skip link pointing at an existing target', async ({ page }) => {
      const skip = page.locator('a.skip-link').first();
      const href = await skip.getAttribute('href');
      expect(href, 'a skip link with an href is required').toBeTruthy();
      expect(href.startsWith('#'), `skip link must be a fragment link, got ${href}`).toBe(true);
      await expect(page.locator(`#${href.slice(1)}`)).toHaveCount(1);
    });

    test('every image declares alt text', async ({ page }) => {
      const missing = await page.$$eval('img', (imgs) =>
        imgs
          .filter((img) => !img.hasAttribute('alt'))
          .map((img) => img.getAttribute('src') || '(no src)')
          .slice(0, 20),
      );
      expect(missing, `images without an alt attribute: ${missing.join(', ')}`).toEqual([]);
    });

    test('every button has an accessible name', async ({ page }) => {
      const nameless = await page.$$eval('button', (els) =>
        els
          .filter((el) => el.getAttribute('aria-hidden') !== 'true')
          .filter((el) => {
            if ((el.getAttribute('aria-label') || '').trim()) return false;
            if (el.getAttribute('aria-labelledby')) return false;
            if ((el.getAttribute('title') || '').trim()) return false;
            if ((el.textContent || '').trim()) return false;
            const img = el.querySelector('img[alt]');
            if (img && (img.getAttribute('alt') || '').trim()) return false;
            const svgTitle = el.querySelector('svg title');
            if (svgTitle && (svgTitle.textContent || '').trim()) return false;
            return true;
          })
          .map((el) => el.outerHTML.slice(0, 120))
          .slice(0, 10),
      );
      expect(nameless, `buttons without an accessible name: ${nameless.join(' | ')}`).toEqual([]);
    });

    test('every link has an accessible name and a destination', async ({ page }) => {
      const broken = await page.$$eval('a', (els) =>
        els
          .filter((el) => el.getAttribute('aria-hidden') !== 'true')
          .filter((el) => {
            if (!(el.getAttribute('href') || '').trim()) return true;
            if ((el.getAttribute('aria-label') || '').trim()) return false;
            if (el.getAttribute('aria-labelledby')) return false;
            if ((el.getAttribute('title') || '').trim()) return false;
            if ((el.textContent || '').trim()) return false;
            const img = el.querySelector('img[alt]');
            if (img && (img.getAttribute('alt') || '').trim()) return false;
            const svgTitle = el.querySelector('svg title');
            if (svgTitle && (svgTitle.textContent || '').trim()) return false;
            return true;
          })
          .map((el) => el.outerHTML.slice(0, 120))
          .slice(0, 10),
      );
      expect(broken, `links without an accessible name or href: ${broken.join(' | ')}`).toEqual([]);
    });

    test('every form control has an accessible name', async ({ page }) => {
      const nameless = await page.$$eval('input, select, textarea', (els) =>
        els
          .filter((el) => el.getAttribute('type') !== 'hidden')
          .filter((el) => {
            if ((el.getAttribute('aria-label') || '').trim()) return false;
            if (el.getAttribute('aria-labelledby')) return false;
            if ((el.getAttribute('title') || '').trim()) return false;
            if (el.id && document.querySelector(`label[for="${el.id}"]`)) return false;
            if (el.closest('label')) return false;
            return true;
          })
          .map((el) => el.outerHTML.slice(0, 120))
          .slice(0, 10),
      );
      expect(nameless, `form controls without an accessible name: ${nameless.join(' | ')}`).toEqual(
        [],
      );
    });

    test('uses no positive tabindex values', async ({ page }) => {
      const positive = await page.$$eval('[tabindex]', (els) =>
        els
          .filter((el) => Number(el.getAttribute('tabindex')) > 0)
          .map((el) => el.outerHTML.slice(0, 120))
          .slice(0, 10),
      );
      expect(positive, `elements with a positive tabindex: ${positive.join(' | ')}`).toEqual([]);
    });
  });
}
