# Requirements: emoj.ie

**Defined:** 2026-03-03
**Core Value:** Instant access to any emoji — find it, copy it, done

## v1 Requirements

Requirements for the "personality update" — transforming emoj.ie from a functional utility into the best emoji site in the world.

### Architecture

- [ ] **ARCH-01**: Site migrated from custom Node.js SSG to Astro 5 with zero URL breakage
- [ ] **ARCH-02**: Interactive UI elements built as Svelte island components with hydration strategies
- [ ] **ARCH-03**: Page-to-page navigation uses View Transitions API for smooth animated transitions
- [ ] **ARCH-04**: Shared state (favorites, recents, preferences) managed via Svelte stores with localStorage sync
- [ ] **ARCH-05**: Build-time data slicing — detail pages inline their emoji, category pages load only their category data

### Design & Animation

- [ ] **DSGN-01**: Visual redesign with big emojis, bright colors, warmth, and opinionated playful aesthetics
- [ ] **DSGN-02**: Micro-interactions on copy (bounce/confetti feedback), hover/tap effects on emoji cards
- [ ] **DSGN-03**: Touch targets sized 56px+ for kid-friendly interaction on all interactive elements
- [ ] **DSGN-04**: Animation system using GPU-only properties (transform, opacity) with reduced-motion support
- [ ] **DSGN-05**: Smooth page transitions between home, category, and detail pages

### Discovery

- [ ] **DISC-01**: Emoji of the Day — daily featured emoji with fun context, deterministic selection (build-time generated)
- [ ] **DISC-02**: Random / Surprise Me button — reveals a random emoji with delightful animation
- [ ] **DISC-03**: Curated collections — 10-15 themed groups with editorial voice, browsable from home page

### Navigation

- [ ] **NAV-01**: Keyboard navigation — `/` focuses search, arrow keys browse emoji grid, Enter copies, Esc clears
- [ ] **NAV-02**: Enhanced semantic search — queries like "something angry" match rage-related emojis beyond keyword matching

### Builder

- [ ] **BLDR-01**: Multi-select emoji builder — floating tray, tap emojis to add, reorder/remove in tray, copy all

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Discovery

- **DISC-04**: Related/similar emoji suggestions on detail pages based on tag overlap and subcategory proximity
- **DISC-05**: Seasonal/event-tied collections that rotate based on calendar (holidays, awareness months)

### Platform

- **PLAT-01**: Platform preview showing how emoji renders on Apple, Google, Samsung, Microsoft side-by-side
- **PLAT-02**: Internationalized search data — search in Spanish, French, etc. without translating UI

### Monetization

- **MNTZ-01**: Merch integration via print-on-demand partner (emoj.ie earns cut, partner handles fulfillment)
- **MNTZ-02**: Direct sponsor placement slots (tasteful, curated, no programmatic ads)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI emoji generator | Requires server-side compute (breaks GitHub Pages). Emojipedia's implementation is forgettable. Doesn't serve core value |
| User accounts / login | Massive complexity for marginal gain. localStorage handles 95% of use cases. Static hosting constraint |
| User-generated content | Requires moderation, storage, content policy. Quality degrades without active curation |
| Games / quizzes | Diverts focus from core utility. Fun for 30 seconds then forgotten. Discovery features are enough |
| Ad networks | Destroys premium feel instantly. "How is this free?" is a stronger brand signal |
| Native mobile app | PWA already supported. Web works perfectly for this use case |
| Real-time / collaborative features | Absurd complexity for a reference site. Static constraint makes it impossible |
| Emoji history / changelog | Emojipedia has 10-year head start. Show Unicode version/year, link out for deep history |
| Browser extension | Browser emoji pickers are built into every OS. Competing with native is a losing proposition |
| Multi-language UI | Translation dilutes editorial voice. Emoji are universal. Internationalized search data (v2) is the better approach |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | — | Pending |
| ARCH-02 | — | Pending |
| ARCH-03 | — | Pending |
| ARCH-04 | — | Pending |
| ARCH-05 | — | Pending |
| DSGN-01 | — | Pending |
| DSGN-02 | — | Pending |
| DSGN-03 | — | Pending |
| DSGN-04 | — | Pending |
| DSGN-05 | — | Pending |
| DISC-01 | — | Pending |
| DISC-02 | — | Pending |
| DISC-03 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| BLDR-01 | — | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
