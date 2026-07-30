// Playwright configuration used by utils/ci/run-local-ci.mjs.
//
// This file is copied into a temporary staging workspace so that
// `@playwright/test` resolves against the staged astro-site node_modules.
//
// It deliberately declares NO `webServer`: run-local-ci.mjs starts and stops a
// single `astro preview` server over the built `dist/` output and passes its
// URL in. Playwright therefore always runs against production output and never
// against `astro dev`.

import { defineConfig } from '@playwright/test';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`playwright.ci.config.mjs: missing required env var ${name}`);
  }
  return value;
}

export default defineConfig({
  testDir: required('PW_CI_TEST_DIR'),
  outputDir: required('PW_CI_OUTPUT_DIR'),
  timeout: 60_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: required('PW_CI_BASE_URL'),
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
