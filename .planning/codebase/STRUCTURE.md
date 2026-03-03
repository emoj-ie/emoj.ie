# Codebase Structure

**Analysis Date:** 2026-03-03

## Directory Layout

```
emoj.ie/
├── utils/                       # Build and QA utilities (Node.js scripts)
│   ├── build/                   # Build pipeline (generates site)
│   ├── data/                    # Data enrichment scripts
│   ├── qa/                      # Quality assurance and testing tools
│   └── site.config.json         # Build configuration
├── tests/                       # Test suite (phase-based testing)
├── data/                        # Generated data artifacts (JSON)
├── assets/                      # Static assets (images, emoji SVGs)
├── docs/                        # Documentation and guides
├── [category-dirs]/             # Generated category pages
│   ├── smileys-emotion/         # Category hub pages
│   ├── animals-nature/
│   ├── food-drink/
│   └── ... (10 total category groups)
├── emoji/                       # Generated detail pages (2000+ subdirs)
│   └── [emoji-slug]--[hex]/
│       └── index.html
├── category/                    # Category subgroup pages
│   ├── smileys-emotion/
│   │   ├── face-smiling/
│   │   └── ... (subgroups)
│   └── ... (all categories)
├── alternatives/                # Competitor comparison pages
│   ├── emojipedia/
│   ├── getemoji/
│   └── findemoji/
├── compare/                     # Side-by-side comparisons
│   └── [service1]-vs-[service2]/
├── about/                       # About and help pages
├── activities/                  # Activity category hubs
├── animals-nature/              # Nature category hubs
├── component/                   # Component (skin tone) category
├── extras-openmoji/             # Extended emoji category
├── extras-unicode/              # Unicode extra symbols
├── flags/                       # Flag category hubs
├── food-drink/                  # Food/drink category hubs
├── objects/                     # Objects category hubs
├── people-body/                 # People category hubs
├── smileys-emotion/             # Smileys category hubs
├── symbols/                     # Symbols category hubs
├── travel-places/               # Travel category hubs
├── *.mjs                        # Client runtime modules
│   ├── home-app.mjs             # Home page interactivity
│   ├── home-search.mjs          # Search engine
│   ├── home-utils.mjs           # Shared utilities
│   ├── detail-page.js           # Detail page logic
│   ├── generated-pages.js       # Shared page logic
│   └── script.js                # Global initialization
├── sw.js                        # Service worker (generated)
├── *.json                       # Generated data files
│   ├── grouped-openmoji.json    # Full emoji catalog
│   ├── home-data.json           # Home page data
│   ├── daily-emoji.json         # Daily emoji of the day
│   ├── about-data.json          # About page content
│   ├── build-manifest.json      # Build metadata and file listing
│   └── ... (other generated artifacts)
├── *.css                        # Stylesheets
├── *.html                       # Generated page templates
│   ├── index.html               # Home page
│   └── about/index.html
├── package.json                 # NPM project metadata
└── [other-files]                # Icons, config, metadata
```

## Directory Purposes

**utils/build/:**
- Purpose: Build pipeline orchestration and page rendering
- Contains: Node.js modules for loading data, rendering HTML/JSON, generating sitemaps, building service workers
- Key files:
  - `index.mjs`: Main build orchestrator, runs 7-9 phases, manages temp workspace
  - `load-data.mjs`: Loads emoji data from JSON, builds model with groups, subgroups, variants, tags
  - `render.mjs`: Generates HTML for all pages (home, detail, categories, comparisons)
  - `slug.mjs`: Utilities for URL-safe slugs and hex normalization
  - `emoji-assets.mjs`: Downloads/caches emoji SVGs locally
  - `redirects.mjs`: Generates legacy redirect pages for old URLs
  - `sitemap.mjs`: Builds XML sitemaps and robots.txt
  - `sw.mjs`: Generates service worker script
  - `verify.mjs`: Validates model and render output

**utils/data/:**
- Purpose: Data enrichment and transformation
- Contains: Scripts for processing emoji metadata from external sources
- Key files:
  - `build-enrichment.mjs`: Builds CLDR keywords and Twemoji mapping data

**utils/qa/:**
- Purpose: Quality assurance, testing, and CI integration
- Contains: Lighthouse, Playwright, and link checking utilities
- Key files:
  - `playwright-smoke.mjs`: Browser automation smoke tests
  - `playwright-baseline.mjs`: Screenshot baseline captures
  - `lighthouse-budget.mjs`: Performance budget checks
  - `check-links.mjs`: Validates all internal and external links
  - `generate-launch-assets.mjs`: Creates social media preview images

