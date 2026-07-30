#!/usr/bin/env node
// Local CI dispatcher entry point.
//
// Runs the complete pre-merge validation for a pull-request head SHA on
// project-controlled hardware. No GitHub-hosted compute is involved: this
// script is invoked by the Dell worker, and the HP control plane consumes the
// evidence manifest it writes.
//
// Usage:
//   node utils/ci/run-local-ci.mjs \
//     --repository <owner/repo> \
//     --issue-number <number> \
//     --head-sha <40-char-sha> \
//     --correlation-id <id> \
//     --evidence-dir <absolute-path>
//
// Optional:
//   --pr-number <number>   pull request whose head is being validated. Required
//                          before the HP control plane may publish the
//                          `ai-company/local-ci` status for a pull request.
//   --repo-root <path>     source repository to archive from (default: this repo)
//   --port <number>        preview server port (default: an ephemeral free port)
//   --keep-workspace       never delete the staging workspace
//
// Exit code is 0 only when every required check passed and every required
// artifact exists. A manifest is written in all cases.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertNoExternalSymlinks, neutraliseExternalSymlinks } from './repair-symlinks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(HERE, '..', '..');

const REQUIRED_CHECK_IDS = [
  'astro-build',
  'vitest',
  'playwright-built-output',
  'accessibility',
  'screenshots',
];

// Additional checks that are part of the issue contract's required evidence.
const CONTRACT_CHECK_IDS = ['clean-checkout', 'dependency-install'];

const SCREENSHOT_PAGES = [
  { id: 'home', route: '/' },
  { id: 'category', route: '/smileys-emotion/' },
  { id: 'detail', route: '/emoji/grinning-face/' },
];

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

// Payload files copied into the staging workspace so that their imports
// resolve against the staging astro-site/node_modules tree.
const PAYLOADS = [
  { from: 'playwright.ci.config.mjs', to: 'playwright.ci.config.mjs' },
  { from: 'a11y-smoke.mjs', to: 'ci-a11y-smoke.mjs' },
  { from: 'capture-screenshots.mjs', to: 'ci-capture-screenshots.mjs' },
];

/* ------------------------------------------------------------------ args -- */

