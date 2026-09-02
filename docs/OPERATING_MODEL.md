# AI Company Operating Model — Pilot (v1.0)

**Status:** Ratified 2026-07-26 by CEO approval recorded in PR #30. Converged
from two independent AI architecture reviews (Claude, ChatGPT) plus CEO
direction.
**Pilot scope:** this repository (`emoj-ie/emoj.ie`) only.
**Canonical success criterion:**

> A useful change reaches production with verified evidence generated from the
> codebase production actually serves, while requiring no more than one brief
> specification decision and one brief release decision from the CEO.

This document is the process contract for the pilot. Newer CEO decisions
recorded in the Decision Log below override older text.

---

## 1. Principles

1. **Build a pipeline, not a company.** Roles are prompt templates + tool
   scopes + output schemas, not persistent agents or services.
2. **Evidence outranks agent reports.** Work is "done" only when independently
   observable artifacts exist and are verified by deterministic code — never
   because an agent said so.
3. **Separate agents only where independence is the point.** One builder
   session plans, implements, and validates a narrow issue. A different vendor
   reviews it. Deterministic scripts verify it. The CEO approves it.
4. **Mechanical enforcement over prompt goodwill.** Autonomy boundaries live in
   GitHub branch protection, token scopes, and the release controller — not in
   instructions agents are trusted to follow.
5. **The pilot's deliverable is shipped product changes, not the platform.**

## 2. Architecture

```text
Discord (CEO console: embeds, buttons, slash commands)
        ↕  gateway WebSocket (outbound-only; no inbound exposure needed)
HP workstation (Debian, Tailscale-only)
├── Discord gateway bot        (approval cards, commands, identity check)
├── n8n                        (GitHub polling, schedules, digests, alerts, heartbeats)
├── PostgreSQL                 (atomic job queue, run ledger, approvals, events)
└── orchestration/release API  (deterministic release controller)

Dell (Windows host → WSL2 Debian)
├── dispatcher (systemd)       (atomic claim, worktree, spawn, timeout, kill, retry, logs)
├── disposable Git worktrees   (one per job; deleted on success, kept on failure)
├── Claude Code                (planner activity + builder, headless: -p, JSON output, turn caps)
├── Codex CLI                  (read-only reviewer, headless)
└── builds, tests, Playwright  (evidence generation, screenshots)

GitHub (emoj-ie/emoj.ie)
├── issues                     (work contracts)
├── labels                     (human-visible state projection)
├── draft PRs + CI             (implementation + verification evidence)
└── deployment history
```

## 3. System-of-record division

| System         | Authority                                              |
| -------------- | ------------------------------------------------------ |
| GitHub issue   | Scope and acceptance contract                          |
| GitHub PR      | Implementation and review record                       |
| GitHub Actions | Verification evidence                                  |
| PostgreSQL     | Locks, leases, runs, approvals, costs, events (ledger) |
| Discord        | CEO interface — never canonical storage                |
| n8n            | Scheduling and integrations — never locking logic      |

PostgreSQL owns job claiming via `SELECT … FOR UPDATE SKIP LOCKED`. GitHub
labels are a projection of ledger state, not a locking mechanism.

## 4. Roles

| Role | Implementation | May | May not |
| --- | --- | --- | --- |
| **Chief of Staff** | n8n workflows + bot + deterministic formatting | Route, summarize, nag, alert | Decide anything |
| **Planner** | Bounded, batched Claude activity | Convert CEO one-liners into proposed issue contracts | Write code |
| **Builder** | Claude Code, headless, in a disposable worktree | Modify assigned branch, run repo commands, generate evidence, push branch, open/update draft PR | Merge; alter protection rules; touch unrelated repos; publish externally; weaken or skip tests to obtain a pass |
| **Reviewer** | Codex CLI, read-only | Produce a structured verdict JSON, returned to the HP orchestration API | Edit the branch; approve as a "human" review; post to GitHub directly |
| **Release controller** | Deterministic script, not an agent | Merge + deploy when all conditions hold | Anything else |

Release controller conditions (all required):

```text
CEO approval exists
AND approved head SHA == current PR head SHA
AND all required checks are green
AND no unresolved blocking review findings
```

Reviewer verdict schema:

```json
{
  "schema_version": 1,
  "repository": "emoj-ie/emoj.ie",
  "pr_number": 123,
  "head_sha": "…",
  "correlation_id": "…",
  "verdict": "approve | changes_required | blocked",
  "blockers": [],
  "non_blocking_findings": [],
  "evidence_gaps": [],
  "scope_drift": []
}
```

Reviewer credential boundary: Codex runs read-only on the Dell and returns the
verdict JSON to the HP orchestration API. A dedicated HP-side GitHub App
(check-publisher identity) posts the verdict as the required check run. Dell
worker credentials never receive `checks:write`. The check-publisher rejects
any verdict whose `repository`, `pr_number`, `correlation_id`, or `head_sha`
does not match the active job's ledger row — a stale or replayed verdict is
never posted as a check.