**tests/:**
- Purpose: Phase-based test suites validating build output and functionality
- Contains: Node.js test files using native assert module
- Key files:
  - `phase1-generator.test.mjs`: Validates build generation (manifests, sitemaps, detail pages)
  - `phase2-home-utils.test.mjs`: Tests home page utilities (slugs, state parsing)
  - `phase3-accessibility-style.test.mjs`: a11y validation and CSS parsing
  - `phase4-seo-schema.test.mjs`: JSON-LD and SEO metadata validation
  - `phase5-sw-assets.test.mjs`: Service worker and caching logic
  - `phase6-analytics-ci.test.mjs`: Analytics integration and CI metadata
  - `phase7-ux-performance.test.mjs`: UX features, performance targets
  - `home-search.test.mjs`: Search functionality and ranking

**data/:**
- Purpose: Generated JSON artifacts containing emoji metadata
- Contains: Build-time generated files (not committed)
- Key files:
  - `emoji-enrichment.json`: CLDR names, keywords, and metadata per emoji
  - `twemoji-map.json`: Twemoji SVG URL mappings

**assets/emoji/base/:**
- Purpose: Locally cached emoji SVG files
- Contains: One SVG per emoji (3000+), downloaded during build
- Pattern: Files named by uppercase hex code (e.g., `1F600.svg` for 😀)
- Generated: During `npm run build` with `--refresh-assets` flag

**[category]/:**
- Purpose: Category hub pages with group overview and subgroup navigation
- Contains: Generated `index.html` files for each emoji category
- Pattern: `/smileys-emotion/`, `/animals-nature/`, `/food-drink/`, etc. (10 main categories)
- Generated: During render phase

**category/[category]/[subgroup]/:**
- Purpose: Subgroup detail pages showing all emojis in a subcategory
- Contains: HTML pages listing emojis in each subgroup
- Pattern: `/category/smileys-emotion/face-smiling/`, `/category/food-drink/fruit/`, etc.
- Generated: During render phase

**emoji/[slug]--[hex]/:
- Purpose: Emoji detail pages with copy functionality and metadata
- Contains: One `index.html` per emoji with all copy formats and structured data
- Pattern: `/emoji/grinning-face--1f600/`, `/emoji/family-man-woman-girl-boy--1f468-200d-1f469-200d-1f467-200d-1f466/`
- Count: 2000+ detail pages
- Generated: During render phase

**alternatives/ and compare/:**
- Purpose: Competitive analysis pages comparing emoj.ie to other emoji sites
- Contains: Structured comparison pages (why switch, strengths, weaknesses)
- Key pages: Emojipedia, GetEmoji, FindEmoji comparisons
- Generated: During render phase

## Key File Locations

**Entry Points:**

- **Build Entry:** `utils/build/index.mjs` - Run via `npm run build`
- **Home Page:** `/index.html` (generated)
- **Detail Page:** `/emoji/[slug]--[hex]/index.html` (generated for each emoji)
- **Category Hub:** `/[category]/index.html` (e.g., `/smileys-emotion/index.html`)
- **Category Subgroup:** `/category/[category]/[subgroup]/index.html`

**Configuration:**

- `utils/site.config.json` - Central configuration for paths, URLs, indexing, analytics
- `package.json` - NPM scripts and metadata

**Core Logic:**

- `utils/build/index.mjs` - Build orchestration and phase management
- `utils/build/load-data.mjs` - Data model building (groups, subgroups, variants)
- `utils/build/render.mjs` - HTML generation for all page types
- `utils/build/slug.mjs` - URL slug and hex normalization utilities
- `home-app.mjs` - Home page interactivity (search, filters, favorites)
- `home-search.mjs` - Search engine with tokenization and ranking
- `home-utils.mjs` - Shared utilities (copy modes, UI state parsing)
- `detail-page.js` - Detail page breadcrumbs and analytics
- `generated-pages.js` - Shared interactivity (favorites, theme switching)
- `script.js` - Global initialization and theme detection

**Testing:**

- `tests/phase[N]-*.test.mjs` - Test files organized by phase/feature
- `tests/home-search.test.mjs` - Search-specific tests

## Naming Conventions

**Files:**

