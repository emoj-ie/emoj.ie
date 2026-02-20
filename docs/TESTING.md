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
- Use screenshot sweeps during major design passes to catch visual regressions on home/detail/about/alternatives routes.

## Coverage Matrix (Initial)
| Journey | Current Coverage | Planned Coverage |
|---|---|---|
| Home loads and title/meta valid | full (unit + integration + baseline Playwright) | maintain |
| Search query filters results | full (unit + baseline Playwright) | maintain |
| Copy emoji to clipboard | full (baseline Playwright) | maintain |
| Keyboard navigation in results/grid | full (baseline Playwright + unit) | maintain |
| Recents persistence (local storage) | partial (unit/home-script behavior) | add cross-route e2e coverage in a future slice |
| Favorites persistence (local storage) | partial (unit/home-script behavior) | add cross-route e2e coverage in a future slice |
| Theme toggle and system default behavior | full (baseline Playwright + unit) | maintain |
| Category/subcategory navigation | full (baseline Playwright + unit) | maintain |
| SEO routes metadata/sitemap | full (unit + integration: emoji/category/search/tag/alternatives + robots + link graph) | maintain |
| Accessibility smoke | present | broaden with keyboard + focus coverage |

## Baseline E2E Cases (Planned)
- [x] Home loads category cards and advanced menu controls.
- [x] Category card click navigates to canonical `/category/{group}/` route.
- [x] Category page exposes subgroup links on canonical `/category/{group}/{subgroup}/` routes.
- [x] Category and subcategory pages show breadcrumb context (`Home / Categories / ...`).
- [x] Copying from subgroup emoji list triggers toast + clipboard payload.
- [x] Keyboard arrow navigation moves focus between emoji buttons.
- [x] Theme mode toggles and persists setting after returning to home.

## SEO Regression Coverage (Current)
- `tests/phase4-seo-schema.test.mjs` validates metadata + schema on sample pages.
- Validates sitemap inclusion/exclusion rules for canonical emoji/category/search/tag/alternatives routes.
- Validates legacy detail and legacy group routes canonicalize to current canonical URLs with `noindex,follow`.
- Validates `robots.txt` policy and internal link graph continuity (home -> category -> subgroup -> emoji -> related).

## Assumptions
- Existing Node test suite stays in place; Playwright coverage will be additive.

## Latest Full Regression (2026-02-20)
- `npm run build`
- `npm test`
- `npm run lint:links`
- `npm run test:a11y-smoke`
- `npm run test:playwright-smoke`
- `npm run test:playwright-baseline`
- `npm run test:lighthouse-budget`