## 5. Approval model

- **Automatic (no human):** branch pushes, draft PRs, CI runs, test/a11y/
  Lighthouse execution, screenshot capture, label transitions, one retry,
  nightly digests.
- **Departmental (agent-decided, logged):** reviewer verdicts, builder
  implementation choices within an approved contract.
- **Executive (auto-escalated, CEO answers async):** spec ambiguity,
  builder/reviewer disagreement, budget overruns, work stale > 48 h.
- **CEO-only (button press, mechanically enforced):** merge to `main` /
  production deploy, new project start, scope changes, spending, DNS, external
  publication, secrets changes, deletions, weakening any check or test.

Two gates per change, maximum: **Gate 1** — issue contract approval (batched);
**Gate 2** — SHA-bound release approval.

## 6. State model

Detailed ledger states (PostgreSQL, for auditing/leases/recovery):

```text
draft → approved → queued → claimed → building → validating → reviewing
→ changes-requested → awaiting-ceo → approved-for-merge → merging
→ verifying-production → complete
failure states: blocked | failed | cancelled | timed-out | stale
```

GitHub label projection (the only states humans and n8n workflows branch on):

```text
queued · running · needs-review · awaiting-ceo · blocked · done
```

Every transition writes an event row:

```json
{
  "project": "emoj-ie",
  "work_item": 123,
  "from": "reviewing",
  "to": "awaiting-ceo",
  "actor": "codex-reviewer",
  "reason": "No blocking findings",
  "timestamp": "…",
  "correlation_id": "…",
  "head_sha": "…"
}
```

Do **not** build UI or n8n workflows per internal ledger state.

## 7. Worker execution

- Dispatcher claims one job atomically (SKIP LOCKED), concurrency **1**.
- Fresh `git worktree` per job; deleted on success, retained on failure.
- Builder invocation: `claude -p "<contract>" --output-format json
  --max-turns 30 --allowedTools <scoped list>` under a hard wall-clock cap
  (~25 min). Usage/turns/duration recorded to the ledger from the JSON result.
- Retries: exactly one automatic retry with failure output appended; second
  failure → `blocked` + Discord digest. Never loop.
- Pause vs kill: `/pause` prevents new claims and lets the active run
  finish. `/halt` prevents new claims, terminates the active process group,
  marks the run `cancelled`, and preserves its worktree and logs.
- Free-text CEO feedback ("make the header smaller") is stored verbatim as an
  issue/PR comment, state → `changes-requested`, new bounded builder run. No
  NL interpretation layer in the pilot.
- Production smoke failure in the pilot: **freeze, alert, preserve artifacts,
  CEO decides.** No auto-rollback until the deploy path has a track record.

## 8. Evidence contract

A run reaches `awaiting-ceo` only when deterministic verification (n8n via the
GitHub API — never agent prose) confirms:

- PR exists and changed files match the issue contract's machine-readable
  `execution.allowed_paths` (see the execution block in each issue contract)
- All required checks green **on the current head SHA**
- Screenshots uploaded as workflow artifacts
- Test/a11y/Lighthouse outputs present
- Reviewer verdict `approve` posted as a check run by the HP check-publisher
- Evidence was generated from the codebase production actually serves
  (see `PILOT_ISSUE_CI_ALIGNMENT.md` — this property is the first workload)

Issue contracts may split `required_evidence` into `pre_merge` (gates
Gate 2) and `post_merge` (required before the run reaches `complete`).
Evidence that cannot exist before merge — e.g. the first manual dispatch of
a workflow whose trigger the PR itself introduces — is declared
`post_merge`, never waived.

## 9. Cost and quota controls

- All agent runs draw on existing Claude Code / Codex subscription quotas —
  the risk is exhaustion blocking interactive use, not surprise bills.
- Per-run `--max-turns` (25–30) and wall-clock caps; daily run budget
  (initially 6), enforced by the dispatcher; alert at 80 %.
- No scheduled overnight agent loops during the pilot.
- Nightly "CFO" digest: runs, turns, failures, cost per shipped change —
  an n8n job, not a role.
- Zero new paid services. Discord, GitHub, GitHub Pages, Tailscale, n8n,
  PostgreSQL all remain on free tiers at this scale.

## 10. Security controls

- Branch protection on `main`, staged (baseline verified absent 2026-07-26):
  baseline first — PR-based changes required, direct and force pushes
  blocked — as a bootstrap prerequisite before any contents-write worker
  credential exists; required status checks (Astro + reviewer check run)
  added once those check names exist. No worker token may bypass it.
- Workers use a fine-grained PAT scoped to this repo only (contents + PRs;
  no `checks:write`). Check runs are posted only by the HP-side
  check-publisher GitHub App.
- No DNS, billing, or production-data credentials exist on any worker machine.
- Secrets in `.env` files (mode 600) outside every repo and worktree.
- Discord actions gated on the CEO's Discord user ID; all decisions ledgered
  with message ID, user ID, timestamp, decision, head SHA.
