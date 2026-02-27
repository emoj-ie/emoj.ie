# SEO Strategy And Programmatic Plan

Last updated: 2026-02-27

## Objectives
- Capture high-intent emoji search demand with useful, non-thin pages.
- Improve crawlability and metadata quality across generated routes.
- Keep SEO changes aligned with performance and accessibility budgets.
- Keep content English-first in this phase to maximize quality depth and editorial consistency.

## Planned Page Types
- [x] `/emoji/{slug}` canonical detail routes with meaning, keywords, variants, and related emojis
- [x] `/{group}` canonical category hubs (card-first, minimal copy)
- [x] `/{group}/{subgroup}` canonical subgroup pages (card-first browse and copy)
- [x] `/category/*` compatibility aliases with canonical + `noindex,follow`
- [x] `/tag/{tag}` tag hubs with curated explanations
- [x] `/search/*` compatibility redirects into `/tag/*` where mapped
- [x] `/alternatives/*`, `/vs/*`, `/compare/*` compatibility redirects into `/tag/`
- [x] `/about` and lightweight help content for trust and query coverage

## Current Inventory Snapshot
| Type | Count | Source Data | Canonical Rule | Indexing Rule | Notes |
|---|---:|---|---|---|---|
| Home | 1 | Static template | self-canonical | index | existing |
| Core routes | 252 | generated | self-canonical | mixed | from `sitemap-core.xml` |
| Emoji detail routes | 2062 | `home-data.json` + sources | canonical to `/emoji/*` routes | index/noindex split | from `sitemap-emoji.xml` |
| Category routes | 12 | grouped data | canonical `/{group}/` | index/noindex split | homepage is primary category entry point |
| Subcategory routes | 120+ | grouped data | canonical `/{group}/{subgroup}/` | index/noindex split | progressive list hydration for heavier routes |
| Legacy detail aliases | 2062+ | generated | canonical to `/emoji/*` | noindex | lightweight redirect stubs (not full duplicate detail pages) |
| Legacy category aliases | 120+ | generated | canonical to flat browse routes | noindex | `/category/*` compatibility layer |
| Tag routes | 97 (incl. index) | derived tags (`tags`, `openmoji_tags`, annotations) | self-canonical | index | expanded via enrichment baseline |
| Search compatibility routes | 17 (index + mapped redirects) | topic-to-tag bridge map | canonical to `/tag/*` | noindex | redirect compatibility layer |
| Compare compatibility routes | 3 (index redirects) | static redirect map | canonical to `/tag/` | noindex | `/alternatives`, `/vs`, `/compare` |

## Technical SEO Checklist
- [x] Validate canonical tags on all indexable pages
- [x] Ensure structured data coverage (WebSite, Organization, and page-specific schema)
- [x] Generate and validate sitemap index + child sitemaps
- [x] Confirm `robots.txt` policy and no accidental blocks
- [x] Add tests for metadata presence and sitemap validity
- [x] Add validation for canonical `/emoji/{slug}` alias behavior and redirect health
- [x] Add validation for canonical browse alias behavior (`/category/*` -> flat routes)
- [x] Add validation for `/search/*` compatibility redirects to `/tag/*`
- [x] Add internal link graph checks (home -> category -> subcategory -> detail -> related)

## Programmatic SEO Quality Gates
- A generated page must answer a distinct user intent in under 5 seconds.
- Each indexable route must have unique H1, description, and primary content block.
- Tag pages are indexable only when they meet minimum content and engagement thresholds.
- No pages generated only from keyword permutations without unique utility.

## Route Strategy (Draft)
- Keep canonical emoji detail routes under `/emoji/{slug}--{hex}`.
- Preserve legacy detail routes (`/{group}/{subgroup}/{slug}--{hex}`) as lightweight redirect aliases to canonical emoji pages.
- Keep canonical browse routes flat at `/{group}/` and `/{group}/{subgroup}/`.
- Preserve `/category/*` URLs as compatibility aliases (`noindex,follow`, canonical to flat browse paths).
- Generate tag pages from curated taxonomy (not raw every-token generation).
- Keep `/search/*` as compatibility redirects to tag destinations.
- Keep compare routes as compatibility redirects and keep discovery focused on tags.

## Indexing Policy
- `robots.txt` allows crawling and points to `https://emoj.ie/sitemap.xml`.
- Noindex is still applied where needed at page level (legacy aliases, variants, excluded groups).

## Metadata And Copy Templates (Phase 2)
- Emoji detail title: `{Emoji Name} Emoji Meaning, Copy + Variations | emoj.ie`
- Emoji detail description: `Learn what {Emoji Name} means, copy it in one click, and explore related emojis.`
- Category title: `{Category Name} Emojis: Meaningful Sets To Copy Fast | emoj.ie`
- Category description: `Browse {Category Name} emojis with clear labels and fast copy actions.`
- Tag title: `{Tag Name} Emojis To Copy And Use | emoj.ie`
- Tag description: `Explore {Tag Name} emojis with context and related options.`

## Template Utility Requirements (Current)
- Home: emoji-first 12-card category grid with minimal chrome and fast path into subcategories.
- Category/Tag/Subcategory hubs: card-first browse and copy with progressive hydration for heavier collections.
- Emoji detail: copy actions, usage context, and related links.

## Content Quality Guardrails
- No doorway pages
- No near-duplicate pages with only token swaps
- Require unique utility per generated route

## Assumptions
- Existing sitemap split (`sitemap-core.xml`, `sitemap-emoji.xml`) remains foundation.
