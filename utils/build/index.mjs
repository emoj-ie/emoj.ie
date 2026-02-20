import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEmojiModel } from './load-data.mjs';
import { ensureBaseEmojiAssets } from './emoji-assets.mjs';
import { buildLegacyRedirects } from './redirects.mjs';
import { renderSite } from './render.mjs';
import { buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml } from './sitemap.mjs';
import { buildServiceWorker } from './sw.mjs';
import { verifyModel, verifyRenderResult } from './verify.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function writeTextFile(rootDir, relativeFile, contents) {
  const filePath = path.join(rootDir, relativeFile);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}

async function syncFile(sourceFile, targetFile) {
  if (!(await pathExists(sourceFile))) {
    await fs.rm(targetFile, { force: true });
    return;
  }

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.copyFile(sourceFile, targetFile);
}

function stableList(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildHash(parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) {
    hash.update(String(part));
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 16);
}

function formatProgressBar(current, total, width = 28) {
  const normalizedTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, current / normalizedTotal));
  const filled = Math.round(width * ratio);
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function printPhaseProgress(current, total, label) {
  const percent = Math.round((Math.max(0, current) / Math.max(1, total)) * 100);
  const padded = String(percent).padStart(3, ' ');
  console.log(`${formatProgressBar(current, total)} ${padded}% ${label}`);
}

