# Architecture Research

**Domain:** Animation-rich static emoji reference site
**Researched:** 2026-03-03
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
BUILD TIME (Node.js)
==========================================================================
  ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
  │  Emoji Data      │   │  Astro Content     │   │  Build Pipeline  │
  │  (JSON source)   │──>│  Layer / Loader    │──>│  (SSG output)    │
  │                  │   │                    │   │                  │
  │  grouped-openmoji│   │  Schema validation │   │  ~3500 HTML pages│
  │  enrichment data │   │  Collection API    │   │  JSON data slices│
  │  daily-emoji     │   │  Type safety       │   │  CSS / JS bundles│
  └──────────────────┘   └───────────────────┘   └──────────────────┘

RUNTIME (Browser)
==========================================================================
  ┌──────────────────────────────────────────────────────────────────┐
  │                    Static HTML Shell (Astro)                     │
  │  Server-rendered pages, SEO metadata, structured data, fonts    │
  ├──────────────────────────────────────────────────────────────────┤
  │                    View Transitions Router                       │
  │  ClientRouter: client-side nav, page transitions, persist state │
  ├────────────┬───────────┬───────────────┬────────────────────────┤
  │  Island:   │  Island:  │  Island:      │  Island:               │
  │  Search    │  Emoji    │  Builder      │  Discovery             │
  │  (Svelte)  │  Grid     │  (Svelte)     │  (Svelte)              │
  │            │  (Svelte) │               │                        │
  │  Keyboard  │  Virtual  │  Multi-select │  Emoji of Day          │
  │  nav, filt │  scroll,  │  copy string  │  Random, Collections   │
  │  instant   │  animated │  builder      │  Surprise-me           │
  │  results   │  cards    │               │                        │
  └─────┬──────┴─────┬─────┴───────┬───────┴────────────┬───────────┘
        │            │             │                    │
  ┌─────┴────────────┴─────────────┴────────────────────┴───────────┐
  │                    Shared State Layer                             │
  │  Svelte stores + localStorage persistence                        │
  │  favorites, recents, preferences, skin tone, copy mode           │
  ├──────────────────────────────────────────────────────────────────┤
  │                    Animation System                               │
  │  CSS transitions (tier 1) + Svelte transitions (tier 2)          │
  │  GPU-composited: transform, opacity, filter                      │
  │  WAAPI for complex sequences (tier 3, sparingly)                 │
  ├──────────────────────────────────────────────────────────────────┤
  │                    Service Worker                                 │
  │  Cache-first SVGs, network-first HTML, offline fallback          │
  └──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Astro Content Layer** | Load emoji JSON, validate schema, expose typed collections | `file()` loader with Zod schema in `src/content/config.ts` |
| **Astro Page Templates** | Generate ~3500 static HTML pages with SEO, structured data | `.astro` files in `src/pages/` using `getStaticPaths()` |
| **View Transitions Router** | Client-side navigation with animated page transitions | `<ClientRouter />` in base layout, `transition:animate` directives |
| **Search Island** | Instant search with keyboard navigation, semantic matching | Svelte component hydrated with `client:idle`, in-memory index |
| **Emoji Grid Island** | Render emoji cards with hover effects, lazy loading, virtual scroll | Svelte component hydrated with `client:load`, FLIP animations |
| **Builder Island** | Multi-select emoji builder, copy composed string | Svelte component hydrated with `client:visible`, persisted state |
| **Discovery Island** | Emoji of the Day, random, curated collections | Svelte component hydrated with `client:idle`, daily-emoji.json |
| **Shared State** | Cross-island state: favorites, recents, preferences | Svelte stores with localStorage sync, exported from shared module |
| **Animation System** | Micro-interactions, hover effects, copy feedback, transitions | CSS custom properties + Svelte `transition:` directives |
| **Service Worker** | Offline support, SVG caching, asset pre-caching | Generated at build time with hashed cache version |

## Recommended Project Structure

