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
  --head-sha <40-char-sha> \
  --correlation-id <run-correlation-id> \
  --evidence-dir /absolute/path/to/evidence/<correlation-id>
```

Optional flags:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--repo-root <path>` | this repository | repository to export the head SHA from |
| `--base-port <n>` | `43210` | first port tried for the preview server |
| `--keep-staging` | off | keep the staging workspace even on success |

Exit code is `0` only when the verdict is `passed`. Any failure exits nonzero,
and the manifest is written either way.

## What it does

1. **clean-checkout** — `git archive` of the exact head SHA into a temporary
   staging workspace (`astro-site`, `grouped-openmoji.json`, `data/`; the last
   two are read by `astro-site/src/lib/data/load-emoji.ts` at build time). The
   working copy's state cannot influence the run.

   `astro-site/public/assets/emoji/base` is tracked as an absolute symlink to a
   path that exists on only one machine. The repository symlink is never
   modified; only the staged copy is made buildable — the link is kept when its
   target resolves, and replaced with an empty directory when it does not, so a
   clean worker can build. Markup and tests are unaffected either way; the run
   records which strategy was used.

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

`manifest.json` contains `repository`, `issueNumber`, `headSha`,
`correlationId`, `startedAt`, `completedAt`, `verdict`, `checks` and
`artifacts`. Each `checks` entry has `id`, `status` and `logPath`; each
`artifacts` entry has `path` and `sha256`.

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
  when `manifest.verdict == "passed"` and `manifest.headSha` equals the current
  pull-request head SHA (a changed head SHA invalidates the earlier result);
- posts the SHA-bound summary to the pull request and Discord;
- after merge, re-runs this same command against the approved `main` SHA and
  publishes the resulting `astro-site/dist` (which already includes
  `.nojekyll`) to the `gh-pages` branch, then verifies production.

## Retained workflows

| File | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/legacy-site-quality.yml` | `workflow_dispatch` | manual-only checks for the legacy root site; never required |
| `.github/workflows/deploy.yml` | `workflow_dispatch` | break-glass GitHub-hosted Pages build; delete once `gh-pages` publishing is verified |
