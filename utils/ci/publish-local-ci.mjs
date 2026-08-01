#!/usr/bin/env node
/**
 * ai-company/local-ci — control-plane publication of a local validation run.
 *
 * Runs on the HP control plane only. It never builds or tests anything: it
 * verifies evidence produced by `utils/ci/run-local-ci.mjs` on the worker, then
 * publishes the single required GitHub commit status from that evidence.
 *
 * Every step is refusable. The status is published as `success` only when:
 *   - the manifest's verdict is `pass` and every required check passed,
 *   - every artifact still hashes to the SHA-256 recorded in the manifest,
 *   - the manifest is bound to a pull request number, and
 *   - the pull request's CURRENT head SHA still equals the manifest head SHA
 *     (a new push invalidates the earlier result).
 *
 * In order, a run:
 *   1. verifies the manifest and its artifacts,
 *   2. confirms the live pull-request head SHA,
 *   3. records the `main` ruleset BEFORE any modification,
 *   4. records the run, head SHA, verdict, artifact locations and hashes in
 *      PostgreSQL,
 *   5. publishes the `ai-company/local-ci` commit status,
 *   6. adds `ai-company/local-ci` to the `main` ruleset's required status
 *      checks (only with --require-status-check, only after a passing result)
 *      and records the ruleset AFTER,
 *   7. posts a SHA-bound summary to the pull request and to Discord — no
 *      GitHub Actions artifact storage is involved,
 *   8. writes its own control-plane evidence, hashed, next to the run evidence.
 *
 * Usage:
 *   node utils/ci/publish-local-ci.mjs --manifest <evidence-dir>/manifest.json \
 *     [--require-status-check] [--branch main] [--dry-run]
 *
 * Environment:
 *   GITHUB_TOKEN | GH_TOKEN                 repo:status + rulesets write
 *   AI_COMPANY_DATABASE_URL | DATABASE_URL  PostgreSQL connection string
 *   AI_COMPANY_DISCORD_WEBHOOK_URL | DISCORD_WEBHOOK_URL
 *   AI_COMPANY_EVIDENCE_BASE_URL            optional target_url prefix
 *
 * Exit codes: 0 = published, 1 = refused or failed.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_STATUS = 'ai-company/local-ci';
const API = 'https://api.github.com';
const REQUIRED_CHECKS = [
  'clean-checkout',
  'exact-head-sha',
  'no-hosted-ci',
  'dependency-install',
  'playwright-browsers',
  'astro-build',
  'vitest',
  'playwright-built-output',
  'accessibility',
  'screenshots',
  'evidence-manifest',
];

function parseArgs(argv) {
  const flags = new Set(['--require-status-check', '--dry-run']);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    if (flags.has(arg)) {
      out[arg.slice(2)] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  return out;
}

const nowIso = () => new Date().toISOString();
const log = (message) => process.stdout.write(`[publish-local-ci] ${message}\n`);

function refuse(message) {
  process.stderr.write(`\npublish-local-ci: REFUSED — ${message}\n`);
  process.exit(1);
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

function githubToken() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) refuse('GITHUB_TOKEN (or GH_TOKEN) is not set — the control plane cannot publish');
  return token;
}

async function github(method, endpoint, body) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${githubToken()}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ai-company-local-ci',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} → ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
  }
  return payload;
}

/** Full ruleset definitions for a branch, enough to reproduce the state later. */
async function readRulesets(repository, branch) {
  const summaries = await github('GET', `/repos/${repository}/rules/branches/${encodeURIComponent(branch)}`);
  const ids = [...new Set(summaries.map((rule) => rule.ruleset_id).filter(Boolean))];
  const rulesets = [];
  for (const id of ids) {
    rulesets.push(await github('GET', `/repos/${repository}/rulesets/${id}`));
  }
  return { recordedAt: nowIso(), repository, branch, effectiveRules: summaries, rulesets };
}

// ---------------------------------------------------------------------------
// PostgreSQL (via psql — no npm dependency on the control plane)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_ci_runs (
  correlation_id       text PRIMARY KEY,
  repository           text NOT NULL,
  pull_request_number  integer,
  head_sha             text NOT NULL,
  verdict              text NOT NULL,
  run_context          text NOT NULL,
  started_at           timestamptz,
  completed_at         timestamptz,
  evidence_dir         text NOT NULL,
  manifest_sha256      text NOT NULL,
  manifest             jsonb NOT NULL,
  recorded_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_ci_runs_head_sha_idx ON local_ci_runs (head_sha);

