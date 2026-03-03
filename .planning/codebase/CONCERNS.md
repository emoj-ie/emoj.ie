# Codebase Concerns

**Analysis Date:** 2026-03-03

## Tech Debt

**Legacy script.js with mixed concerns:**
- Issue: `/home/sionnach/ws/emoj.ie/script.js` (786 lines) handles data fetching, rendering, filtering, theme management, and recent emojis all in one file with global state. No module system, difficult to test, and prone to side effects.
- Files: `script.js`
- Impact: Hard to maintain, refactor, or add features without risking regressions. State mutations are implicit and scattered.
- Fix approach: Extract into modules (theme module, recents module, render module) and migrate to home-app.mjs patterns with proper module structure.

**Direct HTML injection with string concatenation:**
- Issue: `/home/sionnach/ws/emoj.ie/script.js` line 224 and lines 419-431 use template literals to inject emoji data directly into `onclick` handlers and HTML attributes without proper escaping. While emoji.annotation.replace(/'/g, "\\'") exists, it only handles single quotes and misses other injection vectors.
- Files: `script.js` (lines 219-230, 419-431), `home-app.mjs` uses `innerHTML` (lines 665, 284, 294, 493, 519)
- Impact: Potential XSS vulnerability if emoji data contains malicious annotations or if annotation parsing is bypassed. Attack surface includes annotation fields from grouped-openmoji.json.
- Fix approach: Use DOM APIs instead of innerHTML/insertAdjacentHTML. Replace template literal HTML construction with document.createElement/setAttribute. Add HTML escaping utility for any remaining string construction.

**Unsafe localStorage JSON parsing without validation:**
- Issue: `/home/sionnach/ws/emoj.ie/script.js` line 29 parses localStorage without try-catch: `JSON.parse(localStorage.getItem('recentEmojis'))`. home-app.mjs (lines 793, 902) wraps in try-catch but doesn't validate structure. If localStorage is corrupted or someone manually edits it, parsing fails silently or stores invalid data.
- Files: `script.js` (line 29), `home-app.mjs` (lines 791-798, 900-907)
- Impact: Data corruption silently prevents recents/favorites from loading. No error notification to user.
- Fix approach: Implement data validation after parsing. Add schema validation (check isArray, check each item has required fields like hexcode). Log warnings for corrupted data. Provide recovery by clearing invalid entries.

**Missing error handling in fetch flows:**
- Issue: `/home/sionnach/ws/emoj.ie/home-app.mjs` lines 1340-1360 fetch home-data.json with catch handlers that show "Loading demo data" but don't log the actual error. Silent fallback masks network issues, CDN failures, or malformed JSON.
- Files: `home-app.mjs` (lines 1336-1360)
- Impact: Users see demo data thinking site is working when external data source is down. No visibility into failures.
- Fix approach: Add console.error logging. Track fetch failures in analytics. Consider retry logic with exponential backoff for failed requests.

**Large monolithic rendering functions:**
- Issue: `/home/sionnach/ws/emoj.ie/utils/build/render.mjs` (3157 lines) contains renderSite(), renderDetailPage(), and dozens of schema builders. Functions are 100+ lines. renderDetailPage() (lines 1500+) handles template construction, schema generation, and file writing in one function.
- Files: `utils/build/render.mjs`
- Impact: Hard to understand data flow. Difficult to test individual rendering steps. Changes risk breaking multiple page types at once.
- Fix approach: Extract schema builders into separate modules. Create smaller render functions per page type. Separate template construction from schema generation.

**Data loading without null checks:**
- Issue: `/home/sionnach/ws/emoj.ie/utils/build/load-data.mjs` assumes grouped data structure exists and emojis array is valid. Line 201 slugifies `emoji.annotation || emoji.hexcode` without validating hexcode format. Line 179 parses JSON directly without try-catch.
- Files: `utils/build/load-data.mjs` (lines 177-180, 200-210)
- Impact: Build fails silently with unhelpful error if input data is malformed. No validation of critical fields like hexcode format before use in routes.
- Fix approach: Add JSON parsing error handling. Validate emoji structure before processing (required fields: hexcode, annotation, group, subgroup). Log detailed errors for malformed entries.

**In-memory data structures without memory bounds:**
- Issue: `/home/sionnach/ws/emoj.ie/home-app.mjs` builds entryByRoute Map (line 67), groupPreviewEntries Map (line 64), and variantsByBaseTone Map (line 63) from all emoji data (~3500+ emojis × variants). No cleanup on navigation. Favorites and recents stored in localStorage with limits (40 and 20) but no quota management for sync.
- Files: `home-app.mjs` (lines 59-77)
- Impact: Memory usage grows with app interaction. localStorage can fill up if favorites/recents logic breaks and duplicates entries.
- Fix approach: Implement max entry limits with eviction. Add localStorage quota checks. Monitor Map sizes in development.

## Known Bugs

**Inconsistent recent/favorite localStorage keys:**
- Symptoms: Users might have old `recentEmojisV2` key and new data in different storage keys, causing conflicts or loss of data.
- Files: `script.js` (uses 'recentEmojis'), `home-app.mjs` (uses RECENT_KEY = 'recentEmojisV2')
- Trigger: Migration from old script.js to new home-app.mjs on same domain
- Workaround: Manually clear localStorage on first visit to reset to new key scheme

**Theme toggle may not sync across tabs:**
- Symptoms: Changing theme in one tab doesn't update other open tabs of the site
- Files: `script.js` (lines 113-152), `generated-pages.js` (THEME_PREFERENCE_KEY logic)
- Trigger: Open site in two tabs, toggle theme in one tab, switch to other tab - old theme persists
- Workaround: Refresh the page to see theme change

**Tofu detection cache doesn't invalidate on browser update:**
- Symptoms: If browser updates emoji support, tofu detection results cached in localStorage persist
- Files: `emoji-diagnostics.js` (CACHE_KEY, CACHE_MAX_AGE_MS, SCORE_VERSION)
- Trigger: Browser font update (Chrome/Firefox emoji update), cached tofu scores from before update still used
- Workaround: Clear browser cache or wait 7 days for cache expiry

## Security Considerations

**XSS via emoji annotation in inline handlers:**
- Risk: If openmoji.json contains annotation like `test'; alert('xss); //` or similar, it could break out of the onclick string context.
- Files: `script.js` (lines 219-230), `generated-pages.js`
- Current mitigation: Single quote escaping in script.js, but insufficient for all contexts. Generated pages use escapeHtml().
- Recommendations: Use addEventListener instead of onclick attributes. Sanitize all user-facing data before DOM insertion. Add Content Security Policy header to prevent inline script execution.

**localStorage data persistence without encryption:**
- Risk: Favorites stored in plaintext localStorage. On shared devices, other users can see/modify favorites list.
- Files: `home-app.mjs`, `script.js`, `generated-pages.js` (favorites storage)
- Current mitigation: None. Data stored as JSON in localStorage.
- Recommendations: Consider ephemeral storage for sensitive interactions. Document that favorites are not private. Add user-initiated session reset option.

**CDN fallback dependency without integrity checks:**
- Risk: Emoji images load from jsdelivr.net CDN. If CDN is compromised, serves SVG with malicious content (JavaScript in SVG).
- Files: `home-app.mjs` (line 237), `script.js` (lines 51, 221), `generated-pages.js` (multiple)
- Current mitigation: SVGs served with proper MIME type, but no subresource integrity (SRI) hash.
- Recommendations: Add SRI hashes to CDN image requests where possible. Implement local asset fallback for critical emojis. Monitor CDN health.

**Data validation missing on external JSON sources:**
- Risk: home-data.json and other generated JSON files are trusted implicitly. If build process is compromised, malicious data could be injected.
- Files: `home-app.mjs` (lines 1340-1350), `utils/build/render.mjs`
- Current mitigation: Type checks after parsing (Array.isArray check on line 1340), but no schema validation.
- Recommendations: Implement strict schema validation. Add cryptographic checksums to critical data files. Consider running in Web Worker for untrusted data processing.

## Performance Bottlenecks

**Emoji data loaded synchronously into memory on page load:**
- Problem: home-app.mjs loads home-data.json which is 1.7MB, parsed entirely into allEntries array. No pagination or lazy loading of data beyond visual chunk loading.
- Files: `home-app.mjs` (lines 1330-1360)
- Cause: Full dataset needed for search index building (buildEntrySearchIndex called for all entries). Search requires tokenized index of all emojis to rank results.
- Improvement path: Implement Web Worker for search index building. Stream data from IndexedDB instead of full JSON download. Implement incremental index building as user scrolls.

**Search tokenization happens on every keystroke without debounce validation:**
- Problem: tokenizeSearch() (home-search.mjs line 97) runs regex operations and stemming for every query character. Query debounce is 90ms (line 57) but regex cost still accumulates.
- Files: `home-search.mjs`, `home-app.mjs` (line 57 SEARCH_DEBOUNCE_MS)
- Cause: DIACRITIC_RE, TOKEN_SPLIT_RE, and stemming operations are computationally expensive for large input strings.
- Improvement path: Memoize tokenization results. Cache stem results. Use native String.localeCompare for better performance. Profile regex patterns.

**Canvas-based emoji rendering in tofu detection creates blocking operations:**
- Problem: emoji-diagnostics.js creates canvas context and renders 100+ test emojis to detect support. Runs on idle (requestIdleCallback) but still blocks rendering.
- Files: `emoji-diagnostics.js` (lines 26-100+)
- Cause: No batch processing. Each emoji detection creates new canvas operation. Shared mask calculations are O(n²) pixel comparisons.
- Improvement path: Use OffscreenCanvas or Web Worker. Batch detections. Cache results aggressively (already 7-day TTL). Consider sampling subset of emojis instead of full detection.

**Build generation runs serially through 3000+ emoji pages:**
- Problem: utils/build/render.mjs renders pages one by one in async queue. With 3000+ emoji detail pages, build takes minutes.
- Files: `utils/build/render.mjs` (lines 2905+, writeRouteHtml calls)
- Cause: Sequential file I/O and template string construction not parallelized.
- Improvement path: Use Promise.all() to render batches of 50 pages in parallel. Implement worker pool for rendering. Profile template string construction.

## Fragile Areas

**Emoji data structure assumptions:**
- Files: `utils/build/load-data.mjs`, `home-app.mjs`, `generated-pages.js`
- Why fragile: Code assumes emojis have hexcode, annotation, group, subgroup fields. If openmoji.json changes structure, multiple places break. No schema validation.
- Safe modification: Add validateEmojiEntry() function that checks all required fields and throws early. Update load-data.mjs to validate before using entries.
- Test coverage: No schema validation tests. Tests in phase1-generator.test.mjs don't verify data structure validation.

**Route generation logic:**
- Files: `utils/build/slug.mjs`, `utils/build/load-data.mjs` (lines 205-210)
- Why fragile: Route generation mixes slugification, hexcode normalization, and variant detection. If slug format changes, all detail routes break and old links become 404.
- Safe modification: Implement route versioning scheme. Add migration helpers for old routes. Test route format stability across different emoji names.
- Test coverage: No tests for route format consistency. phase1-generator.test.mjs checks generation but not route stability.

**localStorage key versioning:**
- Files: `script.js` (line 50 RECENT_KEY), `home-app.mjs` (lines 50-53)
- Why fragile: Hard-coded key names with version suffixes (recentEmojisV2, favoriteEmojisV1). If schema changes, old keys are orphaned. Migration between versions not automated.
- Safe modification: Implement key migration utility. Add schema version field to data. Provide migration functions that transform old to new format.
- Test coverage: home-search.test.mjs tests search only. No tests for localStorage migrations.

**Build verification logic:**
- Files: `utils/build/verify.mjs` (lines 1-61)
- Why fragile: Verification catches some issues (duplicate routes, missing base routes) but doesn't validate rendered HTML content, broken images, or semantic correctness.
- Safe modification: Add HTML validation (check links work, images exist). Verify schema compliance in generated pages. Test rendering pipeline with sample emojis.
- Test coverage: phase1-generator.test.mjs basic checks only. No integration tests for full build output.

## Scaling Limits

**Emoji dataset size (3500+ emojis):**
- Current capacity: Handles ~3500 base emojis + variants. home-data.json is 1.7MB. Build time ~2-5 minutes.
- Limit: Adding 10,000+ emojis would likely break performance. Search index would become unwieldy. Build generation would take 10+ minutes.
- Scaling path: Implement data sharding by group. Use IndexedDB for search index persistence. Lazy load groups on category pages instead of all-at-once. Consider service worker caching of index.

**Search index memory footprint:**
- Current capacity: All emoji search indexes built in memory at startup. tokenizeSearch() creates new token arrays per query.
- Limit: With 10,000 emojis × 5 search terms average = 50,000 token operations per search. Becomes noticeable on low-end devices.
- Scaling path: Implement incremental search using localStorage index cache. Pre-compute tokenized indexes at build time. Use Web Worker for search computation.

**Favorites/Recents storage limits:**
- Current capacity: Favorites limited to 40, recents to 20. localStorage typically has 5-10MB limit.
- Limit: If user behavior changes to favor many recents, quota could be exceeded. Current code silently fails on quota error (try-catch swallows errors).
- Scaling path: Implement quota-aware eviction. Add UI warning when storage is full. Consider IndexedDB for larger capacity (50MB+).

**Build file count:**
- Current capacity: ~3500 emoji detail pages + ~200 category/tag pages = 3700+ HTML files. Sitemap has 3000+ URLs.
- Limit: GitHub Pages has soft limits on file count and storage. With 10,000 emojis, could hit limits. Static site generators become slow.
- Scaling path: Implement dynamic routes with service worker. Use ISR-like approach to regenerate pages on demand. Consider moving to Cloudflare Workers for dynamic edge rendering.

## Dependencies at Risk

**OpenMoji data dependency:**
- Risk: Entire site depends on openmoji.json structure and content. If OpenMoji project abandons maintenance or changes format, site breaks.
- Impact: Build fails if grouped-openmoji.json structure changes. UI breaks if hexcode format changes.
- Migration plan: Implement data format adapter layer. Support multiple emoji sources (Unicode CLDR, OpenMoji, custom). Add data source abstraction to load-data.mjs.

**CDN image delivery (jsdelivr.net):**
- Risk: All emoji images served from external CDN. If CDN goes down or changes pricing, site becomes image-less.
- Impact: Emoji detail pages lose visual reference. User experience degrades significantly.
- Migration plan: Maintain local SVG assets in /assets/emoji/base/. Implement local asset fallback before CDN. Pre-download critical emojis.

**Build tool dependencies (Node.js, Playwright):**
- Risk: package.json only lists playwright as devDependency. No lock on Node.js version. Scripts rely on built-in fs/crypto modules.
- Impact: Node.js version mismatch could cause build failures. No version lock file for Node version.
- Migration plan: Add .nvmrc or use volta.sh for Node version pinning. Evaluate if Playwright version needs security updates. Implement dependency audit in CI.

## Missing Critical Features

**Error reporting and monitoring:**
- Problem: No centralized error logging. Silent failures on data fetch, build failures, or JSON parse errors.
- Blocks: Debugging production issues. Identifying when data becomes corrupted.
- Fix: Implement error tracking (Sentry-like). Add logging to all error handlers. Track errors in analytics with stack traces (sanitized for privacy).

**Data integrity validation:**
- Problem: No schema validation on loaded data. No checksums on generated files.
- Blocks: Detecting corrupted emoji data. Ensuring build artifacts are complete.
- Fix: Add JSON schema validation. Implement file checksums in build manifest. Verify checksums before rendering.

**Graceful degradation for missing emoji support:**
- Problem: If emoji font is missing or specific emoji is unsupported, no fallback provided.
- Blocks: Users with older browsers get broken emoji experience.
- Fix: Use text alternative in title attributes. Implement emoji fallback to Unicode codepoint. Add visual indicator for unsupported emojis.

**Offline-first functionality:**
- Problem: Site loads emoji data from network. If offline or CDN down, experience degrades.
- Blocks: Using site offline or with poor connectivity.
- Fix: Implement service worker with full data caching. Sync favorites/recents across devices via service worker. Offline search index.

## Test Coverage Gaps

**HTML rendering untested:**
- What's not tested: Generated HTML pages not validated for correctness, accessibility, or broken links.
- Files: `utils/build/render.mjs` (no tests), `generated-pages.js` (no unit tests)
- Risk: Rendering bugs, broken schema markup, missing accessibility attributes go unnoticed.
- Priority: High - renders 3000+ pages

**Data validation untested:**
- What's not tested: Emoji data structure validation, null checks, field presence.
- Files: `utils/build/load-data.mjs`, `home-app.mjs`
- Risk: Malformed input data causes silent failures or crashes.
- Priority: High - critical path

**Error handling untested:**
- What's not tested: localStorage failures, fetch errors, JSON parse errors, network timeouts.
- Files: `home-app.mjs`, `emoji-diagnostics.js`, `script.js`
- Risk: Error recovery behavior is untested. Silent failures likely.
- Priority: Medium

**XSS injection untested:**
- What's not tested: Annotation field escaping, injection of special characters in HTML context.
- Files: `script.js`, `home-app.mjs`, `generated-pages.js`
- Risk: Security vulnerability not caught by current test suite.
- Priority: High

**Integration between build and runtime untested:**
- What's not tested: Generated pages work correctly with home-app.mjs. Schema markup renders properly. Cross-page linking works.
- Files: All build output, `home-app.mjs`, `detail-page.js`
- Risk: Build generates broken pages. Runtime code breaks with new build output.
- Priority: Medium - covered by playwright-smoke but not comprehensively

---

*Concerns audit: 2026-03-03*
