# emoj.ie “Best-on-Planet” Overhaul Plan (Static, Phased, UX+Speed First)

## Progress Tracker

- [x] Phase 1: Deterministic generation foundation implemented
- [x] Phase 1 tests added and passing (`tests/phase1-generator.test.mjs`)
- [x] Phase 2: Frontend architecture and UX upgrade
- [x] Phase 2 tests added and passing (`tests/phase2-home-utils.test.mjs`)
- [x] Phase 3: Accessibility and standards compliance pass
- [x] Phase 3 tests added and passing (`tests/phase3-accessibility-style.test.mjs`)
- [x] Phase 4: SEO metadata and JSON-LD at scale
- [x] Phase 4 tests added and passing (`tests/phase4-seo-schema.test.mjs`)
- [x] Phase 5: Asset and caching strategy updates
- [x] Phase 5 tests added and passing (`tests/phase5-sw-assets.test.mjs`)
- [x] Phase 6: Analytics and CI quality gates
- [x] Phase 6 tests added and passing (`tests/phase6-analytics-ci.test.mjs`)
- [x] Phase 6 QA scripts passing (`npm run lint:links`, `npm run test:a11y-smoke`, `npm run test:lighthouse-budget`, `npm run test:playwright-smoke`*)
- [x] Phase 7: Premium UX/UI redesign and progressive rendering
- [x] Phase 7 tests added and passing (`tests/phase7-ux-performance.test.mjs`)
- [x] Post-Phase update: editorial 366-day emoji schedule + burger-gated advanced menu visibility

`*` Playwright smoke currently skips when Playwright is not installed, by design.

## Summary

This plan keeps the current static + Node generator model and upgrades emoj.ie into a premium, fast, accessible emoji utility with strong SEO and deterministic generation.  
It uses a phased rollout on GitHub Pages, with strict quality gates (`Lighthouse 95+`, accessibility-first, zero stale generated pages) and backward-compatible URL migration.

## Baseline Findings (Grounded Audit)

1. Core generation quality issues exist: stale generated pages are present (`actual 6614` HTML files vs `expected 4330`, `extra 2284`), and slug collisions collapse variants (`90` collisions from current slug logic in `utils/pages-maker.js:17`).
2. SEO foundation is incomplete at scale: no canonical/meta description/schema/twitter tags across generated pages (`0` matches); OG image points to missing asset (`index.html:15` uses `logo.png`, file absent).
3. Accessibility/UI compliance gaps are systemic: `8568` `role="button"` elements with `0` keyboard handlers; `12778` inline `onclick`; all `21661` `<img>` tags lack `width`/`height`.
4. Frontend correctness debt: duplicate title tag on home (`index.html:4`, `index.html:18`), duplicate event listener (`script.js:344`, `script.js:758`), undefined CSS variables (`--recent-bg`, `--modal-bg`, `--modal-overlay` at `style.css:449`, `style.css:907`, `style.css:913`), and service worker cache condition bug (`sw.js:88`).
5. Payload/layout risk: largest generated page is `people-body/index.html` at ~`1.9 MB`, and generated pages inline duplicate utility JS (`utils/pages-maker.js:270-322`).

## Skills Applied

1. `web-design-guidelines` for standards-aligned UI/accessibility/performance audit.
2. `frontend-design` for playful premium visual direction and interaction strategy.
3. `programmatic-seo` for scalable index strategy and template quality control.
4. `schema-markup` for JSON-LD strategy per page type.
5. `webapp-testing` for planned Playwright-based verification workflow.

## Implementation Plan

### Phase 1: Deterministic Site Generation and URL Model (Foundation)

