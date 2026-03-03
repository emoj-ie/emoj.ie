# Pitfalls Research

**Domain:** Emoji reference site with animation-rich UI, ~3500 emojis from OpenMoji, static site on GitHub Pages
**Researched:** 2026-03-03
**Confidence:** HIGH (based on codebase analysis, documented concerns, and verified web research)

## Critical Pitfalls

### Pitfall 1: Animation Overload Tanks Performance on Low-End Devices

**What goes wrong:**
Adding "buttery animations and micro-interactions throughout" to a page that already renders 50-200+ emoji SVGs creates catastrophic jank on budget phones and older tablets -- exactly the devices kids (the target audience) are likely using. Animating CSS properties that trigger layout or paint (width, height, margin, top/left) rather than compositor-friendly properties (transform, opacity, filter) forces the browser to recalculate layout on every frame. With a grid of dozens of emoji cards each animating on hover/tap, the main thread gets buried.

**Why it happens:**
Animations look fine on a developer's MacBook Pro. Nobody tests on a 2020 Android phone with 2GB RAM until it is too late. The "premium feel" goal creates pressure to add more motion, not less. CSS `transition: all` is the default laziness that sneaks in -- it animates every property change, including ones that trigger expensive reflows.

**How to avoid:**
- Only animate `transform`, `opacity`, `filter`, and `clip-path` -- these run on the GPU compositor thread and stay smooth even when the main thread is busy.
- Use `will-change` sparingly and only on elements that are about to animate, not as a blanket declaration.
- Set a performance budget: test on a throttled Chrome DevTools profile (4x CPU slowdown, Fast 3G) before every animation PR.
- Stagger animations in grids -- do not animate 100 emoji cards simultaneously. Use `IntersectionObserver` to only animate elements entering the viewport.
- The existing `@keyframes` in style.css (4 animations) is manageable. The danger is the planned "bouncy interactions" and "interactive hover/tap effects" multiplied across every emoji card surface.

**Warning signs:**
- Frame rate drops below 30fps on Chrome DevTools Performance panel when scrolling emoji grids
- Cumulative Layout Shift (CLS) exceeds 0.1 in Lighthouse
- `transition: all` appears anywhere in CSS
- Users on mobile report laggy or stuttery scrolling

**Phase to address:**
Foundation/architecture phase. Establish an animation system with GPU-only properties as a constraint from day one. Create shared animation utilities (e.g., `bounceIn`, `fadeScale`) that are pre-approved for performance. Enforce the constraint in code review.

---

### Pitfall 2: 1.7MB JSON Payload Blocks First Meaningful Interaction

**What goes wrong:**
The site currently loads `home-data.json` (1.7MB) synchronously into memory to build the search index. On a 3G mobile connection, that is 5-8 seconds before the user can search. Adding animation JS, a framework runtime, and richer emoji metadata will push this higher. The search index build (`buildEntrySearchIndex` on ~3500 entries) also blocks the main thread during parsing.

**Why it happens:**
Client-side search requires the full dataset in memory for ranking. The "zero API" static site architecture means there is no server to paginate or query. It worked at prototype scale; it becomes the primary bottleneck as the site grows richer.

**How to avoid:**
- Pre-compute the search index at build time and ship it as a compact binary format (e.g., a pre-built trie or inverted index in a typed array). The client loads the index directly instead of rebuilding it from raw data.
- Move search to a Web Worker so index building never blocks the main thread.
- Implement progressive data loading: ship a lightweight "shell" JSON (~50KB) for initial category rendering, then load the full search index asynchronously.
- Use `Transfer-Encoding: chunked` or split the JSON into per-category shards that load on demand.
- Add `rel="preload"` for the data JSON so the browser starts fetching it immediately.

**Warning signs:**
- Time to Interactive (TTI) exceeds 3 seconds on Fast 3G throttle
- Users see empty search results for 2+ seconds after page load
- `home-data.json` file size continues to grow as metadata is enriched
- Memory usage exceeds 50MB on mobile during initial load

