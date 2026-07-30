// Playwright configuration used by utils/ci/run-local-ci.mjs.
//
// This file is copied into the staging checkout's `astro-site/` directory at
// run time so its imports resolve against the staged node_modules tree.
//
// It deliberately declares no `webServer`: the dispatcher starts a single
// `astro preview` process serving the built `dist/` output and passes its URL
// in LOCAL_CI_BASE_URL. Playwright therefore can never fall back to
// `astro dev`, and a missing preview server surfaces as a hard failure rather
// than a silently different target.
import { defineConfig } from '@playwright/test';

const baseURL = process.env.LOCAL_CI_BASE_URL;
if (!baseURL) {
  throw new Error('LOCAL_CI_BASE_URL is required; run this config via utils/ci/run-local-ci.mjs');
}

export default defineConfig({
  testDir: './tests',
  outputDir: process.env.LOCAL_CI_PW_OUTPUT || './test-results',
  timeout: 60_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: process.env.LOCAL_CI_PW_JSON }]],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