1. Replace monolithic generator with modular build pipeline under `utils/build/`: `load-data.mjs`, `slug.mjs`, `render.mjs`, `sitemap.mjs`, `redirects.mjs`, `verify.mjs`.
2. Introduce `utils/site.config.json` with explicit rules: indexable page types, noindex rules, legacy redirect behavior, asset source policy, and build paths.
3. Change emoji URL schema to unique per codepoint: `/{group}/{subgroup}/{annotation-slug}--{hex-lower}/`; keep group/subgroup URLs unchanged.
4. Implement robust slugify: normalize Unicode, collapse repeated dashes in loop, strip trailing dashes, and enforce deterministic lowercase ASCII.
5. Detect variants (`skin tone`, gendered sequences, right-facing variants) and attach `isVariant`, `baseHex`, `baseUrl` in generated model.
6. Build in temp directory first, then atomic sync to repo root for managed paths only; use prior `build-manifest.json` to delete stale generated paths safely.
7. Generate static redirect stubs for legacy emoji URLs: meta refresh + canonical + JS `location.replace`; collision legacy paths redirect to canonical base emoji URL.
8. Split sitemap into `sitemap-core.xml` and `sitemap-emoji.xml`, with `sitemap.xml` index file.
9. Keep generator source-of-truth in `grouped-openmoji.json`; add deterministic path manifest to eliminate orphan drift permanently.

### Phase 2: Frontend Architecture and UX Upgrade (Playful Premium)

1. Rebuild `index.html`, shared templates, and `style.css` into a coherent design system with a playful premium look (expressive typography, bright but controlled palette, intentional motion).
2. Standardize shared shell across all page types: same header/search/filter/navigation/footer behavior everywhere.
3. Remove inline handlers and switch to delegated JS listeners from one shared client bundle.
4. Add keyboard-first interactions: `Cmd/Ctrl+K` focus search, arrow navigation in results, `Enter` copy, `Esc` close modal/menu.
5. Replace `li role="button"` patterns with semantic `<button>` actions and `<a>` navigation.
6. Add URL-synced state for discoverability and deep links: `q`, `g`, `sg`, `copy`; preserve browser back/forward behavior.
7. Improve copy workflow: selectable copy format (`emoji`, `unicode`, `html`, `shortcode`) with persistent preference.
8. Add variant selector on emoji detail pages; base emoji remains canonical target.
9. Keep recents/favorites local-only (`localStorage`), no auth/backend.

### Phase 3: Accessibility and Standards Compliance

1. Add a skip link and strict heading hierarchy (`h1` present on every page template).
2. Add `aria-live="polite"` to toast region and announce async copy success/failure.
3. Enforce visible `:focus-visible` states; remove `outline: none` without replacement.
4. Add keyboard handlers for all interactive controls and ensure full tab order sanity.
5. Add explicit `width` and `height` for all rendered emoji images to reduce CLS.
6. Replace `transition: all` with explicit property transitions only.
7. Ensure reduced-motion mode disables non-essential animations.
8. Add touch interaction defaults (`touch-action: manipulation`, intentional tap highlight).

### Phase 4: SEO, Metadata, and Structured Data at Scale

1. Generate unique `<title>` and `<meta name="description">` per page from deterministic templates.
2. Add `<link rel="canonical">` on every page; canonicalize variant pages to base emoji URL.
3. Add OG + Twitter metadata with valid local social image asset (`/social-card.png`) and correct absolute URL.
4. Inject JSON-LD by page type:
5. Home: `Organization` + `WebSite` with `SearchAction`.
6. Group/Subgroup: `CollectionPage` + `BreadcrumbList`.
7. Emoji page: `WebPage` + `BreadcrumbList` + `DefinedTerm`-style entity fields.
8. Index policy (curated): index home/about/groups/subgroups/base emoji pages; `noindex,follow` for variant pages and `component` pages.
9. Keep only indexable URLs in sitemaps; exclude noindex URLs from sitemap files.

### Phase 5: Asset and Caching Strategy (Hybrid Local + CDN)

1. Local-host base emoji SVG assets under `assets/emoji/base/{HEX}.svg` for all non-variant emojis outside `component`.
2. Keep CDN fallback for variants/long tail via runtime fallback on image error.
3. Add preconnect for CDN and preload critical local shell assets.
4. Refactor service worker strategy:
5. Fix response-type bug (`response.type !== 'basic'`).
6. Version cache from build hash.
7. Use stale-while-revalidate for same-origin shell and emoji assets.
8. Keep offline fallback for shell pages.

### Phase 6: Privacy-First Analytics and Quality Gates

1. Add Plausible analytics with minimal event schema: `search`, `copy`, `filter`, `variant_select`, `share`.
2. Add GitHub Actions CI (`.github/workflows/site-quality.yml`) with Node 20 pipeline.
3. CI stages: build clean, generated-path verification, metadata/schema lint, broken-link scan, accessibility smoke, Playwright smoke, Lighthouse budgets.
4. Fail PR if any quality gate fails.

