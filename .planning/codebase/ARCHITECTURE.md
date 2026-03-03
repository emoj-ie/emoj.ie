# Architecture

**Analysis Date:** 2026-03-03

## Pattern Overview

**Overall:** Static site generator with client-side state management and offline-first service worker caching.

**Key Characteristics:**
- Build-time HTML/JSON generation from structured emoji data
- Client-side search, filtering, and UI state management with localStorage persistence
- Progressive enhancement with inline scripts for client behavior
- Separate concerns: build pipeline, rendering, client interactions
- Zero external API dependencies—all data precomputed at build time

## Layers

**Build Pipeline (Node.js, runs at development time):**
- Purpose: Generate static HTML pages, JSON data artifacts, and manifest files from emoji source data
- Location: `utils/build/`
- Contains: Data loading, rendering, sitemap generation, redirects, asset management, service worker generation, verification
- Depends on: Filesystem, emoji data sources (`grouped-openmoji.json`, enrichment data)
- Used by: CI/deployment system to produce site artifacts

**Data Transformation & Loading:**
- Purpose: Load, normalize, and structure emoji data into categories, groups, subgroups, and variants
- Location: `utils/build/load-data.mjs`
- Contains: Emoji model building, group descriptions, tag extraction, variant detection (skin tones, gender, direction)
- Depends on: Grouped emoji JSON, enrichment data, twemoji mappings
- Used by: Rendering pipeline to create site structure and pages

**HTML & Asset Rendering:**
- Purpose: Generate static HTML pages with SEO metadata, structured data, and layouts
- Location: `utils/build/render.mjs`
- Contains: Page templates for home, detail pages, category pages, comparison pages; metadata generation (OpenGraph, JSON-LD)
- Depends on: Emoji model, config, slug utilities
- Used by: Build pipeline to write files to output

**Sitemap & Metadata Generation:**
- Purpose: Create XML sitemaps, robots.txt, and manifests for search engine indexing and deployment
- Location: `utils/build/sitemap.mjs`, `utils/build/index.mjs`
- Contains: Sitemap XML builders, robots.txt generation, build manifest creation
- Depends on: Render result, configuration
- Used by: Build pipeline for SEO and deployment tracking

**Client-Side Runtime (Browser, ES6+ modules and vanilla JS):**
- Purpose: Handle search, filtering, favorites, copy interactions, theme switching, and client state
- Location: `home-app.mjs`, `home-search.mjs`, `generated-pages.js`, `detail-page.js`, `script.js`
- Contains: Search indexing and ranking, UI event handling, localStorage state persistence, breadcrumb tracking
- Depends on: HTML DOM, localStorage API, Plausible analytics
- Used by: Every page for interactivity

**Service Worker & Offline Caching:**
- Purpose: Enable offline access, cache emoji assets locally, and handle failed requests gracefully
- Location: `sw.js` (generated at build time from `utils/build/sw.mjs`)
- Contains: Cache-first strategy for emoji SVG assets, network-first strategy for core pages
- Depends on: Cache API
- Used by: Browser for offline fallback and performance

## Data Flow

**Build Time:**

1. **Load Source Data:**
   - `utils/build/index.mjs` → `readJson(grouped-openmoji.json)` → Base emoji catalog with OpenMoji grouping
   - Load enrichment data with CLDR names, keywords, and Twemoji URLs
   - Load configuration from `utils/site.config.json`

2. **Build Emoji Model:**
   - `load-data.mjs` → Process raw emoji entries
   - Group by category (smileys-emotion, animals-nature, etc.)
   - Extract subgroups and filter variants (skin tones, gender, direction)
   - Build search indices (tags, keywords, aliases)
   - Identify base emojis vs variants

3. **Render Site:**
   - `render.mjs` → For each emoji: generate detail page HTML with metadata
   - For each category: generate category hub page with subgroups and preview grid
   - For each subgroup: generate subgroup page with full emoji list
   - Generate home page with group panels and search UI
   - Generate alternative comparison pages
   - Output all as `[route]/index.html`

4. **Generate Assets & Manifests:**
   - Create sitemaps (`sitemap-core.xml`, `sitemap-emoji.xml`)
   - Create robots.txt for crawler instructions
   - Compute build hash from content for cache invalidation
   - Write service worker with hashed cache name
   - Create build manifest tracking all generated files and stats

