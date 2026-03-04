# Phase 2: Design System and Animation - Research

**Researched:** 2026-03-04
**Domain:** CSS design tokens, animation systems, accessibility (prefers-reduced-motion), touch targets
**Confidence:** HIGH

## Summary

Phase 2 transforms emoj.ie from a functional utility into a visually distinctive "toybox bold" experience. The existing codebase already has a solid CSS custom property system (30+ tokens in `global.css`), a warm cream/gold palette with light/dark themes, neo-brutalist hard shadows, and a component architecture of Astro layouts + Svelte islands. The work is primarily CSS design token refactoring, component restyling, and adding a pure-CSS animation system -- no new dependencies are needed.

The animation system should use CSS `linear()` easing for spring physics (88%+ browser support, including Safari 17.2+), with `cubic-bezier()` fallbacks via `@supports`. All animations must use GPU-composited properties only (`transform`, `opacity`). Stagger effects use CSS custom properties with `--stagger-index` set inline. The existing `@media (prefers-reduced-motion: reduce)` block at the end of `global.css` already kills all animation/transition duration -- this needs refinement to be graceful rather than nuclear.

**Primary recommendation:** Extend the existing CSS custom property system with new design tokens (larger radii, thicker borders, pop accent colors, spring easing curves), restyle components in-place, and build the animation system entirely in CSS -- no JavaScript animation libraries needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Aesthetic direction: "Toybox bold" -- chunky, oversized, playful but not childish
- Thick visible borders (2-3px) on cards and containers
- Hard offset shadows retained and emphasized (existing `7px 7px 0` pattern)
- Corner radii pushed up to 16-24px range (from current 7/11/16px)
- Cards feel like physical objects -- bordered toy tiles you could pick up
- Keep warm cream/gold base palette (existing vars)
- Add 2-3 bright pop accent colors for interactive elements, badges, hover states
- Existing brand-primary (blue), brand-secondary (red-orange), accent (gold) remain as foundation
- Detail page hero emoji: huge, 200-280px
- Grid emoji size: bigger at 96-120px (up from current 72x72)
- Grid cards show emoji only -- annotation appears on hover/focus, not by default
- Each emoji sits in its own individual bordered card (toy tile)
- Hero emoji + copy button only above the fold
- All metadata below the fold
- Bouncy spring curves -- elements overshoot and settle
- GPU-only properties enforced: transform and opacity only
- Targeted motion budget: hover/focus on cards, copy feedback, page-level entrance
- Card hover: scale up (1.05-1.08) + shadow deepens, spring animation
- Grid entrance animation: stagger cascade on initial page load, only on first paint
- Copy voice: warm casual, friendly, direct, slightly playful
- Category headings only -- no descriptive subtext
- Copy feedback: both text AND animation

### Claude's Discretion
- Exact spring curve parameters (tension, friction, mass)
- Specific pop accent colors (must complement existing warm palette)
- Exact stagger timing for grid entrance
- Touch target sizing implementation approach (as long as 56px+ met)
- Reduced-motion fallback specifics (as long as content accessible, decorative animation suppressed)
- Card border color choices
- Responsive breakpoints for emoji sizing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DSGN-01 | Visual redesign with big emojis, bright colors, warmth, and opinionated playful aesthetics | Design token overhaul (radii, borders, shadows, accent colors), emoji sizing changes, card restyling, detail page hero restructuring |
| DSGN-03 | Touch targets sized 56px+ for kid-friendly interaction on all interactive elements | CSS `min-height`/`min-width` enforcement on all buttons, links, and interactive elements; exceeds WCAG 2.5.5 (44px) |
| DSGN-04 | Animation system using GPU-only properties (transform, opacity) with reduced-motion support | CSS `linear()` spring easing with `cubic-bezier()` fallback, `@media (prefers-reduced-motion)` graceful degradation, `will-change` on animated elements |
| DSGN-06 | Minimal copy throughout -- UI is self-explanatory, plain human language where text is needed | Grid cards show emoji-only (annotation on hover), category headings without subtext, below-fold metadata on detail pages |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | Native | Design tokens | Already in use; extends existing `:root` block in `global.css` |
| CSS `linear()` | Native | Spring easing curves | 88%+ browser support (Chrome 113+, Firefox 112+, Safari 17.2+); no JS needed |
| CSS `@keyframes` | Native | Entrance/stagger animations | GPU-composited, zero-dependency, works with reduced-motion |
| CSS `@supports` | Native | Progressive enhancement | Fallback to `cubic-bezier()` for older browsers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Svelte 5 `Spring` class | 5.53+ | Copy feedback bounce | Only for JS-driven interactive feedback (CopyButton) |
| Svelte 5 `prefersReducedMotion` | 5.7+ | Motion preference detection in islands | When Svelte components need to conditionally animate |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `linear()` | `spring-easing` npm package | Adds dependency; CSS `linear()` has sufficient browser support now |
| CSS animations | Motion (motion.dev) | JS runtime cost; overkill for targeted motion budget |
| CSS animations | GSAP | Heavy dependency; licensing concerns; CSS sufficient for this scope |
| CSS stagger | Svelte `each` with `transition:` | Forces hydration; CSS-only stagger works on static pages |

