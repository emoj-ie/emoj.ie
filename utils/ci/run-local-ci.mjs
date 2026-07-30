#!/usr/bin/env node
/**
 * Local CI runner for emoj.ie — the single deterministic validation command.
 *
 * All build, test, browser, accessibility and screenshot work for a pull
 * request head runs here, on project-controlled hardware. GitHub-hosted
 * Actions perform none of it. The HP control plane consumes the evidence
 * manifest this script writes and is the only component allowed to publish
 * the `ai-company/local-ci` commit status.
 *
 * Usage:
 *
 *   node utils/ci/run-local-ci.mjs \
 *     --repository <owner/repo> \
 *     --issue-number <number> \
 *     --head-sha <40-char-sha> \
 *     --correlation-id <id> \
 *     --evidence-dir <absolute-path>
 *
 * Optional:
 *   --pr-number <number>   pull request the head SHA belongs to; recorded as
 *                          `prNumber`. The control plane may only publish
 *                          `ai-company/local-ci` for a manifest that has it.
 *   --repo-root <path>     repository to export the head SHA from (default: this repo)
 *   --base-port <number>   first port tried for the preview server (default: 43210)
 *   --keep-staging         keep the temporary staging workspace even on success
 *   --reset-evidence-dir   clear a pre-existing, non-empty evidence directory
 *
 * Behaviour contract:
 *   - Every required check runs. Nothing is skipped, softened or faked.
 *   - Any failure exits nonzero; the manifest is still written.
 *   - Everything the build consumes comes from the requested SHA. No file from
 *     outside that commit — in particular no machine-local emoji asset tree —
 *     may enter the run, and no missing input is silently substituted.
 *   - Playwright runs against `astro preview` over the built `dist/` output,
 *     never `astro dev`.
 *   - Every process this script starts is stopped before it exits.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(SCRIPT_DIR, 'templates');

/** Check IDs that must exist and pass before the verdict can be `passed`. */
const REQUIRED_CHECKS = [
  'astro-build',
  'vitest',
  'playwright-built-output',
  'accessibility',
  'screenshots',
];

/** Screenshots that must exist before the verdict can be `passed`. */
const REQUIRED_SCREENSHOTS = ['home', 'category', 'detail'];

/**
 * `astro-site/public/assets/emoji/base` is tracked as a symlink to an absolute
 * path that exists on one developer machine only. The same emoji asset set is
 * tracked in this repository at `assets/emoji/base`, so the staged copy is
 * built from the commit instead of from that machine-local path.
 */
const PUBLIC_ASSET_PATH = path.join('public', 'assets', 'emoji', 'base');
const REPO_ASSET_PATH = 'assets/emoji/base';

/**
 * Paths exported into the staging workspace. `astro-site` is the canonical
 * application; `grouped-openmoji.json` and `data/` are the repository-root
 * data files that `astro-site/src/lib/data/load-emoji.ts` reads at build time
 * (via `path.resolve(process.cwd(), '..')`), so the build fails without them;
 * `assets/emoji/base` is the SHA-controlled emoji asset set.
 */
const STAGED_PATHS = ['astro-site', 'grouped-openmoji.json', 'data', REPO_ASSET_PATH];

// ---------------------------------------------------------------------------
// argument parsing
// ---------------------------------------------------------------------------

const USAGE = `Usage: node utils/ci/run-local-ci.mjs \\
  --repository <owner/repo> \\
  --issue-number <number> \\
  --head-sha <40-char-sha> \\
  --correlation-id <id> \\
  --evidence-dir <absolute-path> \\
  [--pr-number <number>] [--repo-root <path>] [--base-port <number>] \\
  [--keep-staging] [--reset-evidence-dir]`;

function parseArgs(argv) {
  const flags = new Set(['keep-staging', 'reset-evidence-dir', 'help']);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`unexpected positional argument: ${token}`);
    }
    const eq = token.indexOf('=');
    const key = eq === -1 ? token.slice(2) : token.slice(2, eq);
    if (flags.has(key)) {
      out[key] = true;
      continue;
    }
    const value = eq === -1 ? argv[++i] : token.slice(eq + 1);
    if (value === undefined) {
      throw new Error(`missing value for --${key}`);
    }
    out[key] = value;
  }
  return out;
}