5. **Sync to Output:**
   - Copy all generated files from temporary build directory to repository root
   - Track managed files for cleanup of stale artifacts

**Runtime (Client):**

1. **Initial Page Load:**
   - Browser fetches HTML (home, detail, or category page)
   - Parse SEO metadata, JSON-LD structured data, and page content
   - Inline scripts run immediately in blocking order: `detail-page.js`, `generated-pages.js`, `script.js`

2. **Data Loading:**
   - Inline JavaScript loads `grouped-openmoji.json` (full emoji catalog with metadata)
   - Build search index from all emoji entries in-memory
   - Initialize state from URL params (`?q=`, `?g=`, `?sg=`, `?copy=`) and localStorage

3. **User Interaction (Home Page):**
   - User types in search input → debounced search handler → tokenize query → rank entries → render results
   - User selects group → filter to group → show subgroup pills → render filtered results
   - User selects subgroup → show emoji in that subgroup
   - User clicks favorite star → update localStorage favorite set → sync all favorite buttons
   - User changes copy mode → persist to localStorage → format copy value accordingly

4. **Detail Page Interaction:**
   - Page loads with single emoji in focus
   - User clicks copy button → copies emoji/unicode/HTML/shortcode to clipboard
   - User clicks favorite star → adds/removes from favorites in localStorage
   - Breadcrumb trail built from navigation history stored in sessionStorage

5. **Service Worker:**
   - Install: Cache core assets (HTML, CSS, JS, data JSON)
   - Fetch: Emoji SVG assets use cache-first (check cache, fallback to CDN or local)
   - Activate: Clean old cache versions

**State Management:**

Storage layers:
- **URL Search Params:** Query string (q, g, sg, copy) for shareable state
- **localStorage:** Persistent user preferences across sessions
  - `recentEmojisV2`: Last 20 viewed emojis (detail page views)
  - `favoriteEmojisV1`: Up to 40 saved emojis with metadata
  - `copyMode`: Preferred copy format (emoji, unicode, html, shortcode)
  - `defaultSkinTone`: Skin tone preference (0-5)
  - `themePreference`: Light/dark/system theme choice
- **sessionStorage:** Session-only data (detail trail for breadcrumbs)
- **In-Memory:** Rendered entry count, filtered results, search index built from data JSON

## Key Abstractions

**Emoji Entry Model:**
- Purpose: Represents a single emoji with all its metadata
- Examples: `grinning-face--1f600`, `1f600`, used in `home-app.mjs`, `detail-page.js`
- Pattern: Object with properties: `emoji`, `annotation`, `hexcode`, `group`, `subgroup`, `skintone`, `tags`, etc.

**Search & Ranking System:**
- Purpose: Query-to-emoji matching with fuzzy/stemmed token matching
- Examples: Query "happy" matches "grinning face", "happy face", "joy"
- Pattern: Tokenize query → check aliases → stem tokens → match against indexed keywords → rank by relevance
- Location: `home-search.mjs` (tokenizeSearch, filterAndRankEntries, buildEntrySearchIndex)

**Slug System:**
- Purpose: Convert natural language to URL-safe identifiers
- Examples: "grinning face" → "grinning-face", "skin tone: light" → removed, "man frowning" → "person frowning"
- Pattern: Normalize NFKD, remove diacritics/special chars, convert to kebab-case
- Location: `utils/build/slug.mjs` (slugify, normalizeHex, toBaseAnnotationKey)

**Route Pattern:**
- Purpose: Canonical URL structure for all pages
- Examples: `/emoji/grinning-face--1f600/`, `/smileys-emotion/face-smiling/`, `/category/animals-nature/`
- Pattern: Routes with trailing slashes, detail pages include emoji name and hex code
- Location: Used throughout rendering and client navigation

**Variant Detection:**
- Purpose: Identify and exclude variants (skin tones, gender, direction) from base search results
- Pattern: Check annotation for "skin tone", "facing right", "man"/"woman" prefixes
- Examples: "grinning face" is base, "grinning face: light skin tone" is variant
- Location: `utils/build/load-data.mjs` (isSkinToneVariant, isGenderVariant, isRightFacingVariant)