**Phase to address:**
Early architecture phase, before adding new features that increase payload. This is a prerequisite for the "premium feel" -- a site that takes 5 seconds to become interactive never feels premium.

---

### Pitfall 3: Framework Migration Rewrite Trap

**What goes wrong:**
The project is "open to framework adoption" (Astro, Svelte, etc.). The temptation is to do a Big Bang rewrite: stop everything, rebuild from scratch in the new framework, ship when "done." This stalls all feature work for weeks or months. Worse, the rewrite often introduces regressions in SEO, service worker behavior, route structure, and edge cases that the vanilla JS version already solved.

**Why it happens:**
The existing codebase has 135KB of client-side JS across 5 files, a 3157-line render.mjs, and a monolithic script.js. It feels like it needs a clean break. But every emoji detail page URL, every JSON-LD schema, every service worker cache strategy represents accumulated correctness that must be preserved.

**How to avoid:**
- Migrate incrementally, not all at once. If adopting Astro, start by wrapping the existing build output as Astro pages and progressively replacing templates.
- Define a "migration contract": every existing URL must still work, every schema must still validate, service worker must still cache correctly. Run the existing Playwright smoke tests against the new build before switching.
- Keep the existing build working in parallel until the new build passes all existing tests.
- Migrate the build pipeline first (page generation), then migrate client-side interactivity second. These are separate concerns.
- The 11,000+ HTML files and established route patterns (`/emoji/[name]--[hex]/`) are a contract with search engines. Breaking routes means losing SEO equity.

**Warning signs:**
- Feature work halts for more than 2 weeks during migration
- "We'll add that back later" appears in PR descriptions
- Existing Playwright smoke tests are skipped or commented out
- 404 errors spike in analytics after deployment
- Google Search Console reports coverage drops

**Phase to address:**
Must be the first major phase if pursued. Do NOT attempt framework migration and feature development simultaneously. Complete migration with feature parity first, then build new features on the new foundation.

---

### Pitfall 4: SVG-Heavy Emoji Grid Causes Layout Shift and Rendering Stalls

**What goes wrong:**
Loading 50-200 emoji SVGs from jsDelivr CDN in a grid without explicit dimensions causes massive Cumulative Layout Shift (CLS). Each SVG loads at its intrinsic size, then the grid reflowing as images arrive. Images without dimensions cause approximately 60% of layout shifts. On slow connections, the grid "jumps around" for seconds. Combined with animations on these elements, CLS can exceed 0.5 (Google considers >0.25 "poor").

**Why it happens:**
SVG images loaded via `<img>` tags from an external CDN have no intrinsic width/height until they load. Developers set `width: 100%` in CSS and assume the container handles sizing, but the container itself may not have explicit height until the image arrives.

**How to avoid:**
- Always set explicit `width` and `height` attributes on emoji `<img>` elements (or use `aspect-ratio: 1` in CSS with a fixed container).
- Use CSS `contain: content` on emoji grid cells to isolate layout impact.
- Implement skeleton placeholders with the exact dimensions of the emoji cards, so layout is stable before images load.
- Consider inlining the most critical SVGs (above-fold "emoji of the day," featured collections) to eliminate network dependency for initial render.
- Use `loading="lazy"` for emoji images below the fold -- the site already has chunk-based loading in home-app.mjs, but this needs to extend to all surfaces.

**Warning signs:**
- CLS score exceeds 0.1 in Lighthouse
- Visible "jump" when scrolling emoji grids on slow connections
- Grid items visibly resize as SVG images load
- PageSpeed Insights flags "Image elements do not have explicit width and height"

**Phase to address:**
Any phase that adds or modifies emoji grid rendering. Must be established as a constraint before the "big emojis, bright colors" visual redesign.

---

### Pitfall 5: Clipboard Copy Breaks Silently on Safari/iOS

