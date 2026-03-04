# Phase 1: Astro Migration - Research

**Researched:** 2026-03-03
**Domain:** Static site generation migration (Node.js SSG to Astro 5 + Svelte 5)
**Confidence:** HIGH

## Summary

Phase 1 migrates emoj.ie from a custom Node.js static site generator (render.mjs, ~106KB monolithic template engine) to Astro 5 with Svelte 5 island components. The existing codebase generates ~4,284 emoji detail pages, 12 category pages, and ~100+ subgroup pages from `grouped-openmoji.json` and `data/emoji-enrichment.json`. The migration replaces the custom build pipeline with Astro's file-based routing and `getStaticPaths()` for dynamic route generation, while converting all interactive elements (search, theme switcher, copy buttons, favorites, skin tone picker, emoji grids) to hydrated Svelte 5 components.

The data pipeline is well-suited for Astro's content layer -- the existing `loadEmojiModel()` function already produces a structured model with groups, categories, tags, and emoji entries that maps directly to Astro's `getStaticPaths()` props pattern. The URL pattern change from `/emoji/grinning-face--1f600/` to `/emoji/grinning-face/` (slug-only, no hex code) requires a new slug uniqueness strategy since some emoji annotations share the same slug after normalization.

**Primary recommendation:** Use Astro 5's `getStaticPaths()` with the existing data loading pipeline adapted as a shared utility module. Use Svelte 5 runes (`$state`, `$derived`) for all client-side state, with `.svelte.ts` files for shared state (favorites, recents, theme, copy mode, skin tone). Keep search loading the full JSON for now (optimization deferred to Phase 3 per user decision).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Detail pages use slug-only URLs: `/emoji/grinning-face/` (no hex code)
- Slug uniqueness must be handled (duplicates like "man frowning" vs "person frowning" need disambiguation)
- Category hubs at top level: `/smileys-emotion/`
- Subgroup pages nested under category: `/smileys-emotion/face-smiling/` (no `/category/` prefix)
- Skin tone and gender variants do NOT get separate pages -- variants live on the base emoji's detail page only
- Home page at `/`
- ALL interactive elements become Svelte islands in Phase 1: search, theme switcher, copy buttons, favorites, skin tone picker
- Emoji grids on category/subgroup pages are full Svelte components (not static HTML with interactive cards)
- Clean break from vanilla JS -- no hybrid vanilla/Svelte interactivity
- Keep the 10 Unicode standard categories as top-level navigation
- Keep subgroup pages within categories (one page per Unicode subgroup)
- Home page is search-first: prominent search bar dominates above the fold, category grid is secondary/below fold
- Detail pages maintain full feature parity: big emoji, all copy formats, metadata, skin tone variants, breadcrumbs
- Phase 1 migrates CORE pages only: home, category hubs, subgroup pages, emoji detail pages
- Deferred pages: about, alternatives/competitor comparisons, compare, press-kit, tag, tofu
- Full SEO parity required: JSON-LD structured data, OpenGraph tags, sitemaps, robots.txt
- Service worker deferred -- no offline support in Phase 1
- Adapt existing Playwright tests to new URL patterns and selectors (not a fresh test suite)

### Claude's Discretion
- Trailing slash convention (likely trailing slashes for Astro + GitHub Pages)
- Search implementation approach -- port existing algorithm or rebuild in Svelte
- Search data optimization deferred to Phase 3 (keep loading full JSON for now)

