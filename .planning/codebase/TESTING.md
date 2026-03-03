# Testing Patterns

**Analysis Date:** 2026-03-03

## Test Framework

**Runner:**
- Node.js built-in `test` module (`node:test`)
- Configuration: Tests run via `npm test` → `node --test tests/*.test.mjs`
- Phase-specific runners: `npm run test:phase1` → `node --test tests/phase1-generator.test.mjs`

**Assertion Library:**
- Node.js built-in `assert/strict` module: `import assert from 'node:assert/strict'`
- Provides `assert.equal()`, `assert.deepEqual()`, `assert.match()`, `assert.ok()`

**Run Commands:**
```bash
npm test                      # Run all unit tests (*.test.mjs files)
npm run test:phase1           # Run phase 1 build generator tests
npm run test:phase2           # Run phase 2 home utilities tests
npm run test:phase3           # Run phase 3 accessibility & style tests
npm run test:phase4           # Run phase 4 SEO schema tests
npm run test:phase5           # Run phase 5 service worker assets tests
npm run test:phase6           # Run phase 6 analytics CI tests
npm run test:phase7           # Run phase 7 UX performance tests
npm run test:playwright-smoke # Run Playwright E2E smoke test
npm run test:lighthouse-budget # Run Lighthouse performance budget
npm run lint:links            # Check for broken links
```

## Test File Organization

**Location:**
- Co-located in `/tests/` directory separate from source
- Test files import from parent directory: `import { ... } from '../home-utils.mjs'`

**Naming:**
- Module-based: `home-search.test.mjs`, `phase2-home-utils.test.mjs`
- Phase-based: `phase1-generator.test.mjs`, `phase4-seo-schema.test.mjs`
- Pattern: `[module-or-phase-name].test.mjs`

**Structure:**
```
tests/
├── home-search.test.mjs           # Tests for search algorithm
├── phase1-generator.test.mjs      # Build output integrity
├── phase2-home-utils.test.mjs     # UI utilities and state
├── phase3-accessibility-style.test.mjs  # A11y and CSS
├── phase4-seo-schema.test.mjs     # Schema.org markup
├── phase5-sw-assets.test.mjs      # Service worker
├── phase6-analytics-ci.test.mjs   # Analytics
└── phase7-ux-performance.test.mjs  # Performance
```

## Test Structure

**Suite Organization:**
Tests are organized as a flat sequence without nesting suites. Each test is independent.

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenizeSearch, filterAndRankEntries } from '../home-search.mjs';

test('query alias usa favors United States over incidental substring matches', () => {
  const rows = [/* test data */];
  const ranked = filterAndRankEntries(rows, 'usa');
  assert.equal(ranked[0]?.annotation, 'United States');
});

test('short token uk does not drift to ukraine or tuk tuk', () => {
  const rows = [/* test data */];
  const ranked = filterAndRankEntries(rows, 'uk');
  assert.equal(ranked[0]?.annotation, 'United Kingdom');
});
```

**Test File Prefix Setup:**
Most test files open with required imports and shared setup:
```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

