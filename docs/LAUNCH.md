# Launch Plan

Last updated: 2026-02-27

## Launch Goal
- Position `emoj.ie` as the fastest and most distinctive emoji workflow site for search, copy, and reuse.

## Positioning Spine
- Core line: `Find the right emoji in seconds. Copy it once. Reuse it instantly.`
- Supporting proof:
  - Local-first recents + favorites (no account required)
  - Ranked search (synonyms + typo tolerance)
  - Useful indexable routes (`/emoji`, `/category`, `/tag`, `/search`, `/alternatives`)
  - Distinctive, high-contrast visual language in light and dark themes

## Launch Narrative (Use This Order)
1. The problem: emoji discovery is either fast-but-shallow or rich-but-slow.
2. The approach: static-first speed + quality route architecture + local workflow memory.
3. The outcomes: faster copy loops, better confidence on meaning, less repeat search.
4. The proof: test gates, route depth, and visible workflow demos.

## Audience Segments
- Daily writers, chat-heavy users, and social managers who care about speed.
- Creators who need related options and meaning context before publishing.
- Organic search users looking for emoji meaning, categories, and alternatives.

## Conversion Events To Watch
- `copy`
- `search`
- `search_no_results`
- `filter`
- `favorite_add` / `favorite_remove`
- `recent_reuse`
- `share`
- `theme_toggle`

## Success Targets (First 14 Days)
- Increase `copy` events per session by >= 15%.
- Increase `favorite_add` rate by >= 20%.
- Reduce `search_no_results` rate by >= 20%.
- Keep baseline quality gates at 100% pass rate before every release.
- Grow organic entrances to `/emoji/*`, `/category/*`, and `/alternatives/*`.

## Feature Payload For This Launch
- URL-shareable search state on home.
- Dedicated `search_no_results` analytics event and privacy-safe query-shape properties.
- Expanded schema coverage (`ItemList`, `FAQPage`, richer home `Organization` graph links).
- Better homepage value-proposition copy and quick-path navigation.
- Search relevance improvements:
  - 2-character high-intent prefix support (`ex` -> exclamation results)
  - transposition typo matching (`fier` -> fire)
  - vowel-drop matching (`smly` -> smiley)

## Rollout Timeline
1. T-7 days
   - Final regression pass and artifact checks
   - Capture fresh screenshots and short workflow clips
   - Finalize launch copy and social calendar
2. T-2 days
   - Soft publish to existing audience and gather UX feedback
   - Verify analytics event integrity in production
3. Launch day
   - Publish release notes + changelog summary
   - Publish social assets across X, LinkedIn, and Reddit
   - Engage in comments for 24h and collect objections
4. T+3 to T+14
   - Post 3 focused follow-up demos (search quality, favorites loop, alternatives pages)
   - Ship fast fixes for repeated feedback points

## Channel Strategy (ORB)
- Owned:
  - Website changelog update
  - Email/newsletter note
  - On-site release summary block
- Rented:
  - X thread + follow-up clips
  - LinkedIn launch post + case-study follow-up
  - Reddit practical launch post in relevant communities
- Borrowed:
  - Founder network reposts
  - Newsletter swaps with productivity/creator communities

## Asset Checklist
- [x] 6 updated screenshots (home, detail, categories, alternatives, light, dark)  
  Location: `press-kit/screenshots/`
- [x] 3 short demo clips (<= 20s)  
  Location: `press-kit/clips/`
- [x] 50-word and 150-word product summaries  
  Location: `docs/launch/PRODUCT_SUMMARIES.md`
- [x] Social copy pack for X/LinkedIn/Reddit  
  Location: `docs/launch/SOCIAL_COPY_PACK.md`
- [x] Press-kit folder with logo + screenshots + descriptors  
  Location: `press-kit/README.md`, `press-kit/logos/`

Generation command:
- `npm run launch:assets`

## Release Runbook
1. Preflight
   - `npm run build`
   - `npm test`
   - `npm run lint:links`
   - `npm run test:a11y-smoke`
   - `npm run test:playwright-smoke`
   - `npm run test:playwright-baseline`
   - `npm run test:lighthouse-budget`
2. Artifact checks
   - Validate `sitemap.xml`, `sitemap-core.xml`, `sitemap-emoji.xml`, `robots.txt`
   - Validate canonical tags on sample `/emoji`, `/category`, `/search`, `/tag`, `/alternatives` pages
3. Publish
   - Push to `main` (GitHub Pages source)
   - Wait for Pages build completion
   - Run production smoke checks on representative routes
4. Rollback (if needed)
   - Revert to previous known-good commit
   - Rebuild/redeploy
   - Revalidate sitemap + canonical tags

## Post-Launch Review
- What messages produced the highest `copy` and `favorite_add` lift?
- Which traffic source drove the highest-quality sessions?
- Which page templates had high bounce + low copy rates?
- Which objections repeated most in comments/feedback?
