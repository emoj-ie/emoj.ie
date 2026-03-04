# emoj.ie

## What This Is

The best emoji site in the world. A fast, playful, personality-driven emoji reference at emoj.ie — zero friction to find, copy, and enjoy emojis. Designed to be instantly useful for developers who need quick emoji access, and irresistibly fun for kids (ages 5-7) who want to explore and play. Not a utility site — a site with a vibe.

## Core Value

Instant access to any emoji — find it, copy it, done. Everything else serves this: speed, design, and delight all exist to make that moment faster and more enjoyable.

## Requirements

### Validated

- ✓ Category-based browsing (12 categories → subcategories → emoji listings → detail pages) — existing
- ✓ Click-to-copy emoji character — existing
- ✓ Multiple copy formats (emoji, unicode, HTML entity, shortcode) — existing
- ✓ Search with tokenized matching and ranking — existing
- ✓ Skin tone variant access with default skin tone preference — existing
- ✓ Favorites system (up to 40, persisted in localStorage) — existing
- ✓ Recent emojis tracking — existing
- ✓ Dark/light/system theme switching — existing
- ✓ Offline support via service worker — existing
- ✓ SEO with JSON-LD structured data, sitemaps, OpenGraph — existing
- ✓ Privacy-focused analytics (Plausible) — existing
- ✓ PWA support — existing

### Active

- [ ] Playful, kid-appealing visual design — big emojis, bright colors, bouncy interactions
- [ ] Buttery animations and micro-interactions throughout (hover effects, copy feedback, page transitions)
- [ ] Smart search — semantic matching ("happy" finds all happy-related emojis), instant filter, keyboard navigable
- [ ] Emoji of the Day — featured emoji with fun context, refreshes daily
- [ ] Random emoji discovery — surprise me button, serendipitous exploration
- [ ] Emoji collections — curated themed groups (party time, nature walk, food fight)
- [ ] Interactive/animated emoji hover and tap effects — feels like a toy
- [ ] Multi-select emoji builder — tap multiple emojis to build a string, then copy (nice to have)
- [ ] Minimal copy — UI is self-explanatory, plain human language where needed, detailed descriptions below-the-fold
- [ ] Premium feel — "how is this free?" polish level
- [ ] Personality in design — opinionated, memorable, not generic

### Out of Scope

- Ad networks — no programmatic ads, ever. Open to tasteful direct sponsors later
- Merch store — deferred to future milestone. Idea: print-on-demand integration where emoj.ie earns a cut
- AI emoji creator — emojipedia tries too hard with this; not our thing
- Games/quizzes — may revisit later, but v1 discovery features (emoji of the day, random, collections) are enough
- Mobile app — web-first, the site should work beautifully on mobile browsers
- User accounts / login — no need for v1, localStorage handles preferences
- Real-time features — no WebSocket/collaboration needed

## Context

- **Domain**: emoj.ie — premium short domain, the reason this project exists
- **Existing codebase**: Custom Node.js static site generator, ~3500 emojis from OpenMoji, deployed to GitHub Pages
- **Current architecture**: Vanilla JS, no framework. Build-time HTML/JSON generation. Client-side search with in-memory index. Service worker for offline/caching
- **Data source**: OpenMoji 15.1.0 (SVGs via jsDelivr CDN) + Unicode CLDR enrichment data
- **Tech openness**: Open to adopting a framework (Svelte, Astro, etc.) if it helps deliver the vision
- **Target audience**: Developers who need quick emoji access (primary), kids aged 5 and 7 (design appeal target), anyone who uses emojis
- **Competition**: Emojipedia is the reference but tries too hard to be cool. Copy-paste sites are functional but ugly. No one nails fast + personality + fun
- **Monetization vision**: Build something so good it's worth buying. Potential merch revenue later. Direct sponsors welcome. No ad networks

## Constraints

- **Hosting**: GitHub Pages (static files only, no server-side compute)
- **Data**: OpenMoji as primary emoji source — tied to their release cycle and SVG quality
- **Performance**: Must remain fast — no heavy frameworks or large JS bundles that compromise load time
- **Privacy**: No tracking beyond Plausible. No cookies. No user data collection
- **Accessibility**: Must maintain keyboard navigation, screen reader support, high contrast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenMoji as emoji source | Open source, high quality SVGs, consistent style | — Pending |
| Static site on GitHub Pages | Zero hosting cost, fast CDN delivery, simple deployment | — Pending |
| Fresh URL patterns | Site has no meaningful SEO history — start with optimal URL structure | — Pending |
| Minimal copy | UI should speak for itself. Plain human language where text is needed, details below-the-fold | — Pending |
| No ad networks | Preserves UX quality, aligns with "premium feel" goal | — Pending |
| Open to framework adoption | Current vanilla JS has scaling concerns (monolithic files, no component model) | — Pending |
| Kid-appeal in v1 | Discovery features (emoji of the day, random, collections) are differentiators, not afterthoughts | — Pending |

---
*Last updated: 2026-03-03 after initialization*
