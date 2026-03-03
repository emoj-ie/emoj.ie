# Project Research Summary

**Project:** emoj.ie
**Domain:** Animation-rich static emoji reference site
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

emoj.ie is a brownfield emoji reference site with a working foundation -- ~3,500 emojis, search, copy-to-clipboard, favorites, dark mode, PWA, and offline support all exist today. The core utility is solid. What is missing is personality: the site looks and feels like a database dump rather than a destination. The research points to a clear path: migrate from the custom Node.js SSG to Astro 5 with Svelte islands, adopt GSAP for animation, and layer in discovery features (Emoji of the Day, curated collections, random discovery) that make the site feel alive. This is fundamentally a migration-then-enhancement project, not a greenfield build.

The recommended approach is an incremental migration to Astro, preserving every existing URL and SEO signal while gaining a component model, view transitions, islands architecture, and Vite-powered builds. Svelte provides lightweight reactive islands for search, emoji grids, and the builder -- shipping minimal JS while enabling smooth animations. GSAP handles the SVG-heavy animation work that CSS alone cannot cover (staggered grid reveals, scroll-triggered effects, timeline sequences). The architecture is static-first: pages render to zero-JS HTML by default, with interactivity added only where users need it.

The primary risks are migration scope creep (the single biggest threat -- a big-bang rewrite will stall all feature work), animation performance on low-end devices (kids use cheap phones), and the 1.7MB JSON search payload blocking first interaction. All three are solvable with disciplined phasing: migrate incrementally, establish GPU-only animation constraints from day one, and pre-build the search index at compile time. The GitHub Pages 1GB size limit is a medium-term concern that should be monitored but is not blocking.

## Key Findings

### Recommended Stack

Astro 5.18+ is the clear choice for the static site framework -- it ships zero JS by default, provides islands architecture for surgical interactivity, includes View Transitions for page-to-page animation, and bundles Vite for HMR and asset optimization. GSAP 3.14+ handles animation: it is now fully free (Webflow acquisition), has superior SVG support critical for an emoji site, and provides ScrollTrigger, Flip, and timeline sequencing out of the box. Svelte provides the island component model -- lightweight, reactive, with built-in transition and spring physics primitives.

**Core technologies:**
- **Astro 5.18+:** Static site framework -- ships zero JS by default, islands architecture, View Transitions, Content Layer API for 3,500+ emoji dataset
- **Svelte 5:** Island component framework -- lightweight reactive components, built-in transitions/animations, minimal runtime
- **GSAP 3.14+:** Animation engine -- 23KB core, SVG-native, free, ScrollTrigger and Flip plugins included
- **Vite 7 (via Astro):** Build tool -- HMR, CSS modules, tree-shaking, replaces custom build pipeline

**Supporting:** @astrojs/sitemap for sitemap generation, open-props for animation easing tokens (cherry-pick only), sharp for image optimization, Playwright for E2E testing (already in project).

**Avoid:** React/Next.js (massive runtime), Tailwind (fights existing CSS system), Lottie/Rive (overkill), heavy state management (localStorage handles all state needs).

### Expected Features

The site already has all table stakes features (full catalog, search, click-to-copy, categories, skin tones, dark mode, mobile-responsive, offline). The differentiation is entirely in personality and discovery.

**Must have (v1 "Personality Update"):**
- Playful visual redesign -- big emojis, warmth, premium aesthetic. Single most impactful change
- Micro-interactions -- bounce on copy, hover effects, page transitions via View Transitions API
- Emoji of the Day -- daily featured emoji with fun context, build-time generated, zero server needed
- Random emoji / Surprise Me -- pure client-side, immediately delightful
- Curated collections (10-15 to start) -- "Party Time," "Cozy Night In," editorial voice is the differentiator
- Keyboard navigation -- `/` to search, arrows to browse, Enter to copy. Developer audience demands this

**Should have (v1.x, after validation):**
- Multi-select emoji builder -- tap multiple emojis, build a string, copy
- Related/similar emoji suggestions on detail pages
- Enhanced search (synonym expansion, natural language queries)
- Seasonal/event-tied collections

**Defer (v2+):**
- Platform preview ("How does this look on iPhone vs Android") -- high value but requires image licensing research
- Internationalized search data
- Merch integration, direct sponsor placements

### Architecture Approach