```
src/
├── content/
│   └── config.ts              # Astro content collections: emoji, categories, collections
├── data/
│   ├── grouped-openmoji.json  # Source emoji data (moved from root)
│   ├── emoji-enrichment.json  # CLDR enrichment data
│   └── daily-emoji.json       # Pre-computed daily emoji schedule
├── layouts/
│   ├── Base.astro             # HTML shell, meta, fonts, ClientRouter
│   ├── Home.astro             # Home page layout with search + grid slots
│   └── Detail.astro           # Emoji detail page layout
├── pages/
│   ├── index.astro            # Home page
│   ├── emoji/
│   │   └── [...slug].astro    # Dynamic emoji detail pages (~3500)
│   ├── category/
│   │   └── [...slug].astro    # Category hub pages
│   ├── [category]/
│   │   └── [subgroup].astro   # Subgroup listing pages
│   ├── tag/
│   │   └── [...slug].astro    # Tag pages
│   └── search/
│       └── [...slug].astro    # Search landing pages
├── components/
│   ├── islands/               # Hydrated Svelte components (interactive)
│   │   ├── SearchBox.svelte   # Search input + keyboard nav + results
│   │   ├── EmojiGrid.svelte   # Card grid with hover animations
│   │   ├── EmojiCard.svelte   # Single card: hover, copy, favorite
│   │   ├── Builder.svelte     # Multi-select emoji string builder
│   │   ├── Discovery.svelte   # Emoji of Day, Random, Collections
│   │   └── SkinTonePicker.svelte
│   ├── static/                # Non-hydrated Astro components (zero JS)
│   │   ├── Header.astro       # Site header, logo, theme toggle
│   │   ├── Footer.astro       # Footer with links
│   │   ├── Breadcrumbs.astro  # Navigation breadcrumbs
│   │   ├── SEO.astro          # Meta tags, JSON-LD, OG tags
│   │   └── CategoryCard.astro # Static category preview card
│   └── shared/                # Shared between static and island components
│       ├── EmojiImage.astro   # SVG emoji with CDN + local fallback
│       └── CopyButton.svelte  # Copy-to-clipboard with feedback animation
├── stores/
│   ├── favorites.ts           # Favorites store + localStorage sync
│   ├── recents.ts             # Recent emojis store
│   ├── preferences.ts         # Copy mode, skin tone, theme
│   └── search.ts              # Search query, filters, results state
├── lib/
│   ├── search/
│   │   ├── index.ts           # Search index builder
│   │   ├── tokenizer.ts       # Query tokenization + stemming
│   │   └── ranker.ts          # Result ranking algorithm
│   ├── emoji.ts               # Emoji data types, helpers, formatters
│   ├── copy.ts                # Copy format logic (emoji, unicode, HTML, shortcode)
│   └── slug.ts                # Slug generation (port from existing)
├── styles/
│   ├── global.css             # Design tokens, base styles, dark mode
│   ├── animations.css         # Keyframes, transition classes, hover effects
│   └── components/            # Component-specific styles (if not co-located)
└── assets/
    └── emoji/                 # Local SVG fallbacks
```

### Structure Rationale