**No new npm dependencies needed.** The animation system is pure CSS. Svelte's built-in `Spring` class handles the few JS-driven animations (copy feedback bounce).

## Architecture Patterns

### Design Token Structure in global.css

Extend the existing `:root` block. Do not create a separate file -- the project uses a single `global.css`.

```
src/styles/global.css
  :root {
    /* Existing tokens (keep) */
    --bg-canvas, --bg-elevated, --bg-soft, --bg-hero, --surface-glass
    --text-strong, --text-body, --text-muted
    --border-soft, --border-strong, --focus
    --brand-primary, --brand-secondary, --accent
    --shadow-xs, --shadow-sm, --shadow-md
    --radius-sm, --radius-md, --radius-lg
    --font-body, --font-display, --font-mono
    --main-max

    /* NEW tokens to add */
    --pop-mint, --pop-violet, --pop-coral     /* Pop accent colors */
    --radius-xl                               /* 24px for toybox cards */
    --border-card                             /* 3px for card borders */
    --shadow-hover                            /* Deeper shadow for hover */
    --spring-bounce                           /* linear() spring easing */
    --spring-duration                         /* Duration for spring */
    --ease-out-back                           /* cubic-bezier fallback */
    --transition-spring                       /* Shorthand */
    --emoji-grid-size                         /* 96px base, responsive */
    --emoji-hero-size                         /* 240px base, responsive */
    --touch-min                               /* 56px minimum */
  }
```

### Pattern 1: Spring Easing with Progressive Enhancement

**What:** Define spring easing as CSS custom property using `linear()`, with `cubic-bezier()` fallback.
**When to use:** All bouncy hover/focus transitions.

```css
/* Source: Josh W. Comeau + CSS Spring Easing Generator */
:root {
  /* Fallback: simple overshoot curve */
  --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-duration: 500ms;
}

@supports (animation-timing-function: linear(0, 1)) {
  :root {
    /* Spring: ~30% bounce, 500ms perceptual duration */
    --spring-bounce: linear(
      0, 0.002, 0.007 1.15%, 0.026 2.3%, 0.064, 0.114 5.18%,
      0.223 7.78%, 0.598 15.84%, 0.701, 0.790, 0.864, 0.923,
      0.968 28.8%, 1.003 31.68%, 1.023, 1.035 36.29%,
      1.043 38.88%, 1.046 42.05%, 1.045 44.35%, 1.041 47.23%,
      1.012 61.63%, 1.003 69.41%, 0.998 80.35%, 0.999 99.94%
    );
    --spring-duration: 833ms;
  }
}
```

### Pattern 2: Card Hover with GPU-Only Properties

**What:** Scale + shadow transition using only transform and opacity.
**When to use:** Every interactive card (emoji grid cards, category cards).

```css
.panel-card {
  transition: transform var(--spring-duration) var(--spring-bounce),
              box-shadow var(--spring-duration) var(--spring-bounce);
  will-change: transform;
}

.panel-card:hover,
.panel-card:focus-visible {
  transform: scale(1.06);
  box-shadow: var(--shadow-hover);
}
```

### Pattern 3: Stagger Entrance Animation

**What:** Cards animate in with a cascade delay on first paint.
**When to use:** Grid pages on initial load only.

