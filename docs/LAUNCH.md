# Launch Plan

Last updated: 2026-02-20

## Launch Goal
- Position `emoj.ie` as the fastest and most beautiful way to find, copy, and understand emojis.

## Positioning
- Core line: `Find the right emoji in seconds. Copy it once. Reuse it instantly.`
- Differentiators:
  - local-first recents + favorites,
  - smarter relevance (synonyms + typo tolerance),
  - canonical emoji pages and tag hubs for deep discovery,
  - system-aware theme with polished light and dark UX.

## Audience Segments
- Daily chat/social users who need speed.
- Creators and community managers who need expressive discovery.
- SEO users searching for emoji meanings and related emojis.

## Rollout Timeline
1. T-7 days
   - Final regression pass.
   - Capture screenshots and short demo clips.
   - Prepare launch posts and changelog summary.
2. T-2 days
   - Soft announce to existing audience.
   - Monitor analytics event integrity.
3. Launch day
   - Publish update notes and social posts.
   - Push screenshots/GIF clips.
   - Engage with comments and questions for 24h.
4. T+3 days
   - Publish follow-up improvements and top usage insights.

## Channel Plan
- X/Twitter: short launch thread + 2 follow-up clips.
- LinkedIn: product update post focused on UX and build quality.
- Reddit (relevant communities): practical announcement with feature list.
- Indie directories / launch communities: concise listing and visuals.

## ORB Distribution Mix
- Owned: docs changelog, website release note, email/newsletter.
- Rented: X, LinkedIn, Reddit posts and short clips.
- Borrowed: newsletter swaps, founder shout-outs, and niche community reposts.

## Demo Clip Ideas
- `5-second copy`: query -> result -> copy -> paste.
- `Favorite loop`: star emoji, reload, reuse.
- `Theme cycle`: system default + toggle behavior.
- `Explorer flow`: category -> tag -> canonical emoji page.

## Press Kit Basics
- Logo files (`logo.svg`, PNG variants).
- 6 screenshots (home, search, favorites, detail page, tag page, dark mode).
- 1 short product description (50 words).
- 1 long product description (150 words).

## Release Runbook (Final)
1. Preflight
   - `npm run build`
   - `npm test`
   - `npm run lint:links`
   - `npm run test:a11y-smoke`
   - `npm run test:playwright-smoke`
   - `npm run test:playwright-baseline`
   - `npm run test:lighthouse-budget`
2. Artifact checks
   - verify `sitemap.xml`, `sitemap-core.xml`, `sitemap-emoji.xml`, and `robots.txt`
   - verify canonical links on sample pages (`/emoji/*`, `/category/*`, `/search/*`, `/tag/*`, `/alternatives/*`)
3. Publish
   - push `main` to GitHub Pages source branch
   - wait for Pages build completion
   - smoke-check home + representative routes on production
4. Rollback (if needed)
   - revert to previous known-good commit
   - rebuild and redeploy
   - re-validate sitemap and canonical tags on production

## Release Checklist
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run lint:links`
- [x] `npm run test:a11y-smoke`
- [x] `npm run test:playwright-smoke`
- [x] `npm run test:playwright-baseline`
- [x] `npm run test:lighthouse-budget`
- [ ] Confirm sitemap and canonical routes in production
- [ ] Publish launch + social posts