CREATE TABLE IF NOT EXISTS local_ci_artifacts (
  correlation_id  text NOT NULL REFERENCES local_ci_runs (correlation_id) ON DELETE CASCADE,
  relative_path   text NOT NULL,
  absolute_path   text NOT NULL,
  kind            text NOT NULL,
  bytes           bigint NOT NULL,
  sha256          text NOT NULL,
  PRIMARY KEY (correlation_id, relative_path)
);
`;

function psql(sql, connection) {
  return new Promise((resolve) => {
    const child = spawn('psql', [connection, '--no-psqlrc', '--quiet', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', (error) => resolve({ code: null, out, err: String(error.message || error) }));
    child.on('close', (code) => resolve({ code, out, err }));
    child.stdin.end(sql);
  });
}

const quote = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

async function recordInPostgres(manifest, manifestSha256) {
  const connection =
    process.env.AI_COMPANY_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!connection) {
    refuse('AI_COMPANY_DATABASE_URL (or DATABASE_URL) is not set — durable evidence storage is required');
  }
  const artifactRows = manifest.artifacts.map(
    (artifact) =>
      `(${quote(manifest.correlationId)}, ${quote(artifact.relativePath)}, ${quote(artifact.path)}, ` +
      `${quote(artifact.kind)}, ${Number(artifact.bytes)}, ${quote(artifact.sha256)})`,
  );
  const sql = `
${SCHEMA_SQL}
BEGIN;
INSERT INTO local_ci_runs (
  correlation_id, repository, pull_request_number, head_sha, verdict, run_context,
  started_at, completed_at, evidence_dir, manifest_sha256, manifest
) VALUES (
  ${quote(manifest.correlationId)}, ${quote(manifest.repository)},
  ${manifest.pullRequestNumber === null ? 'NULL' : Number(manifest.pullRequestNumber)},
  ${quote(manifest.headSha)}, ${quote(manifest.verdict)}, ${quote(manifest.context ?? 'pull_request')},
  ${quote(manifest.startedAt)}, ${quote(manifest.completedAt)}, ${quote(manifest.evidenceDir)},
  ${quote(manifestSha256)}, ${quote(JSON.stringify(manifest))}::jsonb
)
ON CONFLICT (correlation_id) DO UPDATE SET
  verdict = EXCLUDED.verdict,
  completed_at = EXCLUDED.completed_at,
  manifest_sha256 = EXCLUDED.manifest_sha256,
  manifest = EXCLUDED.manifest,
  recorded_at = now();
