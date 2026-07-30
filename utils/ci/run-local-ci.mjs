#!/usr/bin/env node
/**
 * Local CI dispatcher for emoj-ie/emoj.ie.
 *
 * This is the single deterministic command that produces the evidence behind
 * the required `ai-company/local-ci` commit status. It runs entirely on
 * project-controlled hardware; no GitHub-hosted runner performs build, test,
 * browser, accessibility or screenshot work.
 *
 * Usage:
 *   node utils/ci/run-local-ci.mjs \
 *     --repository owner/repo \
 *     --issue-number 31 \
 *     --head-sha <40-char sha> \
 *     --correlation-id <id> \
 *     --evidence-dir /absolute/path
 *
 * Optional:
 *   --repo-root <path>       Checkout to validate (default: repo containing this file)
 *   --workspace-dir <path>   Staging workspace (default: a fresh mkdtemp directory)
 *   --keep-workspace         Do not delete the staging workspace on exit
 *   --allow-dirty            Do not fail when the checkout has uncommitted changes
 *   --skip-sha-check         Do not fail when HEAD differs from --head-sha
 *
 * Exit code is 0 only when every required check passed and every required
 * artifact exists. Any failure, including a check that could not be executed,
 * exits nonzero. Nothing is ever silently skipped.
 */

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(HERE, '..', '..');
const MANIFEST_SCHEMA_VERSION = 1;

/** Check ids that must exist and must pass for a `passed` verdict. */
const REQUIRED_CHECK_IDS = [
  'astro-build',
  'vitest',
  'playwright-built-output',
  'accessibility',
  'screenshots',
];

/** Screenshots that must exist on disk for a `passed` verdict. */
const REQUIRED_SCREENSHOTS = [
  'screenshots/home-desktop.png',
  'screenshots/category-desktop.png',
  'screenshots/detail-desktop.png',
];

/**
 * Paths copied from the repository root into the staging workspace.
 * `astro-site/src/lib/data/load-emoji.ts` resolves its data files relative to
 * `process.cwd()/..`, so the Astro build and Vitest both need these siblings.
 */
const ROOT_INPUTS = ['grouped-openmoji.json', 'data'];

/** Directories never copied into the staging workspace. */
const STAGING_EXCLUDES = new Set(['node_modules', 'dist', '.astro', 'test-results', 'playwright-report']);

/**
 * Tracked absolute symlink that a clean worker may not be able to resolve.
 * Handled explicitly during staging; the symlink itself is never modified.
 */
const PORTABLE_SYMLINK = path.join('public', 'assets', 'emoji', 'base');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Set(['keep-workspace', 'allow-dirty', 'skip-sha-check']);
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    if (flags.has(key)) {
      options[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    i += 1;
    options[key] = value;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required option --${key}`);
  }
  return value.trim();
}

function resolveConfig(argv) {
  const options = parseArgs(argv);

  const repository = requireOption(options, 'repository');
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`--repository must look like owner/repo, received: ${repository}`);
  }

  const issueNumberRaw = requireOption(options, 'issue-number');
  const issueNumber = Number(issueNumberRaw);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error(`--issue-number must be a positive integer, received: ${issueNumberRaw}`);
  }

  const headSha = requireOption(options, 'head-sha');
  if (!/^[0-9a-f]{7,40}$/i.test(headSha)) {
    throw new Error(`--head-sha must be a hexadecimal git SHA, received: ${headSha}`);
  }

  const correlationId = requireOption(options, 'correlation-id');

  const evidenceDir = requireOption(options, 'evidence-dir');
  if (!path.isAbsolute(evidenceDir)) {
    throw new Error(`--evidence-dir must be an absolute path, received: ${evidenceDir}`);
  }

  return {
    repository,
    issueNumber,
    headSha: headSha.toLowerCase(),
    correlationId,
    evidenceDir,
    repoRoot: path.resolve(options['repo-root'] ?? DEFAULT_REPO_ROOT),
    workspaceDir: options['workspace-dir'] ? path.resolve(options['workspace-dir']) : null,
    keepWorkspace: options['keep-workspace'] === true,
    allowDirty: options['allow-dirty'] === true,
    skipShaCheck: options['skip-sha-check'] === true,
  };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

function log(message) {
  process.stdout.write(`[local-ci] ${message}\n`);
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function git(repoRoot, args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Failed to run git ${args.join(' ')}: ${result.error.message}`);
  }
  return {
    code: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
}

