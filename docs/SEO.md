# SEO Strategy And Programmatic Plan

Last updated: 2026-02-20

## Objectives
- Capture high-intent emoji search demand with useful, non-thin pages.
- Improve crawlability and metadata quality across generated routes.
- Keep SEO changes aligned with performance and accessibility budgets.

## Planned Page Types
- [ ] `/emoji/{slug}` detail pages with meaning, keywords, variants, and related emojis
- [ ] `/category/{name}` category hubs with descriptive context and browse UX
- [ ] `/tag/{tag}` tag hubs with curated explanations
- [ ] `/search/{term}` pages only when quality threshold and uniqueness are met

## Page Inventory (Template)
| Type | Count | Source Data | Canonical Rule | Indexing Rule | Notes |
|---|---:|---|---|---|---|
| Home | 1 | Static template | self-canonical | index | existing |
| Emoji detail | (tbd) | `home-data.json` + sources | self-canonical | index | existing + planned upgrades |
| Category | (tbd) | grouped data | self-canonical | index | existing + planned upgrades |
| Tag | (tbd) | derived tags | self-canonical | index | planned |
| Search term | (tbd) | query-derived shortlist | canonicalized | conditional | planned |

## Technical SEO Checklist
- [ ] Validate canonical tags on all indexable pages
- [ ] Ensure structured data coverage (WebSite, Organization, and page-specific schema)
- [ ] Generate and validate sitemap index + child sitemaps
- [ ] Confirm `robots.txt` policy and no accidental blocks
- [ ] Add tests for metadata presence and sitemap validity

## Content Quality Guardrails
- No doorway pages
- No near-duplicate pages with only token swaps
- Require unique utility per generated route

## Assumptions
- Existing sitemap split (`sitemap-core.xml`, `sitemap-emoji.xml`) remains foundation.