// Shared test data
const grouped = JSON.parse(fs.readFileSync(path.join(root, 'grouped-openmoji.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
```

**Setup/Teardown:**
- No before/after hooks used
- Static data loaded at module level and reused across tests
- Tests are isolated by default; no cross-test state

## Test Types

### Unit Tests

**Scope:** Pure function logic, algorithm correctness

**Examples:**

From `phase2-home-utils.test.mjs`:
```javascript
test('url state parsing and serialization handles q/g/sg/copy', () => {
  const parsed = parseUiState('?q=smile&g=smileys-emotion&sg=face-smiling&copy=html', 'emoji');
  assert.deepEqual(parsed, {
    q: 'smile',
    g: 'smileys-emotion',
    sg: 'face-smiling',
    copy: 'html',
  });

  const query = toSearchParams(parsed);
  assert.equal(query, 'q=smile&g=smileys-emotion&sg=face-smiling&copy=html');
});

test('slugify and detail route produce slug--hex format', () => {
  assert.equal(slugify('São Tomé & Príncipe'), 'sao-tome-principe');
  const route = detailRouteFromEmoji(sample);
  assert.equal(route, 'people-body/hand-fingers-open/waving-hand--1f44b/');
});
```

From `home-search.test.mjs`:
```javascript
function entry({
  emoji,
  annotation,
  group = 'smileys-emotion',
  subgroup = 'face-smiling',
  tags = '',
  hexcode,
}) {
  const row = {
    emoji,
    annotation,
    group,
    subgroup,
    tags,
    hexcode,
    hexLower: hexcode.toLowerCase(),
  };
  row.searchIndex = buildEntrySearchIndex(row);
  return row;
}

test('query alias usa favors United States over incidental substring matches', () => {
  const rows = [
    entry({
      emoji: '🇺🇸',
      annotation: 'United States',
      group: 'flags',
      subgroup: 'country-flag',
      tags: 'US, USA, flag, america, united states',
      hexcode: '1f1fa-1f1f8',
    }),
    // ... more test data
  ];

  const ranked = filterAndRankEntries(rows, 'usa');
  assert.equal(ranked[0]?.annotation, 'United States');
});
```

### Integration Tests

**Scope:** Generated output verification, file system integrity, cross-module contracts

**Examples from `phase1-generator.test.mjs`:**
```javascript
test('manifest stats align with grouped data', () => {
  assert.equal(manifest.stats.emojis, emojiCount);
  assert.ok(manifest.stats.redirects > 0);
  assert.ok(manifest.stats.files > manifest.stats.emojis);
});

test('detail pages are unique and one-per-emoji', () => {
  const detailFiles = manifest.files.filter(isLegacyDetailPage);
  assert.equal(detailFiles.length, emojiCount);

  const unique = new Set(detailFiles);
  assert.equal(unique.size, detailFiles.length);
});

test('legacy redirect sample exists and has redirect markup', () => {
  const redirectCandidate = manifest.files.find(
    (filePath) =>
      filePath.endsWith('/index.html') &&
      filePath.split('/').length >= 4 &&
      !isDetailPage(filePath)
  );

  assert.ok(redirectCandidate, 'expected at least one legacy redirect file');

  const html = fs.readFileSync(path.join(root, redirectCandidate), 'utf8');
  assert.match(html, /http-equiv="refresh"/i);
  assert.match(html, /window\.location\.replace\(/);
});
```

From `phase4-seo-schema.test.mjs`:
```javascript
test('sample templates have complete meta tags and schema payloads', () => {
  const samples = [
    ['index.html', ['Organization', 'WebSite']],
    ['tofu/index.html', ['WebPage', 'BreadcrumbList']],
    ['smileys-emotion/index.html', ['CollectionPage', 'ItemList', 'BreadcrumbList']],
    // ... more samples
  ];

  for (const [filePath, schemaTypes] of samples) {
    const html = read(filePath);
    assertMetaSet(html, filePath);
    assert.match(html, /<script type="application\/ld\+json">/);

    for (const type of schemaTypes) {
      assert.match(html, new RegExp(`"@type":"${type}"`), `${filePath} missing ${type} schema`);
    }
  }
});
```

From `phase3-accessibility-style.test.mjs`:
```javascript
test('sampled generated HTML avoids inline onclick and includes image dimensions', () => {
  const htmlFiles = manifest.files.filter((filePath) => filePath.endsWith('.html')).slice(0, 400);
  assert.ok(htmlFiles.length > 0);

  for (const filePath of htmlFiles) {
    const html = read(filePath);
    assert.ok(!html.includes('onclick='), `inline onclick found in ${filePath}`);

    const images = html.match(/<img\b[^>]*>/g) || [];
    for (const imageTag of images) {
      assert.match(imageTag, /\bwidth="\d+"/);
      assert.match(imageTag, /\bheight="\d+"/);
    }
  }
});
```

### E2E Tests

**Framework:** Playwright (`^1.58.2`)

**Test:** `npm run test:playwright-smoke` and `npm run test:playwright-baseline`

**Scope:** Browser rendering, page load, JavaScript execution

**Pattern from `utils/qa/playwright-smoke.mjs`:**
```javascript
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
```

## Test Data Patterns

**Factory Functions:**

From `home-search.test.mjs`:
```javascript
function entry({
  emoji,
  annotation,
  group = 'smileys-emotion',
  subgroup = 'face-smiling',
  tags = '',
  hexcode,
}) {
  const row = {
    emoji,
    annotation,
    group,
    subgroup,
    tags,
    hexcode,
    hexLower: hexcode.toLowerCase(),
  };
  row.searchIndex = buildEntrySearchIndex(row);
  return row;
}
```

**Inline Fixture Objects:**

From `phase2-home-utils.test.mjs`:
```javascript
const sample = {
  emoji: '👋',
  annotation: 'waving hand',
  hexcode: '1F44B',
  hexLower: '1f44b',
  group: 'people-body',
  subgroup: 'hand-fingers-open',
};
```

**Loaded from Build Output:**

Tests load generated artifacts to verify integrity:
```javascript
const grouped = JSON.parse(fs.readFileSync(path.join(root, 'grouped-openmoji.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
const sitemapIndex = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
```

## Assertion Patterns

**Equality Assertions:**
```javascript
assert.equal(manifest.version, 1);
assert.deepEqual(parsed, { q: 'smile', g: 'smileys-emotion', ... });
```

**String/Pattern Matching:**
```javascript
assert.match(html, /id="group-filter"/);
assert.match(sitemapIndex, /sitemap-core\.xml/);
assert.ok(html.includes('onclick=') === false);
assert.ok(!indexHtml.includes('Quick Options'));
```

**Array Operations:**
```javascript
assert.equal(detailFiles.length, emojiCount);
const unique = new Set(detailFiles);
assert.equal(unique.size, detailFiles.length);
```

**Collection Existence:**
```javascript
assert.ok(Array.isArray(manifest.managedRoots));
assert.ok(grinning.cldrKeywords && grinning.cldrKeywords.length > 0);
assert.ok(variant, 'expected to find a skin-tone variant');
```

## Coverage & Gaps

**Requirements:** No explicit coverage enforcement detected; tests are phase-based validation

**Coverage Scope:**
- Phase 1: Build manifest, generated file count, legacy redirects
- Phase 2: UI utilities, URL parsing, slug generation, copy modes
- Phase 3: Accessibility (skip links, headings), CSS patterns (transitions, outlines), HTML structure (onclick-free)
- Phase 4: SEO (meta tags, schemas, canonical links, sitemaps)
- Phase 5: Service worker and assets
- Phase 6: Analytics
- Phase 7: Performance
- Search: Tokenization, ranking, query aliases
- Playwright: Basic browser rendering and title verification

**Likely Gaps:**
- Error paths in build utilities largely untested
- Edge cases in search tokenization (beyond query aliases)
- Browser compatibility beyond headless Chromium
- Real-world loading performance on slow networks
- Offline service worker behavior

## Test Isolation

**No mocking framework used** - Tests either:
1. Load real generated output from filesystem
2. Call pure functions with fixture data
3. Launch real Playwright browser

**Data isolation:**
- Each test file loads shared static data at top level
- Tests are read-only; no mutations to shared data
- Playwright tests use fresh browser instances

---

*Testing analysis: 2026-03-03*
