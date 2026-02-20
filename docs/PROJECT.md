# emoj.ie Project Plan

Last updated: 2026-02-20

## Goals
- Make `emoj.ie` the fastest and easiest place to find and copy emojis.
- Improve discovery (search, browse, related content) without adding unnecessary complexity.
- Expand useful, indexable content (emoji detail/category/tag surfaces) while avoiding thin pages.
- Maintain local-first behavior and privacy-respecting defaults.

## Definition Of "Best Emoji Site"
- Priority 1: UX (fast find + copy, keyboard/mobile ergonomics, low friction)
- Priority 2: Aesthetics (distinctive, non-generic visual language)
- Priority 3: SEO traffic (high-intent indexable routes with quality content)
- Priority 4: Speed (lightweight pages and low interaction latency)
- Priority 5: Reliability and tests (automated coverage and release confidence)

## Principles And Constraints
- Keep architecture simple: static-first HTML/CSS/JS + current build scripts.
- Deploy on GitHub Pages first; only evaluate Cloudflare if a static-hosting limitation blocks UX/SEO goals.
- Keep UI language English-only for now.
- Preserve local-first persistence (recents/favorites/settings on-device).
- Keep auto-language constraints satisfied by English-only UI now (no locale routing in this phase).
- Favor minimal JS and predictable rendering paths.
- Maintain a visible light/dark theme toggle while defaulting to system preference (light fallback).
- Use privacy-friendly analytics only.
- Require docs, tests, and passing quality gates before marking milestones complete.

## Performance Budgets (Initial Draft)
- LCP: <= 1.8s (p75 mobile, good network/device)
- INP: <= 150ms (p75)
- CLS: <= 0.05
- JS budget (critical path): keep app scripts small and defer non-critical work.

## Roadmap
- [x] Phase 0: Repo discovery, docs scaffolding, clarifying questions, assumptions
- [ ] Phase 1: Competitor research teardown and prioritized backlog
- [ ] Phase 2: Product strategy, messaging, CRO events, microcopy plan
- [ ] Phase 3: UX/UI overhaul + baseline and incremental Playwright coverage
- [ ] Phase 4: Programmatic SEO buildout + routing/meta/sitemap tests
- [ ] Phase 5: Launch and social distribution plan + final regression

## Milestone Checklist (Phase 0)
- [x] Inspect stack/build/test/deploy signals in repository
- [x] Create docs scaffolding in `/docs`
- [x] Confirm assumptions with stakeholder
- [x] Get answers to blocking clarifying questions
- [x] Commit docs scaffolding (`chore: add project docs scaffolding`)

## Milestone Checklist (Phase 1)
- [x] Research top emoji sites/tools and OS pickers
- [x] Summarize strengths/weaknesses/opportunities in `docs/RESEARCH.md`
- [x] Sync prioritized opportunities into project backlog
- [ ] Commit docs research slice (`docs: competitor research + prioritized backlog`)

## Milestone Checklist (Phase 2)
- [x] Define initial target users and JTBD
- [x] Define core conversion events
- [x] Draft microcopy direction for search/empty states/copy hints
- [x] Update project and SEO strategy docs with messaging and CRO framing
- [ ] Commit docs strategy slice (`docs: product messaging + CRO events + microcopy plan`)

## Backlog (Prioritized)
- [ ] P0: Add ranked search relevance (synonyms + typo tolerance + keyword boosts) without heavy dependencies.
- [ ] P0: Add favorites with local-first persistence and keyboard shortcuts.
- [ ] P0: Add baseline Playwright E2E for search/copy/filter/recents before major UI changes.
- [ ] P0: Redesign homepage and cards for a distinctive brutalist-but-clean visual system (mobile-first).
- [ ] P0: Add explicit theme toggle with system-default behavior and improved contrast states.
- [ ] P1: Improve emoji detail pages with richer meaning/context/variations/related links.
- [ ] P1: Add high-quality tag landing pages from curated tag taxonomy.
- [ ] P1: Add `/emoji/{slug}` canonical route layer while preserving existing routes and redirects.
- [ ] P1: Add dataset enrichment pipeline (Unicode + CLDR annotations/keywords + optional Twemoji mapping).
- [ ] P2: Add launch docs (`docs/LAUNCH.md`, `docs/SOCIAL.md`) and distribution assets checklist.

## JTBD (Draft)
- Primary: "When I need an emoji quickly, I want to find and copy the right one in seconds."
- Secondary: "When I am unsure which emoji to use, I want context and related options."
- Secondary: "When I reuse emojis often, I want my history and favorites remembered locally."

## Conversion Events (CRO)
- `copy`: emoji copied from list/detail/recents/favorites.
- `search`: query entered and results shown.
- `filter`: category/subcategory selection.
- `favorite_add` / `favorite_remove`: local favorite interactions.
- `recent_reuse`: copy from recent list.
- `share`: share link action from detail pages.
- `theme_toggle`: dark/light toggle usage.
- `pwa_prompt_shown` / `pwa_installed` (if PWA install UX is enabled).

## Microcopy Direction (English)
- Search placeholder: `Search by emoji, meaning, or keyword`
- Empty state (search): `No matches yet. Try a broader word like "happy", "food", or "heart".`
- Empty state (favorites): `No favorites yet. Star emojis you use often.`
- Copy toast: `Copied {emoji} {name}`
- Keyboard hint: `Tip: Arrow keys move, Enter copies, / focuses search`
- Theme toggle label: `Switch theme`
- Recents section title: `Recently Copied`

## Messaging Framework (Phase 2)
- Value proposition: `Find the right emoji in seconds. Copy it once. Reuse it instantly.`
- Promise pillars:
  - Speed: instant search and copy.
  - Clarity: meanings and related options on detail pages.
  - Memory: local recents/favorites without account friction.
- Primary CTA language:
  - Home: `Start searching`
  - Detail: `Copy emoji`
  - Secondary: `View related emojis`

## Decisions
| Date | Decision | Rationale |
|---|---|---|
| 2026-02-20 | Start with docs-first Phase 0 before feature work | Establishes a shared source of truth and prevents ambiguous implementation. |
| 2026-02-20 | Treat feature implementation as blocked until clarifying questions are answered | Matches explicit operating rules and reduces rework risk. |
| 2026-02-20 | Keep deployment target as GitHub Pages (static-first) | Matches current deployment preference and keeps complexity low. |
| 2026-02-20 | Keep English-only UI in this execution window | User preference favors depth and quality over early localization breadth. |
| 2026-02-20 | Prioritize UX and aesthetics ahead of SEO/speed/reliability | Aligns implementation order with user-provided priority ranking. |
| 2026-02-20 | Keep privacy analytics, no required account system | Supports measurement while preserving low-friction local-first experience. |
| 2026-02-20 | Preserve theme toggle and system-default theme behavior | Explicit user requirement for high-quality light and dark experiences. |

## Assumptions (Status)
- [x] A1. Repository is static-first and generated by local Node scripts.
- [x] A2. Privacy analytics are allowed.
- [x] A3. Current deployment target is GitHub Pages.
- [x] A4. We should keep no-account local-first behavior by default.
- [x] A5. English-only UI is acceptable for now.
- [ ] A6. PWA install UX should be enabled in this cycle if it does not hurt speed budgets.
- [ ] A7. Dataset expansion should include all feasible non-paid-license sources and clear licensing metadata.
- [ ] A8. Cloudflare migration should only happen if GitHub Pages limits block priority goals.

## Open Questions
- Q1. Confirm whether PWA install experience should be included in the first shipping milestone.
- Q2. Confirm whether optional cloud sync should remain out-of-scope for this cycle.