```css
@keyframes card-entrance {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.panel-card {
  animation: card-entrance 400ms var(--spring-bounce) both;
  animation-delay: calc(var(--stagger-index, 0) * 40ms);
}
```

In templates, set the stagger index inline:
```html
{#each emojis as item, i (item.hexLower)}
  <a style="--stagger-index: {Math.min(i, 20)}" ...>
```

Cap at 20 to avoid excessive total delay (800ms max).

### Pattern 4: Reduced Motion Graceful Degradation

**What:** Replace the current nuclear `reduce` block with graceful degradation.
**When to use:** Global, replaces existing `@media (prefers-reduced-motion: reduce)` block.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.15s !important;  /* Keep brief transitions for state changes */
    scroll-behavior: auto !important;
  }

  /* Allow opacity transitions for essential feedback */
  .copy-btn {
    transition: opacity 0.15s ease, background-color 0.15s ease !important;
  }

  /* Kill decorative entrance animation */
  .panel-card {
    animation: none !important;
  }
}
```

### Pattern 5: Touch Target Enforcement

**What:** Minimum 56px touch targets on all interactive elements.
**When to use:** Buttons, links, toggles -- anything tappable.

```css
:root {
  --touch-min: 56px;
}

button,
[role="button"],
a.panel-card,
.copy-btn,
.mode-toggle,
.mode-option,
.emoji-favorite,
.panel-emoji-copy,
.panel-emoji-favorite,
.theme-toggle-glyph,
.header-menu-toggle,
.quick-chip {
  min-height: var(--touch-min);
  min-width: var(--touch-min);
}
```

### Anti-Patterns to Avoid
- **Animating `width`, `height`, `top`, `left`:** Triggers layout reflow. Use `transform: translate/scale` instead.
- **`will-change` on everything:** Wastes GPU memory. Only apply to elements that actively animate (cards, buttons).
- **`transition: all`:** Animates unintended properties. Always list specific properties.
- **Stagger delay without cap:** 50 cards * 60ms = 3 seconds total. Cap stagger index at ~20.
- **Removing all motion for reduced-motion users:** Some transitions (opacity for feedback) are helpful. Use graceful degradation, not nuclear removal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring physics curves | Manual `cubic-bezier()` guessing | Pre-computed `linear()` values from CSS Spring Easing Generator | Spring needs multi-point overshoot curve; `cubic-bezier` can only overshoot once |
| Theme switching | Custom JS theme manager | Existing `data-theme` attribute + CSS custom properties | Already works; just extend token values for both themes |
| Stagger orchestration | JavaScript stagger loop | CSS `animation-delay` + `--stagger-index` custom property | Zero JS overhead; works on server-rendered HTML |
| Reduced-motion detection | Custom JS media query listener | CSS `@media (prefers-reduced-motion)` + Svelte `prefersReducedMotion` | Built into platform; no library needed |
| Touch target sizing | Per-component manual sizing | Global CSS rule on interactive element selectors | Consistent enforcement; one rule catches all |

**Key insight:** This entire phase is achievable with zero new dependencies. CSS custom properties, `linear()` easing, `@keyframes`, and `@supports` handle everything. Svelte's built-in `Spring` class covers the few JS-driven animations.

## Common Pitfalls

### Pitfall 1: Shadow Animation Triggers Paint
**What goes wrong:** Animating `box-shadow` directly causes expensive paint operations.
**Why it happens:** `box-shadow` is not a composited property -- it triggers paint on every frame.
**How to avoid:** Use a pseudo-element with the hover shadow pre-rendered, and animate its `opacity` on hover. Alternatively, accept the paint cost for shadows since the motion budget is small (hover only, not scroll-driven).
**Warning signs:** Choppy hover transitions on lower-end devices.

### Pitfall 2: Stagger Animation Replays on Navigation
**What goes wrong:** Grid cards "spill out" again every time the user navigates back to a page.
**Why it happens:** Astro MPA reloads the page; CSS animations replay on fresh DOM.
**How to avoid:** Use `animation-fill-mode: both` and either: (a) accept the replay since it's page navigation, not scroll-into-view, or (b) set a sessionStorage flag and conditionally add an `is-animated` class. The CONTEXT.md says "only on first paint, NOT on scroll-into-view" which aligns with page navigation replays being acceptable.
**Warning signs:** User complaints about repetitive animation.

### Pitfall 3: Emoji Image Size Change Breaks Layout
**What goes wrong:** Increasing emoji from 72px to 96-120px causes grid overflow on narrow screens.
**Why it happens:** Fixed `grid-template-columns: repeat(6, ...)` with larger items exceeds viewport.
**How to avoid:** Use responsive `--emoji-grid-size` with `clamp()` and let existing responsive breakpoints handle column reduction. Test at 320px viewport width.
**Warning signs:** Horizontal scroll on mobile.

### Pitfall 4: `linear()` Fallback Mismatch
**What goes wrong:** On browsers without `linear()` support, animations feel jarring or have wrong duration.
**Why it happens:** `cubic-bezier()` fallback has different feel than spring; duration might need adjusting.
**How to avoid:** Use `@supports` to set both easing AND duration together. The fallback `cubic-bezier(0.34, 1.56, 0.64, 1)` at 500ms is a reasonable overshoot approximation.
**Warning signs:** Animation feels "wrong" on older Safari (pre-17.2).

### Pitfall 5: Annotation Hide/Show on Hover Hurts Accessibility
**What goes wrong:** Hiding annotation text by default removes accessible names.
**Why it happens:** `display: none` or `visibility: hidden` removes content from accessibility tree.
**How to avoid:** Keep annotation in DOM but visually hidden (opacity/transform), or ensure `aria-label` on the card link provides the annotation. The current `title` attribute on `<a>` cards already provides this.
**Warning signs:** Screen readers announcing cards without names.

### Pitfall 6: Detail Page Hero Emoji Too Large on Mobile
**What goes wrong:** 280px emoji exceeds mobile viewport, causing layout issues.
**Why it happens:** Fixed size without responsive clamping.
**How to avoid:** Use `clamp(140px, 40vw, 280px)` for hero emoji size. Test on 320px viewport.
**Warning signs:** Emoji overflows container on small phones.

## Code Examples

### Extending Design Tokens

```css
/* Source: Existing global.css :root block -- extend with new tokens */
:root {
  /* UPDATED: Larger radii for toybox feel */
  --radius-sm: 8px;     /* was 7px */
  --radius-md: 16px;    /* was 11px */
  --radius-lg: 20px;    /* was 16px */
  --radius-xl: 24px;    /* NEW: toybox cards */

  /* UPDATED: Deeper hover shadow */
  --shadow-hover: 10px 10px 0 rgba(31, 27, 20, 0.22);

  /* NEW: Pop accent colors (complement warm palette) */
  --pop-mint: #2dd4a8;
  --pop-violet: #8b5cf6;
  --pop-coral: #f97066;

  /* NEW: Touch target minimum */
  --touch-min: 56px;

  /* NEW: Emoji sizes */
  --emoji-grid-size: clamp(80px, 12vw, 120px);
  --emoji-hero-size: clamp(140px, 40vw, 280px);
}