### Deferred Ideas (OUT OF SCOPE)
- Service worker / offline support -- add back after core migration is stable
- Supplementary pages (about, alternatives, compare, press-kit, tag, tofu) -- migrate in a later phase or as needed
- Search data optimization (pre-built index, lighter payload) -- Phase 3 (NAV-02: semantic search)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Site migrated from custom Node.js SSG to Astro 5 with fresh SEO-optimized URL patterns | Astro 5.x getStaticPaths for dynamic routes, file-based routing for static pages, slug-only URL generation with uniqueness handling, @astrojs/sitemap for SEO |
| ARCH-02 | Interactive UI elements built as Svelte island components with hydration strategies | @astrojs/svelte v7+ for Svelte 5, client:load for search/theme/copy, client:visible for emoji grids, Svelte 5 runes for state |
| ARCH-05 | Build-time data slicing -- detail pages inline their emoji, category pages load only their category data | getStaticPaths props pattern passes only relevant data per page, no monolithic JSON bundle on page load |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | ^5.18 | Static site generator and build system | File-based routing, getStaticPaths for dynamic pages, island architecture, built-in optimizations. Current stable is 5.18.0 |
| svelte | ^5.53 | Interactive UI component framework | Runes-based reactivity ($state, $derived), compiled to minimal JS, pairs natively with Astro islands. Current stable is 5.53.6 |
| @astrojs/svelte | ^7.2 | Astro-Svelte integration | Official integration enabling SSR + client hydration for Svelte 5 components in Astro pages |
| @astrojs/sitemap | ^3.7 | Automatic sitemap generation | Official integration with filter, customPages, and chunking support for large sites |
| typescript | ^5.7 | Type safety | Required peer dependency for both Astro and Svelte, enables .svelte.ts shared state files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| astro-seo | ^0.8 | SEO meta tag management | Simplifies OpenGraph, Twitter Card, and canonical URL generation per page -- optional, can be done manually |
| playwright | ^1.58 | E2E testing | Already a devDependency; adapt existing tests to Astro dev server |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| getStaticPaths + raw JSON | Astro Content Collections with file() loader | Content collections add Zod validation + type safety but require restructuring data into content.config.ts. For 4,284 emoji entries loaded from existing JSON, getStaticPaths with direct import is simpler and avoids the content layer overhead |
| Manual SEO meta tags | astro-seo component | astro-seo saves boilerplate but the existing site has specific JSON-LD patterns (DefinedTerm, BreadcrumbList, WebPage) that may be easier to template directly |
| Svelte stores (writable) | Svelte 5 runes ($state in .svelte.ts) | Runes are the Svelte 5 standard; stores still work but runes are recommended for new code |

**Installation:**
```bash
npm create astro@latest -- --template minimal
npx astro add svelte
npx astro add sitemap
npm install -D typescript
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    islands/           # Hydrated Svelte components (client:*)
      Search.svelte        # Search bar + results overlay
      ThemeSwitcher.svelte # Dark/light/system toggle
      CopyButton.svelte    # Click-to-copy with format support
      EmojiGrid.svelte     # Category/subgroup emoji grid
      FavoriteButton.svelte # Add/remove favorites
      SkinTonePicker.svelte # Skin tone variant selector
    layout/            # Static Astro layout components
      Header.astro
      Footer.astro
      Breadcrumbs.astro
      SEOHead.astro        # JSON-LD + OG + canonical
  layouts/
    BaseLayout.astro     # HTML shell, fonts, analytics
    DetailLayout.astro   # Emoji detail page wrapper
    CategoryLayout.astro # Category/subgroup page wrapper
  pages/
    index.astro          # Home page (search-first)
    404.astro            # Custom 404
    [category]/
      index.astro        # Category hub (getStaticPaths)
      [subgroup]/
        index.astro      # Subgroup listing (getStaticPaths)
    emoji/
      [slug].astro       # Emoji detail page (getStaticPaths)
  lib/
    data/
      load-emoji.ts      # Adapted from utils/build/load-data.mjs
      slug.ts             # Adapted from utils/build/slug.mjs
      types.ts            # TypeScript interfaces for emoji model
    state/
      theme.svelte.ts    # Theme preference ($state + localStorage)
      favorites.svelte.ts # Favorites list ($state + localStorage)
      recents.svelte.ts  # Recent emojis ($state + localStorage)
      copy-mode.svelte.ts # Copy format preference
      skin-tone.svelte.ts # Default skin tone preference
    search/
      engine.ts          # Ported from home-search.mjs
      index.ts            # Search data loading + query interface
    utils/
      copy-formats.ts    # Ported from home-utils.mjs (formatCopyValue, COPY_MODES)
      seo.ts             # JSON-LD schema builders
public/
  assets/emoji/base/     # ~2,062 local OpenMoji SVGs (9.6MB)
  CNAME                  # emoj.ie custom domain
  .nojekyll              # Disable Jekyll processing
  favicon.ico
  favicon-16x16.png
  favicon-32x32.png
  android-chrome-192x192.png
  android-chrome-512x512.png
  apple-touch-icon.png
  logo.svg
  site.webmanifest
```