/**
 * Run a child process, streaming combined output to a log file and to stdout.
 * Never throws on a nonzero exit; the caller decides what a failure means.
 */
function runCommand({ command, args, cwd, env, logPath, label }) {
  return new Promise((resolve) => {
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    const header = `$ ${command} ${args.join(' ')}\n  cwd: ${cwd}\n  started: ${nowIso()}\n\n`;
    stream.write(header);
    process.stdout.write(`[local-ci] ${label}: ${command} ${args.join(' ')}\n`);

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const forward = (chunk) => {
      stream.write(chunk);
      process.stdout.write(chunk);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);

    const finish = (code, errorMessage) => {
      stream.end(`\n  exit code: ${code}\n  finished: ${nowIso()}\n${errorMessage ? `  error: ${errorMessage}\n` : ''}`);
      resolve({ code, errorMessage: errorMessage ?? null });
    };

    child.on('error', (error) => finish(127, error.message));
    child.on('close', (code, signal) => finish(code ?? (signal ? 128 : 1), signal ? `terminated by ${signal}` : null));
  });
}

// ---------------------------------------------------------------------------
// Evidence collection
// ---------------------------------------------------------------------------

class Evidence {
  constructor(config) {
    this.config = config;
    this.startedAt = nowIso();
    this.checks = [];
    this.notes = [];
    this.logsDir = path.join(config.evidenceDir, 'logs');
    this.reportsDir = path.join(config.evidenceDir, 'reports');
    this.screenshotsDir = path.join(config.evidenceDir, 'screenshots');
  }

