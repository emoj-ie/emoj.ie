#!/usr/bin/env node
/**
 * ai-company release controller — locally built production release of one exact
 * merged `main` SHA.
 *
 * Runs on the HP control plane after an approved merge. GitHub performs no
 * build, test or deployment work: it only stores the branch and serves it.
 *
 * In order, a release:
 *   1. confirms the requested SHA is the current tip of `main` (exact-main-sha),
 *   2. repeats the full local validation on that SHA with
 *      `utils/ci/run-local-ci.mjs --post-merge` (repeated-local-validation),
 *   3. publishes ONLY the resulting `astro-site/dist` contents — plus
 *      `.nojekyll` — to the `gh-pages` branch (gh-pages-publication),
 *   4. verifies the production URL serves exactly the bytes just published
 *      (production-smoke),
 *   5. records the mapping between the production deployment and the source SHA
 *      (production-source-sha),
 *   6. records the release in PostgreSQL, writes a hashed release manifest, and
 *      posts a SHA-bound summary to Discord.
 *
 * The run reaches `complete` only when every step above succeeded. Any missing
 * tool, failed check or unverifiable deployment fails loudly with exit code 1
 * and a `failed` status in the manifest — nothing is skipped silently.
 *
 * Usage:
 *   node utils/ci/release-main.mjs --sha <40-hex> [options]
 *
 * Options (environment fallbacks in brackets):
 *   --sha <sha>             Exact merged `main` SHA       [LOCAL_CI_HEAD_SHA]
 *   --repository <o/r>      owner/repo                    [LOCAL_CI_REPOSITORY]
 *   --branch <name>         Source branch (default: main)
 *   --pages-branch <name>   Publication branch (default: gh-pages)
 *   --production-url <url>  Production URL   [AI_COMPANY_PRODUCTION_URL, dist/CNAME]
 *   --evidence-dir <path>   Evidence root          [AI_COMPANY_EVIDENCE_DIR]
 *   --source <path>         Git repository to clone from (default: this repo)
 *   --remote <url>          Remote to fetch from / push to
 *   --smoke-attempts <n>    Production smoke attempts (default: 20)
 *   --smoke-interval <ms>   Delay between attempts (default: 15000)
 *   --dry-run               Do everything except push, record and post
 *
 * Environment:
 *   GITHUB_TOKEN | GH_TOKEN                 repo contents write
 *   AI_COMPANY_DATABASE_URL | DATABASE_URL  PostgreSQL connection string
 *   AI_COMPANY_DISCORD_WEBHOOK_URL | DISCORD_WEBHOOK_URL
 *
 * Exit codes: 0 = complete, 1 = failed at any step.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = path.resolve(SCRIPT_DIR, '..', '..');
const RUN_LOCAL_CI = path.join(SCRIPT_DIR, 'run-local-ci.mjs');
const API = 'https://api.github.com';
const MANIFEST_SCHEMA_VERSION = 1;

const MINUTE = 60_000;
const TIMEOUTS = { git: 10 * MINUTE, validation: 90 * MINUTE, fetch: 60_000 };

const REQUIRED_STEPS = [
  'exact-main-sha',
  'repeated-local-validation',
  'gh-pages-publication',
  'production-smoke',
  'production-source-sha',
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Set(['--dry-run']);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    if (flags.has(arg)) {
      out[arg.slice(2)] = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
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
const log = (message) => process.stdout.write(`[release-main] ${message}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  process.stderr.write(`\nrelease-main: ${message}\n`);
  process.exit(1);
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

async function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

/** Never let a token reach a log file or the console. */
function redact(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('«redacted»');
  }
  return out;
}

function run(command, args, { cwd, env, timeout, logFile, label, secrets = [] } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const stream = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;
    const write = (chunk) => {
      const text = redact(chunk, secrets);
      if (stream) stream.write(text);
      process.stdout.write(text.replace(/^/gm, `    [${label ?? command}] `));
    };
    write(`\n$ ${redact([command, ...args].join(' '), secrets)}\n`);

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let timedOut = false;
    const timer = timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeout)
      : null;
    child.stdout.on('data', (chunk) => {
      out += chunk;
      write(String(chunk));
    });
    child.stderr.on('data', (chunk) => {
      out += chunk;
      write(String(chunk));
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (stream) stream.end();
      resolve({ code: null, out: `${out}\n${error.message}`, timedOut, durationMs: Date.now() - started });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (stream) stream.end();
      resolve({ code, out, timedOut, durationMs: Date.now() - started });
    });
  });
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