DELETE FROM local_ci_artifacts WHERE correlation_id = ${quote(manifest.correlationId)};
${artifactRows.length ? `INSERT INTO local_ci_artifacts (correlation_id, relative_path, absolute_path, kind, bytes, sha256) VALUES\n${artifactRows.join(',\n')};` : ''}
COMMIT;
SELECT correlation_id, head_sha, verdict, recorded_at FROM local_ci_runs WHERE correlation_id = ${quote(manifest.correlationId)};
`;
  const result = await psql(sql, connection);
  if (result.code !== 0) {
    throw new Error(`psql failed (exit ${result.code}): ${result.err.trim() || result.out.trim()}`);
  }
  return {
    recordedAt: nowIso(),
    tables: ['local_ci_runs', 'local_ci_artifacts'],
    artifactRows: artifactRows.length,
    confirmation: result.out.trim(),
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;
  const branch = args.branch || 'main';

  const manifestArg =
    args.manifest ||
    (process.env.AI_COMPANY_EVIDENCE_DIR
      ? path.join(process.env.AI_COMPANY_EVIDENCE_DIR, 'manifest.json')
      : '');
  if (!manifestArg) {
    refuse('--manifest <path to manifest.json> is required (or set AI_COMPANY_EVIDENCE_DIR)');
  }
  const manifestPath = path.resolve(manifestArg);
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    refuse(`no evidence manifest at ${manifestPath}`);
  }
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const manifestSha256 = await sha256File(manifestPath);
  const evidenceDir = path.dirname(manifestPath);

  // 1 — the evidence must be internally sound and PR-bound ------------------
  const repository = args.repository || manifest.repository;
  if (!repository) refuse('manifest has no repository');
  if (!/^[0-9a-f]{40}$/.test(manifest.headSha || '')) refuse('manifest has no full head SHA');
  if (manifest.pullRequestNumber === null || manifest.pullRequestNumber === undefined) {
    refuse(
      'manifest is not bound to a pull request (pullRequestNumber is null) — ' +
        're-run run-local-ci.mjs with --pr <number>',
    );
  }
  const missing = REQUIRED_CHECKS.filter(
    (name) => !manifest.checks?.some((check) => check.name === name && check.status === 'pass'),
  );
  const verdictPass = manifest.verdict === 'pass' && missing.length === 0;
  if (manifest.verdict === 'pass' && missing.length > 0) {
    refuse(`manifest claims verdict "pass" but these required checks did not pass: ${missing.join(', ')}`);
  }

  const badHashes = [];
  for (const artifact of manifest.artifacts ?? []) {
    if (!fs.existsSync(artifact.path)) {
      badHashes.push(`${artifact.relativePath}: missing on durable storage`);
      continue;
    }
    const actual = await sha256File(artifact.path);
    if (actual !== artifact.sha256) badHashes.push(`${artifact.relativePath}: sha256 ${actual} ≠ ${artifact.sha256}`);
  }
  if (badHashes.length > 0) refuse(`evidence integrity check failed:\n${badHashes.join('\n')}`);
  log(`evidence verified: ${manifest.artifacts?.length ?? 0} artifacts, verdict ${manifest.verdict}`);

  // 2 — the pull request must still point at this SHA -----------------------
  const pull = await github('GET', `/repos/${repository}/pulls/${manifest.pullRequestNumber}`);
  const liveHeadSha = pull.head?.sha;
  if (liveHeadSha !== manifest.headSha) {
    refuse(
      `stale evidence: PR #${manifest.pullRequestNumber} head is now ${liveHeadSha}, ` +
        `the manifest validated ${manifest.headSha}. Re-run local validation on the new head.`,
    );
  }
  log(`PR #${manifest.pullRequestNumber} head confirmed at ${manifest.headSha}`);

  const controlPlaneDir = path.join(evidenceDir, 'control-plane');
  await fsp.mkdir(controlPlaneDir, { recursive: true });
  const written = [];
  const writeEvidence = async (name, data) => {
    const file = path.join(controlPlaneDir, name);
    await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
    written.push(file);
    log(`evidence → ${path.relative(evidenceDir, file)}`);
    return file;
  };

  // 3 — ruleset before any modification --------------------------------------
  const rulesetBefore = await readRulesets(repository, branch);
  await writeEvidence('ruleset-before.json', rulesetBefore);

  // 4 — durable record --------------------------------------------------------
  const postgres = dryRun
    ? { skipped: 'dry-run' }
    : await recordInPostgres({ ...manifest, repository }, manifestSha256);
  await writeEvidence('postgres-record.json', {
    correlationId: manifest.correlationId,
    headSha: manifest.headSha,
    verdict: manifest.verdict,
    manifestSha256,
    ...postgres,
  });

  // 5 — the required commit status -------------------------------------------
  const targetUrl = process.env.AI_COMPANY_EVIDENCE_BASE_URL
    ? `${process.env.AI_COMPANY_EVIDENCE_BASE_URL.replace(/\/$/, '')}/${manifest.correlationId}/`
    : undefined;
  const statusBody = {
    state: verdictPass ? 'success' : 'failure',
    context: REQUIRED_STATUS,
    description: verdictPass
      ? `local validation passed on ${manifest.headSha.slice(0, 7)} (${os.hostname()})`.slice(0, 140)
      : `local validation failed: ${manifest.failureReason ?? missing.join(', ') ?? 'see evidence'}`.slice(0, 140),
    ...(targetUrl ? { target_url: targetUrl } : {}),
  };
  const status = dryRun
    ? { skipped: 'dry-run', request: statusBody }
    : await github('POST', `/repos/${repository}/statuses/${manifest.headSha}`, statusBody);
  await writeEvidence('local-ci-status.json', {
    publishedAt: nowIso(),
    repository,
    pullRequestNumber: manifest.pullRequestNumber,
    headSha: manifest.headSha,
    context: REQUIRED_STATUS,
    request: statusBody,
    response: status,
  });
  log(`status ${REQUIRED_STATUS} = ${statusBody.state} on ${manifest.headSha}`);

  // 6 — branch protection, only after a passing local result -------------------
  let rulesetAfter = { ...rulesetBefore, note: 'unchanged — no ruleset modification requested' };
  if (args['require-status-check'] && verdictPass && !dryRun) {
    rulesetAfter = await requireStatusCheck(repository, branch, rulesetBefore);
  } else if (args['require-status-check'] && !verdictPass) {
    log('not requiring the status check: this run did not pass');
  }
  await writeEvidence('ruleset-after.json', rulesetAfter);

  // 7 — pull request + Discord summary ---------------------------------------
  const summary = [
    `**${REQUIRED_STATUS}: ${verdictPass ? 'success ✅' : 'failure ❌'}**`,
    '',
    `- repository: \`${repository}\``,
    `- pull request: #${manifest.pullRequestNumber}`,
    `- head SHA: \`${manifest.headSha}\``,
    `- correlation id: \`${manifest.correlationId}\``,
    `- worker: \`${manifest.runner?.hostname ?? 'unknown'}\` · control plane: \`${os.hostname()}\``,
    `- checks: ${(manifest.checks ?? []).map((check) => `${check.name}=${check.status}`).join(', ')}`,
    `- evidence: \`${evidenceDir}\` (${manifest.artifacts?.length ?? 0} artifacts, manifest sha256 \`${manifestSha256}\`)`,
    verdictPass ? '' : `- failure: ${manifest.failureReason ?? missing.join(', ')}`,
    '',
    'Built, tested and screenshotted on project-controlled hardware. No GitHub-hosted job ran.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const comment = dryRun
    ? { skipped: 'dry-run' }
    : await github('POST', `/repos/${repository}/issues/${manifest.pullRequestNumber}/comments`, {
        body: summary,
      });
  const discord = dryRun ? { skipped: 'dry-run' } : await postToDiscord(summary);
  await writeEvidence('summary.json', {
    postedAt: nowIso(),
    headSha: manifest.headSha,
    pullRequestNumber: manifest.pullRequestNumber,
    verdict: manifest.verdict,
    summary,
    pullRequestComment: comment?.html_url ?? comment,
    discord,
  });

  // 8 — hash the control-plane evidence itself --------------------------------
  const artifacts = [];
  for (const file of written) {
    artifacts.push({
      path: file,
      relativePath: path.relative(evidenceDir, file),
      bytes: (await fsp.stat(file)).size,
      sha256: await sha256File(file),
    });
  }
  const controlManifest = {
    schemaVersion: 1,
    requiredStatus: REQUIRED_STATUS,
    repository,
    pullRequestNumber: manifest.pullRequestNumber,
    headSha: manifest.headSha,
    correlationId: manifest.correlationId,
    controlPlane: { hostname: os.hostname(), node: process.version },
    runManifest: { path: manifestPath, sha256: manifestSha256, verdict: manifest.verdict },
    statusPublished: statusBody.state,
    dryRun,
    completedAt: nowIso(),
    artifacts,
  };
  const controlManifestPath = path.join(controlPlaneDir, 'control-plane-manifest.json');
  await fsp.writeFile(controlManifestPath, `${JSON.stringify(controlManifest, null, 2)}\n`);
  log(`control-plane manifest → ${controlManifestPath}`);

  process.exit(verdictPass ? 0 : 1);
}