  async init() {
    for (const dir of [this.config.evidenceDir, this.logsDir, this.reportsDir, this.screenshotsDir]) {
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  relative(absolutePath) {
    return path.relative(this.config.evidenceDir, absolutePath).split(path.sep).join('/');
  }

  logPathFor(id) {
    return path.join(this.logsDir, `${id}.log`);
  }

  note(message) {
    this.notes.push(message);
    log(`note: ${message}`);
  }

  /** Record a check outcome. `status` is 'passed' or 'failed'. */
  record({ id, status, logPath, startedAt, details = null, exitCode = null }) {
    const entry = {
      id,
      status,
      logPath: this.relative(logPath),
      startedAt,
      completedAt: nowIso(),
      exitCode,
      details,
    };
    this.checks.push(entry);
    log(`check ${id}: ${status}${details ? ` — ${details}` : ''}`);
    return entry;
  }

  hasFailure() {
    return this.checks.some((check) => check.status !== 'passed');
  }
}

async function collectArtifacts(evidence) {
  const artifacts = [];
  const roots = [evidence.logsDir, evidence.reportsDir, evidence.screenshotsDir];

  for (const root of roots) {
    let entries;
    try {
      entries = await fsp.readdir(root, { withFileTypes: true, recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolute = path.join(entry.parentPath ?? entry.path ?? root, entry.name);
      const stats = await fsp.stat(absolute);
      artifacts.push({
        path: evidence.relative(absolute),
        sha256: await sha256File(absolute),
        bytes: stats.size,
      });
    }
  }

  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  return artifacts;
}

// ---------------------------------------------------------------------------
// Staging workspace
// ---------------------------------------------------------------------------

/**
 * Build an isolated copy of the checkout so the run never depends on machine
 * specific absolute paths and never mutates the checkout under validation.
 *
 * `astro-site/public/assets/emoji/base` is a tracked absolute symlink into a
 * developer home directory. It is excluded from the copy and re-created inside
 * the staging workspace: as a symlink to the resolved target when that target
 * exists, otherwise as an empty directory so the build stays portable on a
 * clean worker. The tracked symlink itself is never modified.
 */
async function createStagingWorkspace(config, evidence) {
  const workspace = config.workspaceDir ?? (await fsp.mkdtemp(path.join(os.tmpdir(), 'emojie-local-ci-')));

  if (config.workspaceDir) {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
  await fsp.mkdir(workspace, { recursive: true });

  for (const input of ROOT_INPUTS) {
    const source = path.join(config.repoRoot, input);
    if (!fs.existsSync(source)) {
      throw new Error(`Required build input is missing from the checkout: ${input}`);
    }
    await fsp.cp(source, path.join(workspace, input), { recursive: true, dereference: true });
  }

  const sourceApp = path.join(config.repoRoot, 'astro-site');
  const stagedApp = path.join(workspace, 'astro-site');
  const excludedSymlink = path.join(sourceApp, PORTABLE_SYMLINK);

  await fsp.cp(sourceApp, stagedApp, {
    recursive: true,
    dereference: false,
    filter: (source) => {
      if (source === excludedSymlink) return false;
      const relative = path.relative(sourceApp, source);
      if (!relative) return true;
      return !relative.split(path.sep).some((segment) => STAGING_EXCLUDES.has(segment));
    },
  });

  const stagedSymlink = path.join(stagedApp, PORTABLE_SYMLINK);
  await fsp.mkdir(path.dirname(stagedSymlink), { recursive: true });

  let resolvedTarget = null;
  try {
    resolvedTarget = await fsp.realpath(excludedSymlink);
  } catch {
    resolvedTarget = null;
  }

  if (resolvedTarget && (await fsp.stat(resolvedTarget)).isDirectory()) {
    await fsp.symlink(resolvedTarget, stagedSymlink, 'dir');
    evidence.note(`Local emoji asset directory resolved to ${resolvedTarget} and linked into the staging workspace.`);
  } else {
    await fsp.mkdir(stagedSymlink, { recursive: true });
    evidence.note(
      `Local emoji asset directory (astro-site/${PORTABLE_SYMLINK.split(path.sep).join('/')}) is unresolvable on this worker; ` +
        'an empty directory was staged so the build stays portable. Emoji artwork falls back to the CDN path.'
    );
  }

  // The Playwright config and the CI-owned specs must live inside the staging
  // app so that `@playwright/test` resolves from astro-site/node_modules.
  const stagedConfig = path.join(stagedApp, 'playwright.ci.config.mjs');
  await fsp.cp(path.join(HERE, 'playwright.ci.config.mjs'), stagedConfig);
  const stagedSpecs = path.join(stagedApp, 'ci-specs');
  await fsp.cp(path.join(HERE, 'specs'), stagedSpecs, { recursive: true });

  return { workspace, stagedApp, stagedConfig, stagedSpecs };
}

// ---------------------------------------------------------------------------
// Static server lifecycle
// ---------------------------------------------------------------------------

function startStaticServer({ distDir, logPath }) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    stream.write(`$ static-server --root ${distDir}\n  started: ${nowIso()}\n\n`);

    const child = spawn(process.execPath, [path.join(HERE, 'lib', 'static-server.mjs'), '--root', distDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    let buffered = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Static server did not become ready within 30s'));
    }, 30_000);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stream.write(text);
      if (settled) return;
      buffered += text;
      const newlineIndex = buffered.indexOf('\n');
      if (newlineIndex === -1) return;
      const line = buffered.slice(0, newlineIndex).trim();
      try {
        const payload = JSON.parse(line);
        if (!payload.ready || !payload.url) throw new Error(`Unexpected ready payload: ${line}`);
        settled = true;
        clearTimeout(timer);
        resolve({ child, url: payload.url, stream });
      } catch (error) {
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(new Error(`Static server produced unreadable startup output: ${error.message}`));
      }
    });

    child.stderr.on('data', (chunk) => stream.write(chunk));

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to start static server: ${error.message}`));
    });

    child.on('exit', (code, signal) => {
      stream.write(`\n  static server exited (code=${code} signal=${signal}) at ${nowIso()}\n`);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Static server exited before becoming ready (code=${code} signal=${signal})`));
    });
  });
}

