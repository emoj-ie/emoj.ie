# Roadmap: emoj.ie

## Overview

Transform emoj.ie from a functional emoji utility into the best emoji site in the world. The journey starts with migrating from the custom Node.js SSG to Astro 5 with Svelte islands (the foundation everything else depends on), then layers in a playful design system, wires up interactive behaviors and navigation, adds discovery features that give the site personality, and finishes with the multi-select emoji builder. Every phase delivers a coherent, verifiable capability. The existing site stays live throughout -- no big-bang rewrite.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Astro Migration** - Migrate from custom SSG to Astro 5 with Svelte islands and build-time data pipeline
- [ ] **Phase 2: Design System and Animation** - Establish playful visual identity, animation infrastructure, and kid-friendly interaction patterns
- [ ] **Phase 3: Interactive Core** - Wire up stateful interactions, micro-animations, keyboard navigation, semantic search, and page transitions
- [ ] **Phase 4: Discovery** - Add Emoji of the Day, random discovery, and curated collections that give the site personality
- [ ] **Phase 5: Emoji Builder** - Multi-select emoji builder with floating tray for composing and copying emoji strings

## Phase Details

### Phase 1: Astro Migration
**Goal**: The entire site generates from Astro 5 with Svelte island components, with fresh SEO-optimized URL patterns
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-05
**Success Criteria** (what must be TRUE):
  1. All pages generate from Astro with clean, SEO-optimized URL patterns (fresh start, no legacy URL preservation needed)
  2. Existing Playwright tests pass against the Astro-generated site (adapted for new URL patterns)
  3. At least one interactive element (e.g., theme switcher or search) runs as a hydrated Svelte island component
  4. Detail pages load only their own emoji data; category pages load only their category data (no monolithic JSON bundle on page load)
  5. Site deploys to GitHub Pages and serves correctly
**Plans**: 3 plans

Plans:
- [x] 01-01: Scaffold Astro project, port data pipeline and utilities, create BaseLayout
- [x] 01-02: Create all page routes with getStaticPaths and build-time data slicing
- [x] 01-03: Build Svelte island components, deploy workflow, and smoke tests

### Phase 2: Design System and Animation
**Goal**: The site has a distinctive, playful visual identity with big emojis, bright colors, and an animation system that feels alive on any device
**Depends on**: Phase 1
**Requirements**: DSGN-01, DSGN-03, DSGN-04, DSGN-06
**Success Criteria** (what must be TRUE):
  1. The site looks and feels visually distinct from any competitor -- big emoji presentation, warm colors, opinionated aesthetics, not generic
  2. All interactive elements (buttons, emoji cards, links) have touch targets of 56px or larger
  3. Hover and focus states animate smoothly using only GPU-composited properties (transform, opacity)
  4. Users with prefers-reduced-motion enabled see a gracefully degraded experience -- essential content accessible, decorative animation suppressed
  5. UI is self-explanatory with minimal copy -- plain human language where text is needed, detailed descriptions below-the-fold only
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Interactive Core
**Goal**: Users experience a responsive, stateful site with buttery animations, keyboard-driven navigation, smart search, and smooth page transitions
**Depends on**: Phase 2
**Requirements**: ARCH-03, ARCH-04, DSGN-02, DSGN-05, NAV-01, NAV-02
**Success Criteria** (what must be TRUE):
  1. Pressing `/` focuses search from any page; arrow keys browse the emoji grid; Enter copies the focused emoji; Esc clears search
  2. Copying an emoji triggers visible bounce/confetti feedback; hovering/tapping emoji cards produces playful effects
  3. Favorites, recents, and theme preference persist across browser sessions and are available on every page
  4. Navigating between home, category, and detail pages plays smooth animated transitions (no hard page reloads)
  5. Searching "something angry" or "happy face" returns semantically relevant emojis beyond exact keyword matches
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Discovery
**Goal**: The site has personality-driven discovery features that make it a destination, not just a utility
**Depends on**: Phase 3
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. The home page features an Emoji of the Day with fun context text; it changes every day and is consistent for all visitors on the same day
  2. A "Surprise Me" button exists and reveals a random emoji with a delightful animation each time it is pressed
  3. At least 10 curated collections (e.g., "Party Time", "Cozy Night In") are browsable from the home page, each with an editorial voice
  4. Collections feel hand-picked and opinionated -- not auto-generated category dumps
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Emoji Builder
**Goal**: Users can compose multi-emoji strings by tapping emojis into a persistent tray, then copy the whole string at once
**Depends on**: Phase 3
**Requirements**: BLDR-01
**Success Criteria** (what must be TRUE):
  1. Tapping an emoji while builder mode is active adds it to a visible floating tray
  2. Emojis in the tray can be reordered and individually removed
  3. A single copy action copies the entire composed emoji string to clipboard
  4. The builder tray does not interfere with normal single-emoji copy when builder mode is inactive
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5
Note: Phase 5 depends on Phase 3 (not Phase 4), so Phases 4 and 5 could theoretically run in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Astro Migration | 2/3 | In Progress | - |
| 2. Design System and Animation | 0/2 | Not started | - |
| 3. Interactive Core | 0/3 | Not started | - |
| 4. Discovery | 0/2 | Not started | - |
| 5. Emoji Builder | 0/1 | Not started | - |