- `--allowedTools` scoping on every headless run — a tool-permission
  boundary (which tools run without prompting), NOT a network boundary.
  Network egress for builder runs is restricted at the container/firewall/
  proxy layer, allowing only the model APIs and approved registries
  (prompt-injection surface reduction).
- Everything reachable only over Tailscale; the Discord gateway connection is
  outbound-only.
- Agent logs are grepped for secret patterns before any excerpt reaches
  Discord.

## 11. Pilot plan

Seven days, one **complete real change** end-to-end (then repeat twice the
following week):

| Day | Deliverable |
| --- | --- |
| 1 | Discord bot receives a command and records an approval |
| 2 | PostgreSQL jobs/runs/approvals/events schema |
| 3 | Dell worker claims a toy job and creates a worktree |
| 4 | Claude performs one bounded change and opens a draft PR |
| 5 | Deterministic tests run; Codex returns a structured verdict; the HP check-publisher posts the review check |
| 6 | Discord approval card includes PR, evidence, and screenshot |
| 7 | CEO approves; merge via the controlled path; verify production |

Bootstrap sequence (preserves Gate 1 as the first real test of the approval
system rather than a decision taken before the system exists):

1. Ratify and merge the operating-model PR manually.
2. Build the Discord bot and approval ledger.
3. Post Gate-1 Option A through the bot.
4. Use that response as the bot's first recorded approval.
5. File and queue the CI-alignment issue.

Bootstrap prerequisite (CEO-ratified, PR #30): baseline branch protection on
`main` — require PR-based changes, block direct and force pushes — is
enabled BEFORE any contents-write worker credential is issued and before the
first worker job runs. The Astro and reviewer required checks are added
later, once those check names exist (created by the alignment workload and
the check-publisher respectively).

**First Gate-1 decision:** which codebase is canonical for production —
see `PILOT_GATE1_DECISION.md`.
**First workload:** CI/deployment alignment — see
`PILOT_ISSUE_CI_ALIGNMENT.md`.

Sequencing caveat: the alignment issue exists to prove the pipeline, so it is
not hand-fixed out of tidiness — **unless** another change must merge before
the pipeline is ready, in which case alignment is done manually first;
evidence integrity does not queue behind automation.

## 12. Explicitly deferred (do not build during the pilot)

LangGraph, CrewAI, AutoGen, or any orchestration framework; executive-agent
hierarchies; departmental subgraphs; marketing/growth/CFO agents; NL command
parsing; multi-project portfolio automation; Windows-native testing;
dashboards; auto-rollback; hosting migration.

Reconsider a workflow framework only after repeated evidence that issue/PR
state cannot express what is needed.

## 13. Meta-project guardrails

- After week 1, platform work is capped at ~20 % of project time.
- Any new platform feature must cite **three** concrete occurrences of the
  manual pain it removes (rule of three).
- Failure criteria (any two → stop and reassess, do not patch indefinitely):
  a change needing > 2 CEO interventions; fabricated evidence discovered;
  pipeline maintenance > 4 h in week 2.
- Measurement: CEO minutes per shipped change (approval-card timestamp →
  decision timestamp, plus intervention count), cycle time, cost per change —
  all derivable from the ledger.

## 14. Decision Log

Entries are **Proposed** until explicitly ratified by the CEO; ratification
records the date and the Discord message (or other venue) that approved it.
Recommendations are never recorded as CEO decisions.

| Date | Decision | Status |
| --- | --- | --- |
| 2026-07-26 | This operating model (thin GitHub-centric orchestrator; no workflow framework for the pilot) | Approved — CEO, PR #30 |
| 2026-07-26 | Five roles only (Chief of Staff, Planner, Builder, Reviewer, Release controller); all other roles deferred | Approved — CEO, PR #30 |
| 2026-07-26 | PostgreSQL owns locking (SKIP LOCKED); labels are projection only | Approved — CEO, PR #30 |
| 2026-07-26 | Reviewer verdict posted as a required check run by the HP-side check-publisher App; approvals SHA-bound | Approved — CEO, PR #30 |
| 2026-07-26 | Pre-merge/post-merge evidence model (§8): post-merge evidence gates `complete`, never waived | Approved — CEO, PR #30 |
| 2026-07-26 | Byte-budget decision B: PR #30 stays red on the pre-existing `main` breach; no cap raise, no trim in this PR | Approved — CEO, PR #30 |
| 2026-07-26 | Gate-1 Option A: `astro-site` is canonical for production | Proposed — pending Gate-1 answer |
| 2026-07-26 | First pilot workload: file and queue the CI-alignment issue | Proposed — pending Gate-1 answer |
| 2026-07-26 | Mark legacy personal repo `martinkilmartin/emoj-ie` as legacy; archive after Pages/CNAME/DNS dependency check | Proposed |
