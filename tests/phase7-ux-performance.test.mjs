import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

test('home app uses progressive rendering and lightweight home index data', () => {
  const homeApp = read('home-app.mjs');

  assert.match(homeApp, /home-data\.json/);
  assert.match(homeApp, /IntersectionObserver/);
  assert.match(homeApp, /appendResultChunk/);
  assert.ok(!homeApp.includes('slice(0, 400)'), 'hard 400 result cap should be removed');
});

test('homepage template has lazy loading controls', () => {
  const home = read('index.html');

  assert.match(home, /id="results-load-more"/);
  assert.match(home, /id="results-sentinel"/);
});

test('build emits a full home-data index', () => {
  const homeDataPath = path.join(root, 'home-data.json');
  assert.ok(fs.existsSync(homeDataPath), 'home-data.json should exist');

  const rows = JSON.parse(fs.readFileSync(homeDataPath, 'utf8'));
  assert.ok(Array.isArray(rows), 'home-data.json should be an array');
  assert.ok(rows.length > 4000, `expected >4000 entries, got ${rows.length}`);

  const sample = rows[0] || {};
  assert.ok(typeof sample.group === 'string' && sample.group.length > 0);
  assert.ok(typeof sample.subgroup === 'string' && sample.subgroup.length > 0);
  assert.ok(typeof sample.detailRoute === 'string' && sample.detailRoute.endsWith('/'));
});

test('heavy group page uses preview copy that points users to subgroup pages', () => {
  const peopleBodyPage = read('people-body/index.html');
  assert.match(peopleBodyPage, /Open full collection/);

  const fileSize = fs.statSync(path.join(root, 'people-body/index.html')).size;
  assert.ok(fileSize < 1200000, `expected people-body page < 1.2MB, got ${fileSize} bytes`);
});
