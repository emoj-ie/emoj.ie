#!/usr/bin/env node
/**
 * ai-company/local-ci — deterministic local validation of one exact commit SHA.
 *
 * Runs on project-controlled hardware (the Dell worker). Nothing in here may
 * depend on GitHub Actions: no hosted runner performs build, test, browser,
 * accessibility, screenshot, or review work.
 *
 * Every run:
 *   1. makes a clean checkout of the exact requested commit SHA,
 *   2. asserts site/'s engines.node and the repo's .nvmrc agree and allow the
 *      Node this worker is running,
 *   3. installs site/ dependencies from its lockfile,
 *   4. runs `npm audit` and fails on any high/critical severity advisory,
 *   5. builds the canonical production application (site/),
 *   6. runs the Vitest suite,
 *   7. runs Playwright against the built output (never a dev server),
 *   8. captures accessibility results and screenshots from the built output,
 *   9. writes a SHA-bound, machine-readable evidence manifest with SHA-256
 *      hashes of every log and screenshot.
 *
 * Any required check that fails — or that cannot run at all (missing binary,
 * missing browser, zero tests collected) — fails the whole run loudly with a
 * non-zero exit code and a `fail` verdict in the manifest. Nothing is skipped
 * silently.
 *
 * Usage:
 *   node utils/ci/run-local-ci.mjs --sha <40-hex> [options]
 *
 * Options (environment fallbacks in brackets):
 *   --sha <sha>              Exact head SHA to validate      [LOCAL_CI_HEAD_SHA]
 *   --pr <number>            Pull request number (required)  [LOCAL_CI_PR_NUMBER]
 *   --post-merge             Validate a merged `main` SHA instead of a pull request
 *   --repository <o/r>       owner/repo                      [LOCAL_CI_REPOSITORY]
 *   --correlation-id <id>    Run correlation id     [AI_COMPANY_CORRELATION_ID]
 *   --source <path>          Git repository to clone from (default: this repo)
 *   --remote <url>           Fetch the SHA from here if it is not in --source
 *   --workspace <path>       Where to place the clean checkout (no `#` or `?`)
 *   --evidence-dir <path>    Evidence root             [AI_COMPANY_EVIDENCE_DIR]
 *   --browsers-path <path>   Playwright browser cache   [LOCAL_CI_BROWSERS_PATH]
 *   --keep-workspace         Do not delete the checkout when the run passes
 *
 * Exit codes: 0 = pass, 1 = fail (any required check failed or was unavailable).
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
const REQUIRED_STATUS = 'ai-company/local-ci';
const MANIFEST_SCHEMA_VERSION = 1;

const MINUTE = 60_000;
const TIMEOUTS = {
  git: 10 * MINUTE,
  npmCi: 20 * MINUTE,
  npmAudit: 5 * MINUTE,
  browserInstall: 30 * MINUTE,
  browserLaunch: 2 * MINUTE,
  build: 40 * MINUTE,
  vitest: 15 * MINUTE,
  playwright: 20 * MINUTE,
  browserEvidence: 15 * MINUTE,
};

/**
 * The repo-wide Node version pin. `site/package.json`'s `engines.node` must
 * allow it and `.nvmrc` must pin a major version that satisfies it — a fresh
 * `nvm use && npm ci` must produce no engines warning.
 */
const MINIMUM_NODE_MAJOR = 22;

/** `npm audit` severities at or above this level fail the run; below it, warn only. */
const AUDIT_FAIL_LEVEL = 'high';

/**
 * Playwright browsers live in a project-controlled cache, never in whatever
 * happens to be in the invoking user's `~/.cache/ms-playwright`. The run
 * installs into it itself, so a worker with no prior Playwright installation
 * validates exactly like one that has run before.
 */
const DEFAULT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ai-company', 'ms-playwright');

// ---------------------------------------------------------------------------
// argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Set(['--keep-workspace', '--post-merge']);
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.replace(/^--/, '');
    if (flags.has(arg)) {
      out[key] = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Option ${arg} requires a value`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function fail(message) {
  process.stderr.write(`\nlocal-ci: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// small helpers
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

async function walkFiles(root) {
  const found = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      // A directory that is absent really does hold no files. A directory that
      // exists but could not be read is a third answer, and returning [] for it
      // would let `no-hosted-ci` conclude "no workflow files" from a failure.
      if (error && error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) found.push(full);
    }
  }
  await walk(root);
  return found.sort();
}

/**
 * Directory-name form of a correlation id.
 *
 * Correlation ids carry the issue reference verbatim (`.../emoj.ie#5-job-7`),
 * and Vite and Rollup resolve module ids as URLs: a `#` anywhere in the project
 * root truncates every id at the fragment marker, so `+layout.svelte` stops
 * matching the Svelte plugin's filter and Rollup parses the component as
 * JavaScript. The build then dies on `<script lang="ts">` with "Expression
 * expected", pointing at valid source. Vite only warns about the character and
 * carries on, so nothing downstream names the real cause.
 *
 * Sanitising alone is not enough: two ids differing only in the characters
 * being replaced would map to one workspace, and `clean-checkout` deletes the
 * workspace before it clones — a concurrent run would lose its checkout
 * underneath it. A digest of the raw id is appended whenever any character was
 * replaced, so distinct ids keep distinct directories. The raw id is what the
 * manifest still reports.
 */