function printSyncProgress(current, total) {
  const label = `Syncing generated files ${current}/${total}`;
  const percent = Math.round((Math.max(0, current) / Math.max(1, total)) * 100);
  const line = `${formatProgressBar(current, total)} ${String(percent).padStart(3, ' ')}% ${label}`;

  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
    if (current === total) {
      process.stdout.write('\n');
    }
    return;
  }

  if (current === 1 || current === total || current % 250 === 0) {
    console.log(line);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has('--check');
  const skipAssets = args.has('--skip-assets');
  const includeAssetStep = !checkOnly && !skipAssets;
  const includeSyncStep = !checkOnly;
  const phaseTotal = 7 + (includeAssetStep ? 1 : 0) + (includeSyncStep ? 1 : 0);
  let phaseCurrent = 0;

  const advancePhase = (label) => {
    phaseCurrent += 1;
    printPhaseProgress(phaseCurrent, phaseTotal, label);
  };

  const configPath = path.join(ROOT_DIR, 'utils/site.config.json');
  const config = await readJson(configPath);

  const outputRoot = path.resolve(ROOT_DIR, config.paths.outputRoot);
  const tempRoot = path.join(ROOT_DIR, config.paths.tempBuildDir);
  const manifestFile = config.build.manifestFile;
  const manifestPath = path.join(outputRoot, manifestFile);

  advancePhase('Preparing build workspace');
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  advancePhase('Loading emoji model');
  const model = await loadEmojiModel({ rootDir: ROOT_DIR, config });

  let assetStats = null;
  if (!checkOnly && !skipAssets) {
    advancePhase('Ensuring local emoji assets');
    assetStats = await ensureBaseEmojiAssets({
      rootDir: ROOT_DIR,
      model,
      config,
      refresh: args.has('--refresh-assets'),
    });
  }

  advancePhase('Computing redirects and validating model');
  const legacyRedirects = buildLegacyRedirects(model.emojiEntries, {
    preferBaseForCollisions: config.redirects?.preferBaseForCollisions,
  });

  verifyModel({ emojiEntries: model.emojiEntries, legacyRedirects });

  advancePhase('Rendering HTML and JSON artifacts');
  const renderResult = await renderSite({
    model,
    legacyRedirects,
    config,
    tempRoot,
  });

  verifyRenderResult(renderResult);

  const [groupedDataStat, groupedDataContents] = await Promise.all([
    fs.stat(model.groupedDataPath),
    fs.readFile(model.groupedDataPath, 'utf8'),
  ]);
  const timestamp = new Date(Math.floor(groupedDataStat.mtimeMs)).toISOString();
  const groupedDataHash = buildHash([groupedDataContents]);

  advancePhase('Building sitemap files');
  const coreSitemapXml = buildSitemapXml(renderResult.coreRoutes, {
    baseUrl: config.site.baseUrl,
    lastmod: timestamp,
    priority: '0.8',
  });

  const emojiSitemapXml = buildSitemapXml(renderResult.emojiRoutes, {
    baseUrl: config.site.baseUrl,
    lastmod: timestamp,
    priority: '0.7',
  });

  const sitemapIndexXml = buildSitemapIndexXml(
    [config.build.sitemapCore, config.build.sitemapEmoji],
    {
      baseUrl: config.site.baseUrl,
      lastmod: timestamp,
    }
  );
  const robotsTxt = buildRobotsTxt({
    baseUrl: config.site.baseUrl,
    sitemapIndexFile: config.build.sitemapIndex,
  });

  await writeTextFile(tempRoot, config.build.sitemapCore, coreSitemapXml);
  await writeTextFile(tempRoot, config.build.sitemapEmoji, emojiSitemapXml);
  await writeTextFile(tempRoot, config.build.sitemapIndex, sitemapIndexXml);
  await writeTextFile(tempRoot, config.build.robots || 'robots.txt', robotsTxt);

  const managedRoots = stableList([
    ...model.groups.map((group) => group.key),
    ...(config.indexing?.includeAboutPage ? ['about'] : []),
  ]);
  const managedFiles = stableList([
    config.build.sitemapIndex,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    config.build.robots || 'robots.txt',
    'sw.js',
    manifestFile,
  ]);

  const generatedFileList = stableList([
    ...renderResult.generatedFiles,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    config.build.sitemapIndex,
    config.build.robots || 'robots.txt',
    'sw.js',
  ]);

  const buildHashValue = buildHash([
    groupedDataHash,
    JSON.stringify(config.indexing || {}),
    JSON.stringify(config.redirects || {}),
    ...managedRoots,
    ...generatedFileList,
  ]);

  advancePhase('Generating service worker and manifest');
  const swContent = buildServiceWorker({ buildHash: buildHashValue });
  await writeTextFile(tempRoot, 'sw.js', swContent);

  const manifest = {
    version: 1,
    generatedAt: timestamp,
    buildHash: buildHashValue,
    managedRoots,
    managedFiles,
    stats: {
      groups: model.groups.length,
      emojis: model.emojiEntries.length,
      redirects: legacyRedirects.length,
      files: generatedFileList.length,
      coreRoutes: renderResult.coreRoutes.size,
      emojiRoutes: renderResult.emojiRoutes.size,
    },
    files: generatedFileList,
  };

  await writeTextFile(tempRoot, manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  if (!checkOnly) {
    advancePhase('Syncing generated output to repository');
    const previousManifest = (await readJsonIfExists(manifestPath)) || {};

    const filesToSync = stableList([
      ...generatedFileList,
      ...(previousManifest.managedFiles || []),
      ...(previousManifest.files || []),
      ...managedFiles,
    ]);

    const totalSyncFiles = filesToSync.length;
    let syncedCount = 0;
    for (const file of filesToSync) {
      await syncFile(path.join(tempRoot, file), path.join(outputRoot, file));
      syncedCount += 1;
      printSyncProgress(syncedCount, totalSyncFiles);
    }
  }

  advancePhase('Cleaning temporary build artifacts');
  await fs.rm(tempRoot, { recursive: true, force: true });

  console.log(`Phase 1 build complete${checkOnly ? ' (check only)' : ''}.`);
  console.log(`Groups: ${model.groups.length}`);
  console.log(`Emoji entries: ${model.emojiEntries.length}`);
  console.log(`Legacy redirects: ${legacyRedirects.length}`);
  console.log(`Generated files: ${generatedFileList.length}`);
  console.log(`Core sitemap routes: ${renderResult.coreRoutes.size}`);
  console.log(`Emoji sitemap routes: ${renderResult.emojiRoutes.size}`);
  if (assetStats) {
    console.log(
      `Local emoji assets: ${assetStats.total} total (${assetStats.downloaded} downloaded, ${assetStats.skipped} cached)`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
