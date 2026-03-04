---
phase: 2
slug: design-system-and-animation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58+ |
| **Config file** | `astro-site/playwright.config.ts` |
| **Quick run command** | `cd astro-site && npx playwright test --grep "PATTERN"` |
| **Full suite command** | `cd astro-site && npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Visual inspection in dev server (`npm run dev`)
- **After every plan wave:** Run `cd astro-site && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-xx | 01 | 0 | DSGN-01 | smoke (visual) | `npx playwright test tests/design-system.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-xx | 01 | 0 | DSGN-03 | integration | `npx playwright test tests/touch-targets.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-xx | 01 | 0 | DSGN-04 | integration | `npx playwright test tests/animation-a11y.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-xx | 01 | 0 | DSGN-06 | smoke | `npx playwright test tests/minimal-copy.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `astro-site/tests/design-system.spec.ts` — stubs for DSGN-01 (emoji sizes, card radii, color tokens)
- [ ] `astro-site/tests/touch-targets.spec.ts` — stubs for DSGN-03 (min-height/min-width checks on interactive elements)
- [ ] `astro-site/tests/animation-a11y.spec.ts` — stubs for DSGN-04 (prefers-reduced-motion emulation, no layout-triggering properties)
- [ ] `astro-site/tests/minimal-copy.spec.ts` — stubs for DSGN-06 (annotation hidden by default on grid, metadata below fold on detail)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toybox aesthetic feels distinct and playful | DSGN-01 | Subjective visual quality | Compare side-by-side with emojipedia/emojiterra — must feel visually different |
| Spring animations feel "alive" and bouncy | DSGN-04 | Subjective animation quality | Hover cards, trigger copy — animation should overshoot and settle naturally |
| Copy voice is warm casual | DSGN-06 | Subjective tone judgment | Read all UI labels — should feel friendly and direct |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