async function stopStaticServer(server) {
  if (!server?.child || server.child.exitCode !== null || server.child.signalCode !== null) {
    server?.stream?.end();
    return;
  }
  await new Promise((resolve) => {
    const force = setTimeout(() => {
      server.child.kill('SIGKILL');
    }, 5_000);
    server.child.once('exit', () => {
      clearTimeout(force);
      resolve();
    });
    server.child.kill('SIGTERM');
  });
  server.stream?.end();
  log('static server stopped');
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function checkCleanCheckout(config, evidence) {
  const id = 'clean-checkout';
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);
  const lines = [`$ git checkout verification\n  repo: ${config.repoRoot}\n  started: ${startedAt}\n\n`];
  const problems = [];

  const head = git(config.repoRoot, ['rev-parse', 'HEAD']);
  lines.push(`git rev-parse HEAD -> ${head.code === 0 ? head.stdout : head.stderr}\n`);
  if (head.code !== 0) {
    problems.push('Unable to resolve HEAD; the validation target is not a git checkout.');
  } else if (!head.stdout.toLowerCase().startsWith(config.headSha)) {
    const message = `HEAD is ${head.stdout} but --head-sha is ${config.headSha}.`;
    if (config.skipShaCheck) {
      evidence.note(`${message} Accepted because --skip-sha-check was passed.`);
      lines.push(`SKIPPED SHA ENFORCEMENT: ${message}\n`);
    } else {
      problems.push(message);
    }
  }

  const status = git(config.repoRoot, ['status', '--porcelain']);
  lines.push(`git status --porcelain ->\n${status.stdout || '(clean)'}\n`);
  if (status.code !== 0) {
    problems.push('Unable to read git status.');
  } else if (status.stdout !== '') {
    const message = `Checkout has uncommitted changes:\n${status.stdout}`;
    if (config.allowDirty) {
      evidence.note('Checkout was not clean; accepted because --allow-dirty was passed.');
      lines.push(`ACCEPTED DIRTY TREE: ${message}\n`);
    } else {
      problems.push(message);
    }
  }

  lines.push(`\n  problems: ${problems.length}\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  await fsp.writeFile(logPath, lines.join(''), 'utf8');

  evidence.record({
    id,
    status: problems.length === 0 ? 'passed' : 'failed',
    logPath,
    startedAt,
    exitCode: problems.length === 0 ? 0 : 1,
    details: problems.length === 0 ? `HEAD ${head.stdout}` : problems.join(' '),
  });

  return { resolvedHeadSha: head.stdout || null, passed: problems.length === 0 };
}

async function checkDependencies(stagedApp, evidence) {
  const id = 'dependencies';
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);

  const lockfile = path.join(stagedApp, 'package-lock.json');
  if (!fs.existsSync(lockfile)) {
    await fsp.writeFile(logPath, `Missing ${lockfile}\n`, 'utf8');
    evidence.record({ id, status: 'failed', logPath, startedAt, exitCode: 1, details: 'astro-site/package-lock.json is missing' });
    return false;
  }

  const result = await runCommand({
    command: 'npm',
    args: ['ci', '--no-audit', '--no-fund'],
    cwd: stagedApp,
    logPath,
    label: id,
  });

  const passed = result.code === 0;
  evidence.record({
    id,
    status: passed ? 'passed' : 'failed',
    logPath,
    startedAt,
    exitCode: result.code,
    details: passed ? 'npm ci from astro-site/package-lock.json' : result.errorMessage ?? 'npm ci failed',
  });
  return passed;
}

async function checkAstroBuild(stagedApp, evidence) {
  const id = 'astro-build';
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);

  const result = await runCommand({
    command: 'npx',
    args: ['--no-install', 'astro', 'build'],
    cwd: stagedApp,
    env: { NODE_ENV: 'production' },
    logPath,
    label: id,
  });

  const distDir = path.join(stagedApp, 'dist');
  const expected = [
    'index.html',
    path.join('smileys-emotion', 'index.html'),
    path.join('emoji', 'grinning-face', 'index.html'),
    '404.html',
  ];
  const missing = expected.filter((relative) => !fs.existsSync(path.join(distDir, relative)));

  if (missing.length > 0) {
    await fsp.appendFile(logPath, `\nMissing expected build output:\n${missing.map((m) => `  - ${m}`).join('\n')}\n`, 'utf8');
  }

  const passed = result.code === 0 && missing.length === 0;
  evidence.record({
    id,
    status: passed ? 'passed' : 'failed',
    logPath,
    startedAt,
    exitCode: result.code,
    details: passed
      ? `astro build produced ${distDir}`
      : missing.length > 0
        ? `missing build output: ${missing.join(', ')}`
        : result.errorMessage ?? 'astro build failed',
  });

  return { passed, distDir };
}

async function checkVitest(stagedApp, evidence) {
  const id = 'vitest';
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);
  const reportPath = path.join(evidence.reportsDir, 'vitest.json');

  const result = await runCommand({
    command: 'npx',
    args: [
      '--no-install',
      'vitest',
      'run',
      '--root',
      stagedApp,
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${reportPath}`,
      'src/lib',
    ],
    cwd: stagedApp,
    logPath,
    label: id,
  });

  let details;
  let passed = result.code === 0;

  // Exit code alone is not enough: a filter that matches nothing must never
  // read as a pass.
  try {
    const report = JSON.parse(await fsp.readFile(reportPath, 'utf8'));
    const total = report.numTotalTests ?? 0;
    const failed = report.numFailedTests ?? 0;
    const pending = report.numPendingTests ?? 0;
    details = `${report.numPassedTests ?? 0}/${total} tests passed (failed=${failed}, pending=${pending})`;
    if (total === 0) {
      passed = false;
      details = 'no Vitest tests were collected under astro-site/src/lib';
    } else if (failed > 0 || pending > 0) {
      passed = false;
    }
  } catch (error) {
    passed = false;
    details = `unable to read Vitest JSON report: ${error.message}`;
  }

  await fsp.appendFile(logPath, `\n  summary: ${details}\n`, 'utf8');
  evidence.record({ id, status: passed ? 'passed' : 'failed', logPath, startedAt, exitCode: result.code, details });
  return passed;
}