**What goes wrong:**
The site's core value proposition is "find it, copy it, done." The existing code (script.js line 510, generated-pages.js line 413) uses `navigator.clipboard.writeText()` with a `document.execCommand('copy')` fallback. Safari requires clipboard writes to happen in a synchronous context directly triggered by user interaction. Any async operation between the click and the clipboard write (animation delay, analytics event, promise chain) causes a `NotAllowedError`. The copy silently fails. The user thinks they copied but pastes something else.

**Why it happens:**
Safari's User Activation API has a narrow window for "trusted" clipboard access. Developers test in Chrome where clipboard access is more permissive, then the site ships with broken copy on the second most popular mobile browser. The existing code wraps clipboard write in a `.then()` chain (script.js lines 511-512) which may lose the user activation context in Safari.

**How to avoid:**
- Structure clipboard writes so `navigator.clipboard.writeText()` is called synchronously within the click handler, not inside a `.then()` or `await` chain.
- For Safari compatibility, pass the Promise to the Clipboard API rather than awaiting it: `navigator.clipboard.write([new ClipboardItem({"text/plain": Promise.resolve(new Blob([text], {type: "text/plain"}))})])`.
- Always provide visual feedback for successful AND failed copies. Do not assume success. Catch errors and show "Copy failed -- try again" with a manual select-all fallback.
- Test clipboard functionality in Safari (macOS and iOS) as part of the Playwright smoke test suite.
- The `execCommand('copy')` fallback is deprecated but still works -- keep it as a last resort.

**Warning signs:**
- No error handling around clipboard calls in new code
- Copy feedback animation fires before clipboard write confirms
- Analytics show copy events but user complaints about paste not working
- Clipboard calls are inside async functions or promise chains

**Phase to address:**
Must be addressed in any phase that touches copy functionality. If building a "multi-select emoji builder" (tap multiple emojis, copy string), this becomes even more critical -- building a string asynchronously then trying to copy it will fail on Safari.

---

### Pitfall 6: prefers-reduced-motion Kills All Animation Instead of Adapting

**What goes wrong:**
The existing CSS (style.css line 2593-2602) uses a nuclear approach: `animation-duration: 0.01ms !important` on all elements when `prefers-reduced-motion: reduce` is set. This removes ALL animation, including functional transitions that help users understand state changes (copy confirmation fade, modal open/close, page transitions). Users with vestibular disorders do not necessarily want zero motion -- they want no spatial/parallax motion. Blanket removal makes the site feel broken for these users.

**Why it happens:**
The "nuke all animation" pattern is the most common implementation because it is easy. It is also wrong. Research shows that some animations improve accessibility (e.g., fade transitions that signal state changes), and users with ADHD may benefit from subtle motion cues. The `prefers-reduced-motion` preference is also a blunt instrument -- users who set it may want to avoid parallax but are fine with opacity fades.

**How to avoid:**
- Replace the blanket `animation-duration: 0.01ms` with targeted overrides. Keep opacity/fade transitions. Remove transforms that create spatial movement (translate, scale, rotate). Remove parallax effects.
- Create two animation tiers: "motion" (transforms, bounces, slides) and "feedback" (fades, color changes, border highlights). Only suppress the "motion" tier for reduced-motion users.
- Add a manual animation toggle in the site's settings, separate from the OS-level preference. Some users want to control animation per-site.
- Test the site with reduced motion enabled. It should still feel polished and responsive, just calmer.

**Warning signs:**
- The `* { animation-duration: 0.01ms !important }` pattern persists as the site adds dozens of new animations
- Copy feedback is invisible with reduced motion enabled
- Page transitions become instant jumps with no visual continuity
- No one has tested the site with reduced motion enabled

**Phase to address:**
Animation/interaction design phase. Must be designed into the animation system from the start, not bolted on after.

---

### Pitfall 7: OpenMoji CDN Dependency Creates Single Point of Failure

**What goes wrong:**
Every emoji image on the site loads from `cdn.jsdelivr.net/npm/openmoji@15.1/...`. If jsDelivr has a regional outage, a version update breaks paths, or OpenMoji removes/renames files between versions, the entire site becomes a wall of broken images. The CONCERNS.md already flags this, but the project plan to add "big emojis" and "animated emoji hover effects" makes images even more central to the experience.