### Phase 7: Experience Overdrive (Premium UI + Loading Performance)

1. Ship a new design system in `style.css` with expressive typography, layered backgrounds, stronger hierarchy, and orientation-aware responsive layout.
2. Remove the hard `400` homepage result cap and implement progressive chunk rendering with `IntersectionObserver` + manual load-more fallback.
3. Generate a lightweight `home-data.json` search index and load it on home instead of the heavier full grouped dataset.
4. Reduce heavyweight group page payloads with subgroup preview limits and direct full-collection links.
5. Add UX/performance regression tests in `tests/phase7-ux-performance.test.mjs`.

## Important Public API / Interface Changes

1. **URL Interface**: emoji detail URL becomes `/{group}/{subgroup}/{slug}--{hex}/`; legacy slug-only URLs remain reachable via generated redirects.
2. **Query Interface**: stateful params standardized to `q`, `g`, `sg`, `copy`; URLs are shareable and restore UI state.
3. **Generated Artifacts**: add `build-manifest.json`, `sitemap-core.xml`, `sitemap-emoji.xml`, and redirect stubs for legacy URLs.
4. **Structured Data Contract**: JSON-LD blocks generated per template with consistent fields and canonical URL references.
5. **Analytics Event Contract**: Plausible events use stable property keys (`hex`, `group`, `subgroup`, `format`, `source`).

## Test Cases and Acceptance Scenarios

1. Generator determinism: two consecutive clean builds produce identical manifests and `extra=0`.
2. URL uniqueness: every emoji record maps to one unique output path; collisions are zero.
3. Redirect validity: sampled legacy URLs resolve to correct canonical targets.
4. Accessibility smoke: keyboard-only copy/search/filter/modal flows pass; skip link and focus-visible verified.
5. Metadata coverage: every HTML page has exactly one title, one description, one canonical; OG/Twitter tags valid.
6. Schema validity: representative pages pass Rich Results/Schema validator checks.
7. Performance gates: Lighthouse mobile on home/group/emoji pages is `>=95` performance, `>=98` accessibility, no major CLS issues.
8. Offline shell: repeat visit works offline for shell and cached emoji assets.
9. Functional UX: query-param deep links restore state; copy format persists across navigation.
10. SEO integrity: sitemap URLs are only indexable pages; noindex pages excluded.

## Assumptions and Defaults Chosen

1. Primary goal: UX + speed first; SEO remains strong but secondary to interaction quality.
2. Tech stack: remain static HTML/CSS/JS with Node generation; no framework migration.
3. Delivery: phased milestones, not big-bang rewrite.
4. Variant model: unique URL per codepoint, canonical base for variants.
5. Hosting: GitHub Pages static; redirects implemented with static stubs.
6. Analytics: Plausible, privacy-first, cookieless minimal events.
7. Browser support: evergreen browsers with graceful fallback.
8. i18n: English now, architecture i18n-ready for future.
9. Scope: core utility perfection only; no backend/community features in this phase.

## Scope

Static + Node generator overhaul focused on UX + speed first, while fixing SEO, accessibility, and deterministic generation.

## Constraints and Defaults

- Keep stack static (`.html/.css/.js`) + Node scripts.
- Ship in phased milestones (not big-bang).
- Emoji URL format: `/{group}/{subgroup}/{slug}--{hex-lower}/`.
- Keep legacy slug-only URLs reachable via static redirects.
- Hosting target: GitHub Pages static.
- Analytics: Plausible (privacy-first, cookieless).
- Browser baseline: evergreen browsers with graceful fallback.
- i18n: English now, i18n-ready structure.

## Phase 1: Deterministic Generation Foundation

- Create modular pipeline in `utils/build/`:
  - `load-data.mjs`
  - `slug.mjs`
  - `render.mjs`
  - `sitemap.mjs`
  - `redirects.mjs`
  - `verify.mjs`
- Add `utils/site.config.json` for build and indexing policy.
- Implement robust slugify:
  - normalize input
  - collapse repeated dashes
  - strip leading/trailing dashes
  - deterministic lowercase ASCII
- Detect variants and attach:
  - `isVariant`
  - `baseHex`
  - `baseUrl`
