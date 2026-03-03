# Coding Conventions

**Analysis Date:** 2026-03-03

## Naming Patterns

**Files:**
- Kebab-case with `.mjs` extension for ES modules: `home-app.mjs`, `home-search.mjs`, `home-utils.mjs`
- Kebab-case with `.js` extension for browser scripts: `detail-page.js`, `script.js`, `generated-pages.js`
- Kebab-case with domain prefix in build utils: `build-enrichment.mjs`, `daily-emoji-editorial.mjs`, `playwright-baseline.mjs`
- Test files follow pattern `[module-name].test.mjs` or `phase[N]-[description].test.mjs`: `home-search.test.mjs`, `phase1-generator.test.mjs`, `phase4-seo-schema.test.mjs`

**Functions:**
- Camel case for function names: `normalizeHex()`, `slugify()`, `parseUiState()`, `formatCopyValue()`, `buildEntrySearchIndex()`
- Descriptive verb-first pattern: `formatHexForAsset()`, `ensureTrailingSlash()`, `escapeHtml()`, `removeVariationSelectorsHex()`
- Helper functions with `to` prefix for transformations: `toSearchParams()`, `toTitleCaseLabel()`, `toBaseAnnotationKey()`, `toAnnotationLookupKey()`
- Predicate functions with `is` prefix: `isSkinToneVariant()`, `isRightFacingVariant()`, `isGenderVariant()`, `isLikelyVariantAnnotation()`, `isDetailPage()`, `isLegacyDetailPage()`
- Builder functions with `build` prefix: `buildEntrySearchIndex()`, `buildQueryContext()`, `buildHash()`, `buildFileContentHash()`, `buildProgressBar()`, `buildServiceWorker()`, `buildLegacyRedirects()`, `buildSitemapXml()`, `buildRobotsTxt()`
- Private/internal functions use underscore: `_normalizeHex()` (rare; most are exported)

**Variables:**
- Camel case for all variables: `searchInput`, `groupFilter`, `panelGrid`, `resultsCount`, `emojiData`, `recentEmojis`
- Descriptive element references include type: `searchInput`, `groupFilter`, `copyMode` (not `input`, `filter`, `mode`)
- Constants in UPPER_SNAKE_CASE: `COPY_MODES`, `NON_SLUG_RE`, `SPACE_RE`, `DASH_RE`, `DIACRITIC_RE`, `TOKEN_SPLIT_RE`, `QUERY_ALIASES`, `STOPWORDS`, `TAG_STOPWORDS`, `GROUP_DESCRIPTIONS`, `DETAIL_TRAIL_STORAGE_KEY`
- Loop variables: `i`, `j` for indices; descriptive names for iteration: `group`, `subgroup`, `emoji`, `entry`, `file`

**Types/Data:**
- Object property keys in camelCase: `hexLower`, `emoji`, `annotation`, `hexcode`, `group`, `subgroup`, `detailRoute`, `baseRoute`
- Special prefixes for tracked state: `data-` attributes for DOM metadata: `data-tofu-score-root`, `data-credits-run-marker`, `data-breadcrumb-source`

## Code Style

**Formatting:**
- No explicit linting or formatting tool detected; code follows manual conventions
- 2-space indentation throughout
- Lines are generally kept under 100 characters
- Trailing commas omitted in most cases
- String quotes: Mix of single and double quotes, but single quotes dominate in most files

**Import Organization:**
- Node built-ins first: `import fs from 'node:fs/promises'`, `import path from 'node:path'`, `import crypto from 'node:crypto'`
- Followed by local module imports: `import { loadEmojiModel } from './load-data.mjs'`
- Followed by function/constant imports: `import { COPY_MODES, detailRouteFromEmoji } from './home-utils.mjs'`
- All imports grouped by type with blank lines between groups
- Used in `utils/build/index.mjs`, `home-app.mjs`, all test files

**Constants and Regex:**
- Regex patterns declared at module top level: `const DIACRITIC_RE = /\p{Diacritic}/gu`
- Frozen objects for lookups: `const QUERY_ALIASES = Object.freeze({ lol: [...], ... })`
- Sets for membership testing: `const STOPWORDS = new Set(['a', 'an', 'and', ...])`

## Error Handling

**Patterns:**
- Explicit validation with `throw new Error()`: See `verify.mjs` lines 6-8, 16-18, 30-32, 42-44
  ```javascript
  if (!/--[a-f0-9-]+\/$/.test(entry.detailRoute)) {
    throw new Error(`Invalid detail route format: ${entry.detailRoute}`);
  }
  ```
