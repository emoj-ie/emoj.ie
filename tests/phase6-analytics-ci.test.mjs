import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

test('homepage includes plausible analytics script', () => {
  const home = read('index.html');
  assert.match(home, /plausible\.io\/js\/script\.js/);
  assert.match(home, /data-domain="emoj\.ie"/);
});

test('analytics events are wired for copy/search/filter/variant/share', () => {
  const generated = read('generated-pages.js');
  const homeApp = read('home-app.mjs');

  assert.match(generated, /track\('copy'/);
  assert.match(generated, /track\('share'/);
  assert.match(generated, /track\('theme_toggle'/);
  assert.match(generated, /track\('variant_select'/);
  assert.match(homeApp, /track\('search'/);
  assert.match(homeApp, /track\('filter'/);
  assert.match(homeApp, /favorite_add/);
  assert.match(homeApp, /favorite_remove/);
  assert.match(generated, /source:/);
  assert.match(generated, /hex:/);
  assert.match(generated, /group:/);
  assert.match(generated, /subgroup:/);
  assert.match(generated, /format:/);
  assert.match(homeApp, /source:/);
  assert.match(homeApp, /hex:/);
  assert.match(homeApp, /group:/);
  assert.match(homeApp, /subgroup:/);
  assert.match(homeApp, /format:/);
});

test('site-quality workflow runs full QA stages', () => {
  const workflow = read('.github/workflows/site-quality.yml');

  assert.match(workflow, /npm run build:check/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint:links/);
  assert.match(workflow, /npm run test:a11y-smoke/);
  assert.match(workflow, /npm run test:playwright-smoke/);
  assert.match(workflow, /npm run test:lighthouse-budget/);
});