**Copy Formats:**
- Purpose: Multiple emoji representation formats for different contexts
- Examples: Emoji (😀), Unicode (1f600), HTML (&#x1f600;), Shortcode (:grinning-face:)
- Pattern: formatCopyValue function switches on mode and formats entry accordingly
- Location: `home-utils.mjs` (formatCopyValue, COPY_MODES)

## Entry Points

**Build Entry Point:**
- Location: `utils/build/index.mjs`
- Triggers: `npm run build` or `npm run build:check`
- Responsibilities: Orchestrate entire build pipeline, load data, render site, generate manifests, sync output files
- Output: All generated files in root directory, build manifest with stats

**Home Page Entry Point:**
- Location: `/index.html` (generated)
- Triggers: User visits https://emoj.ie/ or subdomains
- Responsibilities: Display emoji search interface, category grid, favorites/recents sections
- Runtime scripts: `home-app.mjs`, `home-search.mjs`, `generated-pages.js`

**Detail Page Entry Point:**
- Location: `/emoji/[name]--[hex]/index.html` (generated, e.g., `/emoji/grinning-face--1f600/`)
- Triggers: User clicks emoji link or navigates directly
- Responsibilities: Display single emoji with all copy formats, related suggestions, breadcrumb trail
- Runtime scripts: `detail-page.js`, `generated-pages.js`

**Category Page Entry Point:**
- Location: `/[category]/` (e.g., `/smileys-emotion/`)
- Triggers: User clicks category from home or navigates directly
- Responsibilities: Show category grid with subgroups and emoji previews
- Runtime scripts: `generated-pages.js`

**Service Worker Entry Point:**
- Location: `/sw.js` (generated at build time)
- Triggers: Browser registers service worker on page load
- Responsibilities: Cache core assets on install, serve cached assets, cache emoji SVGs on demand

## Error Handling

**Strategy:** Graceful degradation with fallbacks at all layers

**Patterns:**

1. **Build-Time Validation:**
   - `verifyModel()`: Check for duplicate entries, missing required fields, invalid slugs
   - `verifyRenderResult()`: Ensure all pages generated, no HTML parsing errors
   - Location: `utils/build/verify.mjs`

2. **Client-Side Validation:**
   - Missing DOM elements: Scripts check for null before accessing (e.g., `if (!searchInput) return`)
   - JSON parse failures: Try-catch blocks in localStorage access (e.g., `readFavorites()`)
   - SVG asset failures: Service worker catches 404, returns offline message

3. **Asset Fallbacks:**
   - Emoji SVGs: If CDN fails, serve from local `/assets/emoji/base/` directory
   - If both fail: Display fallback Unicode emoji character from DOM
   - Location: `home-app.mjs` and generated pages use data attributes for fallback values

4. **Offline Mode:**
   - Service worker caches core pages and assets
   - Emoji SVGs fetched with cache-first strategy
   - Failed requests return generic offline message rather than breaking page

## Cross-Cutting Concerns

**Logging:** Console logging in build process only (progress bars, phase output). Minimal client-side logging. No external logging service.

**Validation:**
- Build time: Data model verification, link checking, accessibility smoke tests
- Client time: DOM element existence checks, localStorage safety

**Analytics:** Plausible.io integration via script tag (opt-in, privacy-focused)
- Events tracked: favorite_add, favorite_remove, copy, visit detail, theme change
- No PII collected
- Configuration: `utils/site.config.json` analytics section

**Accessibility:**
- Semantic HTML with proper ARIA labels
- Focus management in modals and interactive elements
- High contrast theme support
- Keyboard navigation throughout
- Alt text for images and emoji descriptions
- Role attributes on buttons and interactive regions

**SEO:**
- JSON-LD structured data on every page (Organization, WebSite, BreadcrumbList, DefinedTerm)
- OpenGraph and Twitter Card meta tags
- Canonical URLs to prevent duplicate content
- Sitemaps split by type (core pages, emoji detail pages)
- robots.txt with sitemap index

**Performance:**
- Static site (no server compute)
- Service worker precaching of critical assets
- Lazy loading for emoji SVG assets
- Deferred script loading where possible
- No external dependencies except analytics and CDN fonts

---

*Architecture analysis: 2026-03-03*