- Try-catch for optional dependencies: `playwright-smoke.mjs` lines 5-11 gracefully handles missing Playwright
- Accumulated errors with arrays then throw bulk: `verify.mjs` collects `duplicateDetailRoutes` array before throwing
- Guard clauses early return on missing elements: `detail-page.js` line 39 checks existence of `breadcrumbNav` before proceeding
- Fallback returns for missing data: `home-utils.mjs` line 23 returns fallback `'emoji'` if slugify produces empty string
- Safe mode defaults: `formatCopyValue()` uses `COPY_MODES.includes()` check and defaults to `'emoji'`

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- Progress output with `console.log()`: `build/index.mjs` uses `printPhaseProgress()` and `printSyncProgress()`
- Conditional logging for TTY vs piped output: `build/index.mjs` lines 110-121 checks `process.stdout.isTTY`
- Error output with `console.error()`: `playwright-smoke.mjs` line 30, build runner line 324
- Status messages on phase completion: `build/index.mjs` lines 309-320 log summary stats

## Comments

**When to Comment:**
- Comments are sparse; code is generally self-documenting through naming
- No JSDoc/TSDoc annotations found
- Regex patterns sometimes preceded by brief intent comments (rare)
- Inline comments explain edge cases in string transformations: `home-search.mjs` line 41 explains skin tone variant handling

**Comment Style:**
- Single-line comments with `//` for rare clarifications
- Block comments absent
- Most complexity handled through function extraction rather than comments

## Function Design

**Size:** Functions are typically 5-30 lines; generally concise

**Parameters:**
- Single parameter functions preferred: `formatCopyValue(mode, entry)` takes two related parameters
- Optional parameters use default values: `slugify(input = '')`, `tokenizeSearch(value = '', { minLength = 1 } = {})`
- Options objects for optional collections: `tokenizeSearch(value, { minLength = 1 })`
- Configuration objects passed whole to functions: `renderSite({ model, legacyRedirects, config, tempRoot })`

**Return Values:**
- Early returns for guard clauses standard practice
- Functions return transformed versions of input: `slugify()` returns cleaned string, `formatCopyValue()` returns mode-specific string
- Array/object returns for multi-value results: `parseUiState()` returns object with parsed state
- Boolean returns for predicates: `isSkinToneVariant()`, `pathExists()`, `isDetailPage()`

## Module Design

**Exports:**
- Named exports standard: `export function normalizeHex(hexcode = '') { ... }`
- Constant exports: `export const COPY_MODES = ['emoji', 'unicode', 'html', 'shortcode']`
- No default exports; modules export specific utilities
- All public functions exported; no private function pattern

**Module Purpose:**
- Utilities grouped by domain: `home-utils.mjs` handles UI state, copying, slugs; `home-search.mjs` handles search logic
- Build phases separated: `load-data.mjs`, `render.mjs`, `sitemap.mjs`, `sw.mjs`, `verify.mjs`
- QA/test utilities separate: `playwright-smoke.mjs`, `check-links.mjs`, `lighthouse-budget.mjs`

## Transformation Patterns

**Common Pipeline:**
1. Input normalization: `.normalize('NFKD')` for Unicode decomposition
2. Character removal: `.replace(DIACRITIC_RE, '')` for accents
3. Case conversion: `.toLowerCase()`
4. Token splitting: `.split(TOKEN_SPLIT_RE)` or regex match
5. Filtering: `.filter(part => part.length >= minLength)`

**Example from `home-utils.mjs`:**
```javascript
export function slugify(input = '') {
  const normalized = String(input)
    .normalize('NFKD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(NON_SLUG_RE, ' ')
    .replace(SPACE_RE, '-')
    .replace(DASH_RE, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return normalized || 'emoji';
}
```

## DOM Manipulation Patterns

**Element Selection:**
- `document.getElementById()` for known elements: `const searchInput = document.getElementById('search')`
- `document.querySelector()` for class/complex selectors: `document.querySelector('nav.breadcrumbs')`
- Early guard checks for optional elements: Check if element exists before using

**DOM Updates:**
- `replaceChildren()` for clearing and replacing: `breadcrumbNav.replaceChildren()` then append new items
- `appendChild()` and manual link/span creation for structured content: `detail-page.js` builds breadcrumb items
- Style property assignment: `modal.style.display = 'block'`, `document.body.style.overflow = 'hidden'`

## Data Access Patterns

**JSON Parsing:**
- Read file to string, parse: `JSON.parse(fs.readFileSync(path, 'utf8'))`
- Safe destructuring of grouped data: Iterate with nested loops: `for (const [group, subgroups] of Object.entries(grouped))`
- Hex code normalization before comparison: `normalizeHex(emoji.hexcode) !== normalizeHex(emoji.skintone_base_hexcode)`

## URL/Route Patterns

**Building Routes:**
- Group + subgroup + slug + hex format: `people-body/hand-fingers-open/waving-hand--1f44b/`
- Normalize hex with dashes: `normalizeHex()` produces `1f44b` from `1F44B`
- Slugify annotations: `slugify(entry.annotation)` for readable part

---

*Convention analysis: 2026-03-03*
