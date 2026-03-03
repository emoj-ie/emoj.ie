# Stack Research

**Domain:** Animation-rich static emoji reference site
**Researched:** 2026-03-03
**Confidence:** HIGH

## Decision Context

emoj.ie is a brownfield site with ~7,000 lines of handwritten vanilla JS, a custom Node.js SSG, ~3,500 emojis from OpenMoji, and zero npm dependencies beyond Playwright for testing. It deploys to GitHub Pages. The site works, but has no component model, no build tool (raw ESM imports), and no animation infrastructure. The goal is to add buttery animations, playful micro-interactions, kid-appealing design, and game-like discovery features -- while keeping the site static and fast.

The stack recommendation must thread the needle: enough tooling to enable the vision, but not so much that it bloats what is fundamentally a content site.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Astro | 5.18.x (stable) | Static site framework, component model, build system | Ships zero JS by default. Islands architecture lets you add interactivity exactly where needed. Built-in View Transitions for page-to-page animation. Content Layer API handles the ~3,500 emoji dataset with type-safe collections and 5x faster builds vs legacy. First-class GitHub Pages deployment with official action. Vite under the hood gives HMR, asset optimization, and CSS processing for free. |
| GSAP | 3.14.x | Animation engine for micro-interactions, hover effects, scroll-driven motion | Now 100% free (Webflow acquisition). Industry standard with 15+ years of cross-browser battle testing. ScrollTrigger, Flip, and SplitText plugins all included free. Works perfectly with vanilla JS -- no React/Vue needed. 23KB gzipped core. The only animation library with reliable SVG animation support, which matters for an emoji site serving thousands of SVGs. |
| Vite | 7.x (via Astro) | Build tool, dev server, asset bundling | Comes bundled with Astro -- no separate config needed. Provides HMR, CSS modules, asset hashing, tree-shaking. Replaces the current Python HTTP server for dev and the custom Node.js build pipeline for production. |
| Node.js | 22.x+ | Build runtime | Required by Astro 5.18+. Current codebase uses Node 20.x -- will need a bump. Node 22 is current LTS. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/sitemap | 3.7.x | Automated sitemap generation | Replaces the custom `utils/build/sitemap.mjs`. Handles sitemap-core.xml and sitemap-emoji.xml generation automatically from Astro routes. |
| astro-pagefind | 1.8.x | Static search integration | Drop-in post-build search indexing. Loads zero JS until user types. Index chunks load on demand -- bandwidth-friendly for 3,500+ entries. Consider this if the custom search system becomes hard to maintain in Astro, but the existing custom search is excellent and may be worth porting directly. |
| sharp | 0.34.x | Image optimization at build time | Astro's built-in image optimization uses sharp. Useful for OG images, press kit assets, and any raster emoji fallbacks. Comes with `@astrojs/image` if needed. |
| open-props | 1.7.x | CSS design tokens (animations, easings, shadows) | Provides battle-tested easing curves, animation timing tokens, and shadow scales via CSS custom properties. Use JIT mode to include only what you use. Augments the existing design token system (the site already has good custom properties). Cherry-pick the animation and easing tokens only. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright | 1.58.x (keep existing) | E2E testing and visual regression | Already in the project. Astro dev server works well with Playwright. |
| @astrojs/check | 0.9.x | Astro template type checking | Catches template errors at build time. Lightweight -- adds no runtime cost. |
| TypeScript (optional) | 5.x (via Astro) | Type safety for components | Astro supports TS out of the box. Can be adopted incrementally -- `.astro` files work with or without TS. Not required but recommended for the search index and data model types. |

## Installation

