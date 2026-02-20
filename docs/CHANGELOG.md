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
- Added launch planning docs:
  - `docs/LAUNCH.md`
  - `docs/SOCIAL.md`

### Notes
- Phase 0, Phase 1, and Phase 2 are complete.
- Phase 3 implementation is in progress with baseline UX improvements shipped.
- Phase 4 and Phase 5 implementation are in progress.
