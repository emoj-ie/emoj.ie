import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/emoj\.ie/i);
  });

  test('has a search input', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Category page', () => {
  test('loads and shows subgroup links', async ({ page }) => {
    await page.goto('/smileys-emotion/');
    await expect(page.locator('h1')).toContainText(/smileys/i);
    // Should have at least one subgroup link
    const subgroupLinks = page.locator('a.panel-card');
    await expect(subgroupLinks.first()).toBeVisible();
  });
});

test.describe('Subgroup page', () => {
  test('loads and shows emoji cards', async ({ page }) => {
    await page.goto('/smileys-emotion/face-smiling/');
    await expect(page.locator('h1')).toContainText(/face smiling/i);
  });
});

test.describe('Detail page', () => {
  test('loads and shows the emoji and annotation', async ({ page }) => {
    await page.goto('/emoji/grinning-face/');
    await expect(page.locator('h1')).toContainText(/grinning face/i);
    // Should have copy-related UI
    const copyArea = page.locator('.copy-island, .emoji-actions');
    await expect(copyArea.first()).toBeVisible();
  });

  test('has JSON-LD with DefinedTerm type', async ({ page }) => {
    await page.goto('/emoji/grinning-face/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);

    // Check that at least one script contains DefinedTerm
    let foundDefinedTerm = false;
    for (let i = 0; i < count; i++) {
      const content = await jsonLd.nth(i).textContent();
      if (content && content.includes('DefinedTerm')) {
        foundDefinedTerm = true;
        break;
      }
    }
    expect(foundDefinedTerm).toBe(true);
  });
});

test.describe('404 page', () => {
  test('shows for non-existent routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist/');
    expect(response?.status()).toBe(404);
  });
});

test.describe('SEO', () => {
  test('home page has canonical link', async ({ page }) => {
    await page.goto('/');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /emoj\.ie/);
  });

  test('detail page has canonical link', async ({ page }) => {
    await page.goto('/emoji/grinning-face/');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /emoj\.ie.*grinning-face/);
  });

  test('category page has canonical link', async ({ page }) => {
    await page.goto('/smileys-emotion/');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /emoj\.ie.*smileys-emotion/);
  });
});