### Pattern 1: Dynamic Route Generation with getStaticPaths
**What:** Generate thousands of static pages from JSON data at build time
**When to use:** Emoji detail pages (~2,000+ base emoji pages), category pages (12), subgroup pages (~100)
**Example:**
```typescript
// src/pages/emoji/[slug].astro
---
import { loadEmojiModel } from '../../lib/data/load-emoji';
import DetailLayout from '../../layouts/DetailLayout.astro';

export async function getStaticPaths() {
  const model = await loadEmojiModel();

  // Only generate pages for base emojis (not variants)
  const baseEmojis = model.emojiEntries.filter(e => !e.isVariant);

  // Build slug uniqueness map
  const slugCounts = new Map<string, number>();
  for (const emoji of baseEmojis) {
    const count = slugCounts.get(emoji.slug) || 0;
    slugCounts.set(emoji.slug, count + 1);
  }

  return baseEmojis.map(emoji => {
    // Disambiguate duplicate slugs by appending hex
    const needsDisambiguation = (slugCounts.get(emoji.slug) || 0) > 1;
    const pageSlug = needsDisambiguation
      ? `${emoji.slug}-${emoji.hexLower}`
      : emoji.slug;

    // Collect skin tone variants for this base emoji
    const variants = model.emojiEntries.filter(
      v => v.baseHex === emoji.hexLower && v.hexLower !== emoji.hexLower
    );

    return {
      params: { slug: pageSlug },
      props: { emoji, variants, model: { groups: model.groups } }
    };
  });
}

const { emoji, variants } = Astro.props;
---
<DetailLayout emoji={emoji} variants={variants} />
```

### Pattern 2: Svelte Island with Hydration Strategy
**What:** Interactive components that hydrate on the client with appropriate loading strategy
**When to use:** Any interactive element -- search, copy buttons, emoji grids, theme toggle
**Example:**
```astro
<!-- In an Astro page/layout -->
---
import Search from '../components/islands/Search.svelte';
import EmojiGrid from '../components/islands/EmojiGrid.svelte';
import ThemeSwitcher from '../components/islands/ThemeSwitcher.svelte';
---

<!-- Search loads immediately -- critical interaction -->
<Search client:load />

<!-- Theme switcher loads immediately -- affects visual appearance -->
<ThemeSwitcher client:load />

<!-- Emoji grid loads when visible -- below fold on category pages -->
<EmojiGrid client:visible emojis={categoryEmojis} />
```

### Pattern 3: Shared Reactive State with Svelte 5 Runes
**What:** Cross-component state using .svelte.ts files with $state rune
**When to use:** Favorites, recents, theme, copy mode, skin tone -- any state shared across islands
**Example:**
```typescript
// src/lib/state/favorites.svelte.ts
const STORAGE_KEY = 'favoriteEmojisV1';
const MAX_FAVORITES = 40;

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(hexes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hexes));
  } catch { /* ignore quota errors */ }
}

let favorites = $state<string[]>(loadFromStorage());

export function getFavorites() {
  return favorites;
}

export function toggleFavorite(hex: string) {
  const index = favorites.indexOf(hex);
  if (index >= 0) {
    favorites = favorites.filter(h => h !== hex);
  } else {
    favorites = [hex, ...favorites].slice(0, MAX_FAVORITES);
  }
  saveToStorage(favorites);
}

export function isFavorite(hex: string): boolean {
  return favorites.includes(hex);
}
```