function parseArgs(argv) {
  const out = {};
  const flags = new Set(['keep-workspace']);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (flags.has(key)) {
      out[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function requireArg(args, key) {
  const value = args[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function parsePositiveInteger(raw, key) {
  if (!/^\d+$/.test(String(raw))) {
    throw new Error(`--${key} must be a positive integer, got: ${raw}`);
  }
  const value = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${key} must be a positive integer, got: ${raw}`);
  }
  return value;
}

/* ----------------------------------------------------------------- utils -- */

function nowIso() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[local-ci] ${message}\n`);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Run a command, tee-ing combined output to `logFile` and to this process's
 * stdout. Resolves with the exit code (never rejects on a nonzero exit).
 */
function run(command, args, { cwd, env, logFile, label }) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    stream.write(`$ ${command} ${args.join(' ')}\n(cwd: ${cwd})\n\n`);
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
    child.on('error', (error) => {
      stream.write(`\nspawn error: ${error.message}\n`);
      stream.end();
      reject(new Error(`${label ?? command} failed to start: ${error.message}`));
    });
    child.on('close', (code, signal) => {
      const exit = code === null ? 1 : code;
      stream.write(`\nexit code: ${exit}${signal ? ` (signal ${signal})` : ''}\n`);
      stream.end(() => resolve(exit));
    });
  });
}

/** Run a command and capture stdout as a string. Throws on nonzero exit. */
function capture(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}: ${stderr.trim()}`));
    });
  });
}

/* ------------------------------------------------------------- workspace -- */

/**
 * Materialise a clean tree for `sha` using `git archive`. The repository
 * working tree is never touched, so a dirty checkout cannot leak into the run.
 */
async function createCleanCheckout(repoRoot, sha, workspace) {
  const resolved = await capture('git', ['-C', repoRoot, 'rev-parse', '--verify', `${sha}^{commit}`]);
  const tarPath = path.join(workspace, 'head.tar');
  const treeDir = path.join(workspace, 'tree');
  await fsp.mkdir(treeDir, { recursive: true });
  await capture('git', ['-C', repoRoot, 'archive', '--format=tar', '-o', tarPath, resolved]);
  await capture('tar', ['-xf', tarPath, '-C', treeDir]);
  await fsp.rm(tarPath, { force: true });
  return { resolved, treeDir };
}

/* ---------------------------------------------------------------- server -- */

class PreviewServer {
  constructor({ cwd, port, logFile }) {
    this.cwd = cwd;
    this.port = port;
    this.logFile = logFile;
    this.child = null;
  }

  get baseUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  async start() {
    const stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    // `astro preview` serves the built `dist/` output. Never `astro dev`.
    this.child = spawn(
      'npm',
      ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(this.port)],
      { cwd: this.cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
    );
    this.child.stdout.on('data', (c) => stream.write(c));
    this.child.stderr.on('data', (c) => stream.write(c));
    this.child.on('close', (code) => {
      stream.write(`\npreview server exited: ${code}\n`);
    });

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (this.child.exitCode !== null) {
        throw new Error(`preview server exited early (code ${this.child.exitCode})`);
      }
      try {
        const response = await fetch(`${this.baseUrl}/`, { redirect: 'manual' });
        if (response.status < 500) {
          log(`preview server ready on ${this.baseUrl} (status ${response.status})`);
          return;
        }
      } catch {
        /* not up yet */
      }
      await sleep(500);
    }
    throw new Error(`preview server did not become ready on ${this.baseUrl}`);
  }

  async stop() {
    if (!this.child || this.child.exitCode !== null) return;
    const pid = this.child.pid;
    // Detached spawn puts the server in its own process group, so a negative
    // pid reaps `npm` and the astro child it spawns.
    const signal = (sig) => {
      try {
        process.kill(-pid, sig);
      } catch {
        try {
          process.kill(pid, sig);
        } catch {
          /* already gone */
        }
      }
    };
    signal('SIGTERM');
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && this.child.exitCode === null) await sleep(200);
    if (this.child.exitCode === null) signal('SIGKILL');
    await sleep(200);
    log('preview server stopped');
  }
}

/* ----------------------------------------------------------------- state -- */

class Evidence {
  constructor({ evidenceDir }) {
    this.evidenceDir = evidenceDir;
    this.logsDir = path.join(evidenceDir, 'logs');
    this.reportsDir = path.join(evidenceDir, 'reports');
    this.screenshotsDir = path.join(evidenceDir, 'screenshots');
    this.checks = [];
  }

  async init() {
    for (const dir of [this.logsDir, this.reportsDir, this.screenshotsDir]) {
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  logPath(id) {
    return path.join(this.logsDir, `${id}.log`);
  }

  rel(absolute) {
    return path.relative(this.evidenceDir, absolute).split(path.sep).join('/');
  }

  record(id, status, { details = null, exitCode = null, startedAt, completedAt } = {}) {
    const logFile = this.logPath(id);
    const entry = {
      id,
      status,
      logPath: this.rel(logFile),
      logPathAbsolute: logFile,
      exitCode,
      startedAt: startedAt ?? nowIso(),
      completedAt: completedAt ?? nowIso(),
      details,
    };
    this.checks.push(entry);
    log(`check ${id}: ${status}`);
    return entry;
  }
}

/**
 * Execute one named check. `fn` returns details on success and throws on
 * failure; the failure is recorded rather than propagated so that the manifest
 * is always complete. Returns true when the check passed.
 */
async function runCheck(evidence, id, fn) {
  const startedAt = nowIso();
  const logFile = evidence.logPath(id);
  await fsp.mkdir(path.dirname(logFile), { recursive: true });
  await fsp.appendFile(logFile, `=== ${id} started ${startedAt} ===\n`);
  log(`starting check: ${id}`);
  try {
    const details = await fn({ logFile });
    evidence.record(id, 'passed', { details: details ?? null, exitCode: 0, startedAt });
    return true;
  } catch (error) {
    const message = error?.message ?? String(error);
    await fsp.appendFile(logFile, `\nFAILURE: ${message}\n`);
    evidence.record(id, 'failed', {
      details: { error: message },
      exitCode: error?.exitCode ?? 1,
      startedAt,
    });
    return false;
  }
}

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  return error;
}

/* -------------------------------------------------------------- payloads -- */

async function copyPayloads(siteDir) {
  for (const payload of PAYLOADS) {
    await fsp.copyFile(path.join(HERE, payload.from), path.join(siteDir, payload.to));
  }
}

/** Resolve an installed package's executable entry point. */
async function resolveBin(siteDir, pkgName, binName = pkgName) {
  const pkgJsonPath = path.join(siteDir, 'node_modules', pkgName, 'package.json');
  const pkg = JSON.parse(await fsp.readFile(pkgJsonPath, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName];
  if (!bin) throw fail(`${pkgName} does not expose a "${binName}" binary`);
  return path.join(siteDir, 'node_modules', pkgName, bin);
}

/* ------------------------------------------------------------ the checks -- */

async function checkChromium(siteDir) {
  // Missing browsers must be an explicit failure, never a silent skip.
  let executable;
  try {
    executable = await capture(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { chromium } from '@playwright/test'; process.stdout.write(chromium.executablePath());",
      ],
      { cwd: siteDir },
    );
  } catch (error) {
    throw fail(`unable to resolve the Playwright chromium browser: ${error.message}`);
  }
  if (!executable || !fs.existsSync(executable)) {
    throw fail(
      `Playwright chromium browser is not installed (expected at ${executable || '<unknown>'}). ` +
        'Install it on the worker with: npx playwright install --with-deps chromium',
    );
  }
  return executable;
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

/* ------------------------------------------------------------------ main -- */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const repository = requireArg(args, 'repository');
  const issueNumberRaw = requireArg(args, 'issue-number');
  const headShaRaw = requireArg(args, 'head-sha');
  const correlationId = requireArg(args, 'correlation-id');
  const evidenceDir = requireArg(args, 'evidence-dir');

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`--repository must be "owner/repo", got: ${repository}`);
  }
  const issueNumber = parsePositiveInteger(issueNumberRaw, 'issue-number');
  // Abbreviated object ids are rejected: the contract binds evidence to the
  // exact 40-character head commit, and a prefix is not that commit.
  if (!/^[0-9a-f]{40}$/i.test(headShaRaw)) {
    throw new Error(
      `--head-sha must be a full 40-character commit SHA, got: ${headShaRaw} (${headShaRaw.length} chars)`,
    );
  }
  const headSha = headShaRaw.toLowerCase();
  // The pull-request number is optional so the script stays usable for
  // branch/main validation, but the control plane must supply it before
  // publishing a pull-request status; see `statusPublishable` in the manifest.
  const prNumber = args['pr-number'] === undefined
    ? null
    : parsePositiveInteger(args['pr-number'], 'pr-number');
  if (!path.isAbsolute(evidenceDir)) {
    throw new Error(`--evidence-dir must be an absolute path, got: ${evidenceDir}`);
  }

  const repoRoot = path.resolve(args['repo-root'] ?? DEFAULT_REPO_ROOT);
  const keepWorkspace = args['keep-workspace'] === true;
  const port = args.port ? Number.parseInt(args.port, 10) : await freePort();

  const startedAt = nowIso();
  const evidence = new Evidence({ evidenceDir });
  await evidence.init();

  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), `local-ci-${headSha.slice(0, 12)}-`));
  let server = null;
  let workspaceNotes = { repairedSymlinks: [], workspace };
  // Stays null until a commit is actually archived, so a failed checkout can
  // never report the requested SHA as validated.
  let resolvedSha = null;
  let siteDir = null;

  const stopServer = async () => {
    if (server) await server.stop();
    server = null;
  };
  const onSignal = () => {
    stopServer().finally(() => process.exit(130));
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  log(
    `repository=${repository} issue=#${issueNumber} pr=${prNumber === null ? '<none>' : `#${prNumber}`} headSha=${headSha}`,
  );
  log(`correlationId=${correlationId}`);
  log(`evidenceDir=${evidenceDir}`);
  log(`workspace=${workspace}`);

  try {
    /* ---------------------------------------------------- clean checkout -- */
    const checkoutOk = await runCheck(evidence, 'clean-checkout', async ({ logFile }) => {
      const { resolved, treeDir } = await createCleanCheckout(repoRoot, headSha, workspace);
      resolvedSha = resolved;
      // exact-head-sha: the archived tree must be the requested commit itself.
      if (resolved.toLowerCase() !== headSha) {
        throw fail(`--head-sha ${headSha} resolved to a different commit: ${resolved}`);
      }
      siteDir = path.join(treeDir, 'astro-site');
      if (!fs.existsSync(path.join(siteDir, 'package.json'))) {
        throw fail(`astro-site/package.json missing in the checkout of ${resolved}`);
      }
      // Applied to the whole tree, unconditionally: a symlink leaving the
      // archived commit is neutralised whether or not its target exists on
      // this host, so no machine-specific file can enter the build.
      const repaired = await neutraliseExternalSymlinks(treeDir);
      await assertNoExternalSymlinks(treeDir);
      workspaceNotes = {
        repairedSymlinks: repaired,
        externalSymlinksFollowed: false,
        note:
          'Symlinks leaving the archived commit were replaced with empty directories ' +
          'without being followed, so the build consumed only files contained in this SHA. ' +
          'Assets behind those links are absent from the built output and from the screenshots.',
        workspace,
        treeDir,
      };
      await fsp.appendFile(
        logFile,
        [
          `requested sha: ${headSha}`,
          `resolved sha: ${resolved}`,
          `tree: ${treeDir}`,
          `neutralised external symlinks: ${JSON.stringify(repaired, null, 2)}`,
          'verified: no symlink in the staging tree points outside it',
          '',
        ].join('\n'),
      );
      await copyPayloads(siteDir);
      return { resolvedSha: resolved, repairedSymlinks: repaired };
    });

    if (checkoutOk) {
      /* ------------------------------------------------------- npm ci --- */
      const installOk = await runCheck(evidence, 'dependency-install', async ({ logFile }) => {
        const code = await run('npm', ['ci', '--no-audit', '--no-fund'], {
          cwd: siteDir,
          logFile,
          label: 'npm ci',
        });
        if (code !== 0) throw fail(`npm ci exited ${code}`, code);
        return { lockfile: 'astro-site/package-lock.json' };
      });

      if (installOk) {
        /* --------------------------------------------------- astro build -- */
        const buildOk = await runCheck(evidence, 'astro-build', async ({ logFile }) => {
          const code = await run('npm', ['run', 'build'], {
            cwd: siteDir,
            logFile,
            label: 'astro build',
          });
          if (code !== 0) throw fail(`astro build exited ${code}`, code);
          const distIndex = path.join(siteDir, 'dist', 'index.html');
          if (!fs.existsSync(distIndex)) throw fail('astro build produced no dist/index.html');
          return { dist: 'astro-site/dist' };
        });

        /* -------------------------------------------------------- vitest -- */
        await runCheck(evidence, 'vitest', async ({ logFile }) => {
          const vitestBin = await resolveBin(siteDir, 'vitest');
          const reportPath = path.join(evidence.reportsDir, 'vitest.json');
          const code = await run(
            process.execPath,
            [
              vitestBin,
              'run',
              '--dir',
              'src/lib',
              '--reporter=default',
              '--reporter=json',
              `--outputFile.json=${reportPath}`,
            ],
            { cwd: siteDir, logFile, env: { CI: 'true' }, label: 'vitest' },
          );
          if (code !== 0) throw fail(`vitest exited ${code}`, code);
          if (!fs.existsSync(reportPath)) throw fail('vitest wrote no JSON report');
          const report = await readJson(reportPath);
          const total = report.numTotalTests ?? 0;
          const failed = report.numFailedTests ?? 0;
          const pending = report.numPendingTests ?? 0;
          if (total === 0) throw fail('vitest ran no tests under astro-site/src/lib');
          if (failed > 0) throw fail(`vitest reported ${failed} failing test(s)`);
          if (pending > 0) throw fail(`vitest skipped ${pending} test(s); skips are not permitted`);
          return { total, failed, pending, report: evidence.rel(reportPath) };
        });

        if (buildOk) {
          /* ------------------------------------------- preview + browser -- */
          const serverLog = evidence.logPath('preview-server');
          server = new PreviewServer({ cwd: siteDir, port, logFile: serverLog });
          let serverUp = false;
          try {
            await checkChromium(siteDir);
            await server.start();
            serverUp = true;
          } catch (error) {
            await fsp.appendFile(serverLog, `\nFAILURE: ${error.message}\n`);
            evidence.record('preview-server', 'failed', { details: { error: error.message } });
          }
          if (serverUp) evidence.record('preview-server', 'passed', { exitCode: 0 });

          const baseUrl = server.baseUrl;

          /* ------------------------------------------ playwright on dist -- */
          await runCheck(evidence, 'playwright-built-output', async ({ logFile }) => {
            if (!serverUp) throw fail('preview server for the built output is not running');
            const pwBin = await resolveBin(siteDir, '@playwright/test', 'playwright');
            const reportPath = path.join(evidence.reportsDir, 'playwright.json');
            const code = await run(
              process.execPath,
              [pwBin, 'test', '--config', 'playwright.ci.config.mjs', '--forbid-only'],
              {
                cwd: siteDir,
                logFile,
                label: 'playwright',
                env: {
                  CI: 'true',
                  LOCAL_CI_BASE_URL: baseUrl,
                  LOCAL_CI_PW_JSON: reportPath,
                  LOCAL_CI_PW_OUTPUT: path.join(workspace, 'playwright-output'),
                },
              },
            );
            if (code !== 0) throw fail(`playwright exited ${code}`, code);
            if (!fs.existsSync(reportPath)) throw fail('playwright wrote no JSON report');
            const report = await readJson(reportPath);
            const stats = report.stats ?? {};
            const expected = stats.expected ?? 0;
            const unexpected = stats.unexpected ?? 0;
            const skipped = stats.skipped ?? 0;
            const flaky = stats.flaky ?? 0;
            if (expected === 0) throw fail('playwright ran no tests');
            if (unexpected > 0) throw fail(`playwright reported ${unexpected} failing test(s)`);
            if (skipped > 0) throw fail(`playwright skipped ${skipped} test(s); skips are not permitted`);
            if (flaky > 0) throw fail(`playwright reported ${flaky} flaky test(s)`);
            return {
              expected,
              unexpected,
              skipped,
              flaky,
              baseUrl,
              target: 'astro-site/dist via astro preview',
              report: evidence.rel(reportPath),
            };
          });

          /* ----------------------------------------------- accessibility -- */
          await runCheck(evidence, 'accessibility', async ({ logFile }) => {
            if (!serverUp) throw fail('preview server for the built output is not running');
            const reportPath = path.join(evidence.reportsDir, 'accessibility.json');
            const code = await run(process.execPath, ['ci-a11y-smoke.mjs'], {
              cwd: siteDir,
              logFile,
              label: 'accessibility smoke',
              env: { LOCAL_CI_BASE_URL: baseUrl, LOCAL_CI_A11Y_JSON: reportPath },
            });
            if (code !== 0) throw fail(`accessibility smoke exited ${code}`, code);
            if (!fs.existsSync(reportPath)) throw fail('accessibility smoke wrote no JSON report');
            const report = await readJson(reportPath);
            if (!report.pages?.length) throw fail('accessibility smoke checked no pages');
            if (report.violations > 0) {
              throw fail(`accessibility smoke found ${report.violations} violation(s)`);
            }
            return {
              pages: report.pages.map((p) => p.route),
              rules: report.rules,
              violations: report.violations,
              report: evidence.rel(reportPath),
            };
          });

          /* ------------------------------------------------- screenshots -- */
          await runCheck(evidence, 'screenshots', async ({ logFile }) => {
            if (!serverUp) throw fail('preview server for the built output is not running');
            const manifestPath = path.join(evidence.reportsDir, 'screenshots.json');
            const code = await run(process.execPath, ['ci-capture-screenshots.mjs'], {
              cwd: siteDir,
              logFile,
              label: 'screenshots',
              env: {
                LOCAL_CI_BASE_URL: baseUrl,
                LOCAL_CI_SHOTS_DIR: evidence.screenshotsDir,
                LOCAL_CI_SHOTS_JSON: manifestPath,
              },
            });
            if (code !== 0) throw fail(`screenshot capture exited ${code}`, code);
            const captured = (await readJson(manifestPath)).screenshots ?? [];
            for (const page of SCREENSHOT_PAGES) {
              const hit = captured.find((s) => s.page === page.id);
              if (!hit) throw fail(`no screenshot captured for the ${page.id} page`);
              const file = path.join(evidence.screenshotsDir, hit.file);
              if (!fs.existsSync(file)) throw fail(`screenshot file missing: ${hit.file}`);
            }
            return { count: captured.length, pages: SCREENSHOT_PAGES.map((p) => p.id) };
          });

          await stopServer();
        }
      }
    }
  } catch (error) {
    log(`fatal: ${error.message}`);
    evidence.record('dispatcher', 'failed', { details: { error: error.message } });
  } finally {
    await stopServer();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }

  /* ------------------------------------------------------------ manifest -- */

  // Any required check that never ran is explicitly recorded as not-run so a
  // missing check can never be mistaken for a pass.
  for (const id of [...CONTRACT_CHECK_IDS, ...REQUIRED_CHECK_IDS]) {
    if (!evidence.checks.some((c) => c.id === id)) {
      evidence.record(id, 'not-run', { details: { error: 'check did not run' } });
    }
  }

  const artifacts = [];
  for (const dir of [evidence.logsDir, evidence.reportsDir, evidence.screenshotsDir]) {
    const entries = await fsp.readdir(dir).catch(() => []);
    for (const name of entries.sort()) {
      const full = path.join(dir, name);
      const stat = await fsp.stat(full).catch(() => null);
      if (!stat?.isFile()) continue;
      artifacts.push({
        path: evidence.rel(full),
        absolutePath: full,
        bytes: stat.size,
        kind: path.basename(dir),
        sha256: await sha256File(full),
      });
    }
  }

  const requiredChecksPassed = REQUIRED_CHECK_IDS.every((id) =>
    evidence.checks.some((c) => c.id === id && c.status === 'passed'),
  );
  const allChecksPassed = evidence.checks.every((c) => c.status === 'passed');
  const requiredArtifacts = [
    ...REQUIRED_CHECK_IDS.map((id) => `logs/${id}.log`),
    ...SCREENSHOT_PAGES.flatMap((p) => VIEWPORTS.map((v) => `screenshots/${p.id}-${v.id}.png`)),
    'reports/vitest.json',
    'reports/playwright.json',
    'reports/accessibility.json',
    'reports/screenshots.json',
  ];
  const missingArtifacts = requiredArtifacts.filter(
    (rel) => !artifacts.some((a) => a.path === rel),
  );

  // A verdict of `passed` additionally requires that the evidence really is
  // bound to the requested commit.
  const shaMatches = resolvedSha !== null && resolvedSha.toLowerCase() === headSha;
  const verdict =
    requiredChecksPassed && allChecksPassed && missingArtifacts.length === 0 && shaMatches
      ? 'passed'
      : 'failed';

  const manifest = {
    schemaVersion: 2,
    repository,
    issueNumber,
    prNumber,
    headSha: resolvedSha ?? headSha,
    requestedHeadSha: headSha,
    // null when no commit was archived; never falls back to the requested SHA.
    resolvedHeadSha: resolvedSha,
    headShaMatchesRequested: shaMatches,
    correlationId,
    startedAt,
    completedAt: nowIso(),
    verdict,
    runner: {
      host: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      node: process.version,
      githubActions: false,
      previewBaseUrl: `http://127.0.0.1:${port}`,
    },
    requiredCheckIds: REQUIRED_CHECK_IDS,
    missingArtifacts,
    // The control plane may publish `ai-company/local-ci` for a pull request
    // only when this is true: a run without a pull-request number cannot be
    // attributed to a pull-request head.
    statusPublishable: verdict === 'passed' && shaMatches && prNumber !== null,
    workspace: workspaceNotes,
    evidenceDir,
    checks: evidence.checks,
    artifacts,
  };

  const manifestPath = path.join(evidenceDir, 'manifest.json');
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`manifest written: ${manifestPath}`);
  log(`verdict: ${verdict}`);

  if (verdict === 'passed' && !keepWorkspace) {
    await fsp.rm(workspace, { recursive: true, force: true });
  } else if (verdict !== 'passed') {
    log(`workspace kept for inspection: ${workspace}`);
  }

  process.exitCode = verdict === 'passed' ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`[local-ci] ${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