**Why it happens:**
jsDelivr is free and fast. It works 99.99% of the time. But the 0.01% outage on a site where every single page depends on CDN images is catastrophic -- not "some icons are missing" but "the entire product is unusable." The site already has a `/assets/emoji/base/` fallback directory, but the CONCERNS.md notes there are no subresource integrity (SRI) checks and the fallback path is incomplete.

**How to avoid:**
- Implement a robust CDN fallback chain: try jsDelivr, fall back to local `/assets/emoji/` SVGs, fall back to native Unicode emoji character display.
- Use the service worker to cache emoji SVGs aggressively on first load. After initial visit, all emojis should be served from cache regardless of CDN status.
- Pin to a specific OpenMoji version in the build config and only update intentionally (already using 15.1, but OpenMoji 16 released August 2025 -- version drift is real).
- For the "emoji of the day" and landing page hero, inline the SVGs directly into the HTML to eliminate CDN dependency for critical above-fold content.
- Monitor CDN health -- add a lightweight check in the service worker that flags CDN failures to analytics.

**Warning signs:**
- Emoji images load with no `onerror` handler or fallback
- Service worker cache does not include emoji SVGs from previous visits
- Build uses `latest` or unpinned CDN version URLs
- No local SVG assets exist for critical emojis

**Phase to address:**
Infrastructure/reliability phase, before adding features that make images more prominent (big emojis, hover effects, emoji of the day).

---

### Pitfall 8: 11,000 HTML Files Approaching GitHub Pages Limits

**What goes wrong:**
The site currently generates 11,018 HTML files totaling 187MB. GitHub Pages has a 1GB published site size limit and a 10-minute deployment timeout. Adding features like emoji collections, comparison pages, themed groups, and richer detail pages will increase both file count and total size. At current growth rate, hitting the 1GB limit is plausible within 1-2 major feature additions, especially if local SVG assets are added as CDN fallbacks.

**Why it happens:**
Static site generators make it easy to generate a page for everything. Each emoji gets a detail page. Each comparison gets a page. Each collection gets a page. The file count grows multiplicatively as cross-referencing features are added. Nobody monitors total site size until deployment starts failing.

**How to avoid:**
- Track total site size and file count in the build manifest (the existing `build-manifest.json` should include this). Set alerts at 500MB and 750MB.
- Do NOT generate HTML pages for features that could be client-side rendered. Emoji collections and "themed groups" should be JSON data rendered by client-side JS, not 500 additional HTML files.
- Evaluate whether all 2,062 emoji detail pages need to be pre-rendered. Consider hybrid approach: pre-render top 200 most-searched emojis, use service worker + client-side rendering for the long tail.
- If site exceeds 800MB, migrate from GitHub Pages to Cloudflare Pages (unlimited static files, similar DX) before hitting hard limits.
- Keep local SVG assets out of the deployed site. Use service worker caching instead.

**Warning signs:**
- Build time exceeds 5 minutes (currently 2-5 minutes)
- `build-manifest.json` shows file count growing by >10% per feature
- GitHub Actions deployment step starts taking >5 minutes
- Total site size exceeds 500MB

**Phase to address:**
Architecture phase. Establish file generation strategy and limits before adding new page types. This constraint should inform whether features are SSG pages or client-rendered.

---

### Pitfall 9: Monolithic Client JS Prevents Code Splitting

**What goes wrong:**
The current client JS is 135KB across 5 files with no module bundling or code splitting. The home page loads `home-app.mjs` (42KB), `home-search.mjs` (14KB), and `home-utils.mjs` together regardless of whether the user needs search. Detail pages load `detail-page.js` and `generated-pages.js` (41KB). If a framework is adopted and animations added, this easily doubles. Without code splitting, every visitor downloads all JS upfront, including features they may never use (favorites management, skin tone picker, copy format switcher).

