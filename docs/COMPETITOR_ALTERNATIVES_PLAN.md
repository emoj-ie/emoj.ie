# Competitor Alternatives Plan

Last updated: 2026-02-27

## Purpose
- Expand comparison coverage to capture competitor-intent SEO while helping users choose the right tool honestly.

## Existing Coverage
- `/alternatives/`
- `/alternatives/emojipedia/`
- `/alternatives/getemoji/`
- `/alternatives/findemoji/`

## Next Page Set (Priority Order)

### Priority 1: "Plural Alternatives" Pages
- `/alternatives/emojipedia-alternatives/`
- `/alternatives/getemoji-alternatives/`
- `/alternatives/findemoji-alternatives/`

Reason:
- Captures broader consideration-stage intent ("best alternatives").
- Allows ranking multiple options in one page with clear selection criteria.

### Priority 2: "You vs Competitor" Pages
- `/vs/emojipedia/`
- `/vs/getemoji/`
- `/vs/findemoji/`

Reason:
- Captures direct evaluator intent and supports decision-stage conversion.

### Priority 3: "Competitor vs Competitor (+ emoj.ie)" Pages
- `/compare/emojipedia-vs-getemoji/`
- `/compare/getemoji-vs-findemoji/`

Reason:
- Captures non-brand comparison demand, introduces `emoj.ie` as third option.

## Shared Template Blocks
1. TL;DR summary
2. Switch signals
3. Feature/workflow comparison (paragraph-first, not only table)
4. Best-fit guidance by user profile
5. Migration steps
6. FAQ
7. CTA to test on `emoj.ie`

## Structured Data Requirements
- Keep `BreadcrumbList` on every page.
- Use `FAQPage` only when questions/answers are visible on-page.
- Use `ItemList` for index/list pages that present ranked options.
- Validate every template sample in phase4 schema tests.

## Content Quality Rules
- Acknowledge competitor strengths clearly.
- Avoid absolute claims that cannot be proven.
- Include explicit "who should not switch" guidance.
- Keep migration advice concrete and time-bounded.

## Internal Linking Plan
- Link each detail comparison page back to `/alternatives/`.
- Cross-link related comparison pages for the same user intent.
- Add links from homepage/footer and selected `/search/*` pages where intent matches.

## Success Metrics
- Entrances to `/alternatives/*` and `/vs/*` families.
- Copy events per competitor-intent landing session.
- Click-through from comparison pages to core explorer routes (`/`, `/search/`, `/tag/`).
- Reduction in bounce for comparison pages after FAQ and fit-guidance improvements.
