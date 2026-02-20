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
- [x] Phase 6: Quality recovery pass (design differentiation + messaging depth + full regression)
- [x] Phase 7: KISS landing-page simplification and emoji-first interaction polish

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

## Milestone Checklist (Phase 6)
- [x] Rework visual system to a stronger brutalist/editorial style (light + dark).
- [x] Upgrade homepage narrative hierarchy and utility framing.
- [x] Expand alternatives pages with switch signals, fit guidance, and migration steps.
- [x] Expand about content with quality, architecture, and data transparency blocks.
- [x] Improve detail-page copy and copy-action options (emoji + hex + shortcode + share).
- [x] Fix brittle accessibility test heading matcher.
- [x] Rebuild and pass full quality gates after redesign.

## Milestone Checklist (Phase 7)
- [x] Remove non-essential landing copy and keep the first view emoji-focused.
- [x] Keep a single minimal breadcrumb trail for context.
- [x] Keep the category -> subcategory -> emoji flow in <= 3 clicks.
- [x] Replace preview strips with one large dynamic emoji per landing card.
- [x] Keep favorites/recents hidden until data exists.
- [x] Re-run full quality gates (build, tests, links, a11y, Playwright, Lighthouse).

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
- [ ] P2: Add richer non-commercial use examples on high-traffic emoji detail pages.
- [ ] P3: Introduce optional dataset enrichment for CLDR short names/keywords with attribution notes.

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
- Search placeholder: `Search by emoji, meaning, or keyword…`
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
| 2026-02-20 | Shift visual system to high-contrast brutalist/editorial direction | Removes generic UI feel while preserving speed and accessibility constraints. |
| 2026-02-20 | Expand alternatives pages with switch signals and migration checklists | Better matches comparison-page intent and improves page-level utility/SEO quality. |
| 2026-02-20 | Keep architecture static-first while deepening on-page messaging | Improves perceived quality without backend complexity or hosting changes. |
| 2026-02-20 | Simplify home to emoji-first category grid with 3-click flow | Aligns UX with primary job-to-be-done: fast emoji discovery with minimal copy overhead. |
| 2026-02-20 | Reduce landing chrome to minimal breadcrumb plus dynamic hero emoji cards | Keeps first paint focused on emoji graphics and lowers cognitive friction on mobile. |
| 2026-02-20 | Reframe About page around short, user-facing copy plus interactive emoji wall | Keeps brand story useful while adding playful, copyable value instead of static text blocks. |

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
- `competitor-alternatives`: upgraded `/alternatives/*` pages with switch signals, fit analysis, and migration actions.
- `content-strategy`: refined collection-page intros and quality guardrails around utility-first content blocks.
- `copy-editing`: replaced vague phrases with specific workflow language across home/detail/about/alternatives.
- `copywriting`: rewrote hero, proof sections, and comparison narratives for stronger clarity and intent match.
- `frontend-design`: delivered a higher-contrast brutalist/editorial visual system with distinctive card rhythm.
- `launch-strategy`: expanded launch execution plan with channel sequencing, metrics, and content packaging.
- `marketing-ideas`: expanded acquisition/distribution ideas in launch and social documentation.
- `marketing-psychology`: applied friction reduction, confidence framing, and fit-based decision architecture.
- `page-cro`: strengthened conversion hierarchy (primary browse/search CTAs + proof + shortcut hints).
- `product-marketing-context`: maintained consistent positioning (speed + local memory + quality discovery).
- `programmatic-seo`: kept route-quality focus while increasing page-specific utility and comparison depth.
- `social-content`: expanded social templates into channel-specific hooks, formats, and posting cadence.
- `ui-ux-pro-max`: improved responsive hierarchy, interaction contrast, and dense-grid readability.
- `web-design-guidelines`: verified semantic structure, focus handling, and accessible interaction states.
- `webapp-testing`: validated design/copy changes with Playwright smoke + baseline flows and full gate reruns.