**Why it happens:**
Vanilla JS without a bundler has no code splitting mechanism. ES modules with dynamic `import()` can solve this, but only if the code is structured to support it. The current architecture has deeply intertwined concerns (script.js handles everything from theme to rendering to copy in 786 lines).

**How to avoid:**
- If staying vanilla: restructure into lazy-loaded ES modules using dynamic `import()`. Load search only when the search input is focused. Load favorites management only when the favorites section is visible.
- If adopting a framework: use its built-in code splitting from day one. Astro's island architecture naturally code-splits interactive components.
- Set a JS budget: no more than 50KB of JS should be required for initial page render. Everything else loads on demand.
- The existing service worker can precache deferred JS chunks so they load instantly when needed after first visit.

**Warning signs:**
- Total JS payload exceeds 100KB for any single page
- Lighthouse flags "Reduce unused JavaScript" with >50KB of unused code
- Adding a new feature requires editing files that are already >500 lines
- Import chains pull in unrelated functionality

**Phase to address:**
Architecture/migration phase. Whether migrating to a framework or restructuring vanilla JS, this must be solved structurally before adding animation libraries, emoji collections, or multi-select builder features.

---

### Pitfall 10: Kids Test on Parents' Devices -- Touch Target and Accessibility Blindspot

**What goes wrong:**
The site targets kids ages 5-7 as a "design appeal target." Kids using the site will be on their parents' phones or tablets, using imprecise finger taps on small screens. Emoji grids with 32px tap targets, hover-only interactions, and subtle visual feedback are invisible or unusable for young children. Additionally, kids navigating by swiping/scrolling may trigger unintended copies, favorite toggles, or navigation.

**Why it happens:**
Developers design for mouse precision and adult motor control. The "playful, kid-appealing" design goal focuses on visual aesthetics (bright colors, bouncy animations) but ignores the physical reality of small hands on glass screens. Touch target minimums (48x48px per WCAG) are already tight for adults; kids need larger.

**How to avoid:**
- Minimum touch targets of 56x56px for primary actions (emoji cards, copy buttons, favorite stars). This is larger than WCAG's 44x44px minimum.
- Eliminate hover-only interactions entirely. Every hover effect must have a tap equivalent. On mobile, hover states should not exist -- use `:active` and `:focus-visible` instead.
- Add generous spacing between interactive elements in grids. Kids' taps are imprecise and they will hit adjacent targets.
- Implement "tap confirmation" for destructive actions (remove favorite) -- a single accidental tap should not remove a carefully curated favorite.
- Test with actual children. This is not optional if kids are a target audience.

**Warning signs:**
- Interactive elements smaller than 48x48px
- Features that only trigger on `mouseenter`/`mouseover` with no touch equivalent
- Emoji grid items have less than 8px gap between them
- No usability testing with anyone under age 10
- Favorite removal happens on single tap without confirmation