- `.mjs`: ES6 modules (build-time and runtime client code)
- `.js`: Vanilla JavaScript (legacy or client runtime)
- `.json`: Data files (configuration, generated data)
- `.css`: Stylesheets
- `.html`: HTML templates (generated or static)
- `.test.mjs`: Test files (Node.js native test runner)

**Directories:**

- `utils/[purpose]/`: Utility scripts organized by purpose (build, data, qa)
- `[category-name]/`: Category hubs (kebab-case, matches emoji group names)
- `emoji/[slug]--[hex]/`: Detail page directories (slug derived from annotation, hex code suffix)
- `category/[category]/[subgroup]/`: Subgroup pages (parallel structure to emoji groups)

**Variables & Functions:**

- camelCase: All functions, variables, and method names
- UPPER_SNAKE_CASE: Constants (e.g., `CACHE_NAME`, `COPY_MODES`, `SEARCH_DEBOUNCE_MS`)
- kebab-case: URLs, routes, slugs, group/subgroup names (e.g., `smileys-emotion`, `face-smiling`)
- Data keys: Use standard property names (e.g., `emoji`, `annotation`, `hexcode`, `group`, `subgroup`, `tags`)

**HTML Classes & Attributes:**

- `.page-[type]`: Page type indicator (e.g., `page-home`, `page-detail`)
- `.panel-*`: Panel/card component classes
- `.emoji-*`: Emoji-specific component classes
- `data-*`: Data attributes for JavaScript access (e.g., `data-emoji`, `data-hex`, `data-route`)

## Where to Add New Code

**New Feature (Search, Filtering, Copy Modes):**
- Primary code: `home-app.mjs` (client logic) or `home-search.mjs` (search-specific)
- Tests: `tests/phase2-home-utils.test.mjs` or new phase test
- Build changes: Likely in `utils/build/render.mjs` for HTML generation

**New Emoji Category or Subgroup:**
- Data model: Handled by `load-data.mjs` from source `grouped-openmoji.json`
- Pages generated: Automatically during render phase via `render.mjs`
- No new files needed unless custom content required

**New Page Type (e.g., Browse by Tag):**
- Build logic: Add to `utils/build/render.mjs` (new render function)
- Routing: Add route pattern in build output and service worker
- Client logic: Create new `[feature]-page.js` if significant interactivity needed
- HTML template: Inline in render function or create template file

**Build Utility or Script:**
- Location: `utils/build/[feature].mjs` for build-time, `utils/qa/[feature].mjs` for QA
- Export: Main functions from module for import in `utils/build/index.mjs`
- Integration: Add phase call in build orchestrator with `advancePhase()` call

**Shared Utility Function:**
- Client-side: `home-utils.mjs` (imported by home-app, detail-page, generated-pages)
- Build-time: Create new file or add to `utils/build/slug.mjs` if normalization-related

**Test for New Feature:**
- New phase: Create `tests/phase[N]-[feature].test.mjs`
- Existing phase: Add test to relevant existing phase file
- Must run with Node.js native test runner: `npm test`

## Special Directories

**Temporary Build Directory (.build-tmp):**
- Purpose: Staging area for generated files before syncing to output root
- Generated: Yes (created fresh each build)
- Committed: No (in .gitignore)
- Cleaned up: After each build completion

**emoji/ (Detail Pages):**
- Purpose: Canonical emoji detail pages with full metadata
- Generated: Yes (all pages created during render phase)
- Committed: Yes (output is committed to repo)
- Count: ~2000+ subdirectories (one per unique emoji)

**category/ (Subgroup Pages):**
- Purpose: Intermediate category structure pages
- Generated: Yes (during render phase)
- Committed: Yes (output is committed to repo)
- Pattern: Mirrors emoji group/subgroup taxonomy

**alternatives/ and compare/:**
- Purpose: Content pages comparing emoj.ie to competitors
- Generated: Yes (during render phase)
- Committed: Yes
- Updatable: Yes (content defined in `render.mjs` COMPETITOR_ALTERNATIVES)

**assets/emoji/base/:**
- Purpose: Local copy of OpenMoji SVGs for offline availability
- Generated: Yes (during build if --refresh-assets flag used)
- Committed: Partially (only base emoji assets, not variants)
- Purpose: Fallback if CDN unavailable, offline service worker caching

**data/:**
- Purpose: Supporting JSON artifacts (not user-facing)
- Generated: Yes (during `npm run build:enrichment`)
- Committed: Yes (required for build process)
- Files: `emoji-enrichment.json`, `twemoji-map.json`

---

*Structure analysis: 2026-03-03*
