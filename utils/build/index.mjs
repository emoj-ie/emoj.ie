import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEmojiModel } from './load-data.mjs';
import { buildLegacyRedirects } from './redirects.mjs';
import { renderSite } from './render.mjs';
import { buildSitemapIndexXml, buildSitemapXml } from './sitemap.mjs';
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

async function syncDirectory(sourceDir, targetDir) {
  const sourceExists = await pathExists(sourceDir);
  if (!sourceExists) {
    await fs.rm(targetDir, { recursive: true, force: true });
    return;
  }

  await fs.mkdir(targetDir, { recursive: true });

  const [sourceEntries, targetEntries] = await Promise.all([
    fs.readdir(sourceDir, { withFileTypes: true }),
    fs.readdir(targetDir, { withFileTypes: true }),
  ]);

  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));

  for (const targetEntry of targetEntries) {
    if (!sourceNames.has(targetEntry.name)) {
      await fs.rm(path.join(targetDir, targetEntry.name), { recursive: true, force: true });
    }
  }

  for (const sourceEntry of sourceEntries) {
    const sourcePath = path.join(sourceDir, sourceEntry.name);
    const targetPath = path.join(targetDir, sourceEntry.name);

    if (sourceEntry.isDirectory()) {
      await syncDirectory(sourcePath, targetPath);
      continue;
    }

    if (sourceEntry.isFile()) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
    }
  }
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

  const configPath = path.join(ROOT_DIR, 'utils/site.config.json');
  const config = await readJson(configPath);

  const outputRoot = path.resolve(ROOT_DIR, config.paths.outputRoot);
  const tempRoot = path.join(ROOT_DIR, config.paths.tempBuildDir);
  const manifestFile = config.build.manifestFile;
  const manifestPath = path.join(outputRoot, manifestFile);

  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  const model = await loadEmojiModel({ rootDir: ROOT_DIR, config });
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

  const managedRoots = stableList(model.groups.map((group) => group.key));
  const managedFiles = stableList([
    config.build.sitemapIndex,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    manifestFile,
  ]);

  const generatedFileList = stableList([
    ...renderResult.generatedFiles,
    config.build.sitemapCore,
    config.build.sitemapEmoji,
    config.build.sitemapIndex,
  ]);

  const manifest = {
    version: 1,
    generatedAt: timestamp,
    buildHash: buildHash([
      groupedDataHash,
      JSON.stringify(config.indexing || {}),
      JSON.stringify(config.redirects || {}),
      ...managedRoots,
      ...generatedFileList,
    ]),
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

    const rootsToSync = stableList([
      ...managedRoots,
      ...(previousManifest.managedRoots || []),
    ]);

    const filesToSync = stableList([
      ...managedFiles,
      ...(previousManifest.managedFiles || []),
    ]);

    for (const root of rootsToSync) {
      await syncDirectory(path.join(tempRoot, root), path.join(outputRoot, root));
    }

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
