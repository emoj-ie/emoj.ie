# Pilot Issue Contract — Align required CI checks with the canonical production Astro application

**Status:** Drafted 2026-07-26. Blocked on Gate-1 approval of Option A
(see `PILOT_GATE1_DECISION.md`). On approval, file verbatim as a GitHub
issue; the issue then becomes the binding contract.

---

## Title

```text
Align required CI checks with the canonical production Astro application
```

## Goal

Every required PR check must build and test the same codebase, at the same
path, with the same build step, as the production deployment publishes —
so that green checks are evidence about what users actually receive.

## Context

- `deploy.yml` publishes `./astro-site` (Astro 5 + Svelte 5) to GitHub Pages
  on push to `main`, via `withastro/action`.
- `site-quality.yml` runs on every push to `main` and every PR, executing
  root-site checks only (phased Node suites, root Playwright smoke,
  Lighthouse budgets, link scan). Whether branch protection currently marks
  any check as required is unverified — see acceptance criterion 6.
- Consequence: a PR can pass every quality check that runs while changing
  nothing production serves, or break production without any check going
  red.
- Verified from the first PR run of `site-quality.yml` (run 30212560069,
  2026-07-26): Playwright is not installed on the runner, so the smoke test
  and runtime vitals budget **silently skip** ("Playwright not installed;
  skipping…") while the job continues; and the byte-budget check currently
  fails on `main` itself (`generated-pages.js`: 41,056 B > 40,000 B budget),
  so the legacy quality gate is red on the base branch independent of any
  PR's changes.

## Acceptance criteria

1. **Shared deterministic build step.** A single reusable step (composite
   action or reusable workflow: pinned Node version, `npm ci` against
   `astro-site`'s lockfile, `astro build`) is consumed by BOTH the quality
   workflow and the deployment workflow, so tested output and deployed
   output come from the same build definition by construction, not by
   assertion. No hosting migration — GitHub Pages publishing is unchanged.
2. **Astro build passes in CI.** `astro build` succeeds with dependencies
   installed from `astro-site`'s lockfile.
3. **Vitest runs in CI** against `astro-site`.
4. **Playwright runs against the built production output** — a static server
   or `astro preview` over `astro-site/dist`. Never against `astro dev`.
   Browser installation is an explicit CI step, and the job **fails loudly**
   if browsers are unavailable — the legacy workflow's silent
   "Playwright not installed; skipping" behavior must not carry over.
5. **Screenshots uploaded as workflow artifacts** from the Playwright run.
6. **Branch protection verified, then re-pointed.** First, the CURRENT
   branch-protection configuration for `main` (which checks, if any, are
   required today) is queried via the GitHub API and recorded in the PR as
   evidence. Then the new Astro checks are made required. Alignment that is
   not required is decorative.
7. **Legacy checks demoted, not deleted.** Root suites renamed (e.g.
   `legacy-site-quality`), moved to manual/scheduled trigger, non-required,
   with a one-line stated purpose, or removed with explicit justification.
8. **Production deployment unchanged** until the aligned checks pass on this
   PR. `deploy.yml` behavior is modified only insofar as needed to share the
   build step with the quality workflow.

## Out of scope

- Any change to site behavior, content, styling, or the Astro migration
  itself.
- Hosting migration (stays on GitHub Pages).
- Auto-rollback or deployment smoke automation.
- The legacy personal repository (`martinkilmartin/emoj-ie`) — handled as a
  separate manual admin task.

## Risk tier

Low for the product (no runtime behavior change); medium for process (this
change defines what "green" means for everything after it). Reviewer must
specifically check for weakened or skipped coverage.

## Budget

- Builder: max 30 turns, 25 min wall clock, 1 automatic retry.
- Expected size: workflow YAML + possibly a shared composite step; no
  application code.

## Execution (machine-readable)

The prose above is the human contract; this block is the projection the
dispatcher and deterministic verification consume. Changed files outside
`allowed_paths` (or touching `forbidden_paths`) fail scope verification
regardless of what the PR description claims.

```yaml
execution:
  schema_version: 1
  repository: emoj-ie/emoj.ie
  base_branch: main

  allowed_paths:
    - .github/workflows/**
    - .github/actions/**
    - utils/ci/**

  forbidden_paths:
    - astro-site/src/**
    - astro-site/public/**

  budget:
    max_turns: 30
    timeout_minutes: 25
    retries: 1

  required_evidence:
    pre_merge:
      - astro-build
      - vitest
      - playwright
      - screenshots
      - reviewer-check
      - branch-protection-before
      - branch-protection-after
    post_merge:
      - legacy-workflow-manual-run
      - production-deploy
```

The identifiers map one-to-one onto the evidence bullets below. `pre_merge`
evidence gates Gate 2. `post_merge` evidence is required before the run
reaches `complete` — it cannot exist earlier: a `workflow_dispatch` trigger
is only invocable once the workflow exists on the repository's default
branch, so the first true manual dispatch of the demoted legacy workflow is
only possible after this PR merges.

## Required evidence

Pre-merge (gates Gate 2):

- Draft PR whose changed files are limited to `.github/workflows/**` (plus
  any shared build step under `.github/actions/**` or `utils/ci/**`).
- Green runs of the new Astro checks on the PR head SHA.
- Playwright screenshot artifacts from the built output.
- Reviewer check run with verdict `approve` and no scope drift.
- Branch-protection API output recorded BEFORE (current required checks, if
  any) and AFTER (new Astro checks required). Flipping branch protection
  itself is a CEO/admin action; the PR documents the exact check names to
  require.

Post-merge (gates `complete`, not Gate 2):

- A manual (`workflow_dispatch`) run of the demoted legacy workflow proving
  it still executes — only possible after merge, since the dispatch trigger
  must exist on the default branch.
- Successful production deploy from the resulting push to `main`.

## Definition of done

Merged to `main` via the controlled path with SHA-bound CEO approval; the
resulting push to `main` deploys successfully; a manual dispatch of the
demoted legacy workflow succeeds; required checks on the *following* PR are
the Astro checks. The run reaches `complete` only once all `post_merge`
evidence exists.
