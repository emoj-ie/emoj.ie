// Playwright configuration used exclusively by utils/ci/run-local-ci.mjs.
//
// Everything is supplied through environment variables so the same config file
// drives three separate runs (repo smoke tests, accessibility, screenshots)
// against one already-running static server.
//
// There is deliberately no `webServer` block: run-local-ci.mjs owns the server
// process lifecycle so it can guarantee cleanup, and Playwright must never be
// able to fall back to `astro dev`.

import { defineConfig } from '@playwright/test';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`playwright.ci.config.mjs: missing required env var ${name}`);
  }
  return value;
}

export default defineConfig({
  testDir: required('LOCAL_CI_TEST_DIR'),
  outputDir: required('LOCAL_CI_OUTPUT_DIR'),
  timeout: Number(process.env.LOCAL_CI_TEST_TIMEOUT_MS || 60_000),
  expect: { timeout: 15_000 },
  // A local run must be reproducible: no retries that mask flakiness, no
  // parallel workers that make screenshots racy, and `.only` is a hard error.
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: required('LOCAL_CI_JSON_REPORT') }]],
  use: {
    baseURL: required('LOCAL_CI_BASE_URL'),
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