**Phase to address:**
UX/design phase. Touch target sizes and interaction patterns must be defined in the design system before building individual features. Retroactively increasing touch targets after layout is finalized causes cascading layout changes.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| innerHTML for emoji grid rendering | Fast development, simple template literals | XSS vulnerability surface (17 innerHTML uses across 3 files), no component reuse, hard to add event listeners without delegation | Never for user-facing data. Acceptable for build-time HTML generation only |
| localStorage without schema validation | Ship quickly, no migration code needed | Corrupted state silently breaks favorites/recents. Two different key schemes already exist (recentEmojis vs recentEmojisV2) | Only for MVP. Must add schema validation before localStorage stores more data types |
| Single CSS file (2602 lines) | No build tooling needed, everything in one place | Impossible to scope styles, growing specificity wars, no dead CSS detection | Only for current scale. Must split before adding animation system, component styles, or theme variants |
| Monolithic render.mjs (3157 lines) | All rendering logic in one searchable file | Cannot test individual page types, cannot parallelize build, changes risk breaking all page types | Never at this scale. Already past the acceptable threshold |
| Global state in script.js | No state management overhead, quick to prototype | Cannot test in isolation, implicit dependencies, hard to reason about update order | Only for the legacy code that is being replaced. New features must use module-scoped state |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| jsDelivr CDN (emoji SVGs) | Using unpinned version URLs (`openmoji@latest`) or no fallback | Pin exact version (`openmoji@15.1.0`), implement service worker cache, local SVG fallback chain, `onerror` handler on every `<img>` |
| Plausible Analytics | Tracking too many custom events, slowing down interaction handlers | Fire analytics events asynchronously, never block UI on analytics. Use `navigator.sendBeacon` for fire-and-forget |
| Service Worker cache | Caching everything aggressively, causing stale content after deploys | Use content-hashed cache names (already done), but also implement a "stale-while-revalidate" pattern for data files so users get updates without waiting |
| GitHub Pages deployment | Assuming deployment is instant, not handling the 10-minute timeout | Monitor deployment time in CI. If build exceeds 5 minutes, investigate. Keep deploy artifacts under 500MB to stay well within limits |
| OpenMoji data updates | Updating OpenMoji version without checking for breaking changes in data structure | Create data format adapter layer. Validate new data against schema before committing. Diff old vs new data to catch removed/renamed emojis before breaking routes |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full dataset in memory for search | High memory usage, slow TTI on mobile | Pre-built search index, Web Worker for search computation | Noticeable on devices with <4GB RAM, severe on 2GB devices. Also degrades as emoji count grows beyond 5000 |
| Canvas-based tofu detection for all emojis | Blocking render thread, high CPU on page load | Sample a subset (20-30 representative emojis), cache results for 7 days (already implemented), use OffscreenCanvas in Worker | Already problematic -- runs requestIdleCallback but still blocks rendering pipeline. Worse with more emoji variants |
| Synchronous localStorage reads on page init | Blocks first paint while parsing JSON from storage | Read localStorage in requestIdleCallback or after first paint. Use a single read for all keys, not per-key reads | Noticeable when localStorage contains large favorites/recents sets, especially on mobile |
| CSS `transition: all` on emoji cards | GPU compositing of every property change, jank during scroll | Explicitly list animated properties: `transition: transform 0.2s, opacity 0.2s` | Immediately on any grid with 50+ visible items |
| Rendering 200+ emoji cards without virtualization | DOM node count exceeds 5000, scroll performance degrades | Virtual scrolling or chunked rendering (partially implemented in home-app.mjs chunk loading) | Grid views with 100+ visible items on mobile, category pages with all emojis shown |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| innerHTML with emoji annotation data from OpenMoji JSON | XSS if annotation contains HTML/JS. Current escaping only handles single quotes | Use `textContent` or `document.createElement` for user-visible text. Sanitize all data from external JSON at the data loading boundary, not at each render site |
| No SRI (Subresource Integrity) on CDN-loaded SVGs | Compromised CDN could serve SVGs with embedded JavaScript. SVGs can contain `<script>` tags | Add SRI hashes for CDN resources where possible. Use CSP `img-src` directives to restrict SVG capabilities. Serve SVGs as `<img>` not inline `<svg>` to sandbox script execution |
| Emoji data from build pipeline trusted implicitly | If build process or OpenMoji source is compromised, malicious data propagates to all 11,000 pages | Add schema validation at data load boundary. Verify data checksums. Review data diffs in PRs that update OpenMoji version |
| Copy-to-clipboard with arbitrary emoji sequences | Multi-select builder could construct emoji sequences that look like one thing but paste as another (Unicode spoofing) | Normalize emoji sequences before copy. Display the exact codepoints being copied. Warn on ZWJ sequences that combine unexpected characters |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Copy feedback disappears too quickly | User is unsure if copy worked, tries again, gets frustrated | Show feedback for 1.5-2 seconds minimum. Use both color change AND text confirmation ("Copied!"). Persist feedback state if user copies multiple times rapidly |
| Search requires exact emoji names | User types "sad" but the emoji is annotated "disappointed face" -- no results | Implement synonym/semantic search (already partially done with tags). Map common emotional terms to emoji annotations at build time. "sad" should match disappointed, crying, pensive, melancholy faces |
| Skin tone selection is buried or confusing | Users cannot figure out how to change skin tone, or accidentally set a default they do not want | Show skin tone options inline on detail pages, not hidden behind a settings menu. Make default tone visually obvious. Allow resetting to "no preference" easily |
| Too many copy format options visible at once | Developers want Unicode/HTML entity/shortcode, but most users just want the emoji character. Visual clutter confuses casual users | Default to emoji character copy with one-click. Show advanced formats (unicode, HTML, shortcode) in a collapsed "developer" section. Remember preference |
| Category browsing has too many levels of nesting | User clicks "Smileys & Emotion" then "Face Smiling" then finds the emoji -- 3 clicks minimum | Flatten navigation. Show all emojis in a category immediately with subgroup headers as scroll anchors. Subgroups are visual separators, not navigation gates |
| Emoji of the Day feels stale or random | User sees the same emoji featured multiple times, or featured emojis are obscure flags nobody cares about | Curate featured emojis to be relatable and fun. Weight toward popular emojis. Tie to seasons/holidays/events. Show a fun fact, not just the emoji name |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Search:** Often missing keyboard navigation between results -- verify that arrow keys move through results and Enter copies/navigates
- [ ] **Copy-to-clipboard:** Often missing Safari/iOS testing -- verify that copy works on Mobile Safari, not just Chrome
- [ ] **Animations:** Often missing reduced-motion adaptation -- verify with `prefers-reduced-motion: reduce` enabled that the site is still usable and gives copy/state feedback
- [ ] **Emoji grid:** Often missing explicit image dimensions -- verify CLS score is under 0.1 with Lighthouse after any grid changes
- [ ] **Service worker:** Often missing cache invalidation for data updates -- verify that deploying new emoji data actually reaches returning users within 24 hours
- [ ] **Favorites:** Often missing migration from old storage format -- verify that a user with `recentEmojis` (old key) gets migrated to `recentEmojisV2` without data loss
- [ ] **SEO schema:** Often missing validation after page template changes -- verify JSON-LD validates at schema.org/validator for detail, category, and home pages
- [ ] **Offline support:** Often missing testing with airplane mode -- verify the site loads and core features (browse, copy from cache) work with no network
- [ ] **Dark mode:** Often missing contrast checks in dark theme -- verify all text, icons, and interactive elements meet WCAG AA contrast ratios in both themes
- [ ] **Touch targets:** Often missing size verification on small screens -- verify all interactive elements are at least 44x44px on a 375px-wide viewport

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Animation performance degrades | LOW | Audit with Chrome DevTools Performance panel. Replace layout-triggering animations with transform/opacity equivalents. Add `will-change` hints. Can be fixed per-component |
| JSON payload bloat slows TTI | MEDIUM | Requires architectural change: pre-built search index, data sharding, or Web Worker. Not a quick CSS fix. Plan 1-2 weeks |
| Framework migration stalls features | HIGH | Cut scope of migration. Ship framework for new pages only, keep existing pages as-is. Incremental migration over months, not a big bang |
| CLS from image grid | LOW | Add explicit `width`/`height` to img tags, add `aspect-ratio` CSS. Can be fixed in a single PR |
| Clipboard broken on Safari | LOW | Restructure clipboard call to synchronous context. Add fallback UI. Single PR, but requires Safari testing device |
| Reduced motion removes all feedback | LOW | Replace blanket rule with targeted overrides. Keep opacity/color transitions, remove transform animations. One CSS file edit |
| CDN outage breaks all images | MEDIUM | Implement service worker SVG caching and local fallback. Requires SW changes and potentially hosting local assets. 2-3 day effort |
| GitHub Pages size limit hit | HIGH | Requires migration to Cloudflare Pages or Vercel, or significant reduction in generated pages. Plan 1 week minimum for migration and DNS changes |
| Monolithic JS prevents code splitting | MEDIUM | If framework migration is planned, this is solved by the migration. If staying vanilla, requires restructuring into dynamic imports. 1-2 weeks |
| Touch targets too small for kids | MEDIUM | Requires design system changes cascading through all grid layouts. Increasing emoji card size affects items-per-row calculations, pagination thresholds, and visual density. 1 week |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Animation performance | Architecture: establish animation system with GPU-only constraint | Lighthouse performance score >90 on throttled mobile. Frame rate >30fps during scroll |
| JSON payload bloat | Architecture: implement search index strategy before adding features | TTI <3s on Fast 3G throttle. Data payload <500KB for initial load |
| Framework migration trap | Migration: complete with feature parity before new features | All existing Playwright tests pass. Zero 404s for existing routes. Search Console coverage stable |
| SVG layout shift | Design system: emoji grid component with explicit dimensions | CLS <0.1 in Lighthouse for all page types |
| Clipboard Safari breakage | Core interaction: fix copy flow early, test across browsers | Playwright test suite includes Safari/WebKit. Copy confirmed working on iOS |
| Reduced motion adaptation | Animation system: tiered animation approach from start | Usability audit with `prefers-reduced-motion` enabled. State feedback still visible |
| CDN single point of failure | Infrastructure: implement fallback chain and SW caching | Site functional with jsDelivr blocked in DevTools network panel |
| GitHub Pages limits | Architecture: file generation strategy and monitoring | Build manifest tracks file count and total size. Alerts at 500MB threshold |
| Monolithic client JS | Architecture/migration: code splitting strategy | No page loads >50KB of JS for initial render. Lighthouse "unused JS" flag <30KB |
| Touch target accessibility | Design system: minimum touch target sizes defined | All interactive elements pass 44x44px minimum in automated accessibility audit |

