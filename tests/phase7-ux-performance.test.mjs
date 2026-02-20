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
  assert.match(homeApp, /panel-card-preview/);
  assert.match(homeApp, /panel-card-preview-img/);
  assert.match(homeApp, /panel-card-link/);
  assert.match(homeApp, /`\/\$\{group\}\//);
  assert.match(homeApp, /`\/\$\{state\.g\}\/\$\{subgroup\}\//);
  assert.ok(!homeApp.includes('slice(0, 400)'), 'hard 400 result cap should be removed');
});

test('logo picker resolves daily emoji by month-day key', () => {
  const globalScript = read('generated-pages.js');
  assert.match(globalScript, /getMonthDayKey/);
  assert.match(globalScript, /row\.monthDay === monthDay/);
});

test('homepage template has lazy loading controls', () => {
  const home = read('index.html');

  assert.match(home, /id="header-menu-toggle"/);
  assert.match(home, /id="theme-toggle"/);
  assert.match(home, /id="advanced-menu"[^>]*\shidden\b/);
  assert.match(home, /id="advanced-backdrop"[^>]*\shidden\b/);
  assert.match(home, /id="panel-grid"/);
  assert.match(home, /id="results-load-more"/);
  assert.match(home, /id="results-sentinel"/);
  assert.match(home, /id="favorite-results"/);
  assert.ok(!home.includes('Choose a category panel, then a subcategory, then copy emojis instantly.'));
});

test('advanced menu hidden state is enforced by css', () => {
  const style = read('style.css');
  assert.match(style, /\.advanced-menu\[hidden\],\s*\.advanced-backdrop\[hidden\]\s*\{[\s\S]*?display:\s*none !important;/);
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

test('daily emoji schedule exists for all days of year', () => {
  const dailyPath = path.join(root, 'daily-emoji.json');
  assert.ok(fs.existsSync(dailyPath), 'daily-emoji.json should exist');

  const rows = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
  assert.ok(Array.isArray(rows), 'daily-emoji.json should be an array');
  assert.equal(rows.length, 366, `expected 366 daily entries, got ${rows.length}`);
  assert.ok(rows.every((row) => typeof row.emoji === 'string' && row.emoji.length > 0));
  assert.ok(rows.every((row) => /^\d{2}-\d{2}$/.test(row.monthDay)), 'monthDay key should be MM-DD');

  const uniqueHexes = new Set(rows.map((row) => row.hexcode));
  assert.equal(uniqueHexes.size, rows.length, 'daily schedule should not repeat hex codes');

  const shamrockDay = rows.find((row) => row.monthDay === '03-17');
  assert.ok(shamrockDay, 'expected 03-17 entry');
  assert.equal(shamrockDay.hexcode, '2618', `expected shamrock on 03-17, got ${shamrockDay.hexcode}`);
});

test('heavy group page uses preview copy that points users to subgroup pages', () => {
  const peopleBodyPage = read('people-body/index.html');
  assert.match(peopleBodyPage, /Open full collection/);

  const fileSize = fs.statSync(path.join(root, 'people-body/index.html')).size;
  assert.ok(fileSize < 1200000, `expected people-body page < 1.2MB, got ${fileSize} bytes`);
});

test('home app includes search relevance helpers and favorites persistence', () => {
  const homeApp = read('home-app.mjs');

  assert.match(homeApp, /SEARCH_SYNONYMS/);
  assert.match(homeApp, /expandQueryTokens/);
  assert.match(homeApp, /withinDistance/);
  assert.match(homeApp, /favoriteEmojisV1/);
  assert.match(homeApp, /emoji-favorite/);
});