function correlationDirName(correlationId) {
  const sanitised = correlationId.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  if (sanitised !== '' && sanitised === correlationId) return correlationId;
  const digest = crypto.createHash('sha256').update(correlationId).digest('hex').slice(0, 8);
  return `${sanitised || 'run'}-${digest}`;
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Run a command, streaming a prefixed copy to the console and appending the
 * full combined output to a log file. Never uses a shell.
 */
function run(command, args, { cwd, env, timeout, logFile, label, captureStdout }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    // Only allocated for callers that opt in (currently just `dependency-audit`,
    // which needs stdout free of any stderr line that would corrupt its JSON
    // parse) — every other call site only reads the combined `output`.
    const stdoutChunks = captureStdout ? [] : null;
    const header = `$ ${command} ${args.join(' ')}\n(cwd: ${cwd})\n\n`;
    process.stdout.write(`[local-ci:${label}] ${command} ${args.join(' ')}\n`);

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    const collect = (stream, sink, extra) => {
      stream.on('data', (chunk) => {
        chunks.push(chunk);
        if (extra) extra.push(chunk);
        sink.write(chunk);
      });
    };
    collect(child.stdout, process.stdout, stdoutChunks);
    collect(child.stderr, process.stderr);

    const finish = async (code, signal, spawnError) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8');
      const stdout = stdoutChunks ? Buffer.concat(stdoutChunks).toString('utf8') : null;
      if (logFile) {
        await fsp.mkdir(path.dirname(logFile), { recursive: true });
        await fsp.appendFile(logFile, `${header}${output}\n`);
      }
      resolve({
        code,
        signal,
        timedOut,
        spawnError: spawnError ? String(spawnError.message || spawnError) : null,
        durationMs: Date.now() - started,
        output,
        stdout,
      });
    };

    child.on('error', (error) => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal, null));
  });
}

// ---------------------------------------------------------------------------
// check runner
// ---------------------------------------------------------------------------

class Run {
  constructor(context) {
    this.context = context;
    this.checks = [];
    this.startedAt = nowIso();
    this.startedMs = Date.now();
  }

  /**
   * Execute one required check. A thrown error marks the check `fail`; all
   * remaining checks are then marked `not_run` — a failed run never reports a
   * partial green.
   */
  async check(name, fn) {
    const entry = { name, status: 'running', startedAt: nowIso(), details: {} };
    this.checks.push(entry);
    log(`check ${name}: start`);
    const started = Date.now();
    try {
      const details = (await fn(entry)) || {};
      entry.status = 'pass';
      entry.details = { ...entry.details, ...details };
      log(`check ${name}: pass`);
    } catch (error) {
      entry.status = 'fail';
      entry.error = String(error && error.message ? error.message : error);
      log(`check ${name}: FAIL — ${entry.error}`);
      throw error;
    } finally {
      entry.completedAt = nowIso();
      entry.durationMs = Date.now() - started;
    }
    return entry.details;
  }

  skipRemaining(names) {
    for (const name of names) {
      if (!this.checks.some((check) => check.name === name)) {
        this.checks.push({ name, status: 'not_run' });
      }
    }
  }
}