The architecture is Astro's islands pattern: static HTML pages generated at build time from the emoji dataset via Content Layer API, with isolated Svelte islands hydrating only where interactivity is needed. Four primary islands (Search, EmojiGrid, Builder, Discovery) communicate through shared Svelte stores backed by localStorage. A three-tier animation strategy defaults to CSS transitions (GPU-composited, off main thread), escalates to Svelte transition directives for component lifecycle animation, and uses GSAP sparingly for complex sequences. View Transitions provide app-like page navigation with emoji morph effects between grid and detail views.

**Major components:**
1. **Astro Content Layer** -- loads emoji JSON, validates with Zod schema, generates ~3,500 pages at build time
2. **View Transitions Router** -- `<ClientRouter />` for animated page navigation, `transition:persist` for cross-page state
3. **Search Island (Svelte)** -- ports existing 514-line search with keyboard navigation, instant results from in-memory index
4. **Emoji Grid Island (Svelte)** -- card grid with hover animations, virtual scrolling, intersection-observer chunking
5. **Shared State Layer** -- Svelte stores for favorites, recents, preferences, auto-synced to localStorage
6. **Animation System** -- CSS tier 1 (hover, focus) + Svelte tier 2 (enter/exit, FLIP) + GSAP tier 3 (timelines, scroll-linked)
7. **Service Worker** -- cache-first for SVGs, network-first for HTML, offline fallback

### Critical Pitfalls

1. **Framework migration rewrite trap** -- The biggest risk. Resist big-bang rewrite. Migrate incrementally: scaffold Astro alongside existing code, port layouts first, then data, then pages, then client JS. Keep existing build working until new build passes all Playwright tests. Every existing URL is a contract with search engines.

2. **Animation performance on low-end devices** -- Kids use budget phones. Only animate `transform`, `opacity`, `filter` (GPU compositor). Never `transition: all`. Stagger grid animations with IntersectionObserver. Test at 4x CPU throttle before every animation PR. Set a performance budget.

3. **1.7MB JSON payload blocks interaction** -- Pre-compute search index at build time as compact format. Move search to Web Worker. Ship lightweight shell data (~50KB) for initial render, lazy-load full index. This is a prerequisite for "premium feel."

4. **Clipboard breaks silently on Safari/iOS** -- Safari requires clipboard writes in synchronous user-activation context. Any async chain between click and `writeText()` causes silent failure. Structure copy as synchronous within click handler. Test on real iOS Safari.

5. **SVG grid causes layout shift** -- Always set explicit `width`/`height` on emoji images. Use `aspect-ratio: 1` and skeleton placeholders. Target CLS under 0.1. Critical for the "big emojis" redesign.

## Implications for Roadmap

Based on combined research, the project naturally divides into 6 phases with clear dependency ordering. The architecture research's build-order graph and the feature research's dependency tree align closely.

### Phase 1: Astro Migration Foundation

**Rationale:** Everything depends on this. The existing custom SSG has no component model, no HMR, no view transitions, no code splitting. New features built on the old system will need to be rewritten. Migration must come first, but it must be incremental -- not a big-bang rewrite.
**Delivers:** Astro project scaffolding, Content Layer loading emoji data, base layouts ported from existing templates, all existing pages generating with identical URLs and SEO signals. Existing Playwright tests passing against new build.
**Addresses:** Migration foundation (prerequisite for all features), code splitting (Astro solves this structurally), monolithic build pipeline
**Avoids:** Pitfall 3 (rewrite trap) -- incremental migration with feature parity checkpoint. Pitfall 8 (GitHub Pages limits) -- establish file generation monitoring. Pitfall 9 (monolithic JS) -- islands architecture inherently code-splits.

### Phase 2: Design System and Animation Infrastructure

**Rationale:** Visual identity is the prerequisite for all new features. Micro-interactions require an established animation language (timing curves, scale factors, color palette). Touch targets and grid sizing must be defined before building interactive features. The animation system's GPU-only constraint must be enforced from the start to avoid Pitfall 1.
**Delivers:** Design tokens for animation, CSS tier-1 animations (hover, focus, transitions), touch target sizing (56x56px minimum for primary actions), `prefers-reduced-motion` tiered strategy, emoji grid component with explicit dimensions and skeleton placeholders.
**Addresses:** Playful visual redesign (P1), micro-interactions foundation (P1), kid-friendly design (P1)
**Avoids:** Pitfall 1 (animation performance) -- GPU-only constraint from day one. Pitfall 4 (SVG layout shift) -- explicit dimensions in grid component. Pitfall 6 (reduced-motion nukes all animation) -- tiered approach designed in. Pitfall 10 (touch targets too small) -- minimum sizes in design system.

