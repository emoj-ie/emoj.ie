# Changelog

All notable project updates are tracked here in human-readable form.

## 2026-02-20
### Added
- Initial planning and governance docs:
  - `docs/PROJECT.md`
  - `docs/RESEARCH.md`
  - `docs/SEO.md`
  - `docs/TESTING.md`
  - `docs/CHANGELOG.md`
- Product marketing baseline context:
  - `.claude/product-marketing-context.md`

### Changed
- Updated `docs/PROJECT.md` with confirmed constraints, priority ranking, assumptions status, backlog, JTBD, CRO events, and microcopy direction.
- Filled `docs/RESEARCH.md` with competitor teardown findings and actionable opportunities.
- Updated `docs/SEO.md` with current route inventory and programmatic quality gates.
- Expanded `docs/TESTING.md` with baseline Playwright coverage plan.
- Added a baseline Playwright E2E script and npm command (`test:playwright-baseline`).
- Added local-first favorites UI and persistence to home experience.
- Added search relevance improvements (synonym expansion + typo tolerance scoring).
- Added theme toggle with system default behavior and persisted preference.
- Updated generated page headers to include theme controls and favorites section on home.
- Added/updated tests for analytics wiring and new UX features.
- Added canonical short emoji routes under `/emoji/*` for indexable detail pages.
- Added generated tag hub pages under `/tag/*`.
- Added canonical category hub routes under `/category/*` and category index page.
- Added curated search-topic routes under `/search/*` with quality thresholds.
- Canonicalized legacy group routes to `/category/*` with `noindex,follow`.
- Updated home category panel links to use canonical `/category/*` routes.
- Expanded SEO route tests to cover category/search metadata and canonical behavior.
- Refreshed homepage with quick-action topic chips and clearer keyboard-first guidance.
- Enriched emoji detail pages with meaning/usage copy, keyword pills, code format cards, and related emoji links.
- Added `robots.txt` generation in build with sitemap pointer.
- Added explicit internal link graph regression coverage.
- Expanded keyword enrichment to include `openmoji_tags` + annotation-derived keywords.
- Added competitor alternative pages under `/alternatives/*` and wired them into sitemap/tests.
- Extended baseline Playwright e2e to validate copy-mode payload behavior.
- Added launch planning docs:
  - `docs/LAUNCH.md`
  - `docs/SOCIAL.md`
- Performed a full quality-recovery pass on UI/UX and messaging:
  - redesigned visual system to stronger high-contrast brutalist/editorial style
  - rebuilt homepage hierarchy with proof panel and principle cards
  - expanded About page into architecture, quality, and data sections
  - expanded alternatives pages with switch signals, fit guidance, and migration steps
  - improved detail-page copy and added shortcode quick-copy action
- Updated accessibility test matcher to detect `<h1>` tags with attributes (`/<h1\\b/`).
- Simplified homepage to an emoji-first flow:
  - removed heavy explanatory copy from landing experience
  - defaulted landing to 12 category cards with in-page category -> subgroup -> emoji navigation
  - hid favorites/recents rails until they contain emojis
  - improved mobile header/search layout to prevent overlap and wrapping issues
- Expanded Playwright baseline coverage to assert panel-click 3-step navigation behavior.
- Simplified landing UI further to a strict emoji-first KISS flow:
  - removed visible explanatory heading/copy from home panel shell
  - switched to minimal icon breadcrumb (`⌂ / ...`) with a compact category index shortcut
  - replaced dense preview strips with one large rotating hero emoji per category/subcategory card
  - removed card count metadata on landing panels to reduce cognitive load
  - kept favorites/recents hidden until populated and preserved 3-click discovery flow
- Updated UX/performance and baseline Playwright assertions to match the simplified breadcrumb and dynamic hero-card behavior.

### Notes
- Phase 0 through Phase 5 are complete for the current roadmap scope.
- Latest local regression suite passed:
  - `npm run build`
  - `npm test`
  - `npm run lint:links`
  - `npm run test:a11y-smoke`
  - `npm run test:playwright-smoke`
  - `npm run test:playwright-baseline`
  - `npm run test:lighthouse-budget`
