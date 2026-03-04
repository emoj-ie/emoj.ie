# Phase 2: Design System and Animation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a distinctive, playful visual identity with big emojis, bright colors, and an animation system that feels alive on any device. Covers design token overhaul, component restyling, animation infrastructure, touch target sizing, and reduced-motion support. Does NOT include stateful interactions (copy/favorites/search behavior), page transitions, or keyboard navigation — those are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Aesthetic direction
- Toybox bold: chunky, oversized, playful but not childish
- Thick visible borders (2-3px) on cards and containers
- Hard offset shadows retained and emphasized (existing `7px 7px 0` pattern)
- Corner radii pushed up to 16-24px range (from current 7/11/16px)
- Cards feel like physical objects — bordered toy tiles you could pick up

### Color palette
- Keep warm cream/gold base palette (existing `--bg-canvas`, `--bg-elevated`, etc.)
- Add 2-3 bright pop accent colors for interactive elements, badges, hover states
- Warm canvas with colorful toys on it — grounded base, energetic accents
- Existing brand-primary (blue), brand-secondary (red-orange), accent (gold) remain as foundation

### Emoji sizing
- Detail page hero emoji: huge, 200-280px — poster-sized, the differentiator
- Grid emoji size: bigger at 96-120px (up from current 72x72)
- Grid cards show emoji only — annotation appears on hover/focus, not by default
- Each emoji sits in its own individual bordered card (toy tile)

### Detail page layout
- Hero emoji + copy button only above the fold — pure, uncluttered hero moment
- All metadata (Unicode info, tags, category, variants, copy formats) lives below the fold
- Name/annotation visible with hero but metadata is secondary

### Animation personality
- Bouncy spring curves — elements overshoot and settle, iOS-style springs
- GPU-only properties enforced: transform and opacity only
- Targeted motion budget: hover/focus on cards, copy feedback, page-level entrance
- NOT every button press or scroll event — delightful without exhausting

### Card hover effect
- Scale up (1.05-1.08) + shadow deepens on hover/focus
- Spring animation on the transition — bouncy settle
- Metaphor: picking up a toy tile off the surface

### Grid entrance animation
- Stagger cascade on initial page load/navigation — cards "spill out"
- Only on first paint, NOT on scroll-into-view
- Keeps the moment special, doesn't repeat

### Copy voice & tone
- Warm casual — friendly, direct, slightly playful but not try-hard
- "Copy this emoji" not "Copy emoji to clipboard"
- "Nothing here yet" not "No results found"
- Adults and kids both understand

### Content density
- Category headings only — no descriptive subtext. Emojis below explain themselves
- UI self-explanatory throughout — plain human language only where truly needed
- Detailed descriptions below-the-fold only

### Copy feedback
- Both text AND animation — "Copied!" label change plus visual bounce/flash
- Belt and suspenders: users of all ages get clear confirmation

### Claude's Discretion
- Exact spring curve parameters (tension, friction, mass)
- Specific pop accent colors (must complement existing warm palette)
- Exact stagger timing for grid entrance
- Touch target sizing implementation approach (as long as 56px+ met)
- Reduced-motion fallback specifics (as long as content accessible, decorative animation suppressed)
- Card border color choices
- Responsive breakpoints for emoji sizing

</decisions>

<specifics>
## Specific Ideas

- "Toybox bold" — the design should feel like a well-designed toy store, not a kids' app
- Cards as physical toy tiles: thick borders + hard shadows + big radius = objects you could pick up
- Hero emoji at 200-280px is the single biggest visual differentiator from all competitors
- Grid emoji-only cards with annotation on hover: visual-first browsing, less clutter
- Spring animations create an "alive" feeling without overwhelming — targeted at hover, copy, and entrance moments
- Stagger entrance is a "spilling out" effect — playful first impression, doesn't repeat on scroll

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `global.css`: 30+ CSS custom properties already working (colors, shadows, radii, fonts, spacing) — refactor/extend, don't replace
- `EmojiGrid.svelte`: Renders emoji cards with image loading — needs restyling and hover animation but structure is reusable
- `Header.astro`: Sticky glass-morphism header with gradient stripe — established header pattern
- `BaseLayout.astro`: Clean layout shell, imports global.css — good injection point for animation utilities
- `CopyButton.svelte`, `FavoriteButton.svelte`, `ThemeSwitcher.svelte`: Interactive islands ready for visual upgrade

### Established Patterns
- CSS custom properties for theming (light/dark via `data-theme` attribute)
- Hard-edged shadows in neo-brutalist style — keep and emphasize
- Svelte islands with `client:load` hydration
- OpenMoji SVGs via jsDelivr CDN with local fallback at `/assets/emoji/base/`
- Bricolage Grotesque (display), Instrument Sans (body), IBM Plex Mono (code) font stack

### Integration Points
- `global.css` `:root` block: extend design tokens here
- `EmojiGrid.svelte`: add hover animations, resize emoji images, strip annotation text
- `BaseLayout.astro`: add animation utility CSS or link animation stylesheet
- Each Svelte island component: apply new visual styling within component `<style>` blocks
- `[slug].astro` detail page: hero emoji sizing and above-fold layout restructuring

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-design-system-and-animation*
*Context gathered: 2026-03-04*
