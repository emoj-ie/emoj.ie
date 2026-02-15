import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEmojiModel } from './load-data.mjs';
import { ensureBaseEmojiAssets } from './emoji-assets.mjs';
import { buildLegacyRedirects } from './redirects.mjs';
import { renderSite } from './render.mjs';
import { buildSitemapIndexXml, buildSitemapXml } from './sitemap.mjs';
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

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has('--check');
  const skipAssets = args.has('--skip-assets');

  const configPath = path.join(ROOT_DIR, 'utils/site.config.json');
  const config = await readJson(configPath);

  const outputRoot = path.resolve(ROOT_DIR, config.paths.outputRoot);
  const tempRoot = path.join(ROOT_DIR, config.paths.tempBuildDir);
  const manifestFile = config.build.manifestFile;
  const manifestPath = path.join(outputRoot, manifestFile);

  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  const model = await loadEmojiModel({ rootDir: ROOT_DIR, config });

  let assetStats = null;
  if (!checkOnly && !skipAssets) {
    assetStats = await ensureBaseEmojiAssets({
      rootDir: ROOT_DIR,
      model,
      config,
      refresh: args.has('--refresh-assets'),
    });
  }

  const legacyRedirects = buildLegacyRedirects(model.emojiEntries, {
    preferBaseForCollisions: config.redirects?.preferBaseForCollisions,
  });

  verifyModel({ emojiEntries: model.emojiEntries, legacyRedirects });

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

  await writeTextFile(tempRoot, config.build.sitemapCore, coreSitemapXml);
  await writeTextFile(tempRoot, config.build.sitemapEmoji, emojiSitemapXml);
  await writeTextFile(tempRoot, config.build.sitemapIndex, sitemapIndexXml);

  const managedRoots = stableList([
    ...model.groups.map((group) => group.key),
    ...(config.indexing?.includeAboutPage ? ['about'] : []),
  ]);
  const managedFiles = stableList([
    config.build.sitemapIndex,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    'sw.js',
    manifestFile,
  ]);

  const generatedFileList = stableList([
    ...renderResult.generatedFiles,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    config.build.sitemapIndex,
    'sw.js',
  ]);

  const buildHashValue = buildHash([
    groupedDataHash,
    JSON.stringify(config.indexing || {}),
    JSON.stringify(config.redirects || {}),
    ...managedRoots,
    ...generatedFileList,
  ]);

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
    const previousManifest = (await readJsonIfExists(manifestPath)) || {};

    const filesToSync = stableList([
      ...generatedFileList,
      ...(previousManifest.managedFiles || []),
      ...(previousManifest.files || []),
      ...managedFiles,
    ]);

    for (const file of filesToSync) {
      await syncFile(path.join(tempRoot, file), path.join(outputRoot, file));
    }
  }

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