/** Add `ai-company/local-ci` to the branch's required status checks. */
async function requireStatusCheck(repository, branch, before) {
  const target = before.rulesets.find(
    (ruleset) => ruleset.enforcement === 'active' && ruleset.target === 'branch',
  );
  if (!target) {
    throw new Error(
      `no active branch ruleset protects ${branch}; create one before requiring ${REQUIRED_STATUS}`,
    );
  }
  const rules = [...(target.rules ?? [])];
  const index = rules.findIndex((rule) => rule.type === 'required_status_checks');
  const existing = index === -1 ? { type: 'required_status_checks', parameters: {} } : rules[index];
  const checks = [...(existing.parameters?.required_status_checks ?? [])];
  if (!checks.some((check) => check.context === REQUIRED_STATUS)) {
    checks.push({ context: REQUIRED_STATUS });
  }
  const updated = {
    type: 'required_status_checks',
    parameters: {
      ...(existing.parameters ?? {}),
      strict_required_status_checks_policy:
        existing.parameters?.strict_required_status_checks_policy ?? false,
      required_status_checks: checks,
    },
  };
  if (index === -1) rules.push(updated);
  else rules[index] = updated;

  await github('PUT', `/repos/${repository}/rulesets/${target.id}`, {
    name: target.name,
    target: target.target,
    enforcement: target.enforcement,
    conditions: target.conditions,
    bypass_actors: target.bypass_actors,
    rules,
  });
  const after = await readRulesets(repository, branch);
  const required = after.rulesets
    .flatMap((ruleset) => ruleset.rules ?? [])
    .filter((rule) => rule.type === 'required_status_checks')
    .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
    .map((check) => check.context);
  if (!required.includes(REQUIRED_STATUS)) {
    throw new Error(`${REQUIRED_STATUS} is still not a required status check after the update`);
  }
  return { ...after, modifiedRulesetId: target.id, requiredStatusChecks: required };
}

async function postToDiscord(summary) {
  const webhook =
    process.env.AI_COMPANY_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
  if (!webhook) {
    refuse('AI_COMPANY_DISCORD_WEBHOOK_URL (or DISCORD_WEBHOOK_URL) is not set — the Discord summary is required');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: summary.slice(0, 1900) }),
  });
  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status} ${response.statusText}`);
  }
  return { postedAt: nowIso(), status: response.status };
}

main().catch((error) => {
  process.stderr.write(`\npublish-local-ci: ${error && error.stack ? error.stack : String(error)}\n`);
  process.exit(1);
});
