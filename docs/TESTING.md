# Testing Strategy

Last updated: 2026-02-20

## Quality Gates
- `npm run build:check` passes
- `npm test` passes
- `npm run lint:links` passes
- `npm run test:a11y-smoke` passes
- `npm run test:playwright-smoke` passes
- `npm run test:lighthouse-budget` passes

## Playwright Strategy
- Add baseline end-to-end tests for current critical journeys before UX refactors.
- Expand coverage incrementally for every feature slice (no deferred test debt).
- Prefer deterministic selectors and network-idle waits where dynamic behavior exists.
- Keep tests scoped to user-visible behavior, not implementation details.
- Execute tests against local static server to mirror GitHub Pages behavior.
- Keep test setup minimal and avoid heavyweight custom harnesses.

## Coverage Matrix (Initial)
| Journey | Current Coverage | Planned Coverage |
|---|---|---|
| Home loads and title/meta valid | full (unit + integration + baseline Playwright) | maintain |
| Search query filters results | full (unit + baseline Playwright) | maintain |
| Copy emoji to clipboard | full (baseline Playwright) | maintain |
| Keyboard navigation in results/grid | full (baseline Playwright + unit) | maintain |
| Recents persistence (local storage) | full (baseline Playwright) | maintain |
| Favorites persistence (local storage) | full (baseline Playwright + unit) | maintain |
| Theme toggle and system default behavior | full (baseline Playwright + unit) | maintain |
| Category/subcategory filters | full (baseline Playwright + unit) | maintain |
| SEO routes metadata/sitemap | full (unit + integration: emoji/category/search/tag/alternatives + robots + link graph) | maintain |
| Accessibility smoke | present | broaden with keyboard + focus coverage |

## Baseline E2E Cases (Planned)
- [x] Search for a term and verify result count changes.
- [x] Copy an emoji and verify success signal.
- [x] Copy mode switching updates copied payload format.
- [x] Category and subcategory filtering narrows results.
- [x] Keyboard arrow navigation moves focus between emoji buttons.
- [x] Recent list updates after copy and survives page reload.
- [x] Theme mode toggles and persists setting.
- [x] Favorites updates and survives page reload.

## SEO Regression Coverage (Current)
- `tests/phase4-seo-schema.test.mjs` validates metadata + schema on sample pages.
- Validates sitemap inclusion/exclusion rules for canonical emoji/category/search/tag/alternatives routes.
- Validates legacy detail and legacy group routes canonicalize to current canonical URLs with `noindex,follow`.
- Validates `robots.txt` policy and internal link graph continuity (home -> category -> subgroup -> emoji -> related).

## Assumptions
- Existing Node test suite stays in place; Playwright coverage will be additive.
