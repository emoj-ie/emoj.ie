---
phase: 01-astro-migration
plan: 02
subsystem: pages
tags: [astro, getStaticPaths, data-slicing, seo, json-ld, breadcrumbs, opengraph]

# Dependency graph
requires:
  - phase: 01-01
    provides: Astro scaffold, data pipeline, BaseLayout, SEO utilities, slug system
provides:
  - All page routes: home, 12 category hubs, 122 subgroup listings, 2232 emoji detail pages, 404
  - Shared layout components: Header, Footer, Breadcrumbs, EmojiImage, SEOHead
  - Build-time data slicing via getStaticPaths (ARCH-05)
  - Full SEO parity: JSON-LD, OpenGraph, canonical URLs, breadcrumbs on all pages
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [getStaticPaths data slicing per page type, Breadcrumbs component with inline JSON-LD, EmojiImage with local/CDN fallback]

key-files:
  created:
    - astro-site/src/components/layout/Header.astro
    - astro-site/src/components/layout/Footer.astro
    - astro-site/src/components/layout/Breadcrumbs.astro
    - astro-site/src/components/layout/EmojiImage.astro
    - astro-site/src/components/layout/SEOHead.astro
    - astro-site/src/pages/404.astro
    - astro-site/src/pages/[category]/index.astro
    - astro-site/src/pages/[category]/[subgroup]/index.astro
    - astro-site/src/pages/emoji/[slug].astro
  modified:
    - astro-site/src/pages/index.astro
    - astro-site/src/lib/data/load-emoji.ts

key-decisions:
  - "Breadcrumbs component renders its own JSON-LD BreadcrumbList inline to avoid duplication with page-level jsonLd prop"
  - "Home page shows 9 browsable categories (excludes component, extras-openmoji, extras-unicode)"
  - "Detail pages pass emoji + variants as props (ARCH-05 slicing) -- no full model on any page"
  - "Fixed skin tone variant classification: skintone_combination indicates support, not that the emoji IS a variant"

patterns-established:
  - "Page route pattern: getStaticPaths loads model once, slices data per page in the return"
  - "Layout composition: Header + Breadcrumbs + main content + Footer used on all pages"
  - "EmojiImage component: hex-based src with data-cdn-src fallback attribute"
  - "Category page preview: first 24 non-variant emojis per subgroup"

requirements-completed: [ARCH-05]

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 1 Plan 02: Page Routes with getStaticPaths and Data Slicing Summary

**2368 static pages generated from Astro getStaticPaths with build-time data slicing: home, 12 category hubs, 122 subgroup listings, 2232 emoji detail pages with JSON-LD and full SEO parity**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T01:35:16Z
- **Completed:** 2026-03-04T01:44:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- All 4 page types generate correctly via getStaticPaths with build-time data slicing (ARCH-05)
- 5 shared layout components created: Header, Footer, Breadcrumbs, EmojiImage, SEOHead
- Full SEO parity: JSON-LD (Organization, DefinedTerm, BreadcrumbList, CollectionPage), OpenGraph, canonical URLs, breadcrumbs on all pages
- Detail pages are 8-12KB (not bloated) -- contain only their own emoji + variants
- Build generates 2368 pages in ~12 seconds (well under 60s target)
- Fixed skin tone variant classification bug that misclassified 161 base emojis as variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared layout components** - `7d6619f286` (feat)
2. **Task 2: Create all page routes with getStaticPaths and data slicing** - `ec9a2e5f51` (feat)

## Files Created/Modified
- `astro-site/src/components/layout/Header.astro` - Site header with logo badge, wordmark, search form placeholder
- `astro-site/src/components/layout/Footer.astro` - Footer with copyright and OpenMoji attribution
- `astro-site/src/components/layout/Breadcrumbs.astro` - Breadcrumb nav with ARIA labels and inline JSON-LD BreadcrumbList
- `astro-site/src/components/layout/EmojiImage.astro` - Emoji SVG image with local/CDN src and data-cdn-src fallback
- `astro-site/src/components/layout/SEOHead.astro` - JSON-LD script tag renderer
- `astro-site/src/pages/index.astro` - Home page with search-first layout and 9 category cards
- `astro-site/src/pages/404.astro` - 404 page with friendly message
- `astro-site/src/pages/[category]/index.astro` - Category hub pages with subgroup previews
- `astro-site/src/pages/[category]/[subgroup]/index.astro` - Subgroup listing pages with emoji grids
- `astro-site/src/pages/emoji/[slug].astro` - Emoji detail pages with copy formats, metadata, variants
- `astro-site/src/lib/data/load-emoji.ts` - Fixed repo root path resolution and skin tone variant classification

## Decisions Made
- Breadcrumbs component renders its own JSON-LD BreadcrumbList inline, avoiding duplicate schemas with the page-level jsonLd prop
- Home page shows 9 browsable categories excluding component (modifier building blocks), extras-openmoji, and extras-unicode -- these groups still have their own hub and subgroup pages
- Fixed repo root path resolution from import.meta.dirname (breaks during Astro build compilation) to process.cwd() (reliable in both dev and build)
- Fixed isSkinToneVariant function: `skintone_combination` field means the emoji supports skin tones, not that it IS a skin tone variant. The `skintone` field with a non-empty value indicates an actual variant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed repo root path resolution for build**
- **Found during:** Task 2
- **Issue:** `import.meta.dirname` resolves to `dist/chunks/` during Astro build, not the source directory. Data files could not be found.
- **Fix:** Replaced with `process.cwd()` which reliably resolves to the astro-site directory during both dev and build.
- **Files modified:** `astro-site/src/lib/data/load-emoji.ts`
- **Verification:** Build completes successfully, all 2368 pages generated
- **Committed in:** ec9a2e5f51 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed skin tone variant classification**
- **Found during:** Task 2
- **Issue:** `isSkinToneVariant()` checked `emoji.skintone_combination` which is truthy for base emojis that support skin tones (e.g., "flexed biceps" has `skintone_combination: "single"`). This caused 161 base emojis to be misclassified as variants, preventing their detail pages from being generated and breaking the variant linkage (skin tone variants could not find their base).
- **Fix:** Changed condition to only check `emoji.skintone` with a non-empty value, which indicates an actual skin tone has been applied.
- **Files modified:** `astro-site/src/lib/data/load-emoji.ts`
- **Verification:** Base emoji count increased from 2071 to 2232. Thumbs up (1F4AA) correctly classified as base. Skin tone variants correctly linked to bases. All 39 existing tests still pass.
- **Committed in:** ec9a2e5f51 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correct page generation. The variant fix is particularly important -- without it, 161 emoji pages would be missing and their variants would not render. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All page routes are generating correctly -- ready for Svelte island components (Plan 01-03)
- Layout components (Header, Footer, Breadcrumbs, EmojiImage) provide the static HTML shell that Plan 03 will upgrade with interactive islands
- Search form in Header is a static placeholder -- Plan 03 replaces it with a hydrated Svelte Search component
- Copy format display on detail pages is static text -- Plan 03 adds click-to-copy via Svelte CopyButton
- Emoji grids on category/subgroup pages are static HTML cards -- Plan 03 may upgrade to Svelte EmojiGrid components

## Self-Check: PASSED

All 11 created/modified files verified present. Both commit hashes verified in git log.

---
*Phase: 01-astro-migration*
*Completed: 2026-03-04*