function requireArg(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`missing required argument --${name}\n\n${USAGE}`);
  }
  return value.trim();
}

/** Parse a positive-integer argument. Returns null only when it was omitted. */
export function parsePositiveInteger(raw, name, { required }) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    if (required) throw new Error(`missing required argument --${name}\n\n${USAGE}`);
    return null;
  }
  const value = Number(String(raw).trim());
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer, got: ${raw}`);
  }
  return value;
}

/**
 * Refuse to write into a directory that already holds artifacts: stale logs,
 * screenshots or a previous manifest must never be mistaken for this run's
 * evidence. `--reset-evidence-dir` clears it instead, with guards so an
 * obviously wrong path cannot be emptied by accident.
 */
export async function prepareEvidenceDir(evidenceDir, { reset }) {
  if (!path.isAbsolute(evidenceDir)) {
    throw new Error(`--evidence-dir must be an absolute path, got: ${evidenceDir}`);
  }
  const resolved = path.resolve(evidenceDir);
  let existing = null;
  try {
    existing = await fsp.readdir(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (existing === null) {
    await fsp.mkdir(resolved, { recursive: true });
    return { evidenceDir: resolved, state: 'created' };
  }
  if (existing.length === 0) return { evidenceDir: resolved, state: 'reused-empty' };
  if (!reset) {
    throw new Error(
      `--evidence-dir ${resolved} already contains ${existing.length} entr` +
        `${existing.length === 1 ? 'y' : 'ies'}; pass --reset-evidence-dir to clear it ` +
        'or point at a fresh directory. Stale artifacts must never be reported as this run.',
    );
  }

  const unsafe = [path.parse(resolved).root, os.homedir(), os.tmpdir()].map((p) => path.resolve(p));
  const depth = resolved.split(path.sep).filter(Boolean).length;
  if (unsafe.includes(resolved) || depth < 2) {
    throw new Error(`refusing to clear ${resolved}: not a plausible evidence directory`);
  }
  for (const entry of existing) {
    await fsp.rm(path.join(resolved, entry), { recursive: true, force: true });
  }
  return { evidenceDir: resolved, state: 'reset' };
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

function log(message) {
  process.stdout.write(`[local-ci] ${message}\n`);
}

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(file);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 200; port += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error(`no free TCP port found starting at ${startPort}`);
}

// ---------------------------------------------------------------------------
// child process management
// ---------------------------------------------------------------------------

/** Every long-lived process started by this run, so nothing is ever leaked. */
const runningProcesses = new Set();

const BASE_ENV = {
  ...process.env,
  CI: '1',
  FORCE_COLOR: '0',
  NO_COLOR: '1',
  NPM_CONFIG_FUND: 'false',
  NPM_CONFIG_AUDIT: 'false',
  NPM_CONFIG_PROGRESS: 'false',
  NPM_CONFIG_YES: 'true',
  ASTRO_TELEMETRY_DISABLED: '1',
};

/**
 * Run a command to completion, teeing combined output into `logFile`.
 * Never uses a shell and never waits for input, so it can't go interactive.
 */
function runCommand({ command, args, cwd, logFile, env = {}, timeoutMs = 20 * 60 * 1000 }) {
  return new Promise((resolve) => {
    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    const header = `$ ${command} ${args.join(' ')}\n(cwd: ${cwd})\n(started: ${nowIso()})\n\n`;
    stream.write(header);
    process.stdout.write(`[local-ci] ${header.split('\n')[0]}\n`);

    const child = spawn(command, args, {
      cwd,
      env: { ...BASE_ENV, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    runningProcesses.add(child);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stream.write(`\n[local-ci] TIMEOUT after ${timeoutMs}ms - killing process\n`);
      child.kill('SIGKILL');
    }, timeoutMs);

    // Keep a bounded copy of stdout so callers can read short outputs such as
    // a resolved SHA without re-parsing the log file.
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stream.write(chunk);
      if (stdout.length < 64 * 1024) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => stream.write(chunk));

    const finish = (exitCode, signal, error) => {
      clearTimeout(timer);
      runningProcesses.delete(child);
      stream.end(
        `\n(finished: ${nowIso()}) exitCode=${exitCode} signal=${signal ?? 'none'}` +
          `${error ? ` error=${error.message}` : ''}\n`,
      );
      resolve({ exitCode, signal, timedOut, stdout, error: error ? error.message : null });
    };

    child.on('error', (error) => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal, null));
  });
}

/** Start a long-lived process in its own process group so it can be group-killed. */
function startBackgroundProcess({ command, args, cwd, logFile, env = {} }) {
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  stream.write(`$ ${command} ${args.join(' ')}\n(cwd: ${cwd})\n(started: ${nowIso()})\n\n`);
  const child = spawn(command, args, {
    cwd,
    env: { ...BASE_ENV, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  runningProcesses.add(child);
  child.stdout.on('data', (chunk) => stream.write(chunk));
  child.stderr.on('data', (chunk) => stream.write(chunk));
  child.on('close', (code, signal) => {
    stream.end(`\n(exited: ${nowIso()}) exitCode=${code} signal=${signal ?? 'none'}\n`);
    runningProcesses.delete(child);
  });
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const killGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    }
  };
  const exited = new Promise((resolve) => child.once('close', resolve));
  killGroup('SIGTERM');
  const settled = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ]);
  if (!settled) {
    killGroup('SIGKILL');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  runningProcesses.delete(child);
}

async function stopAllProcesses() {
  for (const child of [...runningProcesses]) {
    await stopProcess(child);
  }
}

// ---------------------------------------------------------------------------
// staging workspace (portable clean checkout of the exact SHA)
// ---------------------------------------------------------------------------

/**
 * Export `astro-site` at the exact SHA into a temporary staging workspace.
 *
 * `git archive` gives a clean tree at that commit regardless of the state of
 * the working copy, and keeps the run isolated from the checkout it runs in.
 */
async function createStagingWorkspace({ repoRoot, headSha, logFile }) {
  const stagingDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'emojie-local-ci-'));
  const tarFile = path.join(stagingDir, 'astro-site.tar');

  const archive = await runCommand({
    command: 'git',
    args: ['-C', repoRoot, 'archive', '--format=tar', '-o', tarFile, headSha, ...STAGED_PATHS],
    cwd: repoRoot,
    logFile,
    timeoutMs: 5 * 60 * 1000,
  });
  if (archive.exitCode !== 0) {
    throw new Error(`git archive of ${headSha} failed (exit ${archive.exitCode})`);
  }

  const extract = await runCommand({
    command: 'tar',
    args: ['-xf', tarFile, '-C', stagingDir],
    cwd: stagingDir,
    logFile,
    timeoutMs: 5 * 60 * 1000,
  });
  if (extract.exitCode !== 0) {
    throw new Error(`extracting the staged checkout failed (exit ${extract.exitCode})`);
  }
  await fsp.rm(tarFile, { force: true });

  const siteDir = path.join(stagingDir, 'astro-site');
  if (!fs.existsSync(path.join(siteDir, 'package.json'))) {
    throw new Error(`staged checkout is missing astro-site/package.json at ${siteDir}`);
  }
  return { stagingDir, siteDir };
}

/**
 * Replace the staged `astro-site/public/assets/emoji/base` symlink with the
 * emoji asset set exported from the requested SHA.
 *
 * The tracked symlink points at `/home/sionnach/...`: mutable, unversioned and
 * present on one machine only. Following it would let the same SHA produce
 * different builds on different workers, so it is always discarded — the run
 * consumes `assets/emoji/base` from the commit instead. If that path is absent
 * from the commit the run fails explicitly; an empty asset tree is never
 * substituted. The repository's own symlink is not touched: this only rewrites
 * the throwaway staging copy.
 */
export async function stageEmojiAssets({ stagingDir, siteDir, assetTree, logFile }) {
  const exported = path.join(stagingDir, REPO_ASSET_PATH);
  let files = [];
  try {
    files = (await fsp.readdir(exported, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch (error) {
    throw new Error(
      `the SHA-controlled emoji asset set ${REPO_ASSET_PATH} was not exported from the ` +
        `requested commit (${error.code || error.message}). Refusing to build against a ` +
        'machine-local asset path or an empty asset tree.',
    );
  }
  if (files.length === 0) {
    throw new Error(
      `${REPO_ASSET_PATH} is empty at the requested commit; refusing to run with no emoji assets.`,
    );
  }

  const destination = path.join(siteDir, PUBLIC_ASSET_PATH);
  // Whatever the export produced here (dangling absolute symlink, or a
  // directory) is removed first, so nothing outside the commit survives.
  await fsp.rm(destination, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fsp.rename(exported, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.cp(exported, destination, { recursive: true });
    await fsp.rm(exported, { recursive: true, force: true });
  }

  const placed = await fsp.lstat(destination);
  if (placed.isSymbolicLink() || !placed.isDirectory()) {
    throw new Error(`${PUBLIC_ASSET_PATH} is not a real directory after staging`);
  }

  await fsp.appendFile(
    logFile,
    `emoji assets staged from the requested commit: ${REPO_ASSET_PATH} ` +
      `(tree ${assetTree}, ${files.length} files) -> astro-site/${PUBLIC_ASSET_PATH}\n` +
      'the tracked absolute symlink was discarded in the staging copy and never followed.\n',
  );
  return {
    strategy: 'sha-exported-assets',
    source: REPO_ASSET_PATH,
    assetTree,
    fileCount: files.length,
  };
}

async function installCiTemplates(siteDir, { baseUrl, screenshotDir }) {
  const ciDir = path.join(siteDir, '.local-ci');
  const a11yDir = path.join(ciDir, 'a11y');
  const shotDir = path.join(ciDir, 'screenshots');
  const resultsDir = path.join(ciDir, 'test-results');
  await fsp.mkdir(a11yDir, { recursive: true });
  await fsp.mkdir(shotDir, { recursive: true });
  await fsp.mkdir(resultsDir, { recursive: true });

  await fsp.copyFile(
    path.join(TEMPLATE_DIR, 'playwright.ci.config.mjs'),
    path.join(ciDir, 'playwright.ci.config.mjs'),
  );
  await fsp.copyFile(path.join(TEMPLATE_DIR, 'a11y.spec.mjs'), path.join(a11yDir, 'a11y.spec.mjs'));
  await fsp.copyFile(
    path.join(TEMPLATE_DIR, 'screenshots.spec.mjs'),
    path.join(shotDir, 'screenshots.spec.mjs'),
  );

  return {
    configFile: path.join(ciDir, 'playwright.ci.config.mjs'),
    smokeTestDir: path.join(siteDir, 'tests'),
    a11yTestDir: a11yDir,
    screenshotTestDir: shotDir,
    outputDir: resultsDir,
    baseUrl,
    screenshotDir,
  };
}

// ---------------------------------------------------------------------------
// preview server over built output
// ---------------------------------------------------------------------------

async function waitForServer(url, { child, timeoutMs = 120_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `preview server exited before becoming ready (exit ${child.exitCode}, signal ${child.signalCode})`,
      );
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) {
        // Drain so the socket is released.
        await response.arrayBuffer().catch(() => {});
        return true;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`preview server did not become ready at ${url} within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const repository = requireArg(args, 'repository');
  const headShaArg = requireArg(args, 'head-sha').toLowerCase();
  const correlationId = requireArg(args, 'correlation-id');
  const evidenceDirArg = requireArg(args, 'evidence-dir');

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`--repository must look like owner/repo, got: ${repository}`);
  }
  const issueNumber = parsePositiveInteger(requireArg(args, 'issue-number'), 'issue-number', {
    required: true,
  });
  // Optional so the documented five-argument invocation keeps working, but
  // validated when present, and the control plane may only publish
  // `ai-company/local-ci` for a manifest that carries it.
  const prNumber = parsePositiveInteger(args['pr-number'], 'pr-number', { required: false });
  // Abbreviated identifiers are rejected: evidence must name one unambiguous
  // commit.
  if (!/^[0-9a-f]{40}$/.test(headShaArg)) {
    throw new Error(`--head-sha must be a full 40-character hex git SHA, got: ${headShaArg}`);
  }

  const basePort = args['base-port'] ? Number(args['base-port']) : 43210;
  if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65000) {
    throw new Error(`--base-port must be an integer between 1024 and 65000`);
  }
  const keepStaging = Boolean(args['keep-staging']);
  const repoRoot = path.resolve(args['repo-root'] || path.join(SCRIPT_DIR, '..', '..'));

  const { evidenceDir, state: evidenceDirState } = await prepareEvidenceDir(evidenceDirArg, {
    reset: Boolean(args['reset-evidence-dir']),
  });

  const startedAt = nowIso();
  const logsDir = path.join(evidenceDir, 'logs');
  const screenshotsDir = path.join(evidenceDir, 'screenshots');
  await fsp.mkdir(logsDir, { recursive: true });
  await fsp.mkdir(screenshotsDir, { recursive: true });

  const checks = [];
  const notes = [];
  let staging = null;
  let previewServer = null;

  const logPathFor = (id) => path.join(logsDir, `${id}.log`);

  /** Record a check result. `status` is one of passed | failed. */
  const record = (id, status, extra = {}) => {
    const entry = { id, status, logPath: logPathFor(id), ...extra };
    checks.push(entry);
    log(`check ${id}: ${status}`);
    return entry;
  };

  /** Run one command as a named check; throw on failure so the run stops. */
  const runCheck = async (id, { command, args: cmdArgs, cwd, env, timeoutMs, description }) => {
    const checkStartedAt = nowIso();
    const result = await runCommand({
      command,
      args: cmdArgs,
      cwd,
      logFile: logPathFor(id),
      env,
      timeoutMs,
    });
    const status = result.exitCode === 0 ? 'passed' : 'failed';
    record(id, status, {
      description,
      command: `${command} ${cmdArgs.join(' ')}`,
      exitCode: result.exitCode,
      signal: result.signal ?? null,
      timedOut: result.timedOut,
      startedAt: checkStartedAt,
      completedAt: nowIso(),
    });
    if (status !== 'passed') {
      throw new Error(`check "${id}" failed (exit ${result.exitCode}); see ${logPathFor(id)}`);
    }
    return result;
  };

  let failureReason = null;

  try {
    // -- clean checkout of the exact head SHA ------------------------------
    const checkoutLog = logPathFor('clean-checkout');
    const checkoutStartedAt = nowIso();
    const revParse = await runCommand({
      command: 'git',
      args: ['-C', repoRoot, 'rev-parse', '--verify', `${headShaArg}^{commit}`],
      cwd: repoRoot,
      logFile: checkoutLog,
      timeoutMs: 60_000,
    });
    if (revParse.exitCode !== 0) {
      record('clean-checkout', 'failed', {
        description: 'export astro-site at the exact head SHA into a staging workspace',
        startedAt: checkoutStartedAt,
        completedAt: nowIso(),
      });
      throw new Error(`commit ${headShaArg} is not present in ${repoRoot}`);
    }
    const resolvedSha = (revParse.stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[0-9a-f]{40}$/.test(line))
      .pop();
    if (!resolvedSha) {
      throw new Error(`could not resolve ${headShaArg} to a full commit SHA`);
    }
    if (resolvedSha !== headShaArg) {
      throw new Error(`resolved SHA ${resolvedSha} does not match requested ${headShaArg}`);
    }

    // The emoji asset set must exist in the commit itself. Resolving its tree
    // OID both proves that and gives the manifest a verifiable identifier for
    // exactly which assets the build consumed.
    const assetTreeResult = await runCommand({
      command: 'git',
      args: ['-C', repoRoot, 'rev-parse', `${resolvedSha}:${REPO_ASSET_PATH}`],
      cwd: repoRoot,
      logFile: checkoutLog,
      timeoutMs: 60_000,
    });
    const assetTree = (assetTreeResult.stdout || '')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^[0-9a-f]{40}$/.test(line));
    if (assetTreeResult.exitCode !== 0 || !assetTree) {
      record('clean-checkout', 'failed', {
        description: 'export astro-site at the exact head SHA into a staging workspace',
        startedAt: checkoutStartedAt,
        completedAt: nowIso(),
      });
      throw new Error(
        `commit ${resolvedSha} does not contain ${REPO_ASSET_PATH}; the run needs a ` +
          'SHA-controlled emoji asset set and will not fall back to a machine-local path.',
      );
    }

    staging = await createStagingWorkspace({ repoRoot, headSha: resolvedSha, logFile: checkoutLog });
    const assets = await stageEmojiAssets({
      stagingDir: staging.stagingDir,
      siteDir: staging.siteDir,
      assetTree,
      logFile: checkoutLog,
    });
    notes.push(
      `emoji assets: ${assets.strategy} (tree ${assets.assetTree}, ${assets.fileCount} files)`,
    );
    record('clean-checkout', 'passed', {
      description: 'export astro-site at the exact head SHA into a staging workspace',
      resolvedSha,
      stagingDir: staging.stagingDir,
      assets,
      startedAt: checkoutStartedAt,
      completedAt: nowIso(),
    });

    const siteDir = staging.siteDir;
    const bin = (name) => path.join(siteDir, 'node_modules', '.bin', name);

    // -- dependency installation from the lockfile -------------------------
    await runCheck('npm-ci', {
      description: 'npm ci from astro-site/package-lock.json',
      command: 'npm',
      args: ['ci', '--no-audit', '--no-fund'],
      cwd: siteDir,
      timeoutMs: 15 * 60 * 1000,
    });

    // -- canonical Astro build --------------------------------------------
    await runCheck('astro-build', {
      description: 'astro build of the canonical production application',
      command: bin('astro'),
      args: ['build'],
      cwd: siteDir,
      timeoutMs: 20 * 60 * 1000,
    });
    // A zero exit code is not enough: the built output must actually exist.
    const distDir = path.join(siteDir, 'dist');
    for (const required of ['index.html', path.join('smileys-emotion', 'index.html')]) {
      if (!fs.existsSync(path.join(distDir, required))) {
        const entry = checks.find((check) => check.id === 'astro-build');
        if (entry) entry.status = 'failed';
        throw new Error(`astro build produced no ${required} in ${distDir}`);
      }
    }

    // -- unit tests --------------------------------------------------------
    // `--passWithNoTests=false` guarantees an empty suite is a failure, never
    // a silent pass.
    await runCheck('vitest', {
      description: 'vitest unit tests under astro-site/src/lib',
      command: bin('vitest'),
      args: ['run', '--root', '.', '--passWithNoTests=false', 'src/lib'],
      cwd: siteDir,
      timeoutMs: 10 * 60 * 1000,
    });

    // -- browsers ----------------------------------------------------------
    // Explicit step: a missing browser fails the run instead of skipping tests.
    await runCheck('playwright-browsers', {
      description: 'install the Playwright chromium browser (explicit, never skipped)',
      command: bin('playwright'),
      args: ['install', 'chromium'],
      cwd: siteDir,
      timeoutMs: 15 * 60 * 1000,
    });

    // -- preview server over built output ----------------------------------
    const port = await findFreePort(basePort);
    const baseUrl = `http://127.0.0.1:${port}`;
    log(`starting astro preview over dist/ at ${baseUrl}`);
    previewServer = startBackgroundProcess({
      command: bin('astro'),
      args: ['preview', '--host', '127.0.0.1', '--port', String(port)],
      cwd: siteDir,
      logFile: logPathFor('preview-server'),
    });
    await waitForServer(`${baseUrl}/`, { child: previewServer });
    log('preview server is serving built output');

    const pw = await installCiTemplates(siteDir, { baseUrl, screenshotDir: screenshotsDir });
    const playwrightEnv = (testDir, extra = {}) => ({
      PW_CI_TEST_DIR: testDir,
      PW_CI_BASE_URL: baseUrl,
      PW_CI_OUTPUT_DIR: pw.outputDir,
      ...extra,
    });

    // -- Playwright against built output -----------------------------------
    await runCheck('playwright-built-output', {
      description: "astro-site's Playwright suite against the built dist/ output",
      command: bin('playwright'),
      args: ['test', '--config', pw.configFile],
      cwd: siteDir,
      env: playwrightEnv(pw.smokeTestDir),
      timeoutMs: 15 * 60 * 1000,
    });

    // -- accessibility smoke ------------------------------------------------
    await runCheck('accessibility', {
      description: 'accessibility smoke checks over the built output',
      command: bin('playwright'),
      args: ['test', '--config', pw.configFile],
      cwd: siteDir,
      env: playwrightEnv(pw.a11yTestDir),
      timeoutMs: 15 * 60 * 1000,
    });

    // -- screenshots --------------------------------------------------------
    await runCheck('screenshots', {
      description: 'capture home, category and detail screenshots from the built output',
      command: bin('playwright'),
      args: ['test', '--config', pw.configFile],
      cwd: siteDir,
      env: playwrightEnv(pw.screenshotTestDir, { PW_CI_SCREENSHOT_DIR: screenshotsDir }),
      timeoutMs: 15 * 60 * 1000,
    });

    for (const name of REQUIRED_SCREENSHOTS) {
      const file = path.join(screenshotsDir, `${name}.png`);
      if (!fs.existsSync(file)) {
        throw new Error(`required screenshot missing: ${file}`);
      }
    }
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error);
    log(`FAILURE: ${failureReason}`);
  } finally {
    await stopProcess(previewServer);
    await stopAllProcesses();
  }

  // -- evidence collection ---------------------------------------------------
  const artifacts = [];
  const addArtifacts = async (dir, kind) => {
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile()) continue;
      const file = path.join(dir, entry.name);
      artifacts.push({
        path: file,
        sha256: await sha256File(file),
        kind,
        relativePath: path.relative(evidenceDir, file),
        bytes: (await fsp.stat(file)).size,
      });
    }
  };
  await addArtifacts(logsDir, 'log');
  await addArtifacts(screenshotsDir, 'screenshot');

  const screenshotNames = new Set(
    artifacts
      .filter((a) => a.kind === 'screenshot')
      .map((a) => path.basename(a.path, path.extname(a.path))),
  );
  const missingScreenshots = REQUIRED_SCREENSHOTS.filter((name) => !screenshotNames.has(name));
  const checkById = new Map(checks.map((check) => [check.id, check]));
  const missingChecks = REQUIRED_CHECKS.filter((id) => checkById.get(id)?.status !== 'passed');
  const failedChecks = checks.filter((check) => check.status !== 'passed').map((check) => check.id);
  const missingLogs = checks
    .filter((check) => !fs.existsSync(check.logPath))
    .map((check) => check.id);

  const passed =
    failureReason === null &&
    missingChecks.length === 0 &&
    failedChecks.length === 0 &&
    missingScreenshots.length === 0 &&
    missingLogs.length === 0;

  if (missingChecks.length > 0) notes.push(`required checks not passed: ${missingChecks.join(', ')}`);
  if (missingScreenshots.length > 0) {
    notes.push(`required screenshots missing: ${missingScreenshots.join(', ')}`);
  }
  if (missingLogs.length > 0) notes.push(`check logs missing: ${missingLogs.join(', ')}`);

  if (prNumber === null) {
    notes.push(
      'no --pr-number was supplied: this manifest carries no pull-request identity, ' +
        'so the control plane must not publish ai-company/local-ci from it',
    );
  }

  const manifest = {
    schemaVersion: 2,
    repository,
    issueNumber,
    prNumber,
    headSha: checkById.get('clean-checkout')?.resolvedSha || headShaArg,
    requestedHeadSha: headShaArg,
    correlationId,
    startedAt,
    completedAt: nowIso(),
    verdict: passed ? 'passed' : 'failed',
    checks,
    artifacts,
    evidenceDir,
    evidenceDirState,
    assets: checkById.get('clean-checkout')?.assets ?? null,
    requiredChecks: REQUIRED_CHECKS,
    requiredScreenshots: REQUIRED_SCREENSHOTS,
    failureReason,
    notes,
    // Gate for the HP control plane: a status may only be published for a
    // passing run that names the pull request it belongs to.
    controlPlane: {
      statusContext: 'ai-company/local-ci',
      eligibleForStatus: passed && prNumber !== null,
    },
    runner: {
      host: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      repoRoot,
      stagingDir: staging ? staging.stagingDir : null,
      stagingRetained: Boolean(staging) && (keepStaging || !passed),
    },
  };

  const manifestPath = path.join(evidenceDir, 'manifest.json');
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  log(`manifest written: ${manifestPath}`);

  // Keep the staging workspace when something failed so it can be inspected.
  if (staging && passed && !keepStaging) {
    await fsp.rm(staging.stagingDir, { recursive: true, force: true });
  } else if (staging) {
    log(`staging workspace retained: ${staging.stagingDir}`);
  }

  log(`verdict: ${manifest.verdict}`);
  if (!passed && failureReason) log(`reason: ${failureReason}`);
  return passed ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // Cleanup on interruption so no preview or browser process is ever orphaned.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      stopAllProcesses().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
    });
  }

  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(async (error) => {
      process.stderr.write(`[local-ci] fatal: ${error && error.stack ? error.stack : error}\n`);
      await stopAllProcesses();
      process.exitCode = 1;
    });
}