- Build to temp directory, then sync to output.
- Track generated outputs in `build-manifest.json`.
- Remove stale generated pages using manifest (orphan cleanup).
- Generate legacy redirect stubs for old slug-only URLs.
- Split sitemaps:
  - `sitemap-core.xml`
  - `sitemap-emoji.xml`
  - `sitemap.xml` (index)

## Phase 2: Frontend Architecture and UX Refresh

- Rebuild `index.html`, shared templates, `style.css`, `script.js`.
- Single shared shell for all page types.
- Remove inline handlers; use delegated listeners from shared bundle.
- Keyboard-first interactions:
  - `Cmd/Ctrl+K` search focus
  - arrow key navigation
  - `Enter` copy
  - `Esc` close modal/menu
- Use semantic controls (`button` for actions, `a` for nav).
- URL-synced state query params:
  - `q` (search)
  - `g` (group)
  - `sg` (subgroup)
  - `copy` (copy mode)
- Copy format chooser:
  - `emoji`, `unicode`, `html`, `shortcode`
- Variant selector on emoji detail pages.
- Recents/favorites in `localStorage` only.

## Phase 3: Accessibility + Standards Compliance

- Add skip link and strict heading hierarchy (`h1` on every template).
- Add `aria-live="polite"` region for async feedback (toasts).
- Replace weak focus handling with visible `:focus-visible`.
- Ensure full keyboard support and sane tab order.
- Add explicit `width`/`height` to rendered images.
- Replace `transition: all` with explicit transition properties.
- Respect `prefers-reduced-motion`.
- Add touch interaction defaults:
  - `touch-action: manipulation`
  - intentional tap highlight

## Phase 4: SEO + Metadata + Schema at Scale

- Unique `<title>` and `<meta name="description">` per page.
- Add canonical URL to every page.
- Add OG + Twitter metadata.
- Add valid local social image: `/social-card.png`.
- JSON-LD templates:
  - Home: `Organization`, `WebSite` + `SearchAction`
  - Group/Subgroup: `CollectionPage`, `BreadcrumbList`
  - Emoji: `WebPage`, `BreadcrumbList`, `DefinedTerm`-style fields
- Curated indexing policy:
  - index: home/about/groups/subgroups/base emoji pages
  - `noindex,follow`: variant pages + `component` pages
- Include only indexable pages in sitemaps.

## Phase 5: Assets + Caching

- Local-host base emoji SVGs:
  - `assets/emoji/base/{HEX}.svg`
- Keep CDN fallback for long tail/variants.
- Add `preconnect` for CDN domains.
- Refactor service worker:
  - fix response-type bug (`response.type !== 'basic'`)
  - version cache from build hash
  - stale-while-revalidate for same-origin shell/assets
  - offline shell fallback

## Phase 6: Analytics + Quality Gates

- Add Plausible event schema:
  - `search`
  - `copy`
  - `filter`
  - `variant_select`
  - `share`
- Add CI workflow:
  - `.github/workflows/site-quality.yml`
  - Node 20
- CI checks:
  - clean build
  - generated-path verification
  - metadata/schema lint
  - broken link scan
  - accessibility smoke
  - Playwright smoke
  - Lighthouse budgets
- Fail PR on gate failures.

## Phase 7: Header + Panel Navigator UX

- Replace image logo with inline SVG brand mark and daily emoji slot in header.
- Generate `daily-emoji.json` with a deterministic emoji-of-the-day schedule (366 entries).
- Move primary search to header and keep advanced controls in a burger-triggered options drawer.
- Add default skin tone preference (`None`, `Light`, `Medium-Light`, `Medium`, `Medium-Dark`, `Dark`) with local persistence.
- Rework homepage interaction to 3-level panel flow:
  - categories (12 group panels)
  - subcategories (selected group)
  - emoji cards (selected subgroup, lazy chunk rendering)

## Acceptance Criteria

- Deterministic build: consecutive clean builds produce identical manifests.
- URL uniqueness: zero collisions across emoji detail routes.
- Legacy redirect coverage: sampled old URLs resolve correctly.
- Metadata coverage: exactly one title/description/canonical per page.
- Schema validity: representative pages pass validators.
- Performance targets:
  - Lighthouse mobile `>=95` performance
  - `>=98` accessibility
- Offline shell works on repeat visit.
- Query-param deep links restore state.
- Noindex URLs are excluded from sitemap files.