### Phase 3: Interactive Islands and Search

**Rationale:** Once the design system exists, port the interactive client-side features into Svelte islands. Search is the most important interaction surface and the most complex to port (514 lines of tuned ranking). The shared state layer (favorites, recents, preferences) must be established here since all subsequent features depend on it.
**Delivers:** SearchBox island with keyboard navigation, EmojiGrid island with Svelte FLIP animations, shared Svelte stores (favorites, recents, preferences) with localStorage sync, copy-to-clipboard with Safari-safe synchronous pattern, View Transitions with emoji morph effects between pages.
**Addresses:** Keyboard navigation (P1), search porting, copy UX hardening, View Transitions
**Avoids:** Pitfall 2 (JSON payload) -- pre-built search index, lazy loading. Pitfall 5 (Safari clipboard) -- synchronous clipboard write pattern from the start.

### Phase 4: Discovery Features

**Rationale:** With the interactive foundation in place, add the features that transform the site from utility to destination. These are the differentiators -- no competitor does Emoji of the Day, curated collections, or random discovery with personality and animation. These features are relatively independent of each other and can be built in parallel.
**Delivers:** Emoji of the Day component (build-time generated, daily rotation with fun facts), Random / Surprise Me button with reveal animation, curated collections (10-15 starter set with editorial voice), related/similar suggestions on detail pages.
**Addresses:** Emoji of the Day (P1), Random discovery (P1), Curated collections (P1), related suggestions (P2)
**Avoids:** Pitfall 8 (GitHub Pages limits) -- collections render client-side from JSON, not as additional HTML pages.

### Phase 5: Builder and Enhanced Interactions

**Rationale:** The multi-select builder and enhanced search depend on the state layer and animation system being mature. These are v1.x features that add depth after the core personality update ships. Analytics from Phase 4 should inform whether users actually copy multiple emojis in sequence (validating the builder) and what search queries fail (informing synonym expansion).
**Delivers:** Multi-select emoji builder with tray UI, enhanced search (synonym expansion, natural language queries), seasonal/event collections, GSAP-powered complex animation sequences (staggered grid reveals, scroll-triggered effects).
**Addresses:** Multi-select builder (P2), enhanced search (P2), seasonal collections (P2)
**Avoids:** Pitfall 5 (Safari clipboard) -- builder constructs string synchronously before clipboard write.

### Phase 6: Performance Optimization and Polish

**Rationale:** Optimize after all features are built. Virtual scrolling, search index chunking, service worker updates, and Lighthouse budget enforcement are polishing concerns that depend on knowing the final feature set.
**Delivers:** Virtual scrolling for large lists, search index chunking by category, service worker update for Astro output, Lighthouse performance >90 on throttled mobile, CDN fallback chain (jsDelivr -> local SVGs -> native emoji).
**Addresses:** Performance budget enforcement, CDN reliability, offline robustness
**Avoids:** Pitfall 7 (CDN single point of failure) -- fallback chain and aggressive SW caching. Pitfall 2 (payload size) -- search index chunking for scale.

### Phase Ordering Rationale

- **Phase 1 before everything:** No new feature should be built on the legacy custom SSG. The migration is the foundation. But it must be incremental -- the existing site keeps working throughout.
- **Phase 2 before interactive features:** Animation constraints, touch targets, and design tokens must exist before building islands. Retrofitting animation performance constraints after features ship is expensive.
- **Phase 3 before discovery:** Search, copy, and state management are the core interactions. Discovery features depend on the grid component, state stores, and animation system from Phase 3.
- **Phase 4 is the payoff:** This is where the site transforms from "another emoji tool" to "the emoji site with personality." Emoji of the Day, collections, and random discovery are the differentiators.
- **Phase 5 is data-informed:** Builder and enhanced search should be validated by usage data from Phase 4 before investing in them.
- **Phase 6 is last by definition:** You optimize what exists, not what you plan to build.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Astro Migration):** Needs research on Content Layer custom loader implementation for the specific emoji JSON format, Astro route patterns that match existing URL structure (`/emoji/[name]--[hex]/`), and service worker generation strategy in Astro.
- **Phase 3 (Interactive Islands):** Needs research on search index pre-build format, Web Worker integration in Astro/Svelte, and Safari clipboard compatibility testing approach.
- **Phase 5 (Builder):** Needs research on multi-emoji clipboard handling across platforms, particularly for ZWJ sequences and Unicode spoofing prevention.

