import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('Playwright not installed; skipping smoke test.');
    return;
  }

  const aboutFile = pathToFileURL(path.join(process.cwd(), 'about', 'index.html')).toString();

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(aboutFile);
  const title = await page.title();

  if (!title.toLowerCase().includes('emoj.ie')) {
    await browser.close();
    throw new Error(`Unexpected title for about page: ${title}`);
  }

  await browser.close();
  console.log('Playwright smoke test passed.');
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
