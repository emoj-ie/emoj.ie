# Phase 1: Astro Migration - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the entire site from the custom Node.js SSG to Astro 5 with Svelte island components and a build-time data pipeline. All core emoji browsing pages generate from Astro with fresh SEO-optimized URL patterns. At least one interactive element (though scope decided as: all) runs as hydrated Svelte. Detail pages load only their own emoji data; category pages load only their category data. Site deploys to GitHub Pages.

</domain>

<decisions>
## Implementation Decisions

### URL patterns
- Detail pages use slug-only URLs: `/emoji/grinning-face/` (no hex code)
- Slug uniqueness must be handled (duplicates like "man frowning" vs "person frowning" need disambiguation)
- Category hubs at top level: `/smileys-emotion/`
- Subgroup pages nested under category: `/smileys-emotion/face-smiling/` (no `/category/` prefix)
- Skin tone and gender variants do NOT get separate pages — variants live on the base emoji's detail page only
- Home page at `/`

### Svelte island scope
- ALL interactive elements become Svelte islands in Phase 1: search, theme switcher, copy buttons, favorites, skin tone picker
- Emoji grids on category/subgroup pages are full Svelte components (not static HTML with interactive cards)
- Clean break from vanilla JS — no hybrid vanilla/Svelte interactivity

### Page taxonomy
- Keep the 10 Unicode standard categories as top-level navigation
- Keep subgroup pages within categories (one page per Unicode subgroup)
- Home page is search-first: prominent search bar dominates above the fold, category grid is secondary/below fold
- Detail pages maintain full feature parity: big emoji, all copy formats (emoji/unicode/HTML/shortcode), metadata (category, tags, Unicode version), skin tone variants, breadcrumbs

### Content migration scope
- Phase 1 migrates CORE pages only: home, category hubs, subgroup pages, emoji detail pages
- Deferred pages: about, alternatives/competitor comparisons, compare, press-kit, tag, tofu
- Full SEO parity required: JSON-LD structured data, OpenGraph tags, sitemaps, robots.txt
- Service worker deferred — no offline support in Phase 1
- Adapt existing Playwright tests to new URL patterns and selectors (not a fresh test suite)

### Claude's Discretion
- Trailing slash convention (likely trailing slashes for Astro + GitHub Pages)
- Search implementation approach — port existing algorithm or rebuild in Svelte
- Search data optimization deferred to Phase 3 (keep loading full JSON for now)

</decisions>

<specifics>
## Specific Ideas

- Search-first home page reflects the core value: "find it, copy it, done" — search is the hero interaction
- Slug-only URLs chosen for shareability and cleanliness (e.g., sharing `/emoji/grinning-face/` vs `/emoji/grinning-face--1f600/`)
- Full Svelte grid chosen to maximize flexibility for Phase 2/3 animation and interaction work
- All interactive elements as Svelte from day one means no vanilla JS technical debt to clean up later

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `utils/build/load-data.mjs`: Data loading and emoji model building — core logic can be adapted for Astro's data pipeline
- `utils/build/slug.mjs`: Slug generation utilities — will need adaptation for slug-only URLs (uniqueness handling)
- `home-search.mjs`: Search tokenization and ranking algorithm — candidate for porting to Svelte component
- `home-utils.mjs`: Copy format functions (`formatCopyValue`, `COPY_MODES`) — port to Svelte utilities
- `utils/site.config.json`: Central configuration — can inform Astro config

### Established Patterns
- Build-time HTML generation with inline JSON data — maps naturally to Astro's static generation
- localStorage for state persistence (favorites, recents, theme, copy mode, skin tone) — port to Svelte stores
- SEO pattern: JSON-LD per page type (Organization, WebSite, BreadcrumbList, DefinedTerm) — reproduce in Astro layouts
- OpenMoji SVGs via jsDelivr CDN with local fallback — keep this asset strategy

### Integration Points
- `grouped-openmoji.json` + `data/emoji-enrichment.json`: Primary data sources for the build pipeline
- GitHub Pages deployment via GitHub Actions (`.github/workflows/site-quality.yml`)
- Plausible analytics script tag integration
- Google Fonts (Bricolage Grotesque, Instrument Sans, IBM Plex Mono) via CDN

</code_context>

<deferred>
## Deferred Ideas

- Service worker / offline support — add back after core migration is stable
- Supplementary pages (about, alternatives, compare, press-kit, tag, tofu) — migrate in a later phase or as needed
- Search data optimization (pre-built index, lighter payload) — Phase 3 (NAV-02: semantic search)

</deferred>

---

*Phase: 01-astro-migration*
*Context gathered: 2026-03-03*