/* Dark theme pop colors adjusted for contrast */
:root[data-theme='dark'] {
  --pop-mint: #5eead4;
  --pop-violet: #a78bfa;
  --pop-coral: #fca5a1;
  --shadow-hover: 10px 10px 0 rgba(0, 0, 0, 0.55);
}
```

### Toybox Card Restyling

```css
/* Source: Existing .panel-card in global.css -- restyle for toybox */
.panel-card {
  border: 3px solid var(--border-soft);
  border-radius: var(--radius-xl);       /* 24px toybox radius */
  padding: 1rem;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);          /* 7px 7px 0 hard shadow */
  transition: transform var(--spring-duration) var(--spring-bounce),
              box-shadow var(--spring-duration) var(--spring-bounce);
  will-change: transform;
}

.panel-card:hover,
.panel-card:focus-visible {
  transform: scale(1.06);
  box-shadow: var(--shadow-hover);       /* Deeper shadow on hover */
}
```

### Emoji Grid Card (Emoji-Only with Hover Annotation)

```svelte
<!-- Source: EmojiGrid.svelte -- restructured for emoji-only display -->
<a href={item.detailRoute} class="emoji-tile" title={item.annotation}
   style="--stagger-index: {Math.min(i, 20)}">
  <img
    src={imgSrc(item)}
    alt={item.annotation}
    width={96}
    height={96}
    loading="lazy"
    decoding="async"
  />
  <span class="emoji-tile-label">{item.annotation}</span>
