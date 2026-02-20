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
- [x] Phase 1: Competitor research teardown and prioritized backlog
- [x] Phase 2: Product strategy, messaging, CRO events, microcopy plan
- [x] Phase 3: UX/UI overhaul + baseline and incremental Playwright coverage
- [x] Phase 4: Programmatic SEO buildout + routing/meta/sitemap tests
- [x] Phase 5: Launch and social distribution plan + final regression

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
- [x] Commit docs research slice (`docs: competitor research + prioritized backlog`)

## Milestone Checklist (Phase 2)
- [x] Define initial target users and JTBD
- [x] Define core conversion events
- [x] Draft microcopy direction for search/empty states/copy hints
- [x] Update project and SEO strategy docs with messaging and CRO framing
- [x] Commit docs strategy slice (`docs: product messaging + CRO events + microcopy plan`)

## Milestone Checklist (Phase 3)
- [x] Add baseline Playwright E2E for search/copy/filter/recents
- [x] Add favorites with local-first persistence and keyboard support
- [x] Add ranked search relevance with synonyms + typo tolerance
- [x] Add system-default theme toggle with persistence
- [x] Validate quality gates after implementation (build/tests/link/a11y/playwright/lighthouse)
- [x] Commit UI/test enhancement slice

## Milestone Checklist (Phase 4)
- [x] Add canonical `/emoji/*` route layer for indexable emoji pages
- [x] Add canonical `/category/*` route layer for browse hubs
- [x] Add `/tag/*` routes generated from curated tag data
- [x] Add curated `/search/*` routes with quality thresholds
- [x] Keep legacy detail routes while canonicalizing to short routes
- [x] Keep legacy group routes while canonicalizing to `/category/*`
- [x] Add SEO tests for canonical behavior and category/search/tag route coverage
- [x] Validate sitemap and link integrity after route expansion
- [x] Commit SEO buildout slice

## Milestone Checklist (Phase 5)
- [x] Add launch plan (`docs/LAUNCH.md`)
- [x] Add social templates (`docs/SOCIAL.md`)
- [x] Finalize release runbook and regression summary in changelog
- [x] Commit launch and social docs slice

## Backlog (Prioritized)
- [x] P0: Add ranked search relevance (synonyms + typo tolerance + keyword boosts) without heavy dependencies.
- [x] P0: Add favorites with local-first persistence and keyboard shortcuts.
- [x] P0: Add baseline Playwright E2E for search/copy/filter/recents before major UI changes.
- [x] P0: Redesign homepage and cards for a distinctive brutalist-but-clean visual system (mobile-first).
- [x] P0: Add explicit theme toggle with system-default behavior and improved contrast states.
- [x] P1: Improve emoji detail pages with richer meaning/context/variations/related links.
- [x] P1: Add high-quality tag landing pages from curated tag taxonomy.
- [x] P1: Add `/emoji/{slug}` canonical route layer while preserving existing routes and redirects.
- [x] P1: Add canonical `/category/{name}` and curated `/search/{term}` routes.
- [x] P1: Add dataset enrichment baseline with additional open keyword sources (`tags`, `openmoji_tags`, annotations).
- [ ] P2: Extend enrichment with dedicated CLDR annotations and optional Twemoji mapping artifacts.
- [x] P2: Add launch docs (`docs/LAUNCH.md`, `docs/SOCIAL.md`) and distribution assets checklist.

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
- `pwa_prompt_shown` / `pwa_installed` (deferred in current milestone).

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
| 2026-02-20 | Defer PWA install UX in current release scope | Keeps delivery focused on UX/SEO route quality and avoids near-term complexity. |
| 2026-02-20 | Make `/category/*` the canonical browse route layer | Enables consistent hub architecture and avoids duplicate indexable group pages. |
| 2026-02-20 | Generate curated indexable `/search/*` pages only above quality thresholds | Captures search intent without thin-route spam. |
| 2026-02-20 | Keep optional account/sync work out of scope for this cycle | Preserves local-first behavior and avoids non-essential infrastructure cost. |
| 2026-02-20 | Enrich detail pages with meaning, keyword pills, code formats, and related links | Improves utility for learning and copy confidence without adding backend complexity. |
| 2026-02-20 | Add indexable competitor alternative pages under `/alternatives/*` | Captures competitor-intent SEO while keeping comparison copy honest and useful. |
| 2026-02-20 | Generate and publish `robots.txt` with sitemap pointer | Closes crawler discovery and indexing policy gap. |
| 2026-02-20 | Expand keyword extraction with `openmoji_tags` and annotations | Improves tag/search coverage using non-paid open data already available in source dataset. |

## Assumptions (Status)
- [x] A1. Repository is static-first and generated by local Node scripts.
- [x] A2. Privacy analytics are allowed.
- [x] A3. Current deployment target is GitHub Pages.
- [x] A4. We should keep no-account local-first behavior by default.
- [x] A5. English-only UI is acceptable for now.
- [x] A6. PWA install UX is deferred in this cycle to protect scope and speed.
- [x] A7. Dataset enrichment baseline should use non-paid sources and keep licensing clear (OpenMoji-derived fields).
- [x] A8. Cloudflare migration should only happen if GitHub Pages limits block priority goals.

## Open Questions
- None blocking for current milestones.

## Skill Execution Log
- `competitor-alternatives`: shipped `/alternatives/*` comparison routes with honest fit guidance.
- `content-strategy`: refined page inventory and content clusters in `docs/SEO.md`.
- `copy-editing`: tightened home/detail microcopy for clarity and specificity.
- `copywriting`: rewrote homepage utility copy and launch/social templates.
- `frontend-design`: delivered visible homepage quick-action and detail-page layout upgrades.
- `launch-strategy`: completed launch runbook and release sequence in `docs/LAUNCH.md`.
- `marketing-ideas`: added channel and content distribution ideas in launch/social docs.
- `marketing-psychology`: applied low-friction CTA hierarchy, progressive disclosure, and fit-based comparison framing.
- `page-cro`: improved conversion surfaces with quick topic chips and stronger action-oriented routes.
- `product-marketing-context`: updated positioning context for ongoing marketing consistency.
- `programmatic-seo`: expanded indexable route system (`/category`, `/search`, `/tag`, `/alternatives`) with quality gates.
- `social-content`: expanded platform-specific social templates and post angles in `docs/SOCIAL.md`.
- `ui-ux-pro-max`: strengthened responsive hierarchy, accessibility, and interaction ergonomics.
- `web-design-guidelines`: validated focus, semantics, and layout/accessibility guardrails via code + tests.
- `webapp-testing`: kept continuous browser-level and e2e validation in quality gates.
