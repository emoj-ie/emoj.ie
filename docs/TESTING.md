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

## Coverage Matrix (Initial)
| Journey | Current Coverage | Planned Coverage |
|---|---|---|
| Home loads and title/meta valid | partial (unit/integration) | full Playwright baseline |
| Search query filters results | partial | full E2E |
| Copy emoji to clipboard | partial | full E2E |
| Keyboard navigation in results/grid | partial | full E2E |
| Recents persistence (local storage) | partial | full E2E |
| Category/subcategory filters | partial | full E2E |
| SEO routes metadata/sitemap | partial | unit + E2E checks |
| Accessibility smoke | present | broaden with keyboard + focus coverage |

## Assumptions
- Existing Node test suite stays in place; Playwright coverage will be additive.
