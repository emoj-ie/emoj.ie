# Emoj.ie Skill Execution Plan

## Objective
Apply all high-value, relevant skills to improve `emoj.ie` product quality, discoverability, measurement, and launch readiness without regressions.

## Skills To Apply (Recommended, In Order)
1. `product-marketing-context` (foundation and shared constraints)
2. `web-design-guidelines` (UI/accessibility audit baseline)
3. `frontend-design` (UI implementation improvements)
4. `page-cro` (homepage/search conversion improvements)
5. `copywriting` (new/rewritten conversion copy)
6. `copy-editing` (copy quality pass)
7. `schema-markup` (structured data correctness and coverage)
8. `programmatic-seo` (high-intent page expansion strategy)
9. `competitor-alternatives` (comparison pages strategy/content)
10. `content-strategy` (topic clusters and editorial roadmap)
11. `analytics-tracking` (event instrumentation and measurement QA)
12. `webapp-testing` (functional UI QA)
13. `playwright` (automated browser regression checks)
14. `launch-strategy` (rollout plan)
15. `social-content` (distribution assets)

## Not Appropriate Right Now
- `signup-flow-cro`, `onboarding-cro`, `paywall-upgrade-cro`, `form-cro`, `email-sequence`, `referral-program`, `paid-ads`, `supabase-postgres-best-practices`, `cloudflare-deploy`, `mcp-builder`, `svelte-code-writer`
- Reason: no signup/paywall/funnel backend in this repo, no DB workload, no Svelte stack, no current Cloudflare migration request.

## Execution Model
Use phase gates with selective parallelization. Do not start implementation phases until baseline audits and regressions are captured.

## Phase Plan

### Phase 0: Baseline and Context (Sequential)
Skills: `product-marketing-context`

Deliverables:
- `.claude/product-marketing-context.md` refreshed
- Baseline metrics captured in `docs/SKILL_EXECUTION_PROGRESS.md`

Mandatory commands:
```bash
npm run build
npm test
npm run lint:links
npm run test:playwright-smoke
npm run test:lighthouse-budget
```

Gate to continue:
- All baseline commands pass or known failures are logged with owner and fix plan.

### Phase 1: Audit Wave (Parallel)
Lane A skills: `web-design-guidelines`
Lane B skills: `schema-markup`, `programmatic-seo`
Lane C skills: `analytics-tracking`

Deliverables:
- Prioritized audit findings list (P0/P1/P2) in progress tracker
- Explicit “fix backlog” tasks created before implementation

Gate to continue:
- Top P0/P1 items accepted into implementation scope.

### Phase 2: Implementation Wave (Parallel)
Lane A skills: `frontend-design`, `page-cro`, `copywriting`, `copy-editing`
Lane B skills: `schema-markup`, `programmatic-seo`, `competitor-alternatives`, `content-strategy`
Lane C skills: `analytics-tracking`

Rules:
- Every behavior change must include tests or assertions to prevent regressions.
- Prefer small batches; after each batch run targeted tests plus full `npm test` before merge.

Per-batch command gate:
```bash
npm run build
npm test
```

### Phase 3: QA Hardening (Sequential)
Skills: `webapp-testing`, `playwright`

Mandatory commands:
```bash
npm run test:playwright-smoke
npm run test:playwright-baseline
npm run test:lighthouse-budget
npm test
```

Deliverables:
- Regression checklist pass
- Any discovered bugs fixed with new tests

### Phase 4: Launch and Distribution (Sequential)
Skills: `launch-strategy`, `social-content`

Deliverables:
- Launch checklist
- Announcement copy/package
- Post-launch monitoring plan tied to analytics events

## Agent Loop (Repeat Until Complete)
1. Pick next ready item from current phase.
2. Apply the specified skill workflow.
3. Implement minimal safe change.
4. Run required tests.
5. If tests fail, fix immediately or revert that batch.
6. Update `docs/SKILL_EXECUTION_PROGRESS.md` with timestamp, status, and evidence.
7. Commit with phase-prefixed message.
8. Move to next item only when gate is satisfied.

## Parallelization Rules
Allowed in parallel:
- Audit lanes in Phase 1
- Implementation lanes in Phase 2

Must stay sequential:
- Phase transitions
- Final QA hardening
- Launch packaging

## Regression Policy
- No phase is complete with failing `npm test`.
- Any bug found during manual or Playwright testing requires:
1. failing test or reproducible check
2. fix
3. passing rerun evidence logged in progress tracker

## Definition of Done
- All 15 selected skills applied.
- All phase gates passed.
- `npm run build`, `npm test`, `npm run lint:links`, `npm run test:playwright-smoke`, `npm run test:lighthouse-budget` pass.
- Progress tracker is fully completed with evidence links/notes.