```bash
# Core framework
npm install astro @astrojs/sitemap

# Animation
npm install gsap

# Design tokens (animation easings only)
npm install open-props

# Dev dependencies
npm install -D @astrojs/check

# Optional: search (only if replacing custom search)
# npm install astro-pagefind
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Astro | Keep custom SSG | If the migration cost is too high. But the custom SSG has no component model, no HMR, no view transitions, no asset optimization. The ~7K lines of client JS will only grow harder to maintain. Astro is worth the migration. |
| Astro | SvelteKit | If you need SPA-style client routing and heavy client-side state. But SvelteKit ships 3x more network requests for equivalent static content vs Astro. For a content-first emoji reference, Astro wins. |
| Astro | 11ty (Eleventy) | If you want zero opinion on frontend JS and maximum template flexibility. But 11ty has no built-in view transitions, no islands architecture, and no Vite integration. You'd have to bolt on everything Astro gives you. |
| GSAP | Motion (motion.dev) | If you are building a React/Vue SPA and want framework-native animation bindings. Motion's vanilla JS API exists but is less mature than GSAP's. GSAP has superior SVG animation, timeline sequencing, and ScrollTrigger -- all critical for this project's vision. Motion's 2.3KB mini animate() is tempting for size, but GSAP's 23KB core + free plugins delivers far more capability per byte for this use case. |
| GSAP | CSS-only animations | For simple hover states and transitions. Use CSS `@keyframes` and `transition` for simple effects (opacity, transform). Reach for GSAP when you need timelines, scroll-linked animation, staggered grid reveals, or spring physics. The two coexist naturally. |
| GSAP | Web Animations API (WAAPI) directly | If bundle size is the only concern and animations are trivial. WAAPI lacks timelines, scroll linking, and SVG morphing. Too low-level for the "buttery, playful" vision. |
| Custom search (port existing) | Pagefind | If maintaining the custom search becomes a burden. Pagefind loads zero JS until search, uses chunked indexes (great for bandwidth), and has Astro integration. But the existing search in `home-search.mjs` is sophisticated (514 lines of tuned ranking with aliases, fuzzy matching, edit distance, stemming) and deeply tailored to emoji semantics. Pagefind would need custom attributes to match this quality. Recommendation: port the existing search first, evaluate Pagefind later. |
| open-props (cherry-pick) | Full design system (Tailwind, etc.) | If the team wants utility classes. But the site already has a strong custom property system with good token names. Adding Tailwind would fight the existing CSS. Open Props augments without replacing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React / Next.js | Massive runtime for a content site. Ships ~80KB+ of framework JS to the client. The site has zero need for a virtual DOM, reconciliation, or client-side routing beyond view transitions. | Astro (ships zero JS by default) |
| Tailwind CSS | The site already has a mature custom property system (2,600 lines of purposeful CSS). Tailwind would add a build step, fight existing styles, and create a jarring inconsistency during migration. The opinionated design direction ("personality, not generic") is better served by hand-crafted CSS. | Keep existing CSS custom properties. Augment with open-props for animation easings. |
| Framer Motion | React-only. Even the vanilla JS version (motion.dev) is less mature than GSAP for SVG-heavy work. The "Motion" rebrand is recent and the vanilla API is still evolving. | GSAP (framework-agnostic, SVG-native, free) |
| Lottie / Rive | Overkill for emoji micro-interactions. Requires authoring in external tools (After Effects, Rive editor). Adds runtime weight (lottie-web is ~60KB). The emojis are already SVGs -- animate them directly with GSAP. | GSAP SVG animation + CSS transitions |
| Webpack / Parcel | Legacy bundlers. Vite (via Astro) is faster, simpler, and already handles everything needed. | Vite (built into Astro) |
| jQuery / Anime.js | jQuery is dead weight for a modern site. Anime.js is abandoned (last meaningful update 2023). | GSAP + CSS transitions |
| Heavy state management (Redux, Zustand) | The site's state is simple: favorites, recents, theme, copy mode -- all in localStorage. No need for a state library. | vanilla JS + localStorage (existing pattern) + Astro `transition:persist` for cross-page state |

## Stack Patterns by Variant

**Animation approach -- layered strategy:**
- CSS `transition` and `@keyframes` for hover states, focus rings, theme transitions, and simple opacity/transform changes. Zero JS. Use `prefers-reduced-motion` media query to respect accessibility.
- GSAP for timelines, staggered reveals (emoji grid entrance), scroll-triggered animations, SVG morph effects, spring physics on tap/click, and the "surprise me" random discovery feature.
- View Transitions API (via Astro) for page-to-page navigation animations. Cross-document transitions work natively in Chrome 126+, Edge 126+, Safari 18+, Firefox 133+. Astro provides `transition:animate`, `transition:name`, and `transition:persist` directives. This replaces the need for an SPA router.

**Search approach -- port then evaluate:**
- Phase 1: Port the existing `home-search.mjs` (514 lines) into an Astro island. It runs entirely client-side, loads the emoji JSON, and provides instant results. This preserves the tuned ranking, aliases, fuzzy matching, and hex code search.
- Phase 2 (optional): Evaluate Pagefind if search maintenance becomes a burden or if the dataset grows significantly beyond 3,500 entries.

**Data handling with Astro Content Layer:**
- Use Astro's Content Layer API with a custom loader for the emoji JSON (`grouped-openmoji.json`). This gives type-safe collections, build-time data validation, and caching between builds. The Content Layer API handles tens of thousands of entries and builds 5x faster than the legacy content collections approach.
- Generate all ~3,500 emoji detail pages, category pages, and subgroup pages at build time using `getStaticPaths()`.

**If targeting maximum browser compatibility:**
- View Transitions gracefully degrade -- browsers without support simply get instant page loads (no animation, no breakage). This is the correct progressive enhancement pattern.
- GSAP handles all browser quirks internally. Its `gsap.matchMedia()` utility handles responsive animation breakpoints.
- Service worker strategy remains unchanged -- Astro generates static files that the existing SW pattern can cache.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| astro@5.18.x | Node.js 22.x+ | Node 20 works but 22 is recommended and will be required by Astro 6 |
| astro@5.18.x | vite@7.x | Vite is bundled -- version managed by Astro |
| gsap@3.14.x | Any (framework-agnostic) | No framework dependency. Works with vanilla JS in Astro `<script>` tags |
| open-props@1.7.x | Any CSS pipeline | Pure CSS custom properties. Import in Astro global styles |
| astro-pagefind@1.8.x | astro@5.x | Integration runs post-build, no conflict with other integrations |
| @astrojs/sitemap@3.7.x | astro@5.x | Official integration, version-locked to Astro major |
| playwright@1.58.x | Node.js 22.x | Already in project, no change needed |

## Migration Path from Current Stack

The migration from the custom SSG to Astro is the biggest change. Here is the recommended approach:

1. **Scaffold Astro alongside existing code.** Create `astro.config.mjs`, `src/` directory. The existing site continues to work during migration.
2. **Port layouts first.** Convert the HTML templates in `render.mjs` to Astro layouts. The existing CSS works as-is in Astro (import it globally).
3. **Port data loading.** Replace `utils/build/load-data.mjs` with an Astro Content Layer custom loader that reads `grouped-openmoji.json`.
4. **Port pages.** Convert home, category, subgroup, and detail page templates to `.astro` files using `getStaticPaths()`.
5. **Port client JS as islands.** The search UI (`home-app.mjs`, `home-search.mjs`) becomes a `<script>` tag in the home page Astro component. Interactive elements use `client:visible` or `client:idle` directives if wrapped in framework components, or inline `<script>` tags for vanilla JS.
6. **Add View Transitions.** Drop `<ViewTransitions />` into the base layout. Add `transition:name` to shared elements (header, emoji cards). Immediate visual upgrade with near-zero effort.
7. **Add GSAP.** Import in page-specific `<script>` tags. Start with emoji grid stagger animations and copy-feedback effects.
8. **Remove old build.** Delete `utils/build/` once Astro produces equivalent output.

## Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Astro Content Layer with 3,500 items may slow builds | LOW | Content Layer API is designed for tens of thousands of entries. Use caching between builds. Benchmark early. |
| GSAP + many SVGs on screen (grid views) could jank | MEDIUM | Use GSAP `batch()` and `ScrollTrigger` to animate only visible items. Leverage `will-change: transform` sparingly. Test on low-end devices. |
| View Transitions not supported in older browsers | LOW | Graceful degradation is built in. No support = instant navigation (current behavior). No breakage. |
| Migration scope creep -- rewriting everything at once | HIGH | Port incrementally. Each page can be migrated independently. Keep the old build working until the new one is verified. |

## Sources

- [Astro 5 documentation](https://docs.astro.build/) -- Content Layer API, View Transitions, GitHub Pages deployment, islands architecture. HIGH confidence.
- [Astro 6 Beta announcement](https://astro.build/blog/astro-6-beta/) -- Confirmed 5.x is current stable, 6.x in beta. HIGH confidence.
- [GSAP documentation](https://gsap.com/docs/) -- ScrollTrigger, Flip, pricing change. HIGH confidence.
- [GSAP free announcement (CSS-Tricks)](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/) -- Confirmed free for commercial use after Webflow acquisition. HIGH confidence.
- [Motion.dev](https://motion.dev) -- Vanilla JS API, bundle size comparison. MEDIUM confidence (compared against GSAP docs).
- [Pagefind](https://pagefind.app/) -- Static search at scale, Astro integration. HIGH confidence.
- [View Transitions API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) -- Browser support: Chrome 111+, Edge 111+, Safari 18+, Firefox 133+ for same-document; Chrome 126+ for cross-document. HIGH confidence.
- [Open Props](https://open-props.style/) -- CSS custom properties, JIT mode. MEDIUM confidence.
- npm registry (direct `npm view` queries) -- All version numbers verified 2026-03-03. HIGH confidence.

---
*Stack research for: emoj.ie animation-rich static emoji reference*
*Researched: 2026-03-03*