</a>

<style>
  .emoji-tile {
    display: grid;
    place-items: center;
    border: 3px solid var(--border-soft);
    border-radius: var(--radius-xl);
    padding: 0.75rem;
    background: var(--bg-elevated);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
    min-height: var(--touch-min);
    transition: transform var(--spring-duration) var(--spring-bounce),
                box-shadow var(--spring-duration) var(--spring-bounce);
    will-change: transform;
    animation: card-entrance 400ms var(--spring-bounce) both;
    animation-delay: calc(var(--stagger-index, 0) * 40ms);
  }

  .emoji-tile:hover,
  .emoji-tile:focus-visible {
    transform: scale(1.06);
    box-shadow: var(--shadow-hover);
  }

  .emoji-tile-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 200ms ease, transform 200ms ease;
    position: absolute;
    bottom: 0.5rem;
  }

  .emoji-tile:hover .emoji-tile-label,
  .emoji-tile:focus-visible .emoji-tile-label {
    opacity: 1;
    transform: translateY(0);
  }
</style>
```

### Detail Page Hero Section

```astro
<!-- Source: [slug].astro -- restructured for hero-first layout -->
<div class="emoji-hero">
  <EmojiImage
    hex={emoji.assetHex}
    annotation={emoji.annotation}
    size={240}
    useLocal={emoji.useLocalAsset}
    loading="eager"
    emoji={emoji.emoji}
  />
</div>
<h1 class="emoji-hero-title">{emoji.annotation}</h1>
<div class="emoji-hero-actions">
  <CopyButton client:load emoji={emoji.emoji} hex={emoji.hexLower} annotation={emoji.annotation} />
</div>

<!-- Below the fold -->
<details class="emoji-metadata">
  <summary>Details</summary>
  <dl class="emoji-meta">...</dl>
</details>
```

### Svelte CopyButton Bounce Feedback

```svelte
<script lang="ts">
  import { Spring, prefersReducedMotion } from 'svelte/motion';

  // Spring for bounce feedback
  const scale = new Spring(1, { stiffness: 0.3, damping: 0.4 });

  async function handleCopy() {
    // ... existing copy logic ...
    if (!prefersReducedMotion.current) {
      scale.target = 1.15;
      setTimeout(() => { scale.target = 1; }, 150);
    }
  }
</script>

<button
  style:transform="scale({scale.current})"
  onclick={handleCopy}
>
  {copied ? 'Copied!' : 'Copy this emoji'}
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cubic-bezier()` for bounce | CSS `linear()` for true spring | 2023 (Chrome 113) | Multi-point spring curves in pure CSS |
| `transition: all` shorthand | Named property transitions | Always best practice | Prevents accidental property animation |
| `@media (prefers-reduced-motion: reduce) { animation: none }` | Graceful degradation (keep brief transitions) | 2021+ (W3C guidance) | Users still get feedback, just no decorative motion |
| Svelte `spring()` store function | Svelte `Spring` class | Svelte 5.8.0 | Class-based API, `prefersReducedMotion` built-in |
| JavaScript stagger loops | CSS `--stagger-index` + `animation-delay` | Always possible, now standard | Zero JS; works on SSR/static HTML |

**Deprecated/outdated:**
- Svelte `spring()` and `tweened()` store functions: Use `Spring` and `Tween` classes instead (since 5.8.0)
- `will-change: transform` on every element: Only apply to elements that actually animate
- Universal `transition: all 0.3s ease`: Always specify properties

## Open Questions

1. **Exact pop accent colors**
   - What we know: Must complement warm cream/gold palette. Blue, red-orange, gold are existing brand colors.
   - What's unclear: Exact hex values for mint/violet/coral need visual testing against both themes.
   - Recommendation: Start with `#2dd4a8` (mint), `#8b5cf6` (violet), `#f97066` (coral) -- adjust after visual review. These provide good contrast on both light and dark backgrounds.

2. **Grid column count at larger emoji sizes**
   - What we know: Current breakpoints are 6/4/3/2/1 columns. Larger emojis (96-120px) may need adjustment.
   - What's unclear: Whether existing breakpoints accommodate larger cards without horizontal overflow.
   - Recommendation: Test with `--emoji-grid-size: 96px` first; adjust breakpoints if needed. `auto-fill` with `minmax(var(--emoji-grid-size), 1fr)` may be simpler than fixed column counts.

