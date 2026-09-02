# `ai-company/local-ci` — local validation of the canonical Astro application

All build, test, browser, accessibility and screenshot work for this repository
runs on project-controlled hardware. GitHub-hosted Actions perform none of it:
`.github/workflows/` contains **no workflow files at all** — the legacy
`site-quality` suite and the hosted Astro `deploy` workflow are both deleted
(justification in `.github/workflows/README.md`), so the hosted-job budget is
zero rather than "manual only".

## One command

```bash
node utils/ci/run-local-ci.mjs --sha <40-character head SHA> --pr <number>
```

| Option | Environment fallback | Meaning |
| --- | --- | --- |
| `--sha` | `LOCAL_CI_HEAD_SHA` | Exact commit to validate. Branch names and abbreviated SHAs are rejected. |
| `--pr` | `LOCAL_CI_PR_NUMBER` | Pull request number. **Required** — a run without it is rejected rather than producing evidence no control plane can bind to a pull request. |
| `--post-merge` | — | Validate a merged `main` SHA that has no pull request. Mutually exclusive with `--pr`. |
| `--browsers-path` | `LOCAL_CI_BROWSERS_PATH` | Playwright browser cache. Defaults to `~/.cache/ai-company/ms-playwright`, which this command populates itself. |
| `--repository` | `LOCAL_CI_REPOSITORY` | `owner/repo`; defaults to the source repo's `origin`. |
| `--correlation-id` | `AI_COMPANY_CORRELATION_ID` | Run correlation id; generated if absent. |
| `--evidence-dir` | `AI_COMPANY_EVIDENCE_DIR` | Evidence root. Defaults to a temp directory, which is printed. |
| `--source` | — | Git repository to clone from (default: this checkout). |
| `--remote` | `LOCAL_CI_REMOTE` | Fetch the SHA from here when `--source` does not have it yet. |
| `--workspace` | — | Where the clean checkout is created. |
| `--keep-workspace` | — | Keep the checkout on success (it is always kept on failure). |

Exit code `0` means every required check passed; `1` means the run failed.
A run also fails when a required check cannot execute at all — missing
`vitest`, missing `playwright`, a browser that will not launch, zero tests
collected, or any skipped test. Nothing is silently skipped.

The run needs no ambient setup beyond `git`, `node` and `npm`: it installs the
lockfile-pinned chromium into its own browser cache on every run, so a clean
worker validates identically to one that has run before. System libraries need
root — the run installs them with `--with-deps` when it has it, and otherwise
proves they are present by launching chromium before any browser check depends
on it, failing with the exact `install-deps` command when they are not.

## What it does

| Check | What it proves |
| --- | --- |
| `clean-checkout` | Fresh clone with no working-tree modifications. |
| `exact-head-sha` | `HEAD` equals the requested SHA — evidence is SHA-bound. |
| `no-hosted-ci` | No workflow at that SHA declares an automatic trigger (`pull_request`, `pull_request_target`, `push`, `schedule`, `merge_group`) **or** a GitHub-hosted `runs-on:` job — including manual ones, because the permitted hosted-job budget is zero. |
| `node-version-pin` | `site/package.json`'s `engines.node` allows Node 22+, the repo's `.nvmrc` pins a major version that satisfies it, and this worker's own Node satisfies it too — a fresh `nvm use && npm ci` produces no engines warning. A missing or unparseable value fails the check; it is never read as "no constraint". |
| `dependency-install` | `npm ci` in `site`, from its lockfile. |
| `dependency-audit` | `npm audit --audit-level=high` in `site`. Any `critical`/`high` severity advisory fails the run; `moderate` and below only log a warning. An unparseable report, a registry error, or an unexplained non-zero exit with zero critical/high advisories counted all fail the check — none of those states is read as "no advisories". |
| `playwright-browsers` | The lockfile-pinned chromium is installed into the project-controlled browser cache by this run, and actually launches here — no dependence on a pre-existing user cache. |
| `astro-build` | `npm run build` succeeds and produces HTML in `site/build`. The check name is historical: `hp-controller` requires it by this name, so renaming it would fail every release. |
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
  npm-audit.json
  vitest-results.json
  playwright-results.json
  accessibility-report.json
  logs/<check>.log              # full stdout+stderr per check
  screenshots/<route>-<viewport>.png
```

`manifest.json` fields: `schemaVersion`, `requiredStatus`, `repository`,
`context` (`pull_request` / `post_merge`), `pullRequestNumber` (never `null` for
a pull-request run), `headSha`, `correlationId`, `startedAt`, `completedAt`,
`durationMs`, `runner`, `workspace`, `evidenceDir`, `checks[]` (each with
`name`, `status` — `pass` / `fail` / `not_run` —, timestamps, `details`, and
`error` when failed), `artifacts[]` (each with `path`, `relativePath`, `kind`,
`bytes`, `sha256`), `verdict` (`pass` / `fail`), `failureReason`, and
`requiresControlPlaneEvidence[]` — the pre-merge evidence the worker cannot
produce itself. A `pass` verdict is a local result, not an approval: the change
is approvable only once the control-plane evidence below exists too.

## Publishing the required status (HP control plane)

`run-local-ci.mjs` never talks to GitHub. Publication is a separate,
refusable step run on the control plane:

```bash
node utils/ci/publish-local-ci.mjs \
  --manifest "$AI_COMPANY_EVIDENCE_DIR/manifest.json" \
  [--branch main] [--dry-run]
