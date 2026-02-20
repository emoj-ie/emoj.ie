# Competitor Research Log

Last updated: 2026-02-20

## Scope
- Benchmark top emoji websites/tools and platform emoji pickers.
- Evaluate information architecture, find/copy UX, accessibility, mobile ergonomics, SEO surface area, and performance patterns.

## Sources
- https://emojipedia.org/
- https://emojipedia.org/sitemap.xml
- https://getemoji.com/
- https://findemoji.io/
- https://findemoji.io/sitemap.xml
- https://support.apple.com/en-vn/guide/mac-help/mchlp1560/mac
- https://support.microsoft.com/en-au/windows/windows-keyboard-tips-and-tricks-d2e05e95-75ff-4cd3-8b55-e3c78050e0c2
- https://unicode.org/emoji/charts/full-emoji-list.html
- https://unicode.org/Public/emoji/16.0/emoji-test.txt
- https://raw.githubusercontent.com/jdecked/twemoji/main/README.md

## Research Matrix
| Competitor | Core IA | Search UX | Copy Flow | Accessibility | Mobile UX | SEO Structure | Speed Notes |
|---|---|---|---|---|---|---|---|
| Emojipedia | Home + category hubs + emoji detail + editorial + stickers/tools | Prominent global search, topical/event surfaces | Multi-context copy and deep detail context | Good labeling and structured content patterns | Large, content-rich mobile experience | Large multilingual sitemap split by locale and content type (`emoji`, `unicode`, `vendor`, `static-content`) | Heavy homepage (high script count and payload) |
| GetEmoji | Category sections in long single-page style + utility widgets | Search-like browsing via categorized blocks | Direct click-to-copy emphasis, low learning curve | Simpler semantics, fewer deep page cues | Works well for quick copy on mobile | Limited visible SEO architecture depth | Significantly larger payload than emoj.ie |
| FindEmoji | Category routes + emoji detail routes + blog/about | Search and category exploration | Straightforward copy/share on detail pages | Modern app shell with route structure; details vary by screen reader semantics | Responsive UI with app-style interactions | Large emoji route footprint in sitemap (`/emoji/*`) | App-heavy shell and larger script footprint |
| macOS Emoji Viewer | System picker with categories, search, and recents | Fast local search in OS-level picker | Insert/copy via native input flow | Native accessibility support | N/A (desktop OS) | N/A | Native performance baseline |
| Windows Emoji Panel | OS panel with emojis + GIFs + symbols + clipboard history | Fast invocation via keyboard and recent reuse | Native insert/copy flow | Native accessibility support | N/A (desktop OS) | N/A | Native performance baseline |

## What They Do Well
- Competitors that win are optimized for "time-to-first-copy" above everything else.
- Strong properties expose many indexable and internally linked detail pages.
- Best experiences combine direct copy action with context (meaning, related, platform variants).
- OS pickers set user expectations for keyboard-first and recent/favorite recall.
- Broad topical surfaces (events, trends, categories) create repeat visits and SEO breadth.

## What They Do Poorly
- Many competitors are visually generic or ad-heavy despite large traffic.
- Large JS/script footprints and dense pages can reduce responsiveness on low-end mobile.
- Some tools are excellent for copy but weak for semantic discovery and education.
- Some tools have shallow SEO architecture (few high-quality hub pages, weak internal taxonomy).
- Theming and contrast consistency are often uneven across light/dark states.

## Opportunities For emoj.ie
- Keep static-first speed advantage while increasing perceived richness through smarter relevance and UX polish.
- Build a distinctive, memorable design direction (not template-looking SaaS UI).
- Add local-first favorites in addition to recents to match OS picker habits.
- Improve search ranking quality with typo tolerance and synonym mapping.
- Expand useful route types: canonical emoji routes, category/tag hubs, and high-value related links.
- Increase detail page utility (meaning, keywords, variations, similar emojis, quick copy formats).
- Enrich data pipeline with additional open sources (Unicode data + CLDR keywords + optional Twemoji metadata mapping).
- Capture competitor-intent queries with honest alternatives/comparison pages.

## Backlog Candidates
- [x] Sync opportunities to prioritized backlog in `docs/PROJECT.md`.
- [x] Add relevance scoring model (exact > prefix > token > fuzzy) for home search.
- [x] Add favorites rail with local persistence and keyboard actions.
- [x] Add canonical `/emoji/{slug}` route layer with redirects from legacy patterns.
- [x] Add tag taxonomy pages only for meaningful, differentiated clusters.
- [x] Enrich detail-page content blocks while preserving low HTML/CSS/JS overhead.
- [x] Add competitor alternatives pages with honest fit guidance.

## Quantitative Snapshot (Observed)
- `emoj.ie` homepage HTML payload (raw): ~8 KB
- `emojipedia.org` homepage HTML payload (raw): ~215 KB
- `getemoji.com` homepage HTML payload (raw): ~242 KB
- `findemoji.io` homepage HTML payload (raw): ~390 KB
- Script tags observed on homepage:
  - `emoj.ie`: 5
  - `emojipedia.org`: 62
  - `getemoji.com`: 20
  - `findemoji.io`: 29

## Assumptions
- Research will prioritize direct emoji utilities first, then adjacent pickers (OS/browser ecosystem).