function githubToken() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) fail('GITHUB_TOKEN (or GH_TOKEN) is not set — the release controller cannot verify or publish');
  return token;
}

async function github(method, endpoint) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${githubToken()}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ai-company-release',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} → ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// PostgreSQL (via psql — same durable store as the pre-merge control plane)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_ci_releases (
  correlation_id     text PRIMARY KEY,
  repository         text NOT NULL,
  source_sha         text NOT NULL,
  pages_branch       text NOT NULL,
  pages_commit_sha   text NOT NULL,
  production_url     text NOT NULL,
  status             text NOT NULL,
  started_at         timestamptz,
  completed_at       timestamptz,
  evidence_dir       text NOT NULL,
  manifest_sha256    text NOT NULL,
  manifest           jsonb NOT NULL,
  recorded_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_ci_releases_source_sha_idx ON local_ci_releases (source_sha);
`;

const quote = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

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

async function recordInPostgres(manifest, manifestSha256) {
  const connection = process.env.AI_COMPANY_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!connection) {
    throw new Error('AI_COMPANY_DATABASE_URL (or DATABASE_URL) is not set — durable release storage is required');
  }
  const sql = `
${SCHEMA_SQL}
INSERT INTO local_ci_releases (
  correlation_id, repository, source_sha, pages_branch, pages_commit_sha, production_url,
  status, started_at, completed_at, evidence_dir, manifest_sha256, manifest
) VALUES (
  ${quote(manifest.correlationId)}, ${quote(manifest.repository)}, ${quote(manifest.sourceSha)},
  ${quote(manifest.pagesBranch)}, ${quote(manifest.deployment?.pagesCommitSha)}, ${quote(manifest.productionUrl)},
  ${quote(manifest.status)}, ${quote(manifest.startedAt)}, ${quote(manifest.completedAt)},
  ${quote(manifest.evidenceDir)}, ${quote(manifestSha256)}, ${quote(JSON.stringify(manifest))}::jsonb
)
ON CONFLICT (correlation_id) DO UPDATE SET
  status = EXCLUDED.status,
  completed_at = EXCLUDED.completed_at,
  pages_commit_sha = EXCLUDED.pages_commit_sha,
  manifest_sha256 = EXCLUDED.manifest_sha256,
  manifest = EXCLUDED.manifest,
  recorded_at = now();
