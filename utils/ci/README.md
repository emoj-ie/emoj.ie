# Local CI (`utils/ci`)

Pull-request validation for this repository runs on project-controlled
machines, not on GitHub-hosted runners. GitHub Actions performs no build, test,
browser, accessibility, screenshot, or review work; the workflows that remain in
`.github/workflows/` are `workflow_dispatch`-only.

## Entry point

```sh
node utils/ci/run-local-ci.mjs \
  --repository emoj-ie/emoj.ie \
  --issue-number 31 \
  --head-sha <40-char-sha> \
  --correlation-id <run-id> \
  --evidence-dir /absolute/path/to/evidence
```

Optional flags:

| Flag                | Meaning                                                    |
| ------------------- | ---------------------------------------------------------- |
| `--repo-root <path>`| Repository to archive the SHA from (default: this repo)     |
| `--port <number>`   | Preview server port (default: an ephemeral free port)       |
| `--keep-workspace`  | Keep the staging workspace even when the run passes         |

Exit code is `0` only when every required check passed and every required
artifact exists. A manifest is written on every run, including failures.

## What it does

1. **clean-checkout** — `git archive` of the exact requested SHA into a fresh
   temporary staging workspace. The repository working tree is never touched, so
   uncommitted state cannot leak into a run.

   The tracked path `astro-site/public/assets/emoji/base` is an absolute symlink
   into a developer home directory. Any dangling symlink found in the staging
   copy is replaced there with an empty directory so the build is portable on a
   clean worker. The tracked symlink itself is never modified, and every repair
   is recorded in the manifest under `workspace.repairedSymlinks`.

2. **dependency-install** — `npm ci` in the staged `astro-site`, from
   `astro-site/package-lock.json`.

3. **astro-build** — `npm run build`, then asserts `dist/index.html` exists.

4. **vitest** — the installed `vitest` binary over `astro-site/src/lib`. The
   JSON report is asserted to contain at least one test, zero failures and zero
   skips.

5. **playwright-built-output** — `astro preview` serves the built `dist/` output
   on a loopback port, and Playwright runs `astro-site/tests` against it using
   `utils/ci/playwright.ci.config.mjs`. That config declares no `webServer`, so
   a fall back to `astro dev` is impossible. A missing chromium browser is an
   explicit preflight failure with remediation instructions
   (`npx playwright install --with-deps chromium`); no test may silently skip.

6. **accessibility** — `utils/ci/a11y-smoke.mjs` runs deterministic DOM
   accessibility rules against home, category, subgroup and detail pages of the
   built output. Any violation fails the run.

7. **screenshots** — `utils/ci/capture-screenshots.mjs` captures full-page
   desktop and mobile screenshots of the home, category and detail pages
   directly into the evidence directory.

The preview server is started detached in its own process group and is always
reaped (`SIGTERM`, then `SIGKILL`) on success, failure, or `SIGINT`/`SIGTERM`.

## Evidence layout

```text
<evidence-dir>/
  manifest.json
  logs/<check-id>.log
  reports/{vitest,playwright,accessibility,screenshots}.json
  screenshots/{home,category,detail}-{desktop,mobile}.png
```

`manifest.json` contains `repository`, `issueNumber`, `headSha`,
`correlationId`, `startedAt`, `completedAt`, `verdict`, `checks` and
`artifacts`. Each `checks` entry has `id`, `status` and `logPath`; each
`artifacts` entry has `path` and `sha256`. Paths are relative to the evidence
directory, with an absolute variant alongside.

`verdict` is `passed` only when every check passed and every required artifact
exists. A required check that never ran is recorded with status `not-run`, so a
missing check can never be mistaken for a pass.

## Boundaries

The worker only produces evidence. Publishing the required
`ai-company/local-ci` commit status, recording the run in PostgreSQL, and
posting the pull-request and Discord summaries are the HP control plane's
responsibility. Artifacts are never uploaded to GitHub Actions artifact
storage. See `docs/OPERATING_MODEL.md`.