- **content/** and **data/**: Astro Content Layer loads emoji JSON via `file()` loader. Schema validation catches data issues at build time. Separates source data from generated output.
- **components/islands/**: Svelte components that hydrate client-side. Each is an independent "island" with its own bundle. Keeps interactive JS isolated from static HTML.
- **components/static/**: Astro components that render to zero-JS HTML. Headers, footers, SEO metadata --- things that never need interactivity. No hydration cost.
- **stores/**: Shared Svelte stores consumed by multiple islands. State syncs to localStorage automatically. Islands subscribe independently, so one island updating favorites notifies all others.
- **lib/**: Pure TypeScript utilities shared between build and client. Search logic lives here so it can be tested independently and imported by the Search island.
- **styles/**: Global design tokens (CSS custom properties) that both Astro and Svelte components consume. Animation keyframes centralized so they can be reused.

## Architectural Patterns

### Pattern 1: Islands of Interactivity

**What:** The page is mostly static HTML. Interactive components (search, emoji grid, builder) are isolated Svelte "islands" that hydrate independently with different loading strategies.

**When to use:** Always --- this is the core architectural pattern. Every component decision starts with "does this need JavaScript?"

**Trade-offs:**
- Pro: Near-zero JS for non-interactive content. Each island loads only when needed.
- Pro: Islands hydrate independently --- search can be interactive before the grid finishes loading.
- Con: Cross-island communication requires shared stores (not direct props).
- Con: Islands cannot directly render Astro components inside them.

**Example:**
```astro
---
// src/pages/index.astro
import Base from '../layouts/Base.astro';
import SearchBox from '../components/islands/SearchBox.svelte';
import EmojiGrid from '../components/islands/EmojiGrid.svelte';
import Discovery from '../components/islands/Discovery.svelte';
import CategoryCard from '../components/static/CategoryCard.astro';
---
<Base title="emoj.ie - Every emoji, instantly">
  <!-- Static: zero JS, rendered at build time -->
  <section class="categories">
    {categories.map(cat => <CategoryCard category={cat} />)}
  </section>

  <!-- Island: hydrates when browser is idle -->
  <SearchBox client:idle />

  <!-- Island: hydrates immediately (core interaction) -->
  <EmojiGrid client:load entries={topEmojis} />

  <!-- Island: hydrates when scrolled into view -->
  <Discovery client:visible dailyEmoji={daily} />
</Base>
```

### Pattern 2: Tiered Animation Strategy

**What:** A three-tier animation approach where the cheapest, most performant technique is always preferred. CSS handles most animations, Svelte transitions handle component lifecycle, and WAAPI handles rare complex sequences.

**When to use:** Every animation decision. Default to tier 1 unless there is a specific reason to escalate.

**Trade-offs:**
- Pro: GPU-composited animations (transform, opacity) run off main thread at 60fps.
- Pro: CSS transitions work without JavaScript --- progressive enhancement for free.
- Con: CSS alone cannot orchestrate complex multi-step sequences.
- Con: Svelte transitions are tied to component mount/unmount lifecycle.

**Tier breakdown:**

| Tier | Technique | Use For | Performance |
|------|-----------|---------|-------------|
| 1 (default) | CSS transitions + keyframes | Hover effects, focus rings, theme switches, page load | GPU compositor, off main thread |
| 2 | Svelte `transition:` / `animate:` | Component enter/exit, list reorder (FLIP), spring physics | Main thread but optimized by Svelte compiler |
| 3 (rare) | Web Animations API | Complex multi-step sequences, scroll-linked, staggered reveals | Main thread, more control |

**Example:**
```css
/* Tier 1: CSS-only hover effect on emoji card */
.emoji-card {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.emoji-card:hover {
  transform: scale(1.08) translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Tier 1: Copy feedback animation */
@keyframes copy-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
.copy-success { animation: copy-pop 0.3s ease-out; }
```

```svelte
<!-- Tier 2: Svelte transition for search results appearing -->
<script>
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
</script>

{#each results as result (result.hexcode)}
  <div
    animate:flip={{ duration: 200 }}
    in:fly={{ y: 10, duration: 150 }}
    out:fade={{ duration: 100 }}
  >
    <EmojiCard emoji={result} />
  </div>
{/each}
```

### Pattern 3: Shared State via Svelte Stores with localStorage Sync

**What:** Application state (favorites, recents, preferences) lives in Svelte stores that auto-sync to localStorage. Multiple islands subscribe to the same stores, enabling cross-island reactivity without a global state manager.

**When to use:** Any state that needs to persist across sessions or be shared between islands.

**Trade-offs:**
- Pro: Zero-dependency state management. Svelte stores are built-in and reactive.
- Pro: localStorage sync means state survives page reloads and even Astro's view transitions.
- Con: localStorage is synchronous and limited to ~5MB. Fine for preferences, not for caching large datasets.
- Con: No cross-tab sync without additional BroadcastChannel logic.

**Example:**
```typescript
// src/stores/favorites.ts
import { writable } from 'svelte/store';

const STORAGE_KEY = 'favoriteEmojisV1';
const MAX_FAVORITES = 40;

function createFavoritesStore() {
  const stored = typeof localStorage !== 'undefined'
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    : [];

  const { subscribe, update, set } = writable<string[]>(stored);

  // Auto-persist on every change
  subscribe(value => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  });

  return {
    subscribe,
    toggle(hexcode: string) {
      update(favs => {
        if (favs.includes(hexcode)) {
          return favs.filter(f => f !== hexcode);
        }
        if (favs.length >= MAX_FAVORITES) return favs;
        return [...favs, hexcode];
      });
    },
    isFavorite(hexcode: string): boolean {
      let result = false;
      subscribe(favs => { result = favs.includes(hexcode); })();
      return result;
    }
  };
}

export const favorites = createFavoritesStore();
```

### Pattern 4: View Transitions for Page Navigation

**What:** Astro's `<ClientRouter />` intercepts link clicks and uses the browser View Transitions API to animate between pages. Specific elements get `transition:name` to morph between pages (e.g., an emoji in a grid morphs into the hero emoji on the detail page).

**When to use:** All same-origin page navigations. The base layout includes `<ClientRouter />` once, and it applies globally.

**Trade-offs:**
- Pro: App-like navigation without SPA overhead. Pages are still static HTML.
- Pro: `transition:persist` keeps islands alive across navigations (search box retains query).
- Pro: Fallback is instant page load --- works without JS, just loses the animation.
- Con: Cross-document view transitions have limited Firefox support (same-document only as of early 2026). Astro's ClientRouter works around this by doing client-side navigation.
- Con: View transition names must be unique per page, requiring dynamic naming for emoji grids.

**Example:**
```astro
---
// src/layouts/Base.astro
import { ClientRouter } from 'astro:transitions';
---
<html>
<head>
  <ClientRouter />
</head>
<body>
  <header transition:persist>
    <!-- Header persists across navigations, theme state maintained -->
  </header>
  <main transition:animate="slide">
    <slot />
  </main>
</body>
</html>
```

```astro
---
// Emoji card with named transition for morph effect
const { emoji } = Astro.props;
---
<a href={`/emoji/${emoji.slug}/`}>
  <img
    src={emoji.svgUrl}
    alt={emoji.annotation}
    transition:name={`emoji-${emoji.hexcode}`}
  />
</a>
```

## Data Flow

### Build-Time Data Flow

```
grouped-openmoji.json + enrichment.json
    |
    v
Astro Content Layer (file() loader + Zod schema)
    |
    v
Typed Emoji Collection (validated, normalized)
    |
    +--> getStaticPaths() --> ~3500 detail pages (HTML)
    +--> getStaticPaths() --> category/subgroup pages (HTML)
    +--> Home page with pre-computed top emojis
    +--> Search index JSON (pre-built, chunked for lazy load)
    +--> daily-emoji.json (pre-computed schedule)
    +--> sitemap.xml, robots.txt, manifest.json
    +--> Service worker with hashed cache name
```

### Runtime Data Flow

```
Page Load (Static HTML)
    |
    v
ClientRouter activates (view transitions enabled)
    |
    +--> Static components render immediately (zero JS)
    |
    +--> Islands hydrate by priority:
    |      client:load  --> EmojiGrid (core interaction)
    |      client:idle  --> SearchBox, Discovery
    |      client:visible --> Builder (below fold)
    |
    v
User types in search
    |
    v
SearchBox island --> tokenize query --> rank against in-memory index
    |
    v
Results update --> EmojiGrid re-renders with Svelte FLIP animations
    |
    v
User clicks emoji card
    |
    +--> View Transition: emoji image morphs to detail page hero
    +--> Detail page loads (static HTML + minimal island hydration)
    +--> Recents store updates --> localStorage syncs
    |
    v
User clicks copy
    |
    +--> Format value (emoji/unicode/HTML/shortcode)
    +--> Clipboard API write
    +--> CSS animation: copy-pop keyframe on button
    +--> Toast feedback (Svelte fly transition)
```

### State Management Flow

```
localStorage
    |
    v (read on init)
Svelte Stores (writable)
    |
    +--> favorites store  <-- toggle from any EmojiCard island
    +--> recents store    <-- auto-add from detail page visits
    +--> preferences      <-- copy mode, skin tone, theme
    +--> search state     <-- query, active filters
    |
    v (subscribe)
Multiple Islands react to same store changes
    |
    v (auto-persist)
localStorage (written on every store change)
```

### Key Data Flows

1. **Search flow:** User keystroke --> debounce (90ms) --> tokenize --> stem --> match against pre-built index --> rank by relevance --> Svelte reactive update renders results with FLIP animation
2. **Copy flow:** Click copy button --> read preference store for format --> format emoji value --> Clipboard API --> CSS animation feedback --> optional Plausible event
3. **Navigation flow:** Click link --> ClientRouter intercepts --> fetch target HTML --> View Transition API animates --> new page paints --> islands hydrate --> stores reconnect from localStorage
4. **Favorites flow:** Toggle favorite in any island --> favorites store updates --> all subscribed islands react --> localStorage persists --> service worker pre-caches favorited emoji SVGs

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~3500 emojis) | Single search index JSON loaded in full. Grid renders with intersection observer chunking. Build generates all pages in one pass. This is fine. |
| 5000-8000 emojis (Unicode growth) | Chunk the search index into per-category files, lazy-load on demand. Virtual scrolling becomes important for "all emojis" views. Build time may reach 30-60s --- still acceptable. |
| 10,000+ emojis (hypothetical) | Search index needs a dedicated worker thread (Web Worker) to avoid main thread blocking during index build. Consider IndexedDB for client-side caching of search data. Build pipeline needs incremental generation (only rebuild changed pages). |

### Scaling Priorities

1. **First bottleneck: Search index size.** The current ~1.7MB `home-data.json` is loaded entirely into memory. At 5000+ emojis this grows. Mitigation: chunk by category, lazy-load only what's needed, or move index building to a Web Worker.
2. **Second bottleneck: DOM node count.** Rendering 3500 emoji cards at once causes jank. Mitigation: virtual scrolling (render only visible cards) or intersection-observer-based chunked rendering (current pattern, works well up to ~1000 visible cards).
3. **Third bottleneck: Build time.** Astro generates pages in parallel, so 3500 pages should build in 15-30 seconds. Unicode adds ~100-200 emojis per year, so this is not an urgent concern.

## Anti-Patterns

### Anti-Pattern 1: Hydrating Everything

**What people do:** Mark every component with `client:load` because "we might need interactivity later."
**Why it's wrong:** Destroys the entire performance benefit of islands architecture. Ships unnecessary JS for static content, increases TTI, wastes bandwidth.
**Do this instead:** Default to Astro (static) components. Only create Svelte islands for components that genuinely respond to user input. Headers, footers, breadcrumbs, SEO metadata, category cards --- these are all static.

### Anti-Pattern 2: Animating Layout Properties

**What people do:** Animate `width`, `height`, `top`, `left`, `margin`, or `padding` to create movement effects.
**Why it's wrong:** These trigger layout recalculation (reflow) on every frame, blocking the main thread. With 50+ emoji cards visible, this causes visible jank and dropped frames.
**Do this instead:** Use `transform` (translate, scale, rotate) and `opacity` exclusively for motion. These are GPU-composited and run off the main thread. If you need size changes, use `transform: scale()` and reserve actual layout changes for the FLIP technique (calculate once, animate with transform).

### Anti-Pattern 3: Global CSS Variable Animation

**What people do:** Animate CSS custom properties on `:root` for theme transitions or global effects.
**Why it's wrong:** Changing a CSS variable on `:root` invalidates styles on every element in the DOM. With 3500+ emoji entries, this forces a full style recalculation that can take 50-100ms, causing a visible freeze.
**Do this instead:** Scope CSS variable changes to the smallest possible subtree. For theme switching, toggle a class on `<html>` and let CSS transitions on individual properties handle the visual change. For scroll-linked effects, apply variable changes only to the affected element.

### Anti-Pattern 4: Monolithic Client-Side Data Loading

**What people do:** Load the entire emoji dataset (2MB+ JSON) on every page, even detail pages that only need one emoji.
**Why it's wrong:** Wastes bandwidth and parsing time. A detail page for a single emoji does not need 3500 emoji records.
**Do this instead:** Pre-compute page-specific data at build time. Detail pages get their emoji data inlined in the HTML. The home page loads the search index lazily after initial render. Category pages load only their category's data.

### Anti-Pattern 5: Fighting View Transitions

**What people do:** Build a custom SPA router alongside Astro's view transitions, or use `transition:persist` on everything to avoid re-rendering.
**Why it's wrong:** Creates conflicts between Astro's navigation system and custom routing. Over-persisting prevents pages from receiving fresh data. Debugging becomes impossible when two routing systems compete.
**Do this instead:** Lean fully into Astro's `<ClientRouter />`. Use `transition:persist` only for elements that genuinely need to maintain state across navigation (the search box, the audio player if there ever is one). Let other islands re-mount --- they will restore state from shared stores.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| jsDelivr CDN | `<img src>` URLs templated from hexcode at build time | Emoji SVGs. Cache-first via service worker. Local `/assets/emoji/` fallback. |
| Google Fonts | `<link rel="preconnect">` + CSS import in base layout | Bricolage Grotesque, Instrument Sans, IBM Plex Mono. Font-display: swap. |
| Plausible Analytics | `<script data-domain>` in base layout | Privacy-focused. Custom events: copy, favorite, theme_change. No cookies. |
| GitHub Pages | Static file deployment via CI | Build output pushed to deploy branch. CNAME for emoj.ie. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Astro pages <-> Svelte islands | Props (build-time data passed as serialized JSON) | Islands receive initial data as props. Cannot call back to Astro. |
| Svelte island <-> Svelte island | Shared Svelte stores (imported from `src/stores/`) | No direct communication. Stores are the message bus. |
| Islands <-> localStorage | Auto-sync in store modules | Read on init, write on change. JSON serialization. |
| Build pipeline <-> Content Layer | Astro Content Collections API | `file()` loader reads JSON, Zod validates schema, `getCollection()` queries. |
| Service Worker <-> Browser | Cache API + fetch event interception | SW generated at build time. Hashed cache name for versioning. |
| Search index <-> Search island | Pre-built JSON loaded via `fetch()` on home page | Index built at build time, loaded lazily on client. |

## Build Order (Dependency Graph for Phased Migration)

The migration from the existing custom SSG to the Astro + Svelte architecture has clear dependency ordering:

```
Phase 1: Foundation
  Astro project scaffolding + Content Layer setup
  Port emoji data loading to Astro content collections
  Base layout with design tokens (port existing CSS variables)
  Static page generation (replicate current output)
  *** Must work before anything else ***
      |
      v
Phase 2: Navigation + Transitions
  Add <ClientRouter /> for view transitions
  Page transition animations (fade, slide)
  transition:name on emoji images for morph effects
  *** Depends on: pages existing to navigate between ***
      |
      v
Phase 3: Interactive Islands
  Port search to Svelte island (SearchBox.svelte)
  Port emoji grid to Svelte island (EmojiGrid.svelte)
  Shared state stores (favorites, recents, preferences)
  *** Depends on: pages + data pipeline working ***
      |
      v
Phase 4: Animation Polish
  Hover effects on emoji cards (CSS tier 1)
  Svelte transitions on search results (tier 2)
  Copy feedback animations
  Spring physics on interactive elements
  *** Depends on: islands being interactive ***
      |
      v
Phase 5: Discovery Features
  Emoji of the Day component
  Random emoji / surprise me
  Curated collections
  Multi-select builder
  *** Depends on: state stores + animation system ***
      |
      v
Phase 6: Performance + Polish
  Virtual scrolling for large lists
  Search index chunking
  Service worker update
  Lighthouse budget enforcement
  *** Depends on: all features built, now optimize ***
```

**Key dependency:** Phases 1-2 must be sequential. Phases 3-5 have some parallelism (Discovery features do not depend on Search being ported), but all depend on Phase 1 foundation. Phase 6 is always last.

## Sources

- [Astro Islands Architecture - Official Docs](https://docs.astro.build/en/concepts/islands/)
- [Astro View Transitions - Official Docs](https://docs.astro.build/en/guides/view-transitions/)
- [Astro Content Loader API Reference](https://docs.astro.build/en/reference/content-loader-reference/)
- [Astro Content Collections - Official Docs](https://docs.astro.build/en/guides/content-collections/)
- [Astro Svelte Integration - Official Docs](https://docs.astro.build/en/guides/integrations-guide/svelte/)
- [Svelte Motion (spring, tweened) - Official Docs](https://svelte.dev/docs/svelte/svelte-motion)
- [Svelte Transitions - Official Docs](https://svelte.dev/docs/svelte/transition)
- [View Transition API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [View Transitions 2025 Update - Chrome Blog](https://developer.chrome.com/blog/view-transitions-in-2025)
- [CSS/JS Animation Performance - MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)
- [FLIP Animation Technique - Aerotwist](https://aerotwist.com/blog/flip-your-animations/)
- [Motion.dev - Animation Library](https://motion.dev)
- [Islands Architecture Pattern - patterns.dev](https://www.patterns.dev/vanilla/islands-architecture/)
- [Astro Content Layer Deep Dive](https://astro.build/blog/content-layer-deep-dive/)
- [Building Static Website from JSON with Astro](https://dev.solita.fi/2024/12/02/building-static-websites-with-astro.html)

---
*Architecture research for: emoj.ie animation-rich static emoji reference site*
*Researched: 2026-03-03*