/**
 * Fail loudly when Playwright browsers are not installed instead of letting
 * tests skip or produce a confusing launch error inside every spec.
 */
async function checkBrowsersAvailable(stagedApp, evidence) {
  const id = 'playwright-browsers';
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);

  const probe = [
    "import { chromium } from '@playwright/test';",
    'import fs from "node:fs";',
    'const executable = chromium.executablePath();',
    'if (!executable || !fs.existsSync(executable)) {',
    '  console.error("Chromium executable not found at: " + executable);',
    '  process.exit(1);',
    '}',
    'const browser = await chromium.launch();',
    'console.log("chromium " + browser.version() + " at " + executable);',
    'await browser.close();',
  ].join('\n');

  const probePath = path.join(stagedApp, '.local-ci-browser-probe.mjs');
  await fsp.writeFile(probePath, probe, 'utf8');

  const result = await runCommand({
    command: process.execPath,
    args: [probePath],
    cwd: stagedApp,
    logPath,
    label: id,
  });
  await fsp.rm(probePath, { force: true });

  const passed = result.code === 0;
  evidence.record({
    id,
    status: passed ? 'passed' : 'failed',
    logPath,
    startedAt,
    exitCode: result.code,
    details: passed
      ? 'chromium launched successfully'
      : 'Playwright chromium is unavailable. Install it on this worker with `npx playwright install --with-deps chromium`.',
  });
  return passed;
}

async function runPlaywrightCheck({ id, stagedApp, stagedConfig, testDir, baseUrl, evidence, extraEnv = {}, minimumTests = 1 }) {
  const startedAt = nowIso();
  const logPath = evidence.logPathFor(id);
  const reportPath = path.join(evidence.reportsDir, `${id}.json`);
  const outputDir = path.join(stagedApp, 'test-results', id);

  const result = await runCommand({
    command: 'npx',
    args: ['--no-install', 'playwright', 'test', '--config', stagedConfig],
    cwd: stagedApp,
    env: {
      LOCAL_CI_TEST_DIR: testDir,
      LOCAL_CI_OUTPUT_DIR: outputDir,
      LOCAL_CI_BASE_URL: baseUrl,
      LOCAL_CI_JSON_REPORT: reportPath,
      ...extraEnv,
    },
    logPath,
    label: id,
  });

  let passed = result.code === 0;
  let details;

  // A green exit code with zero executed specs, or with skipped specs, is not
  // evidence of anything. Both are treated as failures.
  try {
    const report = JSON.parse(await fsp.readFile(reportPath, 'utf8'));
    const outcomes = { expected: 0, unexpected: 0, skipped: 0, flaky: 0 };
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const testCase of spec.tests ?? []) {
          const status = testCase.status ?? 'unknown';
          if (status in outcomes) outcomes[status] += 1;
          else outcomes[status] = (outcomes[status] ?? 0) + 1;
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of report.suites ?? []) walk(suite);

    const total = Object.values(outcomes).reduce((sum, value) => sum + value, 0);
    details = `${outcomes.expected} passed, ${outcomes.unexpected} failed, ${outcomes.skipped} skipped, ${outcomes.flaky} flaky (${total} total)`;

    if (total < minimumTests) {
      passed = false;
      details = `expected at least ${minimumTests} Playwright test(s) in ${testDir} but ${total} ran`;
    } else if (outcomes.unexpected > 0 || outcomes.skipped > 0 || outcomes.flaky > 0) {
      passed = false;
    }
  } catch (error) {
    passed = false;
    details = `unable to read Playwright JSON report: ${error.message}`;
  }

  await fsp.appendFile(logPath, `\n  summary: ${details}\n`, 'utf8');
  evidence.record({ id, status: passed ? 'passed' : 'failed', logPath, startedAt, exitCode: result.code, details });
  return passed;
}

