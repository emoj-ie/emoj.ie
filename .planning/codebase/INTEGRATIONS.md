# External Integrations

**Analysis Date:** 2026-03-03

## APIs & External Services

**Analytics:**
- Plausible Analytics - User behavior tracking (non-invasive, privacy-focused)
  - Script: `https://plausible.io/js/script.js`
  - Domain: `emoj.ie`
  - Loaded via: `<script defer data-domain="emoj.ie" src="https://plausible.io/js/script.js"></script>` in `index.html`
  - Events tracked: copy, share, theme_toggle, variant_select, search, search_no_results, filter, favorite_add, favorite_remove
  - Configuration: See `utils/site.config.json` - `analytics.enabled: true`

**Emoji Data:**
- OpenMoji CDN (jsDelivr)
  - Service: Unicode emoji SVG sprites
  - Version: 15.1.0
  - URL Template: `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/{HEX}.svg`
  - Fallback: Local copies downloaded to `/assets/emoji/base/{HEX}.svg`
  - Implementation: `utils/build/emoji-assets.mjs` handles download and retry logic

**Typography:**
- Google Fonts
  - Families: Bricolage Grotesque, Instrument Sans, IBM Plex Mono
  - URL: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:...`
  - Preconnect: Yes (performance optimization)

## Data Storage

**Databases:**
- None - Fully static site

**File Storage:**
- GitHub Pages (public repository)
- Local filesystem for generated pages and assets
- jsDelivr CDN for emoji SVG distribution

**Caching:**
- Browser Service Worker cache (see `sw.js`)
- CDN cache via jsDelivr edge network

## Local Data Assets

**Embedded Emoji Data:**
- `grouped-openmoji.json` - Master emoji catalog organized by group/subgroup
  - Loaded by home app (`home-app.mjs`)
  - Loaded by generated pages script (`generated-pages.js`)
  - Format: JSON object with group > subgroup > emoji array hierarchy

**Enrichment Data:**
- `data/emoji-enrichment.json` - Additional emoji metadata (searchable keywords, alternative names)
  - Built by: `utils/data/build-enrichment.mjs`
  - Used for: Full-text search and semantic discovery

**Mapping Data:**
- `data/twemoji-map.json` - Fallback emoji variant mappings
  - Used for: Skin tone and variant selection logic

**Editorial Data:**
- `daily-emoji.json` - Daily featured emoji selection
  - Built by: `utils/build/daily-emoji-editorial.mjs`
- `about-data.json` - About page content and messaging

## Authentication & Identity

**Auth Provider:**
- None - Public, unauthenticated site
- No user accounts or login required

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Build logs: Emitted during `npm run build` to stdout/stderr
- Analytics: Plausible provides dashboard at https://plausible.io/emoj.ie
- Browser console: Conditional logging in development

**Build Diagnostics:**
- `emoji-diagnostics.js` - Runtime validation and reporting
- `build-manifest.json` - Build stats and file inventory for CI verification

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static file hosting)
- Custom domain: emoj.ie (CNAME configured)

**CI Pipeline:**
- GitHub Actions workflow: `.github/workflows/site-quality.yml`
- Triggers: Push to main, pull requests
- Node.js 20 environment
- Steps:
  1. Build check: `npm run build:check`
  2. Unit & integration tests: `npm test`
  3. Link validation: `npm run lint:links`
  4. Accessibility audit: `npm run test:a11y-smoke`
  5. Visual regression: `npm run test:playwright-smoke`
  6. Performance budgets: `npm run test:lighthouse-budget`

**Build Artifacts:**
- Static HTML/CSS/JS files
- Service Worker with cache versioning
- Sitemap and robots.txt for SEO
- Emoji asset inventory

## Environment Configuration

**Required env vars:**
- None - Site is fully static and configuration-file driven

**Configuration Files:**
- `utils/site.config.json` - Master config (site metadata, paths, analytics, assets, indexing)

**Secrets location:**
- No secrets stored in repo (GitHub Pages handles deployment authentication)
- Plausible API key not in codebase (configured at plausible.io)

## Webhooks & Callbacks

**Incoming:**
- GitHub webhook: Triggers CI/CD on push to main

**Outgoing:**
- Plausible event submissions: Browser-side POST to Plausible API
  - Event types: copy, search, filter, variant, share, theme toggle, favorites
  - Properties: hex (emoji code), group, subgroup, format, source, query metrics

## Cross-Domain Requests

**CORS / Preconnect:**
- jsDelivr emoji CDN: `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />`
- Google Fonts: `<link rel="preconnect" href="https://fonts.googleapis.com" />`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`
- Plausible: Script loaded directly (no CORS needed)

## Build-Time Integrations

**OpenMoji Download:**
- `utils/build/emoji-assets.mjs` downloads emoji SVGs during build
- Retries on failure (2 attempts + initial)
- 15-second timeout per download
- Populates: `/assets/emoji/base/{HEX}.svg`

**Link Validation:**
- `utils/qa/check-links.mjs` validates all internal/external links in generated HTML
- Used in CI: `npm run lint:links`

**Lighthouse Testing:**
- `utils/qa/lighthouse-budget.mjs` runs performance budgets
- Ensures page load and rendering metrics stay under thresholds

**Playwright Baseline:**
- `utils/qa/playwright-baseline.mjs` generates visual regression baselines
- `utils/qa/playwright-smoke.mjs` runs headless browser smoke tests

---

*Integration audit: 2026-03-03*