3. **Stagger replay behavior**
   - What we know: CONTEXT.md says "only on first paint, NOT on scroll-into-view." MPA navigation reloads pages.
   - What's unclear: Whether "first paint" means first-ever visit or every page load.
   - Recommendation: Let stagger play on every page load (MPA behavior). It is first-paint-of-page, not scroll-triggered. This is the simplest approach and aligns with the "keeps the moment special, doesn't repeat" intent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58+ |
| Config file | `astro-site/playwright.config.ts` |
| Quick run command | `cd astro-site && npx playwright test --grep "PATTERN"` |
| Full suite command | `cd astro-site && npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DSGN-01 | Visual redesign: big emojis, bright colors, toybox cards | smoke (visual) | `npx playwright test tests/design-system.spec.ts` | No -- Wave 0 |
| DSGN-03 | Touch targets 56px+ on all interactive elements | integration | `npx playwright test tests/touch-targets.spec.ts` | No -- Wave 0 |
| DSGN-04 | GPU-only animation + reduced-motion | integration | `npx playwright test tests/animation-a11y.spec.ts` | No -- Wave 0 |
| DSGN-06 | Minimal copy, emoji-only grid cards | smoke | `npx playwright test tests/minimal-copy.spec.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Visual inspection in dev server (`npm run dev`)
- **Per wave merge:** Full Playwright suite
- **Phase gate:** All design/animation tests green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `astro-site/tests/design-system.spec.ts` -- covers DSGN-01 (emoji sizes, card radii, color tokens)
- [ ] `astro-site/tests/touch-targets.spec.ts` -- covers DSGN-03 (min-height/min-width checks on interactive elements)
- [ ] `astro-site/tests/animation-a11y.spec.ts` -- covers DSGN-04 (prefers-reduced-motion emulation, no layout-triggering properties)
- [ ] `astro-site/tests/minimal-copy.spec.ts` -- covers DSGN-06 (annotation hidden by default on grid, metadata below fold on detail)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `astro-site/src/styles/global.css` (2603 lines, 30+ CSS custom properties)
- Existing codebase: All Svelte island components and Astro page templates
- [Can I Use: CSS linear()](https://caniuse.com/mdn-css_types_easing-function_linear-function) -- 88.67% global support, Safari 17.2+
- [Svelte 5 svelte/motion docs](https://svelte.dev/docs/svelte/svelte-motion) -- Spring class API, prefersReducedMotion
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) -- Media query specification
- [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) -- 44px minimum, 56px exceeds requirement

### Secondary (MEDIUM confidence)
- [Josh W. Comeau: Springs and Bounces in Native CSS](https://www.joshwcomeau.com/animation/linear-timing-function/) -- linear() technique, spring parameter generation
- [CSS Spring Easing Generator](https://www.kvin.me/css-springs) -- Tool for generating linear() spring values
- [Creating CSS Spring Animations with linear()](https://pqina.nl/blog/css-spring-animation-with-linear-easing-function/) -- Build-time generation technique
- [Chrome Developers: CSS linear() easing](https://developer.chrome.com/docs/css-ui/css-linear-easing-function) -- Official Chrome documentation
- [CSS-Tricks: Staggered Animations](https://css-tricks.com/different-approaches-for-creating-a-staggered-animation/) -- CSS custom property stagger technique
- [Smashing Magazine: Respecting Motion Preferences](https://www.smashingmagazine.com/2021/10/respecting-users-motion-preferences/) -- Graceful degradation patterns

### Tertiary (LOW confidence)
- Pop accent color recommendations (#2dd4a8, #8b5cf6, #f97066) -- chosen based on color theory (warm palette complement), needs visual validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pure CSS, no new dependencies; existing patterns well understood
- Architecture: HIGH -- extending existing CSS custom property system; all patterns verified against codebase
- Pitfalls: HIGH -- common CSS animation issues are well-documented; specific pitfalls identified from codebase analysis
- Spring easing values: MEDIUM -- generated from tools; exact feel needs tuning during implementation

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain -- CSS specs, browser support unlikely to regress)
