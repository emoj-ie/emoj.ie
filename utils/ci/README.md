# `ai-company/local-ci` — local validation of the canonical Astro application

All build, test, browser, accessibility and screenshot work for this repository
runs on project-controlled hardware. GitHub-hosted Actions perform none of it:
`.github/workflows/` now contains only manual (`workflow_dispatch`) workflows,
and no workflow runs on `pull_request` or on pushes to `main`.

## One command

```bash
node utils/ci/run-local-ci.mjs --sha <40-character head SHA> [--pr <number>]
```

| Option | Environment fallback | Meaning |
| --- | --- | --- |
| `--sha` | `LOCAL_CI_HEAD_SHA` | Exact commit to validate. Branch names and abbreviated SHAs are rejected. |
| `--pr` | `LOCAL_CI_PR_NUMBER` | Pull request number (omit for post-merge `main` runs). |
| `--repository` | `LOCAL_CI_REPOSITORY` | `owner/repo`; defaults to the source repo's `origin`. |
| `--correlation-id` | `AI_COMPANY_CORRELATION_ID` | Run correlation id; generated if absent. |
| `--evidence-dir` | `AI_COMPANY_EVIDENCE_DIR` | Evidence root. Defaults to a temp directory, which is printed. |
| `--source` | — | Git repository to clone from (default: this checkout). |
| `--remote` | `LOCAL_CI_REMOTE` | Fetch the SHA from here when `--source` does not have it yet. |
| `--workspace` | — | Where the clean checkout is created. |
| `--keep-workspace` | — | Keep the checkout on success (it is always kept on failure). |

Exit code `0` means every required check passed; `1` means the run failed.
A run also fails when a required check cannot execute at all — missing
`vitest`, missing `playwright`, missing chromium binary, zero tests collected,
or any skipped test. Nothing is silently skipped.

## What it does

| Check | What it proves |
| --- | --- |
| `clean-checkout` | Fresh clone with no working-tree modifications. |
| `exact-head-sha` | `HEAD` equals the requested SHA — evidence is SHA-bound. |
| `no-hosted-ci` | No workflow at that SHA declares an automatic trigger (`pull_request`, `pull_request_target`, `push`, `schedule`, `merge_group`), so no hosted job can build, test or gate the commit. |
| `dependency-install` | `npm ci` in `astro-site`, from its lockfile. |
| `astro-build` | `npm run build` succeeds and produces HTML in `astro-site/dist`. |
| `vitest` | The Astro app's unit suite passes, with >0 tests and 0 skips. Playwright specs (`tests/*.spec.ts`) are excluded here; they run below. |
| `playwright-built-output` | `playwright.config.ts` is asserted to serve the built output (never `astro dev`), chromium is asserted to be installed, and the suite passes with >0 tests and 0 skips. |
| `accessibility` | `utils/ci/browser-evidence.mjs` loads pages from a static server over `dist` and asserts the rules listed below. |
| `screenshots` | Desktop and mobile PNGs captured from that same built output. |
| `evidence-manifest` | `manifest.json` written with SHA-256 hashes of every artifact. |

Accessibility rules asserted on every sampled route (home, category, subgroup,
detail): `html-has-lang`, `document-title`, `single-h1`, `heading-order`,
`image-alt`, `link-name`, `button-name`, `form-field-label`, `main-landmark`,
`unique-ids`, `no-positive-tabindex`, plus zero uncaught page errors.

## Evidence layout

```
$AI_COMPANY_EVIDENCE_DIR/
  manifest.json                 # SHA-bound run manifest (see below)
  vitest-results.json
  playwright-results.json
  accessibility-report.json
  logs/<check>.log              # full stdout+stderr per check
  screenshots/<route>-<viewport>.png
```

`manifest.json` fields: `schemaVersion`, `requiredStatus`, `repository`,
`pullRequestNumber`, `headSha`, `correlationId`, `startedAt`, `completedAt`,
`durationMs`, `runner`, `workspace`, `evidenceDir`, `checks[]` (each with
`name`, `status` — `pass` / `fail` / `not_run` —, timestamps, `details`, and
`error` when failed), `artifacts[]` (each with `path`, `relativePath`, `kind`,
`bytes`, `sha256`), `verdict` (`pass` / `fail`) and `failureReason`.

## Control-plane responsibilities (not in this repository)

The script produces evidence; it never talks to GitHub. The HP control plane:

1. reads `manifest.json`, copies logs, screenshots and hashes to durable
   project-controlled storage, and records the run, head SHA, verdict, artifact
   locations and hashes in PostgreSQL;
2. publishes the `ai-company/local-ci` commit status — `success` only when the
   manifest verdict is `pass` **and** `headSha` still equals the pull request's
   current head SHA (a new head SHA invalidates the previous result);
3. posts the SHA-bound summary to the pull request and Discord (no GitHub
   Actions artifact storage is used);
4. records the `main` ruleset before and after adding `ai-company/local-ci` as a
   required status check.

After an approved merge, the release controller re-runs this same command
against the merged `main` SHA, publishes the resulting `astro-site/dist`
(including `.nojekyll`) to `gh-pages`, verifies the production URL, and records
the deployed source SHA. Once branch publishing is verified, GitHub Pages is
pointed at the root of `gh-pages` and `.github/workflows/deploy.yml` — retained
for now only as a manual rollback path — is deleted.

Neither machine is registered as a GitHub Actions self-hosted runner.
