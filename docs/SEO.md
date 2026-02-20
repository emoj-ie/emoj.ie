# SEO Strategy And Programmatic Plan

Last updated: 2026-02-20

## Objectives
- Capture high-intent emoji search demand with useful, non-thin pages.
- Improve crawlability and metadata quality across generated routes.
- Keep SEO changes aligned with performance and accessibility budgets.
- Keep content English-first in this phase to maximize quality depth and editorial consistency.

## Planned Page Types
- [x] `/emoji/{slug}` canonical detail routes with meaning, keywords, variants, and related emojis
- [x] `/category/{name}` category hubs with descriptive context and browse UX
- [x] `/tag/{tag}` tag hubs with curated explanations
- [x] `/search/{term}` pages only when quality threshold and uniqueness are met
- [x] `/alternatives/{competitor}` pages for competitor-intent comparisons
- [x] `/about` and lightweight help content for trust and query coverage

## Current Inventory Snapshot
| Type | Count | Source Data | Canonical Rule | Indexing Rule | Notes |
|---|---:|---|---|---|---|
| Home | 1 | Static template | self-canonical | index | existing |
| Core routes | 252 | generated | self-canonical | mixed | from `sitemap-core.xml` |
| Emoji detail routes | 2062 | `home-data.json` + sources | canonical to `/emoji/*` routes | index/noindex split | from `sitemap-emoji.xml` |
| Category routes | 13 (index + 12 groups) | grouped data | self-canonical | index/noindex split | canonical browse layer implemented |
| Subcategory routes | 120+ | grouped data | self-canonical | index/noindex split | existing |
| Tag routes | 97 (incl. index) | derived tags (`tags`, `openmoji_tags`, annotations) | self-canonical | index | expanded via enrichment baseline |
| Search term routes | 17 (index + 16 curated terms) | curated keyword topics + tags + annotations | self-canonical | index | quality-threshold gated generation |
| Competitor alternatives | 4 (index + 3 pages) | curated editorial comparisons | self-canonical | index | implemented |

## Technical SEO Checklist
- [x] Validate canonical tags on all indexable pages
- [x] Ensure structured data coverage (WebSite, Organization, and page-specific schema)
- [x] Generate and validate sitemap index + child sitemaps
- [x] Confirm `robots.txt` policy and no accidental blocks
- [x] Add tests for metadata presence and sitemap validity
- [x] Add validation for canonical `/emoji/{slug}` alias behavior and redirect health
- [x] Add validation for canonical `/category/{name}` alias behavior
- [x] Add validation for curated `/search/{term}` route generation and metadata
- [x] Add internal link graph checks (home -> category -> subcategory -> detail -> related)

## Programmatic SEO Quality Gates
- A generated page must answer a distinct user intent in under 5 seconds.
- Each indexable route must have unique H1, description, and primary content block.
- Tag/search pages are indexable only when they meet minimum content and engagement thresholds.
- No pages generated only from keyword permutations without unique utility.

## Route Strategy (Draft)
- Keep existing stable detail routes to preserve backlink equity.
- Add canonical short emoji route (`/emoji/{slug}--{hex}`) while preserving legacy detail routes for compatibility.
- Add canonical category route (`/category/{name}`) while preserving legacy group routes as noindex aliases.
- Add tag pages from curated taxonomy (not raw every-token generation).
- Generate only curated, high-quality search-topic pages under `/search/{term}` with minimum match and diversity thresholds.
- Add competitor alternatives index and comparison pages under `/alternatives/*` with honest fit guidance.

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

## Content Quality Guardrails
- No doorway pages
- No near-duplicate pages with only token swaps
- Require unique utility per generated route

## Assumptions
- Existing sitemap split (`sitemap-core.xml`, `sitemap-emoji.xml`) remains foundation.