### Pattern 4: Build-Time Data Slicing (ARCH-05)
**What:** Each page receives only the data it needs via getStaticPaths props
**When to use:** All dynamic pages -- ensures no monolithic JSON bundle
**Example:**
```typescript
// Category page: only receives its own subgroups and preview emojis
export async function getStaticPaths() {
  const model = await loadEmojiModel();

  return model.categories.map(category => ({
    params: { category: category.key },
    props: {
      category,
      subgroups: category.subgroups.map(sg => ({
        key: sg.key,
        title: sg.title,
        route: `/${category.key}/${sg.key}/`,
        previewEmojis: sg.emojis
          .filter(e => !e.isVariant)
          .slice(0, 24),  // Only first 24 for preview
        totalCount: sg.emojis.filter(e => !e.isVariant).length,
      })),
    },
  }));
}
```

### Pattern 5: SEO JSON-LD Schema Pattern
**What:** Structured data generation matching existing patterns
**When to use:** All page types need JSON-LD (Organization, WebSite, WebPage, DefinedTerm, BreadcrumbList)
**Example:**
```typescript
// src/lib/utils/seo.ts
export function emojiDetailSchema(emoji: EmojiEntry, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: emoji.annotation,
    termCode: emoji.hexLower,
    url: `${baseUrl}/emoji/${emoji.pageSlug}/`,
    inDefinedTermSet: `${baseUrl}/${emoji.group}/${emoji.subgroup}/`,
  };
}
```

### Anti-Patterns to Avoid
- **Importing full emoji dataset in every page component:** Use getStaticPaths props to slice data at build time, not runtime imports
- **Using client:load on everything:** Only search and theme need immediate hydration; grids can use client:visible
- **Sharing state via Astro props across islands:** Islands hydrate independently; use .svelte.ts shared modules for cross-island state
- **Storing search index in content collections:** The 1.7MB search JSON is a runtime concern, not a content collection. Load it via fetch() in the search island component
- **Using Svelte 4 stores pattern:** Use Svelte 5 runes ($state, $derived) in .svelte.ts files, not writable/derived from svelte/store

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sitemap generation | Custom XML builder (existing sitemap.mjs) | @astrojs/sitemap with filter + customPages | Handles 4000+ URLs, proper XML escaping, sitemap index splitting, integrates with Astro routes automatically |
| HTML page templating | String concatenation (existing render.mjs at 106KB) | Astro .astro component templates | Type-safe, component-based, automatic HTML escaping, layout inheritance |
| OpenGraph/meta tags | Manual `<meta>` string building | Astro `<head>` in layouts or astro-seo | Prevents duplicate tags, handles charset/viewport correctly |
| CSS bundling | Manual style.css inclusion | Astro scoped styles + global CSS import | Automatic code splitting, scoping, dead code elimination |
| Static file serving | Manual asset path computation | Astro public/ directory | Assets copied verbatim, correct paths in dev and production |
| Trailing slash handling | Custom redirect logic | `trailingSlash: 'always'` in astro.config.mjs | Consistent behavior across dev and production, matches GitHub Pages defaults |
| GitHub Pages deployment | Custom CI/CD workflow | withastro/action@v5 GitHub Action | Official, handles package manager detection, Pages artifact upload |

**Key insight:** The existing codebase has ~106KB of hand-rolled HTML templating in render.mjs. Astro's component model eliminates this entirely. The data loading pipeline (load-data.mjs) is the genuinely valuable part to preserve and adapt.

## Common Pitfalls

### Pitfall 1: Slug Collision Without Disambiguation
**What goes wrong:** Multiple emojis share the same slug after normalization. "man frowning" and "person frowning" both slugify to similar values. Without the hex code in the URL, you get route collisions.
**Why it happens:** The existing codebase uses `slug--hexcode` URLs which are inherently unique. Slug-only URLs require an explicit uniqueness strategy.
**How to avoid:** During getStaticPaths, build a slug frequency map first. For any slug with count > 1, append a disambiguator (shortest unique hex prefix, or category-subgroup prefix). Document the disambiguation strategy so URL generation is deterministic and reproducible.
**Warning signs:** Astro build fails with "duplicate route" errors; different emojis share the same page.