const REQUIRED_CHECKS = [
  'clean-checkout',
  'exact-head-sha',
  'no-hosted-ci',
  'node-version-pin',
  'dependency-install',
  'dependency-audit',
  'playwright-browsers',
  'astro-build',
  'vitest',
  'playwright-built-output',
  'accessibility',
  'screenshots',
  'evidence-manifest',
];

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const headSha = String(args.sha || process.env.LOCAL_CI_HEAD_SHA || '').trim();
  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    fail(
      'a full 40-character head SHA is required: --sha <sha> (or LOCAL_CI_HEAD_SHA). ' +
        'Abbreviated refs and branch names are rejected so evidence is SHA-bound.',
    );
  }

  // Evidence must be bound to the pull request as well as to the SHA. A
  // pre-merge run without --pr is rejected outright rather than silently
  // producing a manifest with `pullRequestNumber: null`, which no control plane
  // could attach to a pull request head.
  const postMerge = args['post-merge'] === true;
  const prRaw = args.pr ?? process.env.LOCAL_CI_PR_NUMBER ?? '';
  const pullRequestNumber = String(prRaw).trim() === '' ? null : Number(prRaw);
  if (pullRequestNumber !== null && (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0)) {
    fail(`--pr must be a positive integer (received "${prRaw}")`);
  }
  if (pullRequestNumber === null && !postMerge) {
    fail(
      'a pull request number is required: --pr <number> (or LOCAL_CI_PR_NUMBER). ' +
        'Pass --post-merge instead when validating a merged `main` SHA.',
    );
  }
  if (pullRequestNumber !== null && postMerge) {
    fail('--pr and --post-merge are mutually exclusive');
  }
  const runContext = postMerge ? 'post_merge' : 'pull_request';

  const correlationId =
    args['correlation-id'] ||
    process.env.AI_COMPANY_CORRELATION_ID ||
    `local-ci-${headSha.slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;

  const source = path.resolve(args.source || DEFAULT_SOURCE);
  const remote = args.remote || process.env.LOCAL_CI_REMOTE || '';

  const runDirName = correlationDirName(correlationId);

  const evidenceDir = path.resolve(
    args['evidence-dir'] ||
      process.env.AI_COMPANY_EVIDENCE_DIR ||
      path.join(os.tmpdir(), 'ai-company-local-ci', runDirName),
  );
  const workspace = path.resolve(
    args.workspace || path.join(os.tmpdir(), 'ai-company-local-ci', runDirName, 'checkout'),
  );

  // An operator-supplied --workspace or --evidence-dir is used exactly as
  // given, so the URL-significant characters are rejected up front instead of
  // resurfacing several checks later as a syntax error in valid Svelte source.
  for (const [label, value] of [
    ['workspace', workspace],
    ['evidence dir', evidenceDir],
  ]) {
    const offending = ['#', '?'].filter((character) => value.includes(character));
    if (offending.length > 0) {
      fail(
        `${label} path contains ${offending.join(' and ')}: ${value}\n` +
          'Vite and Rollup resolve module ids as URLs, so these characters truncate every ' +
          'module id and the site build fails with an unrelated syntax error. Choose a path without them.',
      );
    }
  }

  const logsDir = path.join(evidenceDir, 'logs');
  const screenshotsDir = path.join(evidenceDir, 'screenshots');
  await fsp.mkdir(logsDir, { recursive: true });
  await fsp.mkdir(screenshotsDir, { recursive: true });

  const browsersPath = path.resolve(
    args['browsers-path'] || process.env.LOCAL_CI_BROWSERS_PATH || DEFAULT_BROWSERS_PATH,
  );
  // Every browser-using child process — and this process's own launch probe —
  // resolves browsers from the same project-controlled cache.
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

  const repository =
    args.repository || process.env.LOCAL_CI_REPOSITORY || (await detectRepository(source)) || null;

  const runner = {
    hostname: os.hostname(),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    cwd: process.cwd(),
  };

  log(`repository        ${repository ?? '(unknown)'}`);
  log(`context           ${runContext}`);
  log(`pull request      ${pullRequestNumber ?? '(post-merge main run)'}`);
  log(`head sha          ${headSha}`);
  log(`correlation id    ${correlationId}`);
  log(`evidence dir      ${evidenceDir}`);
  log(`workspace         ${workspace}`);
  log(`browsers path     ${browsersPath}`);

  const runState = new Run({ repository, pullRequestNumber, headSha, correlationId });
  const logFileFor = (name) => path.join(logsDir, `${name}.log`);

  // The canonical production application is `site/` (SvelteKit 2 +
  // adapter-static) since #2 landed. It was `astro-site/` before that, and the
  // CHECK NAMES below still say "astro" - deliberately. `astroBuild` and the
  // rest are a cross-repo contract: hp-controller's REQUIRED_CHECKS lists them
  // by name and refuses a release that is missing one. Renaming them here
  // without changing that list, and every stored config that overrides it,
  // would fail every release with "required check missing" - a worse outcome
  // than a name that has outlived its framework.
  //
  // adapter-static writes to `build/`, not `dist/`. That is not cosmetic: the
  // release controller publishes this directory to gh-pages, so pointing at a
  // path the build never creates publishes nothing and reports success.
  const appDir = path.join(workspace, 'site');
  const distDir = path.join(appDir, 'build');

  let failure = null;
  try {
    // 1 — clean checkout of the exact requested SHA -------------------------
    await runState.check('clean-checkout', async (entry) => {
      await fsp.rm(workspace, { recursive: true, force: true });
      await fsp.mkdir(path.dirname(workspace), { recursive: true });

      const logFile = logFileFor('clean-checkout');
      const git = (gitArgs, cwd = workspace) =>
        run('git', gitArgs, { cwd, timeout: TIMEOUTS.git, logFile, label: 'git' });

      const clone = await run('git', ['clone', '--no-checkout', source, workspace], {
        cwd: path.dirname(workspace),
        timeout: TIMEOUTS.git,
        logFile,
        label: 'git',
      });
      if (clone.code !== 0) throw new Error(`git clone from ${source} failed (exit ${clone.code})`);

      let present = await git(['cat-file', '-e', `${headSha}^{commit}`]);
      if (present.code !== 0) {
        const fetchFrom = remote || (await detectRemoteUrl(source));
        if (!fetchFrom) {
          throw new Error(
            `commit ${headSha} is not present in ${source} and no --remote was supplied`,
          );
        }
        log(`commit not in local source; fetching ${headSha} from ${fetchFrom}`);
        const fetched = await git(['fetch', '--no-tags', '--depth', '1', fetchFrom, headSha]);
        if (fetched.code !== 0) {
          throw new Error(`could not fetch ${headSha} from ${fetchFrom} (exit ${fetched.code})`);
        }
        present = await git(['cat-file', '-e', `${headSha}^{commit}`]);
        if (present.code !== 0) throw new Error(`commit ${headSha} still unavailable after fetch`);
      }

      const checkout = await git(['checkout', '--detach', '--force', headSha]);
      if (checkout.code !== 0) throw new Error(`git checkout ${headSha} failed`);

      const clean = await git(['status', '--porcelain']);
      if (clean.code !== 0) throw new Error('git status failed in the fresh checkout');
      const dirty = clean.output.split('\n').filter((line) => line.trim() !== '');
      if (dirty.length > 0) {
        throw new Error(`fresh checkout is not clean:\n${dirty.join('\n')}`);
      }

      entry.details.workspace = workspace;
      return { source, cleanWorktree: true };
    });

    // 2 — the checkout is the exact requested SHA ---------------------------
    await runState.check('exact-head-sha', async () => {
      const result = await run('git', ['rev-parse', 'HEAD'], {
        cwd: workspace,
        timeout: TIMEOUTS.git,
        logFile: logFileFor('exact-head-sha'),
        label: 'git',
      });
      if (result.code !== 0) throw new Error('git rev-parse HEAD failed');
      const actual = result.output.trim().split('\n').pop().trim();
      if (actual !== headSha) {
        throw new Error(`checkout HEAD is ${actual}, expected ${headSha}`);
      }
      if (!fs.existsSync(path.join(appDir, 'package-lock.json'))) {
        throw new Error(`site/package-lock.json missing at ${headSha}`);
      }
      return { requested: headSha, actual };
    });

    // 3 — no GitHub-hosted CI may exist for this commit ----------------------
    //
    // The permitted hosted-job budget is zero, so a manual (`workflow_dispatch`)
    // build/test job is a violation too: it still runs application work on a
    // hosted runner, outside the evidence chain.
    await runState.check('no-hosted-ci', async () => {
      const workflowsDir = path.join(workspace, '.github', 'workflows');
      const files = (await walkFiles(workflowsDir)).filter((file) => /\.ya?ml$/.test(file));
      const offenders = [];
      for (const file of files) {
        const relative = path.relative(workspace, file);
        const yaml = await fsp.readFile(file, 'utf8');
        const triggers = automaticTriggers(yaml);
        if (triggers.length > 0) offenders.push(`${relative}: automatic trigger(s) ${triggers.join(', ')}`);
        const hosted = hostedRunsOnLabels(yaml);
        if (hosted.length > 0) offenders.push(`${relative}: GitHub-hosted job(s) runs-on ${hosted.join(', ')}`);
      }
      if (offenders.length > 0) {
        throw new Error(
          'GitHub-hosted CI is not permitted — build, test, browser, accessibility, ' +
            `screenshot and review work must run locally:\n${offenders.join('\n')}`,
        );
      }
      return { workflowFiles: files.map((file) => path.relative(workspace, file)), hostedJobs: 0 };
    });

    // 4 — Node version pin: engines.node and .nvmrc must agree, and must
    // actually allow the Node this worker is running -------------------------
    //
    // A missing or unreadable value here is not "no constraint" — it is a
    // failed check. A fresh clone that runs `nvm use && npm ci` with no
    // engines warning is an acceptance criterion, so this is asserted from the
    // exact files at the requested SHA, not assumed from repo convention.
    await runState.check('node-version-pin', async () => {
      const pkgPath = path.join(appDir, 'package.json');
      const pkg = await readJsonIfPresent(pkgPath);
      if (!pkg) throw new Error(`site/package.json missing or unparseable at ${headSha}`);
      const engineRange = pkg.engines && pkg.engines.node;
      if (typeof engineRange !== 'string' || engineRange.trim() === '') {
        throw new Error('site/package.json declares no engines.node — a Node version pin is required');
      }
      // ">=22" is asserted as all three of its parts, not just the floor: the
      // range must admit 22.0.0, admit later 22.x releases, and exclude
      // everything below 22. An exact pin like "22" admits 22.0.0 but not
      // 22.1.0, so it would still warn on any 22.x upgrade — it is not a
      // >=22 policy and is rejected here.
      const admitsFloor = nodeVersionSatisfies(`${MINIMUM_NODE_MAJOR}.0.0`, engineRange);
      const admitsLater = nodeVersionSatisfies(`${MINIMUM_NODE_MAJOR}.999.999`, engineRange);
      const excludesOlder = !nodeVersionSatisfies(`${MINIMUM_NODE_MAJOR - 1}.999.999`, engineRange);
      if (!admitsFloor || !admitsLater || !excludesOlder) {
        throw new Error(
          `site/package.json engines.node "${engineRange}" does not express the required policy ` +
            `>=${MINIMUM_NODE_MAJOR} (admits ${MINIMUM_NODE_MAJOR}.0.0: ${admitsFloor}, ` +
            `admits ${MINIMUM_NODE_MAJOR}.x: ${admitsLater}, excludes <${MINIMUM_NODE_MAJOR}: ${excludesOlder})`,
        );
      }

      const nvmrcPath = path.join(workspace, '.nvmrc');
      if (!fs.existsSync(nvmrcPath)) {
        throw new Error(`.nvmrc missing at repo root at ${headSha} — a Node version pin is required`);
      }
      const nvmrcRaw = (await fsp.readFile(nvmrcPath, 'utf8')).trim();
      // The whole trimmed value must be a numeric pin. A prefix match would
      // accept "22garbage" or an alias such as "lts/*" and read it as Node 22,
      // even though this check cannot verify what version nvm would actually
      // resolve either to — an unresolvable pin is a failure, not a Node 22.
      const nvmrcMatch = nvmrcRaw.match(/^v?(\d+)(?:\.\d+)?(?:\.\d+)?$/);
      if (!nvmrcMatch) {
        throw new Error(
          `.nvmrc content "${nvmrcRaw}" is not a numeric Node version pin (expected "22", "22.11" or "v22.11.0") — ` +
            'aliases and trailing text are rejected because this check cannot verify the version they would resolve to',
        );
      }
      if (!nodeVersionSatisfies(`${nvmrcMatch[1]}.0.0`, engineRange)) {
        throw new Error(
          `.nvmrc pins Node ${nvmrcRaw}, which does not satisfy site/package.json engines.node "${engineRange}" — ` +
            'a fresh `nvm use && npm ci` would emit an engines warning',
        );
      }

      const workerVersion = process.version.replace(/^v/, '');
      if (!nodeVersionSatisfies(workerVersion, engineRange)) {
        throw new Error(
          `this worker is running Node ${process.version}, which does not satisfy site/package.json engines.node "${engineRange}"`,
        );
      }

      return { engines: engineRange, nvmrc: nvmrcRaw, workerNode: process.version };
    });

    // 5 — dependency install from site/'s lockfile ---------------------
    await runState.check('dependency-install', async () => {
      const result = await run('npm', ['ci'], {
        cwd: appDir,
        env: { CI: '1', npm_config_fund: 'false', npm_config_audit: 'false' },
        timeout: TIMEOUTS.npmCi,
        logFile: logFileFor('dependency-install'),
        label: 'npm-ci',
      });
      if (result.code !== 0) {
        throw new Error(`npm ci failed in site (exit ${result.code}${result.timedOut ? ', timed out' : ''})`);
      }
      return { command: 'npm ci', cwd: 'site', durationMs: result.durationMs };
    });

    // 6 — npm audit gate: fail on high/critical, warn on moderate ------------
    //
    // A run that cannot determine the audit result is not a pass: an
    // unparseable report, a registry error, or an unexplained non-zero exit
    // with no vulnerabilities counted all fail the check rather than being
    // read as "no advisories".
    await runState.check('dependency-audit', async () => {
      const resultsFile = path.join(evidenceDir, 'npm-audit.json');
      const result = await run('npm', ['audit', `--audit-level=${AUDIT_FAIL_LEVEL}`, '--json'], {
        cwd: appDir,
        env: { CI: '1' },
        timeout: TIMEOUTS.npmAudit,
        logFile: logFileFor('dependency-audit'),
        label: 'npm-audit',
        captureStdout: true,
      });
      // Parsed from stdout only: stdout and stderr are combined (in event-arrival
      // order) into `result.output` for the log file, and an unrelated `npm warn`
      // line on stderr must never corrupt the JSON report this check depends on.
      await fsp.writeFile(resultsFile, result.stdout);

      let report;
      try {
        report = JSON.parse(result.stdout);
      } catch {
        throw new Error(
          `npm audit produced no parseable JSON report (exit ${result.code}${result.timedOut ? ', timed out' : ''}) — ` +
            'the audit result could not be established, so it is not treated as a pass',
        );
      }
      if (report.error) {
        throw new Error(`npm audit reported an error: ${report.error.summary || JSON.stringify(report.error)}`);
      }

      const severities = (report.metadata && report.metadata.vulnerabilities) || null;
      if (!severities) {
        throw new Error('npm audit report has no metadata.vulnerabilities — the audit result could not be established');
      }
      // A missing count is "could not establish", not zero: an incomplete
      // report must not be read as an absence of advisories.
      const severityCount = (name) => {
        const value = severities[name];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(
            `npm audit report has no numeric metadata.vulnerabilities.${name} — the audit result could not be established`,
          );
        }
        return value;
      };
      const critical = severityCount('critical');
      const high = severityCount('high');
      const moderate = severityCount('moderate');
      if (critical > 0 || high > 0) {
        throw new Error(
          `npm audit found ${critical} critical and ${high} high severity advisor(y/ies) in site/ — ` +
            'fix them or document a justification in the pull request before merge',
        );
      }
      if (result.code !== 0) {
        throw new Error(
          `npm audit exited ${result.code}${result.timedOut ? ' (timed out)' : ''} without reporting any critical/high ` +
            'severity advisories — an unexplained non-zero exit is not treated as a pass',
        );
      }
      if (moderate > 0) {
        log(`dependency-audit: ${moderate} moderate-severity advisor(y/ies) in site/ (non-blocking warning)`);
      }

      return {
        auditLevel: AUDIT_FAIL_LEVEL,
        critical,
        high,
        moderate,
        low: severityCount('low'),
        info: severityCount('info'),
        resultsFile,
      };
    });

    // 7 — pinned browser install, into project-controlled storage ------------
    //
    // The run installs the browser itself instead of trusting whatever is in
    // the invoking user's cache, so a clean worker completes validation. The
    // version is whatever site/'s lockfile pinned: `playwright install`
    // downloads the revision that the installed @playwright/test requires.
    await runState.check('playwright-browsers', async () => {
      const bin = path.join(appDir, 'node_modules', '.bin', 'playwright');
      if (!fs.existsSync(bin)) {
        throw new Error('playwright is not installed in site/node_modules — required check unavailable');
      }
      const logFile = logFileFor('playwright-browsers');
      await fsp.mkdir(browsersPath, { recursive: true });

      const version = await run(bin, ['--version'], {
        cwd: appDir,
        timeout: TIMEOUTS.git,
        logFile,
        label: 'playwright',
      });
      if (version.code !== 0) throw new Error('`playwright --version` failed');

      // System libraries need root. Install them when we have it (or when the
      // operator opted in); otherwise the launch probe below is what proves
      // they are present, and its failure names the command to run.
      const canInstallDeps =
        typeof process.getuid === 'function'
          ? process.getuid() === 0 || process.env.LOCAL_CI_INSTALL_DEPS === '1'
          : false;
      const installArgs = canInstallDeps
        ? ['install', '--with-deps', 'chromium']
        : ['install', 'chromium'];
      const install = await run(bin, installArgs, {
        cwd: appDir,
        env: { CI: '1', PLAYWRIGHT_BROWSERS_PATH: browsersPath },
        timeout: TIMEOUTS.browserInstall,
        logFile,
        label: 'playwright-install',
      });
      if (install.code !== 0) {
        throw new Error(
          `\`playwright ${installArgs.join(' ')}\` failed (exit ${install.code}${install.timedOut ? ', timed out' : ''}) — ` +
            `browsers could not be installed into ${browsersPath}`,
        );
      }

      const browser = await resolveChromium(appDir);
      if (!browser.installed) {
        throw new Error(
          `chromium is still missing after install (${browser.reason}); browsers path ${browsersPath}`,
        );
      }

      // Launch probe: proves the binary AND its system dependencies work here.
      // Without it a missing shared library would only surface as a confusing
      // failure inside the test run.
      const probe = await probeChromiumLaunch(appDir);
      await fsp.appendFile(
        logFile,
        `$ chromium launch probe\n${probe.ok ? `ok — ${probe.version}` : `FAILED — ${probe.reason}`}\n\n`,
      );
      if (!probe.ok) {
        throw new Error(
          `chromium is installed at ${browser.executablePath} but will not launch: ${probe.reason}\n` +
            'Install its system dependencies on this worker, e.g.\n' +
            `  sudo PLAYWRIGHT_BROWSERS_PATH=${browsersPath} npx playwright install-deps chromium\n` +
            '(or re-run this command as root, or with LOCAL_CI_INSTALL_DEPS=1 and passwordless sudo). ' +
            'Browser checks must never be skipped.',
        );
      }

      return {
        playwrightVersion: version.output.trim().split('\n').pop().trim(),
        browsersPath,
        executablePath: browser.executablePath,
        installCommand: `playwright ${installArgs.join(' ')}`,
        systemDependencies: canInstallDeps ? 'installed by this run' : 'verified by launch probe',
        launchProbe: probe.version,
      };
    });

    // 8 — canonical production build ----------------------------------------
    await runState.check('astro-build', async () => {
      const result = await run('npm', ['run', 'build'], {
        cwd: appDir,
        env: { CI: '1' },
        timeout: TIMEOUTS.build,
        logFile: logFileFor('astro-build'),
        label: 'astro-build',
      });
      if (result.code !== 0) {
        throw new Error(`site build failed (exit ${result.code}${result.timedOut ? ', timed out' : ''})`);
      }
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        throw new Error(`site build produced no ${path.relative(workspace, distDir)}/index.html`);
      }
      const files = await walkFiles(distDir);
      const htmlPages = files.filter((file) => file.endsWith('.html')).length;
      if (htmlPages === 0) throw new Error('site build produced no HTML pages');
      return { distDir, htmlPages, distFiles: files.length, durationMs: result.durationMs };
    });

    // 9 — Vitest -------------------------------------------------------------
    await runState.check('vitest', async () => {
      const bin = path.join(appDir, 'node_modules', '.bin', 'vitest');
      if (!fs.existsSync(bin)) {
        throw new Error('vitest is not installed in site/node_modules — required check unavailable');
      }
      const resultsFile = path.join(evidenceDir, 'vitest-results.json');
      // Vitest owns `*.test.ts`; `tests/*.spec.ts` are Playwright specs and are
      // executed by the playwright check below, not here.
      //
      // `--exclude` REPLACES Vitest's default exclude list, so node_modules,
      // the build output and generated types have to be restated here. BOTH
      // frameworks' artefacts are listed: site/ writes build/ and .svelte-kit/,
      // and astro-site/ (dist/, .astro/) is still in the tree until #4 removes
      // it. Missing one means collecting a generated copy of a test and
      // reporting a result that depends on the tree, not on this commit — this
      // check runs after the build, and collecting a dependency's own tests
      // would make the result depend on the tree rather than on this commit.
      const result = await run(
        bin,
        [
          'run',
          '--exclude',
          '**/node_modules/**',
          '--exclude',
          '**/dist/**',
          '--exclude',
          '**/.astro/**',
          '--exclude',
          '**/build/**',
          '--exclude',
          '**/.svelte-kit/**',
          '--exclude',
          '**/*.spec.ts',
          '--reporter=default',
          '--reporter=json',
          `--outputFile.json=${resultsFile}`,
        ],
        {
          cwd: appDir,
          env: { CI: '1' },
          timeout: TIMEOUTS.vitest,
          logFile: logFileFor('vitest'),
          label: 'vitest',
        },
      );
      const report = await readJsonIfPresent(resultsFile);
      if (result.code !== 0) {
        throw new Error(`vitest failed (exit ${result.code}${result.timedOut ? ', timed out' : ''})`);
      }
      if (!report) throw new Error(`vitest produced no JSON report at ${resultsFile}`);
      const total = report.numTotalTests ?? 0;
      const failed = report.numFailedTests ?? 0;
      const passed = report.numPassedTests ?? 0;
      const pending = report.numPendingTests ?? 0;
      if (total === 0) throw new Error('vitest collected zero tests — no silent no-op runs allowed');
      if (failed > 0) throw new Error(`vitest reported ${failed} failing test(s)`);
      if (pending > 0) throw new Error(`vitest reported ${pending} skipped test(s) — skips are not allowed`);
      return { totalTests: total, passedTests: passed, suites: report.numTotalTestSuites ?? null, resultsFile };
    });

    // 10 — Playwright against the built dist output ---------------------------
    await runState.check('playwright-built-output', async () => {
      const configPath = path.join(appDir, 'playwright.config.ts');
      if (!fs.existsSync(configPath)) {
        throw new Error('site/playwright.config.ts missing — required check unavailable');
      }
      const config = await fsp.readFile(configPath, 'utf8');
      if (/astro\s+dev|run\s+dev/.test(config)) {
        throw new Error('playwright.config.ts starts a dev server; it must serve the built dist output');
      }
      if (!/preview/.test(config)) {
        throw new Error('playwright.config.ts does not serve the built output via `preview`');
      }
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        throw new Error(`${path.relative(workspace, distDir)}/index.html missing — Playwright would not test production output`);
      }

      const bin = path.join(appDir, 'node_modules', '.bin', 'playwright');
      if (!fs.existsSync(bin)) {
        throw new Error('playwright is not installed in site/node_modules — required check unavailable');
      }
      const browser = await resolveChromium(appDir);
      if (!browser.installed) {
        throw new Error(
          `Playwright chromium is not installed (${browser.reason}) even though the ` +
            'playwright-browsers check installed it. Browser checks must never be skipped.',
        );
      }

      const resultsFile = path.join(evidenceDir, 'playwright-results.json');
      const result = await run(bin, ['test', '--reporter=list,json'], {
        cwd: appDir,
        env: {
          CI: '1',
          PLAYWRIGHT_BROWSERS_PATH: browsersPath,
          PLAYWRIGHT_JSON_OUTPUT_NAME: resultsFile,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
        timeout: TIMEOUTS.playwright,
        logFile: logFileFor('playwright-built-output'),
        label: 'playwright',
      });
      if (result.code !== 0) {
        throw new Error(`playwright failed (exit ${result.code}${result.timedOut ? ', timed out' : ''})`);
      }
      const report = await readJsonIfPresent(resultsFile);
      if (!report) throw new Error(`playwright produced no JSON report at ${resultsFile}`);
      const stats = report.stats ?? {};
      if ((stats.expected ?? 0) === 0) {
        throw new Error('playwright reported zero passing tests — no silent skips allowed');
      }
      if ((stats.unexpected ?? 0) > 0) throw new Error(`playwright reported ${stats.unexpected} failure(s)`);
      if ((stats.skipped ?? 0) > 0) {
        throw new Error(`playwright skipped ${stats.skipped} test(s) — skips are not allowed`);
      }
      if ((stats.flaky ?? 0) > 0) throw new Error(`playwright reported ${stats.flaky} flaky test(s)`);
      return {
        browserExecutable: browser.executablePath,
        passed: stats.expected,
        skipped: stats.skipped ?? 0,
        servedFrom: 'site/build (vite preview)',
        resultsFile,
        durationMs: result.durationMs,
      };
    });

    // 11 + 12 — accessibility and screenshots from the built output ------------
    const evidenceScript = path.join(workspace, 'utils', 'ci', 'browser-evidence.mjs');
    const a11yReportFile = path.join(evidenceDir, 'accessibility-report.json');
    await runState.check('accessibility', async () => {
      if (!fs.existsSync(evidenceScript)) {
        throw new Error(`utils/ci/browser-evidence.mjs missing at ${headSha} — required check unavailable`);
      }
      const result = await run(
        process.execPath,
        [
          evidenceScript,
          '--dist',
          distDir,
          '--screenshots',
          screenshotsDir,
          '--report',
          a11yReportFile,
        ],
        {
          cwd: workspace,
          env: { CI: '1', PLAYWRIGHT_BROWSERS_PATH: browsersPath },
          timeout: TIMEOUTS.browserEvidence,
          logFile: logFileFor('accessibility'),
          label: 'a11y',
        },
      );
      if (result.code !== 0) {
        throw new Error(
          `accessibility/screenshot pass failed (exit ${result.code}${result.timedOut ? ', timed out' : ''})`,
        );
      }
      const report = await readJsonIfPresent(a11yReportFile);
      if (!report) throw new Error(`no accessibility report written at ${a11yReportFile}`);
      if (!report.pages || report.pages.length === 0) {
        throw new Error('accessibility pass checked zero pages');
      }
      if (report.totalViolations > 0) {
        throw new Error(`${report.totalViolations} accessibility violation(s) in the built output`);
      }
      return {
        pagesChecked: report.pages.length,
        rules: report.rules,
        totalViolations: report.totalViolations,
        reportFile: a11yReportFile,
      };
    });

    await runState.check('screenshots', async () => {
      const files = (await walkFiles(screenshotsDir)).filter((file) => file.endsWith('.png'));
      if (files.length === 0) {
        throw new Error('no screenshots were captured from the built production output');
      }
      return {
        count: files.length,
        directory: screenshotsDir,
        files: files.map((file) => path.relative(evidenceDir, file)),
      };
    });
  } catch (error) {
    failure = error;
  }

  // 13 — SHA-bound evidence manifest ------------------------------------------
  const manifestPath = path.join(evidenceDir, 'manifest.json');
  let manifestError = null;
  let artifacts = [];
  try {
    const files = (await walkFiles(evidenceDir)).filter((file) => file !== manifestPath);
    artifacts = await Promise.all(
      files.map(async (file) => {
        const stat = await fsp.stat(file);
        return {
          path: file,
          relativePath: path.relative(evidenceDir, file),
          kind: classifyArtifact(path.relative(evidenceDir, file)),
          bytes: stat.size,
          sha256: await sha256File(file),
        };
      }),
    );
  } catch (error) {
    manifestError = error;
  }

  runState.skipRemaining(REQUIRED_CHECKS);
  const manifestCheck = {
    name: 'evidence-manifest',
    status: manifestError ? 'fail' : 'pass',
    startedAt: nowIso(),
    completedAt: nowIso(),
    details: { manifestPath, artifactCount: artifacts.length },
  };
  if (manifestError) manifestCheck.error = String(manifestError.message || manifestError);
  const existingManifestCheck = runState.checks.find((check) => check.name === 'evidence-manifest');
  Object.assign(existingManifestCheck, manifestCheck);

  const verdict =
    !failure && !manifestError && runState.checks.every((check) => check.status === 'pass')
      ? 'pass'
      : 'fail';

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    requiredStatus: REQUIRED_STATUS,
    repository,
    context: runContext,
    pullRequestNumber,
    headSha,
    correlationId,
    startedAt: runState.startedAt,
    completedAt: nowIso(),
    durationMs: Date.now() - runState.startedMs,
    runner,
    workspace,
    evidenceDir,
    browsersPath,
    checks: runState.checks,
    artifacts,
    verdict,
    failureReason: failure ? String(failure.message || failure) : null,
    // The worker cannot approve its own run. A `pass` verdict here means the
    // local checks passed, nothing more; the control plane still has to produce
    // the evidence below before the change is approvable. Naming it in the
    // manifest keeps an aggregate report from reading a green worker verdict as
    // an approval.
    requiresControlPlaneEvidence: [
      'postgres-record',
      'branch-protection-before',
      'branch-protection-after',
      'pull-request-summary',
      'discord-summary',
      'local-ci-status',
    ],
  };
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  log(`manifest          ${manifestPath}`);
  log(`artifacts         ${artifacts.length}`);
  log(`verdict           ${verdict.toUpperCase()}`);
  for (const check of runState.checks) {
    log(`  ${check.status.padEnd(8)} ${check.name}${check.error ? ` — ${check.error}` : ''}`);
  }

  if (verdict === 'pass' && !args['keep-workspace']) {
    await fsp.rm(workspace, { recursive: true, force: true });
  } else if (verdict !== 'pass') {
    log(`workspace kept for triage: ${workspace}`);
  }

  process.exit(verdict === 'pass' ? 0 : 1);
}

