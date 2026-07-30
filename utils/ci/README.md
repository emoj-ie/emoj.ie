# Local CI

All build, test, browser, accessibility and screenshot work for this repository
runs on project-controlled hardware. GitHub-hosted Actions perform none of it:
no workflow in `.github/workflows/**` runs on `pull_request` or `push`, and the
two workflows that remain are `workflow_dispatch`-only legacy surfaces.

## The single validation command

```sh
node utils/ci/run-local-ci.mjs \
  --repository emoj-ie/emoj.ie \
  --issue-number 31 \
  --pr-number 34 \
  --head-sha <40-char-sha> \
  --correlation-id <run-correlation-id> \
  --evidence-dir /absolute/path/to/evidence/<correlation-id>
```

`--head-sha` must be the full 40-character SHA; abbreviated identifiers are
rejected so evidence always names one unambiguous commit.

Optional flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--pr-number <n>` | none | pull request the head SHA belongs to; recorded as `prNumber` |
| `--repo-root <path>` | this repository | repository to export the head SHA from |
| `--base-port <n>` | `43210` | first port tried for the preview server |
| `--keep-staging` | off | keep the staging workspace even on success |
| `--reset-evidence-dir` | off | clear a pre-existing, non-empty evidence directory |

A non-empty `--evidence-dir` is refused unless `--reset-evidence-dir` is given,
so stale logs, screenshots or manifests can never be reported as this run.

`--pr-number` is optional for issue-scoped runs, but a manifest without it sets
`controlPlane.eligibleForStatus: false`; the control plane must not publish
`ai-company/local-ci` from such a run.

Exit code is `0` only when the verdict is `passed`. Any failure exits nonzero,
and the manifest is written either way.

## What it does

1. **clean-checkout** — `git archive` of the exact head SHA into a temporary
   staging workspace (`astro-site`, `grouped-openmoji.json`, `data/`,
   `assets/emoji/base`; the middle two are read by
   `astro-site/src/lib/data/load-emoji.ts` at build time). The working copy's
   state cannot influence the run.

   `astro-site/public/assets/emoji/base` is tracked as a symlink to
   `/home/sionnach/...`: mutable, unversioned, and present on one machine only.
   Following it would let the same SHA build differently on different workers,
   so the staged copy always discards it and puts the `assets/emoji/base` tree
   exported from the requested commit in its place. Everything the build
   consumes therefore comes from the commit.

   If that path is absent from the commit, the run fails explicitly — an empty
   asset tree is never substituted, and the machine-local path is never used.
   The repository's own symlink is not touched; only the throwaway staging copy
   is rewritten. The manifest records the asset tree OID and file count.

2. **npm-ci** — `npm ci` from `astro-site/package-lock.json`. No dependency
   outside that lockfile is used.
3. **astro-build** — `astro build`, then verification that `dist/` really
   contains the expected entry pages.
4. **vitest** — the unit suite under `astro-site/src/lib`, with
   `--passWithNoTests=false` so an empty suite fails instead of passing.
5. **playwright-browsers** — explicit `playwright install chromium`. A missing
   browser fails the run; no test may silently skip.
6. **playwright-built-output** — `astro-site/tests` run against `astro preview`
   serving the built `dist/`, never `astro dev`.
7. **accessibility** — structural a11y smoke checks (`utils/ci/templates/a11y.spec.mjs`)
   over home, category, subgroup and detail pages of the built output.
8. **screenshots** — home, category and detail captures written straight into
   the evidence directory. Nothing is uploaded to GitHub Actions artifact
   storage.

The preview server is started in its own process group and is always stopped —
on success, on failure, and on `SIGINT`/`SIGTERM`/`SIGHUP`.

## Evidence layout

```text
<evidence-dir>/manifest.json
<evidence-dir>/logs/<check-id>.log
<evidence-dir>/screenshots/{home,category,detail}.png
```

`manifest.json` contains `repository`, `issueNumber`, `prNumber`, `headSha`,
`correlationId`, `startedAt`, `completedAt`, `verdict`, `checks` and
`artifacts`. Each `checks` entry has `id`, `status` and `logPath`; each
`artifacts` entry has `path` and `sha256`. It also records `assets` (the
SHA-exported emoji tree OID and file count) and `controlPlane`
(`statusContext`, `eligibleForStatus`).

`verdict` is `passed` only when every required check passed, every check log
exists, and the required screenshots exist. Required check IDs:

```text
astro-build  vitest  playwright-built-output  accessibility  screenshots
```

## Control-plane responsibilities (outside this script)

This script produces evidence; it publishes nothing. The HP control plane:

- records the run, head SHA, verdict, artifact locations and hashes in
  PostgreSQL;
- publishes the required `ai-company/local-ci` commit status, `success` only
  when `manifest.controlPlane.eligibleForStatus` is `true` (verdict `passed`
  and a `prNumber` present), `manifest.prNumber` is the pull request under
  review, and `manifest.headSha` equals its current head SHA (a changed head
  SHA invalidates the earlier result);
- records the ruleset for `main` before and after adding `ai-company/local-ci`
  as a required status check;
- posts the SHA-bound summary to the pull request and Discord;
- after merge, re-runs this same command against the approved `main` SHA and
  publishes the resulting `astro-site/dist` (which already includes
  `.nojekyll`) to the `gh-pages` branch, then verifies production.

## Retained workflows

| File | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/legacy-site-quality.yml` | `workflow_dispatch` | manual-only checks for the legacy root site; never required |
| `.github/workflows/deploy.yml` | `workflow_dispatch` | break-glass GitHub-hosted Pages build; delete once `gh-pages` publishing is verified |