```

The repository is taken from the manifest. `--repository` is accepted only as an
assertion: a value that differs from `manifest.repository` is a refusal, so
evidence produced for one repository can never publish a status against another.

Required environment: `GITHUB_TOKEN` (or `GH_TOKEN`),
`AI_COMPANY_DATABASE_URL` (or `DATABASE_URL`),
`AI_COMPANY_DISCORD_WEBHOOK_URL` (or `DISCORD_WEBHOOK_URL`). Optional
`AI_COMPANY_EVIDENCE_BASE_URL` becomes the status `target_url`. A missing token,
database or webhook is a refusal, not a warning.

In order it:

1. re-hashes every artifact against `manifest.json` and refuses on any mismatch,
   missing file, missing pull request number, or a `pass` verdict whose required
   checks did not all pass;
2. refuses if the pull request's **current** head SHA no longer equals the
   validated SHA — a new push invalidates the earlier result;
3. records the `main` ruleset **before** any modification
   (`control-plane/ruleset-before.json`);
4. records the run, head SHA, verdict, artifact paths and SHA-256 hashes in
   PostgreSQL (`local_ci_runs`, `local_ci_artifacts`, created if absent) via
   `psql`;
5. adds `ai-company/local-ci` to the active `main` branch ruleset's required
   status checks and records the resulting ruleset
   (`control-plane/ruleset-after.json`), verifying the check is present
   afterwards. This is **mandatory**, not a flag: a passing run that cannot
   protect the branch does not get to publish a green status;
6. posts the SHA-bound summary to the pull request and to Discord — no GitHub
   Actions artifact storage is used anywhere;
7. verifies that `ruleset-before.json`, `postgres-record.json`,
   `ruleset-after.json` and `summary.json` all exist and parse, and that the
   resulting ruleset really requires `ai-company/local-ci`;
8. **only then** publishes the `ai-company/local-ci` commit status as `success`
   (`control-plane/local-ci-status.json`);
9. writes `control-plane/control-plane-manifest.json` with SHA-256 hashes of its
   own evidence — and reverts the status to `failure` if that last step fails.

Because the status is published last, a green `ai-company/local-ci` cannot exist
without the complete control-plane evidence behind it. A manifest whose verdict
is not `pass` short-circuits at step 2: it publishes `failure` immediately, never
touches branch protection, and exits non-zero.

Control-plane evidence lands next to the run evidence:

```
$AI_COMPANY_EVIDENCE_DIR/control-plane/
  ruleset-before.json  postgres-record.json  local-ci-status.json
  ruleset-after.json   summary.json          control-plane-manifest.json
```

## After merge — the release controller

```bash
node utils/ci/release-main.mjs --sha <merged main SHA> [--dry-run]
```

Same environment as the publisher (`GITHUB_TOKEN`, `AI_COMPANY_DATABASE_URL`,
`AI_COMPANY_DISCORD_WEBHOOK_URL`); a missing one is a failure, not a warning.
Useful options: `--pages-branch` (default `gh-pages`), `--production-url`
(default: `dist/CNAME`, else the `github.io` project URL), `--smoke-attempts`,
`--smoke-interval`, `--evidence-dir`.

| Step | What it proves |
| --- | --- |
| `exact-main-sha` | The requested SHA is the **current** tip of `main`. Anything else refuses to publish. |
| `repeated-local-validation` | `run-local-ci.mjs --post-merge` passes again on that SHA, on this hardware, and its manifest is bound to it. |
| `gh-pages-publication` | The `gh-pages` tree is byte-for-byte the built `site/build` plus `.nojekyll` — no extra files, none missing — committed with a `Source-SHA:` trailer and confirmed at the remote tip. |
| `production-smoke` | `https://emoj.ie/` returns 200 and its body hashes to the exact `index.html` just published; it retries until it does, then fails loudly. |
| `production-source-sha` | The remote `gh-pages` tip is the published commit and records `Source-SHA: <merged main SHA>`. |

The run reaches `complete` only when all five steps pass **and** the release is
recorded in PostgreSQL (`local_ci_releases`) with a Discord summary; otherwise
`release-manifest.json` records `failed`, the workspace is kept for triage, and
the exit code is `1`. A `--dry-run` rehearsal publishes nothing and records
`complete-dry-run`, never `complete`.

```
$AI_COMPANY_EVIDENCE_DIR/release/
  release-manifest.json    postgres-record.json  discord-summary.json
  logs/<step>.log          post-merge-validation/   # a full run-local-ci evidence tree
```

GitHub Pages serves the root of `gh-pages` and performs no build: the hosted
`deploy.yml` workflow is deleted, not retained as a fallback.

Neither machine is registered as a GitHub Actions self-hosted runner.
