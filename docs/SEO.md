# SEO Strategy And Programmatic Plan

Last updated: 2026-02-20

## Objectives
- Capture high-intent emoji search demand with useful, non-thin pages.
- Improve crawlability and metadata quality across generated routes.
- Keep SEO changes aligned with performance and accessibility budgets.
- Keep content English-first in this phase to maximize quality depth and editorial consistency.

## Planned Page Types
- [ ] `/emoji/{slug}` canonical detail routes with meaning, keywords, variants, and related emojis
- [ ] `/category/{name}` category hubs with descriptive context and browse UX
- [ ] `/tag/{tag}` tag hubs with curated explanations
- [ ] `/search/{term}` pages only when quality threshold and uniqueness are met
- [ ] `/about` and lightweight help content for trust and query coverage

## Current Inventory Snapshot
| Type | Count | Source Data | Canonical Rule | Indexing Rule | Notes |
|---|---:|---|---|---|---|
| Home | 1 | Static template | self-canonical | index | existing |
| Core routes | 133 | generated | self-canonical | mixed | from `sitemap-core.xml` |
| Emoji detail routes | 2062 | `home-data.json` + sources | canonical to canonical route | index/noindex split | from `sitemap-emoji.xml` |
| Category routes | 12 groups | grouped data | self-canonical | index/noindex split | existing, improve descriptions |
| Subcategory routes | 120+ | grouped data | self-canonical | index/noindex split | existing |
| Tag routes | 0 | derived tags | self-canonical | index | planned |
| Search term routes | 0 | query-derived shortlist | canonicalized | conditional | planned |

## Technical SEO Checklist
- [ ] Validate canonical tags on all indexable pages
- [ ] Ensure structured data coverage (WebSite, Organization, and page-specific schema)
- [ ] Generate and validate sitemap index + child sitemaps
- [ ] Confirm `robots.txt` policy and no accidental blocks
- [ ] Add tests for metadata presence and sitemap validity
- [ ] Add validation for canonical `/emoji/{slug}` alias behavior and redirect health
- [ ] Add internal link graph checks (home -> category -> subcategory -> detail -> related)

## Programmatic SEO Quality Gates
- A generated page must answer a distinct user intent in under 5 seconds.
- Each indexable route must have unique H1, description, and primary content block.
- Tag/search pages are indexable only when they meet minimum content and engagement thresholds.
- No pages generated only from keyword permutations without unique utility.

## Route Strategy (Draft)
- Keep existing stable detail routes to preserve backlink equity.
- Add canonical short emoji route (`/emoji/{slug}--{hex}`) with permanent redirects from alternates.
- Add tag pages from curated taxonomy (not raw every-token generation).
- Keep search result pages `noindex` by default; selectively index only curated high-value terms.

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