Phases with standard patterns (skip deep research):
- **Phase 2 (Design System):** Well-documented CSS custom property patterns, GSAP documentation is extensive, `prefers-reduced-motion` best practices are established.
- **Phase 4 (Discovery Features):** Straightforward build-time data generation and Svelte component work. No novel technical challenges.
- **Phase 6 (Performance):** Standard virtual scrolling, service worker, and Lighthouse optimization patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Astro 5.x is mature and well-documented. GSAP is industry standard. Svelte is established. All version numbers verified against npm registry 2026-03-03. |
| Features | HIGH | Based on thorough competitor analysis (6+ competitors reviewed). Feature prioritization grounded in the brownfield reality -- table stakes already exist. |
| Architecture | HIGH | Astro islands pattern is well-documented with official guides. Svelte store pattern is idiomatic. Content Layer API handles the dataset scale. Architecture research includes concrete code examples. |
| Pitfalls | HIGH | Based on codebase analysis plus verified web research. Critical pitfalls (animation perf, JSON payload, Safari clipboard) have documented solutions. |

**Overall confidence:** HIGH

### Gaps to Address

- **Svelte vs vanilla JS for islands:** Architecture research recommends Svelte islands, but Stack research focuses on GSAP with vanilla JS. The two are compatible (GSAP works in Svelte components), but the decision to adopt Svelte as the island framework needs explicit validation during Phase 1 planning. An alternative is vanilla JS `<script>` tags in Astro with no component framework -- simpler but loses reactivity and Svelte's built-in transitions.
- **Search index pre-build format:** The exact format for the pre-built search index (trie, inverted index, typed array) is not specified. Needs investigation during Phase 3 planning. Pagefind is a fallback option if custom pre-building proves too complex.
- **OpenMoji 16 update:** OpenMoji 16 released August 2025. The site is on 15.1. Whether to update during or after migration needs a decision. Data format differences could complicate migration if done simultaneously.
- **GitHub Pages size trajectory:** Currently at 187MB / 11,018 files against a 1GB limit. Adding local SVG fallbacks (~3,500 SVGs) could add 100-200MB. This needs monitoring and may force a hosting migration to Cloudflare Pages during Phase 6.

## Sources

### Primary (HIGH confidence)
- [Astro 5 documentation](https://docs.astro.build/) -- Content Layer API, View Transitions, islands architecture, GitHub Pages deployment
- [GSAP documentation](https://gsap.com/docs/) -- ScrollTrigger, Flip, SVG animation, free licensing
- [Svelte documentation](https://svelte.dev/docs/) -- stores, transitions, animate directive
- [MDN Web Docs](https://developer.mozilla.org/) -- View Transitions API, Clipboard API, Web Animations API, CSS animation performance
- npm registry (direct queries) -- all version numbers verified 2026-03-03
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) -- 1GB size limit, 10-minute deploy timeout

### Secondary (MEDIUM confidence)
- [Emojipedia](https://emojipedia.org/), [GetEmoji](https://getemoji.com/), [EmojiCopy](https://emojicopy.com/), [EmojiTerra](https://emojiterra.com/) -- competitor feature analysis
- [Motion.dev](https://motion.dev) -- alternative animation library comparison
- [Open Props](https://open-props.style/) -- CSS animation easing tokens
- [Wolfgang Rittner: Safari Clipboard API workaround](https://wolfgangrittner.dev/how-to-use-clipboard-api-in-safari/) -- Safari clipboard fix
- [web.dev CLS optimization](https://web.dev/articles/optimize-cls) -- layout shift prevention

### Tertiary (LOW confidence)
- GitHub Pages size trajectory projection (extrapolated from current 187MB, not measured after feature additions)
- Svelte vs vanilla JS island performance comparison (inferred from documentation, not benchmarked for this specific project)

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
