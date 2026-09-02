# Pilot Gate-1 Decision — Canonical Production Codebase

**Status:** Drafted 2026-07-26. Awaiting CEO decision (Discord).
**Context:** `deploy.yml` builds and publishes `./astro-site` (Astro 5 +
Svelte 5) to GitHub Pages, while `site-quality.yml` runs its checks — all
targeting the legacy root static site — on every push to `main` and every PR
(verified from its `on:` triggers). Whether any of these are configured as
*required* checks in branch protection has not yet been verified; either way,
the quality signals PRs receive currently describe a different codebase from
the one production serves.

The following is the exact approval card, posted to Discord **through the
bot** once it exists. Per the bootstrap sequence in `OPERATING_MODEL.md`
§11, the Gate-1 answer is deliberately the bot's first recorded approval —
the operating model itself is ratified first, manually, by merging its PR.

---

```text
PROJECT: emoj.ie
STAGE: Gate 1 — canonical codebase decision

QUESTION
Which implementation is canonical for production emoj.ie?

  A. astro-site is canonical. Update CI to build and test it; formally
     classify the root static site as legacy / migration input.
  B. The root static site is canonical. Change deployment to publish the
     root output and reconsider the Astro migration.

RECOMMENDATION
Option A.

WHY
The production workflow already deploys astro-site; making CI test what
production serves is one config-level change, while re-pointing production
at the root site would discard the in-flight Astro migration.

RISKS
- Astro test coverage (Vitest/Playwright) is younger than the root phased
  suites; the first aligned run may surface real gaps.
- The root suites are demoted from PR runs; anything still depending on
  root output must be identified before demotion.
- In-flight phase-02 design-system work targets astro-site and should land
  only after aligned checks, so its evidence is real from the first commit.

EVIDENCE
- deploy.yml builds ./astro-site via withastro/action (GitHub Pages)
- site-quality.yml runs root-only checks (phased suites, Playwright,
  Lighthouse) on every PR
- astro-site/package.json: Astro 5, Svelte 5, Vitest, @playwright/test
- Full issue contract: docs/PILOT_ISSUE_CI_ALIGNMENT.md

ACTIONS
- Approve A
- Approve B
- Request changes
- Pause
```

---

## On approval of Option A

1. The issue contract in `PILOT_ISSUE_CI_ALIGNMENT.md` is filed as a GitHub
   issue and becomes the pilot's first workload (label `queued`).
2. Separately (manual CEO/admin task, not agent work): check
   `martinkilmartin/emoj-ie` for GitHub Pages, `CNAME`, or DNS bindings for
   emoj.ie; strip any found; mark the repo legacy; archive it once nothing
   depends on it.

## On approval of Option B

The issue contract is rewritten (deployment re-pointed at root output; Astro
migration paused) and re-approved before any work starts. Option B is not
pre-drafted because it is not recommended.
