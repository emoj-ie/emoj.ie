# No GitHub Actions workflows — by policy

This directory intentionally contains **no workflow files**. GitHub-hosted
runners perform no build, test, browser, accessibility, screenshot, review or
deployment work for this repository, and the permitted GitHub-hosted CI job
count is zero — including manual (`workflow_dispatch`) jobs, which still consume
hosted minutes and still produce results outside the evidence chain.

## What replaced them

| Removed workflow | Replacement |
| --- | --- |
| `site-quality` (`pull_request`, `push: main`) — legacy root-site build, tests, links, a11y, Playwright, Lighthouse | `node utils/ci/run-local-ci.mjs`, run on project-controlled hardware against the exact head SHA. It validates the canonical production application (`astro-site`): build, Vitest, Playwright against the built `dist`, accessibility, screenshots. |
| `deploy.yml` — hosted Astro build + `actions/deploy-pages` | The local release controller rebuilds the approved `main` SHA with the same command and publishes the resulting `astro-site/dist` (including `.nojekyll`) to the `gh-pages` branch. GitHub Pages serves the root of `gh-pages` and performs no build. |

The legacy root-site suite was **removed rather than kept as a manual
fallback**: it tested the pre-Astro root site, not the canonical production
application, its Playwright step skipped silently on hosted runners (no browsers
installed), and its Lighthouse byte budget already failed on `main`. Everything
it was meant to protect is now asserted locally, loudly, and SHA-bound by
`utils/ci/run-local-ci.mjs`.

## The one required check

```text
ai-company/local-ci
```

It is published by the HP control plane from a verified local evidence manifest
(`utils/ci/publish-local-ci.mjs`), never by a GitHub Actions workflow. Neither
local machine is registered as a GitHub Actions self-hosted runner.

`utils/ci/run-local-ci.mjs` enforces this policy as a required check: the run
fails if any workflow file at the validated SHA declares an automatic trigger or
a GitHub-hosted `runs-on:` job. Adding a workflow here therefore fails CI.

See `utils/ci/README.md` for the full contract.