// ---------------------------------------------------------------------------
// support
// ---------------------------------------------------------------------------

/**
 * Minimal semver-range check, just enough for `engines.node`-style ranges
 * (`>=22`, `>=22 <23`, `22`, `>=18 || >=20`, ...). Deliberately dependency-free:
 * this script runs with nothing but Node's own standard library. Ranges are
 * `||`-separated OR-groups of space/comma-separated AND-comparators, same as
 * npm's `engines` field.
 */
function parseVersionTuple(version) {
  const match = String(version).trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)];
}

function compareVersionTuples(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function nodeVersionSatisfies(version, range) {
  const actual = parseVersionTuple(version);
  if (!actual) return false;
  const orGroups = String(range)
    .trim()
    .split(/\s*\|\|\s*/)
    .filter(Boolean);
  if (orGroups.length === 0) return false;
  return orGroups.some((group) => {
    const comparators = group.split(/\s*,\s*|\s+/).filter(Boolean);
    if (comparators.length === 0) return false;
    return comparators.every((comparator) => {
      const match = comparator.match(/^(>=|<=|>|<|=)?\s*(v?\d.*)$/);
      if (!match) return false;
      const target = parseVersionTuple(match[2]);
      if (!target) return false;
      const cmp = compareVersionTuples(actual, target);
      switch (match[1] || '=') {
        case '>=':
          return cmp >= 0;
        case '<=':
          return cmp <= 0;
        case '>':
          return cmp > 0;
        case '<':
          return cmp < 0;
        default:
          return cmp === 0;
      }
    });
  });
}

function classifyArtifact(relativePath) {
  if (relativePath.startsWith('screenshots/')) return 'screenshot';
  if (relativePath.startsWith('logs/')) return 'log';
  if (relativePath.endsWith('.json')) return 'report';
  return 'artifact';
}

/**
 * Automatic (non-manual) triggers declared by a workflow file. Only
 * `workflow_dispatch` — a human pressing a button — is permitted; anything
 * that fires by itself would put build/test work back on hosted runners.
 */
function automaticTriggers(yaml) {
  const forbidden = ['pull_request_target', 'pull_request', 'push', 'schedule', 'merge_group'];
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => /^on:/.test(line));
  if (start === -1) return [];

  // Either the inline form (`on: [push]`) or the indented block beneath `on:`.
  const inline = lines[start].slice(3).split('#')[0].trim();
  const scope = [inline];
  if (inline === '') {
    for (let i = start + 1; i < lines.length; i += 1) {
      if (lines[i].trim() === '') continue;
      if (!/^\s/.test(lines[i])) break;
      scope.push(lines[i].split('#')[0]);
    }
  }
  const block = scope.join('\n');
  return forbidden.filter((trigger) => new RegExp(`(^|[\\s\\[,])${trigger}\\b`, 'm').test(block));
}

