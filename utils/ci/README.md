# Local CI (`utils/ci`)

Pull-request validation for this repository runs on project-controlled hardware.
No GitHub-hosted job performs build, test, browser, accessibility, screenshot or
review work. The required commit status `ai-company/local-ci` is published by the
HP control plane from the evidence produced here.

## Command

```bash
node utils/ci/run-local-ci.mjs \
  --repository emoj-ie/emoj.ie \
  --issue-number 31 \
  --head-sha <40-char sha> \
  --correlation-id <run id> \
  --evidence-dir /absolute/path/to/evidence
```

Exit code `0` means every required check passed **and** every required artifact
exists. Any other outcome exits nonzero.

### Optional flags

| Flag | Purpose |
| --- | --- |
| `--repo-root <path>` | Checkout to validate. Defaults to the repository containing this script. |
| `--workspace-dir <path>` | Use a specific staging workspace instead of `mkdtemp`. Recreated from scratch each run. |
| `--keep-workspace` | Keep the staging workspace for debugging. |
| `--allow-dirty` | Record, rather than fail on, uncommitted changes. Never use for a run that will publish a status. |
| `--skip-sha-check` | Record, rather than fail on, a `HEAD` that differs from `--head-sha`. Never use for a run that will publish a status. |

## What it does

1. **`clean-checkout`** — verifies `HEAD` equals `--head-sha` and that the tree
   has no uncommitted changes.
2. **Staging workspace** — copies `grouped-openmoji.json`, `data/` and
   `astro-site/` into a temporary workspace. `astro-site/src/lib/data/load-emoji.ts`
   resolves its inputs relative to `process.cwd()/..`, so the siblings must
   travel with the app. The checkout under validation is never mutated.
3. **`dependencies`** — `npm ci` inside the staged `astro-site`, from its
   committed lockfile.
4. **`astro-build`** — `astro build`, then asserts that the home, category,
   detail and 404 pages exist in `dist/`.
5. **`vitest`** — `vitest run src/lib`. Passing requires a nonzero collected test
   count with no failures and no pending tests, so an empty filter can never read
   as a pass.
6. **`playwright-browsers`** — launches Chromium once up front. A missing browser
   is an explicit failure, never a skipped suite.
7. **`playwright-built-output`** — runs `astro-site/tests` against a static
   server serving `astro-site/dist`. `astro dev` is never used, and the generated
   Playwright config has no `webServer` block so it cannot fall back to one.
8. **`accessibility`** — `utils/ci/specs/accessibility` against the same built
   output.
9. **`screenshots`** — `utils/ci/specs/screenshots` writes desktop and mobile
   captures of the home, category and detail pages directly into the evidence
   directory.

Every Playwright run is rejected if it produced fewer tests than expected, or if
any test was skipped or flaky.

The static server process is always terminated, including on `SIGINT`/`SIGTERM`,
and the staging workspace is removed unless `--keep-workspace` is passed.

### The `astro-site/public/assets/emoji/base` symlink

That tracked path is an absolute symlink into a developer home directory, so a
clean worker may not be able to resolve it. The staging step excludes it from the
copy and re-creates it inside the workspace: as a symlink to the resolved target
when one exists, otherwise as an empty directory so the build stays portable
(artwork then falls back to the CDN path). Which branch was taken is recorded in
`manifest.notes`. The tracked symlink itself is never modified.

## Evidence layout

```text
<evidence-dir>/
  manifest.json
  logs/<check-id>.log
  reports/<check-id>.json          Playwright and Vitest machine-readable reports
  screenshots/{home,category,detail}-{desktop,mobile}.png
```

`manifest.json` contains `repository`, `issueNumber`, `headSha`,
`correlationId`, `startedAt`, `completedAt`, `verdict`, `checks` and
`artifacts`, plus `resolvedHeadSha`, `runner`, `notes`, `requiredCheckIds` and
`requiredArtifacts`.

- Each `checks` entry has `id`, `status`, `logPath`, `startedAt`, `completedAt`,
  `exitCode` and `details`.
- Each `artifacts` entry has `path`, `sha256` and `bytes`.
- `logPath` and `artifacts[].path` are relative to `evidenceDir`, which is
  recorded absolutely at the top level, so evidence stays valid when copied.
- `verdict` is `passed` only when every required check passed and every required
  screenshot exists.

Required check ids: `astro-build`, `vitest`, `playwright-built-output`,
`accessibility`, `screenshots`. `clean-checkout`, `dependencies` and
`playwright-browsers` are additional gates and must also pass.

`issueNumber` is the AI Company work item, which is also the pull request number
for a run bound to a pull-request head.

## Boundaries

This script generates evidence. It does not, and must not:

- publish a GitHub commit status (HP control plane only),
- write to PostgreSQL, Discord or the pull request,
- modify branch protection,
- publish to `gh-pages`.

Those steps belong to the HP control plane and release controller, which consume
`manifest.json` and verify `headSha` against the current pull-request head before
publishing `ai-company/local-ci`. A changed head SHA invalidates earlier
evidence.

## Workflows

`.github/workflows/` contains only manual, `workflow_dispatch`-gated legacy
workflows:

- `site-quality.yml` — ad-hoc inspection of the pre-Astro root site.
- `deploy.yml` — break-glass GitHub-hosted Pages build, removed once local
  `gh-pages` publishing is verified in production.

Neither may regain a `pull_request` or `push` trigger.
