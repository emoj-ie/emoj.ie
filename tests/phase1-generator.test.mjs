import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const grouped = JSON.parse(fs.readFileSync(path.join(root, 'grouped-openmoji.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
const sitemapIndex = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const buildRunner = fs.readFileSync(path.join(root, 'utils/build/index.mjs'), 'utf8');

function countEmojiEntries(groupedData) {
  let count = 0;
  for (const subgroups of Object.values(groupedData)) {
    for (const emojis of Object.values(subgroups)) {
      count += emojis.length;
    }
  }
  return count;
}

const emojiCount = countEmojiEntries(grouped);

function isDetailPage(filePath) {
  return /--[a-f0-9-]+\/index\.html$/.test(filePath);
}

test('manifest stats align with grouped data', () => {
  assert.equal(manifest.stats.emojis, emojiCount);
  assert.ok(manifest.stats.redirects > 0);
  assert.ok(manifest.stats.files > manifest.stats.emojis);
});

test('detail pages are unique and one-per-emoji', () => {
  const detailFiles = manifest.files.filter(isDetailPage);
  assert.equal(detailFiles.length, emojiCount);

  const unique = new Set(detailFiles);
  assert.equal(unique.size, detailFiles.length);
});

test('manifest is deterministic shape and build hash format is stable', () => {
  assert.match(manifest.buildHash, /^[a-f0-9]{16}$/);
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.managedRoots));
  assert.ok(Array.isArray(manifest.managedFiles));
  assert.ok(Array.isArray(manifest.files));
});

test('split sitemap index points at core and emoji sitemap files', () => {
  assert.match(sitemapIndex, /sitemap-core\.xml/);
  assert.match(sitemapIndex, /sitemap-emoji\.xml/);
});

test('legacy redirect sample exists and has redirect markup', () => {
  const redirectCandidate = manifest.files.find(
    (filePath) =>
      filePath.endsWith('/index.html') &&
      filePath.split('/').length >= 4 &&
      !isDetailPage(filePath)
  );

  assert.ok(redirectCandidate, 'expected at least one legacy redirect file');

  const html = fs.readFileSync(path.join(root, redirectCandidate), 'utf8');
  assert.match(html, /http-equiv="refresh"/i);
  assert.match(html, /window\.location\.replace\(/);
});

test('build runner exposes progress output for long build steps', () => {
  assert.match(buildRunner, /formatProgressBar/);
  assert.match(buildRunner, /Syncing generated files/);
});