/**
 * GitHub-hosted `runs-on:` labels declared by a workflow file. Self-hosted
 * labels are not matched — but this project registers no self-hosted runner
 * either, so in practice any job here is a violation.
 */
function hostedRunsOnLabels(yaml) {
  const labels = new Set();
  for (const line of yaml.split('\n')) {
    const match = line.split('#')[0].match(/^\s*runs-on:\s*(.+?)\s*$/);
    if (!match) continue;
    for (const label of match[1].replace(/[[\]'"]/g, ' ').split(/[\s,]+/)) {
      if (/^(ubuntu|macos|windows)-/.test(label)) labels.add(label);
    }
  }
  return [...labels];
}

/**
 * Launch the installed chromium once. This is the only way to prove the
 * browser's system dependencies are present on this worker before the browser
 * checks depend on them.
 */
async function probeChromiumLaunch(appDir) {
  let browser = null;
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(path.join(appDir, 'package.json'));
    const { chromium } = require('@playwright/test');
    browser = await Promise.race([
      chromium.launch({ headless: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('launch timed out')), TIMEOUTS.browserLaunch).unref?.(),
      ),
    ]);
    const version = browser.version();
    const page = await browser.newPage();
    await page.setContent('<title>probe</title><h1>probe</h1>');
    await page.close();
    return { ok: true, version };
  } catch (error) {
    return { ok: false, reason: String(error && error.message ? error.message : error) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function resolveChromium(appDir) {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(path.join(appDir, 'package.json'));
    const { chromium } = require('@playwright/test');
    if (!chromium) return { installed: false, reason: '@playwright/test exports no chromium browser type' };
    const executablePath = chromium.executablePath();
    if (!executablePath || !fs.existsSync(executablePath)) {
      return { installed: false, reason: `browser binary missing at ${executablePath}` };
    }
    return { installed: true, executablePath };
  } catch (error) {
    return { installed: false, reason: String(error && error.message ? error.message : error) };
  }
}

async function detectRepository(source) {
  const url = await detectRemoteUrl(source);
  if (!url) return null;
  const match = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

async function detectRemoteUrl(source) {
  const result = await run('git', ['config', '--get', 'remote.origin.url'], {
    cwd: source,
    timeout: TIMEOUTS.git,
    label: 'git',
  });
  if (result.code !== 0) return null;
  return result.output.trim() || null;
}

main().catch((error) => fail(error && error.stack ? error.stack : String(error)));