SELECT correlation_id, source_sha, pages_commit_sha, status FROM local_ci_releases
WHERE correlation_id = ${quote(manifest.correlationId)};
`;
  const result = await psql(sql, connection);
  if (result.code !== 0) {
    throw new Error(`psql failed (exit ${result.code}): ${result.err.trim() || result.out.trim()}`);
  }
  return { recordedAt: nowIso(), table: 'local_ci_releases', confirmation: result.out.trim() };
}

async function postToDiscord(summary) {
  const webhook = process.env.AI_COMPANY_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
  if (!webhook) {
    throw new Error('AI_COMPANY_DISCORD_WEBHOOK_URL (or DISCORD_WEBHOOK_URL) is not set — the release summary is required');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: summary.slice(0, 1900) }),
  });
  if (!response.ok) throw new Error(`Discord webhook returned ${response.status} ${response.statusText}`);
  return { postedAt: nowIso(), status: response.status };
}

// ---------------------------------------------------------------------------
// step runner
// ---------------------------------------------------------------------------

class Release {
  constructor() {
    this.steps = [];
    this.startedAt = nowIso();
    this.startedMs = Date.now();
  }

  async step(name, fn) {
    const entry = { name, status: 'running', startedAt: nowIso(), details: {} };
    this.steps.push(entry);
    log(`step ${name}: start`);
    const started = Date.now();
    try {
      entry.details = (await fn(entry)) || {};
      entry.status = 'pass';
      log(`step ${name}: pass`);
    } catch (error) {
      entry.status = 'fail';
      entry.error = String(error && error.message ? error.message : error);
      log(`step ${name}: FAIL — ${entry.error}`);
      throw error;
    } finally {
      entry.completedAt = nowIso();
      entry.durationMs = Date.now() - started;
    }
    return entry.details;
  }

  skipRemaining(names) {
    for (const name of names) {
      if (!this.steps.some((step) => step.name === name)) this.steps.push({ name, status: 'not_run' });
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;

  const sourceSha = String(args.sha || process.env.LOCAL_CI_HEAD_SHA || '').trim();
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    fail('a full 40-character merged `main` SHA is required: --sha <sha> (or LOCAL_CI_HEAD_SHA)');
  }

  const branch = args.branch || 'main';
  const pagesBranch = args['pages-branch'] || 'gh-pages';
  const source = path.resolve(args.source || DEFAULT_SOURCE);
  const correlationId =
    args['correlation-id'] ||
    process.env.AI_COMPANY_CORRELATION_ID ||
    `release-${sourceSha.slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;

  const evidenceRoot = path.resolve(
    args['evidence-dir'] ||
      process.env.AI_COMPANY_EVIDENCE_DIR ||
      path.join(os.tmpdir(), 'ai-company-release', correlationId),
  );
  const evidenceDir = path.join(evidenceRoot, 'release');
  const logsDir = path.join(evidenceDir, 'logs');
  const validationEvidenceDir = path.join(evidenceDir, 'post-merge-validation');
  await fsp.mkdir(logsDir, { recursive: true });
  await fsp.mkdir(validationEvidenceDir, { recursive: true });

  const workspace = path.join(os.tmpdir(), 'ai-company-release', correlationId, 'checkout');
  const pagesWorktree = path.join(os.tmpdir(), 'ai-company-release', correlationId, 'gh-pages');
  const distDir = path.join(workspace, 'astro-site', 'dist');
  const logFileFor = (name) => path.join(logsDir, `${name}.log`);

  const repository =
    args.repository || process.env.LOCAL_CI_REPOSITORY || (await detectRepository(source)) || '';
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    fail('could not determine the repository — pass --repository <owner>/<repo>');
  }

  const token = githubToken();
  const pushUrl = args.remote || `https://x-access-token:${token}@github.com/${repository}.git`;
  const secrets = [token];

  log(`repository        ${repository}`);
  log(`source sha        ${sourceSha}`);
  log(`pages branch      ${pagesBranch}`);
  log(`correlation id    ${correlationId}`);
  log(`evidence dir      ${evidenceDir}`);
  log(`dry run           ${dryRun}`);

  const release = new Release();
  const git = (gitArgs, cwd, name) =>
    run('git', gitArgs, { cwd, timeout: TIMEOUTS.git, logFile: logFileFor(name), label: 'git', secrets });

  let productionUrl = args['production-url'] || process.env.AI_COMPANY_PRODUCTION_URL || '';
  let deployment = null;
  let failure = null;

  try {
    // 1 — the SHA must be the current tip of the source branch ---------------
    await release.step('exact-main-sha', async () => {
      const ref = await github('GET', `/repos/${repository}/commits/${encodeURIComponent(branch)}`);
      if (ref.sha !== sourceSha) {
        throw new Error(
          `${branch} is at ${ref.sha}, not the requested ${sourceSha} — releases are bound to the exact merged SHA`,
        );
      }
      return { branch, sha: ref.sha, committedAt: ref.commit?.committer?.date ?? null };
    });

    // 2 — repeat the full local validation on the merged SHA -----------------
    await release.step('repeated-local-validation', async () => {
      if (!fs.existsSync(RUN_LOCAL_CI)) throw new Error(`${RUN_LOCAL_CI} is missing`);
      const result = await run(
        process.execPath,
        [
          RUN_LOCAL_CI,
          '--sha',
          sourceSha,
          '--post-merge',
          '--repository',
          repository,
          '--source',
          source,
          '--evidence-dir',
          validationEvidenceDir,
          '--workspace',
          workspace,
          '--correlation-id',
          `${correlationId}-validation`,
          '--keep-workspace',
        ],
        {
          cwd: source,
          timeout: TIMEOUTS.validation,
          logFile: logFileFor('repeated-local-validation'),
          label: 'local-ci',
          secrets,
        },
      );
      if (result.code !== 0) {
        throw new Error(
          `local validation of ${sourceSha} failed (exit ${result.code}${result.timedOut ? ', timed out' : ''}) — nothing is published`,
        );
      }
      const manifestPath = path.join(validationEvidenceDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) throw new Error(`no validation manifest at ${manifestPath}`);
      const validation = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
      if (validation.headSha !== sourceSha) {
        throw new Error(`validation manifest is bound to ${validation.headSha}, not ${sourceSha}`);
      }
      if (validation.verdict !== 'pass') {
        throw new Error(`validation manifest verdict is "${validation.verdict}"`);
      }
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        throw new Error(`no built output at ${distDir}/index.html`);
      }
      return {
        manifestPath,
        manifestSha256: await sha256File(manifestPath),
        correlationId: validation.correlationId,
        checks: (validation.checks ?? []).map((check) => `${check.name}=${check.status}`),
        distDir,
      };
    });

    // 3 — publish only the built dist (plus .nojekyll) to gh-pages -----------
    deployment = await release.step('gh-pages-publication', async () => {
      const distFiles = await walkFiles(distDir);
      if (distFiles.length === 0) throw new Error(`${distDir} is empty`);

      await fsp.rm(pagesWorktree, { recursive: true, force: true });
      await fsp.mkdir(pagesWorktree, { recursive: true });

      const step = (gitArgs) => git(gitArgs, pagesWorktree, 'gh-pages-publication');
      const must = async (gitArgs, what) => {
        const result = await step(gitArgs);
        if (result.code !== 0) throw new Error(`${what} failed (exit ${result.code})`);
        return result;
      };

      await must(['init', '--initial-branch', pagesBranch, '.'], 'git init');
      await must(['remote', 'add', 'origin', pushUrl], 'git remote add');
      await must(['config', 'user.name', 'ai-company release controller'], 'git config user.name');
      await must(['config', 'user.email', 'release@ai-company.local'], 'git config user.email');

      // Keep the branch's history when it already exists. `--soft` moves HEAD
      // without populating the index, so the commit below records exactly the
      // files staged from `dist` — anything previously published and no longer
      // built is dropped.
      const fetched = await step(['fetch', '--depth', '1', 'origin', pagesBranch]);
      if (fetched.code === 0) await must(['reset', '--soft', 'FETCH_HEAD'], 'git reset');

      // The published tree is exactly the build output — nothing else.
      for (const entry of await fsp.readdir(pagesWorktree)) {
        if (entry === '.git') continue;
        await fsp.rm(path.join(pagesWorktree, entry), { recursive: true, force: true });
      }
      await fsp.cp(distDir, pagesWorktree, { recursive: true });
      const nojekyll = path.join(pagesWorktree, '.nojekyll');
      await fsp.writeFile(nojekyll, '');
      if (!fs.existsSync(nojekyll)) throw new Error('.nojekyll was not written to the publication root');

      const publishedFiles = (await walkFiles(pagesWorktree))
        .map((file) => path.relative(pagesWorktree, file))
        .filter((file) => !file.startsWith(`.git${path.sep}`));
      const expected = new Set([...distFiles.map((file) => path.relative(distDir, file)), '.nojekyll']);
      const unexpected = publishedFiles.filter((file) => !expected.has(file));
      const absent = [...expected].filter((file) => !publishedFiles.includes(file));
      if (unexpected.length > 0 || absent.length > 0) {
        throw new Error(
          `publication root is not exactly the built output plus .nojekyll — ` +
            `unexpected: ${unexpected.join(', ') || 'none'}; missing: ${absent.join(', ') || 'none'}`,
        );
      }

      await must(['add', '--all'], 'git add');
      const message =
        `release: publish ${sourceSha.slice(0, 12)} to ${pagesBranch}\n\n` +
        `Locally built from ${repository}@${sourceSha} on ${os.hostname()}.\n` +
        'No GitHub-hosted job produced this output.\n\n' +
        `Source-SHA: ${sourceSha}\n` +
        `Correlation-Id: ${correlationId}\n`;
      const committed = await step(['commit', '--allow-empty', '-m', message]);
      if (committed.code !== 0) throw new Error(`git commit failed (exit ${committed.code})`);

      const head = await step(['rev-parse', 'HEAD']);
      if (head.code !== 0) throw new Error('git rev-parse HEAD failed');
      const pagesCommitSha = head.out.trim().split('\n').pop().trim();

      if (dryRun) {
        return {
          pagesBranch,
          pagesCommitSha,
          pushed: false,
          note: 'dry-run — not pushed',
          fileCount: publishedFiles.length,
          nojekyll: true,
          indexSha256: await sha256File(path.join(pagesWorktree, 'index.html')),
        };
      }

      await must(['push', '--force', 'origin', `HEAD:refs/heads/${pagesBranch}`], 'git push');
      const remoteRef = await must(['ls-remote', 'origin', `refs/heads/${pagesBranch}`], 'git ls-remote');
      const remoteSha = remoteRef.out.trim().split(/\s+/)[0];
      if (remoteSha !== pagesCommitSha) {
        throw new Error(`${pagesBranch} is at ${remoteSha} after the push, expected ${pagesCommitSha}`);
      }
      return {
        pagesBranch,
        pagesCommitSha,
        pushed: true,
        fileCount: publishedFiles.length,
        nojekyll: true,
        indexSha256: await sha256File(path.join(pagesWorktree, 'index.html')),
        sourceSha,
      };
    });

    // 4 — production must serve exactly what was published -------------------
    if (!productionUrl) {
      const cname = path.join(distDir, 'CNAME');
      if (fs.existsSync(cname)) {
        productionUrl = `https://${(await fsp.readFile(cname, 'utf8')).trim()}/`;
      } else {
        const [owner, repo] = repository.split('/');
        productionUrl = `https://${owner}.github.io/${repo}/`;
      }
    }
    await release.step('production-smoke', async () => {
      const attempts = Number(args['smoke-attempts'] ?? 20);
      const interval = Number(args['smoke-interval'] ?? 15_000);
      if (dryRun) {
        return { productionUrl, skipped: 'dry-run — nothing was published to verify' };
      }
      const tried = [];
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let record;
        try {
          const response = await fetch(`${productionUrl}?local-ci=${sourceSha.slice(0, 12)}`, {
            redirect: 'follow',
            headers: { 'cache-control': 'no-cache', 'user-agent': 'ai-company-release' },
            signal: AbortSignal.timeout(TIMEOUTS.fetch),
          });
          const body = Buffer.from(await response.arrayBuffer());
          const bodySha256 = sha256Buffer(body);
          record = { attempt, status: response.status, bodySha256, bytes: body.length };
          if (response.ok && bodySha256 === deployment.indexSha256) {
            log(`production serves the published index.html (attempt ${attempt})`);
            return {
              productionUrl,
              attempts: attempt,
              httpStatus: response.status,
              bodySha256,
              matchesPublishedIndex: true,
              verifiedAt: nowIso(),
              history: [...tried, record],
            };
          }
        } catch (error) {
          record = { attempt, error: String(error.message || error) };
        }
        tried.push(record);
        log(`production not yet serving ${sourceSha.slice(0, 12)} (attempt ${attempt}/${attempts})`);
        if (attempt < attempts) await sleep(interval);
      }
      throw new Error(
        `${productionUrl} did not serve the published index.html (sha256 ${deployment.indexSha256}) ` +
          `after ${attempts} attempt(s): ${JSON.stringify(tried.slice(-3))}`,
      );
    });

    // 5 — the recorded mapping between production and source -----------------
    await release.step('production-source-sha', async () => {
      if (!dryRun) {
        const ref = await github('GET', `/repos/${repository}/commits/${encodeURIComponent(pagesBranch)}`);
        if (ref.sha !== deployment.pagesCommitSha) {
          throw new Error(
            `${pagesBranch} is at ${ref.sha}, not the published ${deployment.pagesCommitSha}`,
          );
        }
        if (!String(ref.commit?.message ?? '').includes(`Source-SHA: ${sourceSha}`)) {
          throw new Error(`${pagesBranch} tip does not record Source-SHA: ${sourceSha}`);
        }
      }
      return {
        productionUrl,
        sourceSha,
        repository,
        pagesBranch,
        pagesCommitSha: deployment.pagesCommitSha,
        indexSha256: deployment.indexSha256,
        recordedAt: nowIso(),
      };
    });
  } catch (error) {
    failure = error;
  }

  // 6 — manifest, durable record, Discord summary ----------------------------
  release.skipRemaining(REQUIRED_STEPS);
  const complete = !failure && release.steps.every((step) => step.status === 'pass');

  const artifacts = await Promise.all(
    (await walkFiles(evidenceDir))
      .filter((file) => path.basename(file) !== 'release-manifest.json')
      .map(async (file) => ({
        path: file,
        relativePath: path.relative(evidenceDir, file),
        bytes: (await fsp.stat(file)).size,
        sha256: await sha256File(file),
      })),
  );

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    kind: 'post-merge-release',
    repository,
    branch,
    sourceSha,
    pagesBranch,
    productionUrl,
    correlationId,
    startedAt: release.startedAt,
    completedAt: nowIso(),
    durationMs: Date.now() - release.startedMs,
    controller: { hostname: os.hostname(), platform: `${process.platform}-${process.arch}`, node: process.version },
    evidenceDir,
    dryRun,
    steps: release.steps,
    deployment,
    artifacts,
    // A rehearsal never claims `complete`: nothing was published, so nothing
    // was really verified in production.
    status: complete ? (dryRun ? 'complete-dry-run' : 'complete') : 'failed',
    failureReason: failure ? String(failure.message || failure) : null,
  };
  const manifestPath = path.join(evidenceDir, 'release-manifest.json');
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = await sha256File(manifestPath);
  log(`release manifest  ${manifestPath}`);
  for (const step of release.steps) {
    log(`  ${step.status.padEnd(8)} ${step.name}${step.error ? ` — ${step.error}` : ''}`);
  }

  if (complete && !dryRun) {
    // Durable record and announcement are part of the release, not decoration:
    // a failure here fails the run even though the branch is already published.
    try {
      const postgres = await recordInPostgres(manifest, manifestSha256);
      await fsp.writeFile(
        path.join(evidenceDir, 'postgres-record.json'),
        `${JSON.stringify({ ...postgres, correlationId, sourceSha, manifestSha256 }, null, 2)}\n`,
      );
      const summary = [
        `**Production release ✅ — ${repository}@\`${sourceSha}\`**`,
        '',
        `- production: ${productionUrl} (verified, index sha256 \`${deployment.indexSha256}\`)`,
        `- published: \`${pagesBranch}\` @ \`${deployment.pagesCommitSha}\` (${deployment.fileCount} files, \`.nojekyll\` present)`,
        `- validation: repeated locally on \`${sourceSha}\` before publication`,
        `- evidence: \`${evidenceDir}\` (manifest sha256 \`${manifestSha256}\`)`,
        '',
        'Built and verified on project-controlled hardware. GitHub performed no build or test work.',
      ].join('\n');
      const discord = await postToDiscord(summary);
      await fsp.writeFile(
        path.join(evidenceDir, 'discord-summary.json'),
        `${JSON.stringify({ ...discord, summary, sourceSha }, null, 2)}\n`,
      );
    } catch (error) {
      process.stderr.write(`\nrelease-main: release recorded incompletely — ${error.message}\n`);
      process.exit(1);
    }
  }

  log(`status            ${manifest.status.toUpperCase()}`);
  if (complete) await fsp.rm(workspace, { recursive: true, force: true });
  else log(`workspace kept for triage: ${workspace}`);

  process.exit(complete ? 0 : 1);
}

async function detectRepository(source) {
  const result = await run('git', ['config', '--get', 'remote.origin.url'], { cwd: source, timeout: 30_000 });
  if (result.code !== 0) return null;
  const match = result.out.trim().match(/github\.com[:/]([^/]+\/[^/\s]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

main().catch((error) => {
  process.stderr.write(`\nrelease-main: ${error && error.stack ? error.stack : String(error)}\n`);
  process.exit(1);
});