async function checkScreenshotFiles(evidence) {
  const missing = [];
  for (const relative of REQUIRED_SCREENSHOTS) {
    const absolute = path.join(evidence.config.evidenceDir, relative);
    if (!fs.existsSync(absolute) || (await fsp.stat(absolute)).size === 0) {
      missing.push(relative);
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main() {
  const config = resolveConfig(process.argv.slice(2));
  const evidence = new Evidence(config);
  await evidence.init();

  log(`repository=${config.repository} issue=${config.issueNumber} headSha=${config.headSha}`);
  log(`correlationId=${config.correlationId}`);
  log(`evidenceDir=${config.evidenceDir}`);

  let workspace = null;
  let stagedApp = null;
  let stagedConfig = null;
  let stagedSpecs = null;
  let server = null;
  let fatalError = null;
  let resolvedHeadSha = null;

  const cleanup = async () => {
    await stopStaticServer(server).catch((error) => log(`failed to stop static server: ${error.message}`));
    server = null;
    if (workspace && !config.keepWorkspace) {
      await fsp.rm(workspace, { recursive: true, force: true }).catch((error) =>
        log(`failed to remove staging workspace: ${error.message}`)
      );
      log(`removed staging workspace ${workspace}`);
    } else if (workspace) {
      log(`kept staging workspace ${workspace}`);
    }
  };

  // Guarantee no orphaned server survives an interrupt.
  const onSignal = (signal) => {
    log(`received ${signal}; cleaning up`);
    cleanup().finally(() => process.exit(130));
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    const checkout = await checkCleanCheckout(config, evidence);
    resolvedHeadSha = checkout.resolvedHeadSha;

    if (checkout.passed) {
      const staging = await createStagingWorkspace(config, evidence);
      workspace = staging.workspace;
      stagedApp = staging.stagedApp;
      stagedConfig = staging.stagedConfig;
      stagedSpecs = staging.stagedSpecs;
      log(`staging workspace: ${workspace}`);

      if (await checkDependencies(stagedApp, evidence)) {
        const build = await checkAstroBuild(stagedApp, evidence);
        await checkVitest(stagedApp, evidence);

        if (build.passed && (await checkBrowsersAvailable(stagedApp, evidence))) {
          server = await startStaticServer({
            distDir: build.distDir,
            logPath: evidence.logPathFor('static-server'),
          });
          log(`serving built output at ${server.url}`);

          await runPlaywrightCheck({
            id: 'playwright-built-output',
            stagedApp,
            stagedConfig,
            testDir: path.join(stagedApp, 'tests'),
            baseUrl: server.url,
            evidence,
            minimumTests: 8,
          });

          await runPlaywrightCheck({
            id: 'accessibility',
            stagedApp,
            stagedConfig,
            testDir: path.join(stagedSpecs, 'accessibility'),
            baseUrl: server.url,
            evidence,
            minimumTests: 9,
          });

          await runPlaywrightCheck({
            id: 'screenshots',
            stagedApp,
            stagedConfig,
            testDir: path.join(stagedSpecs, 'screenshots'),
            baseUrl: server.url,
            evidence,
            extraEnv: { LOCAL_CI_SCREENSHOT_DIR: evidence.screenshotsDir },
            minimumTests: 6,
          });

          await stopStaticServer(server);
          server = null;
        } else {
          for (const id of ['playwright-built-output', 'accessibility', 'screenshots']) {
            const logPath = evidence.logPathFor(id);
            await fsp.writeFile(
              logPath,
              'Not executed: a prerequisite failed (Astro build or Playwright browser availability). ' +
                'This is recorded as a failure, never as a skip.\n',
              'utf8'
            );
            evidence.record({ id, status: 'failed', logPath, startedAt: nowIso(), exitCode: 1, details: 'prerequisite failed; check not executed' });
          }
        }
      } else {
        for (const id of REQUIRED_CHECK_IDS) {
          const logPath = evidence.logPathFor(id);
          await fsp.writeFile(logPath, 'Not executed: dependency installation failed. Recorded as a failure.\n', 'utf8');
          evidence.record({ id, status: 'failed', logPath, startedAt: nowIso(), exitCode: 1, details: 'dependency installation failed; check not executed' });
        }
      }
    } else {
      for (const id of REQUIRED_CHECK_IDS) {
        const logPath = evidence.logPathFor(id);
        await fsp.writeFile(logPath, 'Not executed: the checkout did not match the requested head SHA or was not clean.\n', 'utf8');
        evidence.record({ id, status: 'failed', logPath, startedAt: nowIso(), exitCode: 1, details: 'checkout verification failed; check not executed' });
      }
    }
  } catch (error) {
    fatalError = error;
    log(`fatal: ${error?.stack || error}`);
    const logPath = evidence.logPathFor('dispatcher-error');
    await fsp.writeFile(logPath, `${error?.stack || error}\n`, 'utf8').catch(() => {});
    evidence.record({ id: 'dispatcher', status: 'failed', logPath, startedAt: evidence.startedAt, exitCode: 1, details: String(error?.message || error) });
  } finally {
    await cleanup();
  }

  // ---- verdict -----------------------------------------------------------
  const byId = new Map(evidence.checks.map((check) => [check.id, check]));
  const missingRequired = REQUIRED_CHECK_IDS.filter((id) => !byId.has(id));
  const failedRequired = REQUIRED_CHECK_IDS.filter((id) => byId.get(id)?.status !== 'passed');
  const missingScreenshots = await checkScreenshotFiles(evidence);

  for (const id of missingRequired) {
    const logPath = evidence.logPathFor(id);
    await fsp.writeFile(logPath, 'Check never ran. Recorded as a failure so it can never read as a pass.\n', 'utf8').catch(() => {});
    evidence.record({ id, status: 'failed', logPath, startedAt: evidence.startedAt, exitCode: 1, details: 'check never ran' });
  }

  if (missingScreenshots.length > 0) {
    evidence.note(`Missing required screenshot artifacts: ${missingScreenshots.join(', ')}`);
  }

  const verdict =
    !fatalError && failedRequired.length === 0 && missingRequired.length === 0 && missingScreenshots.length === 0 && !evidence.hasFailure()
      ? 'passed'
      : 'failed';

  const artifacts = await collectArtifacts(evidence);

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    repository: config.repository,
    // The issue number is also the pull request number for AI Company runs.
    issueNumber: config.issueNumber,
    headSha: config.headSha,
    resolvedHeadSha,
    correlationId: config.correlationId,
    startedAt: evidence.startedAt,
    completedAt: nowIso(),
    verdict,
    evidenceDir: config.evidenceDir,
    requiredCheckIds: REQUIRED_CHECK_IDS,
    requiredArtifacts: REQUIRED_SCREENSHOTS,
    runner: {
      host: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      node: process.version,
      githubActions: false,
    },
    notes: evidence.notes,
    checks: evidence.checks,
    artifacts,
  };

  const manifestPath = path.join(config.evidenceDir, 'manifest.json');
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  log(`verdict=${verdict}`);
  log(`manifest=${manifestPath}`);

  process.exitCode = verdict === 'passed' ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`[local-ci] unrecoverable failure: ${error?.stack || error}\n`);
  process.exit(1);
});