## Sources

- [The struggle of using native emoji on the web -- Nolan Lawson](https://nolanlawson.com/2022/04/08/the-struggle-of-using-native-emoji-on-the-web/) -- cross-platform rendering issues
- [Web Animation Performance Tier List -- Motion.dev](https://motion.dev/blog/web-animation-performance-tier-list) -- which CSS properties are safe to animate
- [Animation performance and frame rate -- MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate) -- compositor-friendly animation properties
- [GitHub Pages limits -- GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) -- 1GB size limit, 10-minute deploy timeout, 100GB/month bandwidth
- [Storage quotas and eviction criteria -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- localStorage 5-10MB limits, iOS Safari 7-day eviction
- [Clipboard API Safari issues -- Apple Developer Forums](https://developer.apple.com/forums/thread/691873) -- writeText fails in async context
- [How to use Clipboard API in Safari async -- Wolfgang Rittner](https://wolfgangrittner.dev/how-to-use-clipboard-api-in-safari/) -- workaround for Safari clipboard restrictions
- [Optimize Cumulative Layout Shift -- web.dev](https://web.dev/articles/optimize-cls) -- images without dimensions cause 60% of layout shifts
- [Design accessible animation and movement -- Pope Tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/) -- prefers-reduced-motion best practices
- [prefers-reduced-motion: no-motion-first approach -- Tatiana Mac](https://www.tatianamac.com/posts/prefers-reduced-motion) -- tiered animation strategy
- [SVG icon stress test -- Cloud Four](https://cloudfour.com/thinks/svg-icon-stress-test/) -- inline SVG vs img performance for many icons
- [OpenMoji releases -- GitHub](https://github.com/hfg-gmuend/openmoji/releases) -- v16 released August 2025, active maintenance
- [SEO split test: emoji in meta descriptions -- SearchPilot](https://www.searchpilot.com/resources/case-studies/seo-split-test-lessons-emoji-meta-descriptions) -- emoji in meta descriptions caused 5% traffic drop
- Project codebase analysis: `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`

---
*Pitfalls research for: emoj.ie emoji reference site*
*Researched: 2026-03-03*
