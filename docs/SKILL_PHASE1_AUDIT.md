# Phase 1 Skill Audit (2026-02-27)

## Scope
- `web-design-guidelines`
- `schema-markup`
- `programmatic-seo`
- `analytics-tracking`

## Summary
- No release-blocking P0 issues found in this audit pass.
- Several P1 improvements were identified that should materially improve UX shareability, analytics usefulness, and rich-result quality.

## Findings By Lane

### Lane A: Web Design Guidelines

#### WG-P1-01: Search state is not URL-shareable on home
- Status: Implemented in Phase 2 Batch 1 (`home-app.mjs`)
- Files:
  - `home-app.mjs:258-264`
- Observation:
  - `persistState()` removes all query params from the URL after render.
  - This prevents deep-linking and back-button restoration of search state.
- Impact:
  - Reduced shareability and weaker UX continuity.
- Recommendation:
  - Preserve at least `q` in URL when non-empty.
  - Keep path-first category routing, but allow query state for search results.

### Lane B: Schema + Programmatic SEO

#### SCH-P1-01: Collection pages lack `ItemList` detail in JSON-LD
- Status: Implemented in Phase 2 Batch 2 (`utils/build/render.mjs`, `tests/phase4-seo-schema.test.mjs`)
- Files:
  - `utils/build/render.mjs:1382-1396`
  - `utils/build/render.mjs:1492-1506`
  - `utils/build/render.mjs:1332-1346`
  - `utils/build/render.mjs:1438-1452`
- Observation:
  - Tag/search/category index pages use `CollectionPage` and breadcrumbs only.
  - No explicit `ItemList` entities for listed emojis/topics/tags.
- Impact:
  - Reduced explicit machine-readable structure for list content.
- Recommendation:
  - Add `@graph` entries with `ItemList` + top N items for list pages.

#### SCH-P1-02: Organization schema is minimal
- Status: Implemented in Phase 2 Batch 2 (`utils/build/render.mjs`)
- Files:
  - `utils/build/render.mjs:853-871`
- Observation:
  - Home `Organization` currently includes `name`, `url`, `logo` only.
- Impact:
  - Leaves structured trust signals under-specified.
- Recommendation:
  - Add `sameAs` references (where available) and optional contact metadata if applicable.

#### PSEO-P1-01: Alternatives pages could be modeled as comparison entities
- Status: Implemented in Phase 2 Batch 2 (`utils/build/render.mjs`, `tests/phase4-seo-schema.test.mjs`)
- Files:
  - `utils/build/render.mjs:1217-1231`
- Observation:
  - Alternatives pages are currently `WebPage` only.
- Impact:
  - Missed structured context for comparison intent pages.
- Recommendation:
  - Add supplemental schema (for example `FAQPage` where Q/A exists, or richer `WebPage` properties) tied to visible content.

### Lane C: Analytics Tracking

#### AT-P1-01: No dedicated `search_no_results` signal
- Status: Implemented in Phase 2 Batch 1 (`home-app.mjs`)
- Files:
  - `home-app.mjs:675-695`
- Observation:
  - Search events include `query_length` and `results`, but no explicit zero-result event.
- Impact:
  - Harder to build focused no-results remediation loops.
- Recommendation:
  - Emit `search_no_results` when `results === 0`, with scope metadata.

#### AT-P1-02: Search intent analysis is limited by payload
- Status: Implemented in Phase 2 Batch 1 (`home-app.mjs`)
- Files:
  - `home-app.mjs:686-694`
- Observation:
  - Current payload omits normalized query/token hints (privacy-safe).
- Impact:
  - Limited ability to prioritize taxonomy/relevance improvements from observed demand.
- Recommendation:
  - Track privacy-safe query features (for example first token stem/hash bucket), not raw query text.

## Prioritized Backlog

### P1 (Next)
1. Completed: SCH-P1-01 Add `ItemList` schema for collection-style pages.
2. Completed: SCH-P1-02 Expand `Organization` schema fields.
3. Completed: PSEO-P1-01 Add richer schema modeling for alternatives pages.

### P2 (Later)
1. Evaluate additional conversion funnels once richer analytics dimensions are in place.
2. Expand structured data on high-intent page families with measured SERP impact tests.