### Pitfall 2: Monolithic Data Import Breaking Data Slicing
**What goes wrong:** Importing the full emoji model in page components instead of through getStaticPaths props means Astro includes the entire dataset in every page's JavaScript bundle.
**Why it happens:** Natural instinct to `import` data directly in the component body rather than passing it through getStaticPaths.
**How to avoid:** ALL data loading happens in getStaticPaths. Pass only the specific emoji/category/subgroup data each page needs via props. The build-time function runs once; props are serialized per-page.
**Warning signs:** Page HTML files are unexpectedly large; detail pages contain data for other emojis.

### Pitfall 3: Svelte Island State Not Shared Across Islands
**What goes wrong:** Two Svelte islands on the same page (e.g., FavoriteButton and the emoji grid) don't share state. Clicking favorite in one doesn't update the other.
**Why it happens:** Each island hydrates independently with its own module scope. Importing the same .svelte.ts file creates separate instances per island unless properly structured.
**How to avoid:** Use a module-level singleton pattern in .svelte.ts files. The $state rune at module scope creates one reactive atom. All islands importing the same module share the same reference. Test cross-island reactivity explicitly.
**Warning signs:** Favoriting an emoji doesn't update the favorite indicator in the header; theme changes don't propagate to all islands on the page.

### Pitfall 4: Search JSON Loading Strategy
**What goes wrong:** Loading the 1.7MB home-data.json eagerly on every page bloats initial page load. Or loading it only on the home page means search doesn't work on category/detail pages.
**Why it happens:** The search bar appears in the header on all pages but search data is large.
**How to avoid:** Load search data lazily via fetch() only when the user focuses/types in the search input. The search island component should show the input immediately (client:load) but defer the data fetch until interaction begins. This keeps initial page weight low while enabling search on all pages.
**Warning signs:** LCP regression on detail pages; large JSON download on pages where user doesn't search.

### Pitfall 5: GitHub Pages Trailing Slash + Base Path Confusion
**What goes wrong:** Links break because of inconsistent trailing slash handling between dev server and GitHub Pages production, or wrong base path configuration.
**Why it happens:** GitHub Pages with custom domain (emoj.ie) doesn't need a base path, but trailing slashes must be consistent. Astro generates `/path/index.html` by default which GitHub Pages serves at `/path/`.
**How to avoid:** Set `trailingSlash: 'always'` and `site: 'https://emoj.ie'` with no `base` (custom domain means root deployment). Put CNAME in public/. Use `trailingSlash: 'always'` which matches the directory-based output format.
**Warning signs:** 404 errors on deployed site; broken internal links; canonical URLs missing trailing slashes.

### Pitfall 6: Asset Paths for Local Emoji SVGs
**What goes wrong:** The 2,062 local OpenMoji SVGs in assets/emoji/base/ don't resolve correctly after migration.
**Why it happens:** Current codebase uses relative paths computed per page depth. Astro's public/ directory serves from root.
**How to avoid:** Move assets/emoji/base/ into public/assets/emoji/base/. All SVG references become absolute paths from root: `/assets/emoji/base/1F600.svg`. The CDN fallback pattern (jsDelivr) stays the same.
**Warning signs:** Broken emoji images; 404 errors for SVG assets in dev or production.

### Pitfall 7: Variant Pages Being Generated When They Shouldn't Be
**What goes wrong:** Skin tone variants, gender variants, and right-facing variants get their own pages despite the decision that variants live on the base emoji's detail page only.
**Why it happens:** The getStaticPaths function iterates all 4,284 emoji entries without filtering.
**How to avoid:** Filter emojiEntries to only base emojis (`!entry.isVariant`) before generating routes. Pass variant data as props on the base emoji's page. The existing `isVariant`, `isSkinToneVariant`, `isGenderVariant`, `isRightFacingVariant` flags from load-data.mjs already handle this classification.
**Warning signs:** Build generates 4,000+ pages instead of ~2,000; variant URLs exist in the sitemap.

## Code Examples

Verified patterns from official sources:

### Astro Config for GitHub Pages with Custom Domain
```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://emoj.ie',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    svelte(),
    sitemap({
      filter: (page) => {
        // Exclude component group (noindex)
        return !page.includes('/component/');
      },
    }),
  ],
});
```
Source: [Astro Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/), [GitHub Pages Deploy Guide](https://docs.astro.build/en/guides/deploy/github/)

### GitHub Actions Workflow for Astro + GitHub Pages
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Install, build, and upload
        uses: withastro/action@v5

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
Source: [Astro GitHub Pages Guide](https://docs.astro.build/en/guides/deploy/github/)

### Svelte 5 Component with Client Hydration
```svelte
<!-- src/components/islands/CopyButton.svelte -->
<script lang="ts">
  import { formatCopyValue, type CopyMode } from '../../lib/utils/copy-formats';

  let { emoji, hex, annotation }: {
    emoji: string;
    hex: string;
    annotation: string;
  } = $props();

  let copied = $state(false);
  let copyMode = $state<CopyMode>('emoji');

  async function handleCopy() {
    const value = formatCopyValue(copyMode, { emoji, hexLower: hex, annotation });
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      setTimeout(() => copied = false, 1500);
    } catch {
      // Fallback for Safari synchronous requirement
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copied = true;
      setTimeout(() => copied = false, 1500);
    }
  }
</script>

<button type="button" onclick={handleCopy} class="copy-btn">
  {#if copied}
    Copied!
  {:else}
    {emoji}
  {/if}
</button>
```
Source: [Svelte 5 $props docs](https://svelte.dev/docs/svelte/$props), [Astro Islands](https://docs.astro.build/en/concepts/islands/)

### Base Layout with SEO and Analytics
```astro
<!-- src/layouts/BaseLayout.astro -->
---
interface Props {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: object[];
}

const { title, description, canonicalUrl, ogImage, noindex, jsonLd = [] } = Astro.props;
const siteUrl = 'https://emoj.ie';
const image = ogImage || `${siteUrl}/android-chrome-512x512.png`;
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl} />
    {noindex && <meta name="robots" content="noindex, follow" />}

    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:image" content={image} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={image} />

    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />

    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    <script defer data-domain="emoj.ie" src="https://plausible.io/js/script.js"></script>

    {jsonLd.map(schema => (
      <script type="application/ld+json" set:html={JSON.stringify(schema)} />
    ))}
  </head>
  <body>
    <slot />
  </body>
</html>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 stores (writable/derived) | Svelte 5 runes ($state/$derived in .svelte.ts) | Oct 2024 (Svelte 5.0) | Simpler reactivity model, universal (works outside components), better performance |
| Astro content collections in src/content/ | Content Layer API with loaders (glob/file) | Dec 2024 (Astro 5.0) | Collections can live anywhere, custom loaders, better performance for large datasets |
| Manual getStaticPaths only | Content collections + getStaticPaths | Astro 5.0 | Both patterns valid; getStaticPaths better for non-file data sources like our JSON |
| @astrojs/svelte v5 (Svelte 3/4) | @astrojs/svelte v7+ (Svelte 5) | 2024 | Svelte 5 component syntax, runes support, $props() instead of export let |
| Astro 4 content in src/content/ only | Astro 5 Content Layer -- any location | Astro 5.0 | More flexible data sourcing |

**Deprecated/outdated:**
- `export let` prop syntax in Svelte: Replaced by `$props()` in Svelte 5. Use `let { prop } = $props()` pattern
- Svelte `writable()` / `derived()` stores: Not deprecated but superseded by `$state` / `$derived` runes for new code
- Astro `src/content/config.ts`: Moved to `src/content.config.ts` in Astro 5

## Discretionary Recommendations

### Trailing Slash Convention
**Recommendation:** Use `trailingSlash: 'always'`
**Rationale:** Astro generates `directory/index.html` files by default. GitHub Pages serves these at `directory/` URLs. Setting `trailingSlash: 'always'` makes Astro's internal link handling match the production behavior. The existing site already uses trailing slashes everywhere. This avoids 301 redirect chains.

### Search Implementation Approach
**Recommendation:** Port the existing search algorithm from home-search.mjs to TypeScript, used directly in the Search Svelte island component
**Rationale:** The existing search algorithm (tokenization, stemming, fuzzy matching, alias expansion, scoring) is well-tested and production-proven with 490 lines of code. Rewriting introduces risk. The algorithm is pure functions with no DOM dependencies -- straightforward to port. Load the search JSON via fetch() on first user interaction with the search input, then use the ported engine for client-side filtering.

## Open Questions

1. **Slug Disambiguation Strategy**
   - What we know: Some emoji annotations produce identical slugs (e.g., gendered variants of the same concept). The existing codebase uses `slug--hexcode` which is inherently unique.
   - What's unclear: Exactly how many slug collisions exist after filtering out variants. The disambiguation format (append hex? append category? append number?).
   - Recommendation: During implementation, build the slug map first and count collisions. For disambiguation, append the shortest unique hex prefix (e.g., `/emoji/frowning-face-1f64d/` vs `/emoji/frowning-face-2639/`). This preserves readability while ensuring uniqueness.

2. **Emoji Data Loading Performance**
   - What we know: grouped-openmoji.json is 2.3MB, enrichment data is 1.4MB. The loadEmojiModel function processes 4,284 entries.
   - What's unclear: Whether Astro's build will call loadEmojiModel once (cached) or per-page-file that uses getStaticPaths.
   - Recommendation: Astro calls getStaticPaths once per dynamic route file. With 3 dynamic route files (emoji/[slug], [category]/index, [category]/[subgroup]/index), the model loads 3 times total at build time. This is fast enough (~1-2 seconds per load). If needed, add a module-level cache.

3. **Existing CSS Strategy**
   - What we know: The existing site uses a single 51KB style.css with no CSS framework. All styles are global.
   - What's unclear: Whether to migrate styles as-is (global import) or gradually refactor into scoped component styles.
   - Recommendation: Import the existing style.css as a global stylesheet in BaseLayout.astro initially. Refactor to scoped styles in Phase 2 (Design System). This minimizes Phase 1 scope while preserving visual parity.

## Sources

### Primary (HIGH confidence)
- [Astro Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/) -- site, base, trailingSlash, output settings
- [Astro Routing Reference](https://docs.astro.build/en/reference/routing-reference/) -- getStaticPaths, params, props, pagination
- [Astro Islands Architecture](https://docs.astro.build/en/concepts/islands/) -- client directives, hydration strategies
- [Astro GitHub Pages Deployment](https://docs.astro.build/en/guides/deploy/github/) -- workflow, CNAME, custom domain setup
- [@astrojs/svelte Integration](https://docs.astro.build/en/guides/integrations-guide/svelte/) -- Svelte 5 support, installation
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/) -- file() loader, Zod schemas, getCollection
- [Svelte 5 $state docs](https://svelte.dev/docs/svelte/$state) -- rune reactivity, .svelte.ts files
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide) -- stores to runes migration

### Secondary (MEDIUM confidence)
- [Svelte 5 Shared State patterns](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/) -- runes in .svelte.ts, singleton pattern
- [Astro trailing slash blog post](https://walterra.dev/blog/2025-01-28-astro-trailing-slashes) -- trailing slash + GitHub Pages interaction
- [Astro SEO Guide](https://eastondev.com/blog/en/posts/dev/20251202-astro-seo-complete-guide/) -- JSON-LD, OpenGraph best practices

### Tertiary (LOW confidence)
- Astro v6 timeline -- early 2026 mentioned; v5.x is current stable (5.18.0). Migration should target v5 which will be supported throughout Phase 1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Astro 5 + Svelte 5 is a well-documented, stable combination with official integration
- Architecture: HIGH -- getStaticPaths pattern is Astro's core static generation mechanism, well-suited for this dataset
- Pitfalls: HIGH -- identified from analysis of existing codebase structure and Astro documentation
- Data pipeline: HIGH -- existing loadEmojiModel maps cleanly to getStaticPaths; data slicing is straightforward
- URL strategy: MEDIUM -- slug disambiguation needs empirical testing during implementation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Astro 5 is stable; no major breaking changes expected)
