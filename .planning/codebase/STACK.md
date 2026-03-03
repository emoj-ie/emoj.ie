# Technology Stack

**Analysis Date:** 2026-03-03

## Languages

**Primary:**
- JavaScript (ES2024) - Client-side applications and browser APIs
- Node.js ESM Modules (.mjs) - Build and utility scripts

**Secondary:**
- HTML5 - Semantic markup and generated pages
- CSS3 - Styling and design tokens

## Runtime

**Environment:**
- Node.js 20.x (specified in `.github/workflows/site-quality.yml`)

**Package Manager:**
- npm (package.json present)
- Lockfile: Not detected (using npm default)

## Frameworks

**Core:**
- None - This is a static site generator (SSG)

**Browser APIs:**
- Web Storage API (localStorage) - Recents and favorites persistence
- Service Workers - Progressive Web App (PWA) support with offline caching
- Fetch API - Dynamic emoji data loading

**Build/Generation:**
- Custom Node.js build system (`utils/build/index.mjs`) - Generates static HTML pages and JavaScript bundles
- No external build tool (webpack, vite, esbuild) - Pure Node.js module imports

## Key Dependencies

**Critical:**
- playwright 1.58.2 - E2E testing and visual regression baseline generation
- Node.js built-in modules only (`fs/promises`, `path`, `crypto`, `node:test`, `node:assert`)

**Data Sources (embedded, not npm):**
- OpenMoji 15.1.0 - Emoji SVG assets and metadata via jsDelivr CDN
- Unicode Emoji data - Embedded in `grouped-openmoji.json` and `data/emoji-enrichment.json`

## Configuration

**Environment:**
- `utils/site.config.json` - Central site configuration containing:
  - Base URL and SEO metadata
  - Asset paths and CDN template
  - Analytics provider (Plausible)
  - Sitemap and robots.txt settings
  - UI preview limits
  - Indexing rules and redirects

**Build:**
- No `.babelrc`, `webpack.config.js`, or framework config files
- Raw JavaScript modules (ESM) used directly in browser and build
- Python 3 HTTP server for local development (`"serve": "python3 -m http.server 4173"`)

**Environment Variables:**
- Not detected - Configuration is file-based and hardcoded in `utils/site.config.json`

## Platform Requirements

**Development:**
- Node.js 20.x
- Python 3 (for local serving)
- Playwright browser binaries (installed via npm)

**Production:**
- Static file hosting (GitHub Pages - hosted at https://emoj.ie)
- CDN access to jsDelivr (OpenMoji SVGs, Google Fonts)
- Plausible analytics endpoint access

## Build Output

**Generated Files:**
- `/index.html` and category pages - Static HTML with embedded SEO metadata
- `/sw.js` - Service Worker (regenerated per build with cache hash)
- `/generated-pages.js` - Emoji detail page routes and handlers
- `/home-app.mjs` - Home page search and UI logic (ES6 module)
- `/style.css` - Compiled CSS (from `style.css`)
- `robots.txt` and `sitemap.xml` - SEO infrastructure
- `build-manifest.json` - Build metadata (file counts, emoji stats, redirects)
- `/assets/emoji/base/*.svg` - Local emoji SVG copies (from CDN or OpenMoji)

**Manifest Tracking:**
- `build-manifest.json` contains build hash, file inventory, statistics for validation

## Asset Hosting Strategy

**CDN (Primary):**
- jsDelivr: `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/{HEX}.svg`
- Google Fonts: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:...`

**Local Fallback:**
- `/assets/emoji/base/{HEX}.svg` - Ensures offline functionality via Service Worker

**Fonts:**
- Bricolage Grotesque (display), Instrument Sans (body), IBM Plex Mono (code)
- Preconnected via `<link rel="preconnect">` for performance

## Caching & Offline Support

**Service Worker:**
- Cache-first strategy for core assets and emoji SVGs
- Dynamic cache versioning using build hash: `emojie-{buildHash}`
- CORE_ASSETS list in `sw.js` prebaked on install (see `utils/build/sw.mjs`)

**Browser Storage:**
- localStorage for recent emojis (`recentEmojis`)
- localStorage for user preferences (theme, copy mode)

---

*Stack analysis: 2026-03-03*
