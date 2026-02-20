import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { detailRouteFromEmoji } from '../home-utils.mjs';

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function count(haystack, pattern) {
  const matches = haystack.match(pattern);
  return matches ? matches.length : 0;
}

function assertMetaSet(html, filePath) {
  assert.equal(count(html, /<title>/g), 1, `${filePath} must have exactly one title`);
  assert.equal(count(html, /<meta name="description"/g), 1, `${filePath} must have one meta description`);
  assert.equal(count(html, /<link rel="canonical"/g), 1, `${filePath} must have one canonical link`);
  assert.match(html, /<meta name="twitter:card"/);
}

test('sample templates have complete meta tags and schema payloads', () => {
  const samples = [
    ['index.html', ['Organization', 'WebSite']],
    ['smileys-emotion/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['smileys-emotion/face-smiling/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['smileys-emotion/face-smiling/grinning-face--1f600/index.html', ['WebPage', 'DefinedTerm', 'BreadcrumbList']],
  ];

  for (const [filePath, schemaTypes] of samples) {
    const html = read(filePath);
    assertMetaSet(html, filePath);
    assert.match(html, /<script type="application\/ld\+json">/);

    for (const type of schemaTypes) {
      assert.match(html, new RegExp(`"@type":"${type}"`), `${filePath} missing ${type} schema`);
    }
  }
});

test('sitemap excludes noindex component pages and variant emoji detail pages', () => {
  const grouped = JSON.parse(read('grouped-openmoji.json'));

  let variant = null;
  outer: for (const [group, subgroups] of Object.entries(grouped)) {
    for (const [subgroup, emojis] of Object.entries(subgroups)) {
      for (const emoji of emojis) {
        if (emoji.skintone_base_hexcode && emoji.skintone_base_hexcode.toLowerCase() !== emoji.hexcode.toLowerCase()) {
          variant = { ...emoji, group, subgroup };
          break outer;
        }
      }
    }
  }

  assert.ok(variant, 'expected to find a skin-tone variant');

  const variantRoute = detailRouteFromEmoji(variant);
  const variantUrl = `https://emoj.ie/${variantRoute}`;

  const coreSitemap = read('sitemap-core.xml');
  const emojiSitemap = read('sitemap-emoji.xml');

  assert.ok(!coreSitemap.includes('https://emoj.ie/component/'));
  assert.ok(!emojiSitemap.includes(variantUrl));
});

test('emoji sitemap uses canonical short emoji routes and core sitemap includes tag routes', () => {
  const coreSitemap = read('sitemap-core.xml');
  const emojiSitemap = read('sitemap-emoji.xml');
  const tagIndex = read('tag/index.html');

  assert.match(emojiSitemap, /https:\/\/emoj\.ie\/emoji\/[a-z0-9-]+--[a-f0-9-]+\//i);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/tag\//);
  assert.match(tagIndex, /<h1>Emoji Tags<\/h1>/);
});

test('legacy detail route points canonical to short emoji route', () => {
  const legacyRoutePage = read('smileys-emotion/face-smiling/grinning-face--1f600/index.html');
  const canonicalRoutePage = read('emoji/grinning-face--1f600/index.html');

  assert.match(
    legacyRoutePage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/emoji\/grinning-face--1f600\/"/
  );
  assert.match(legacyRoutePage, /<meta name="robots" content="noindex,follow"/);
  assert.match(
    canonicalRoutePage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/emoji\/grinning-face--1f600\/"/
  );
  assert.ok(!canonicalRoutePage.includes('noindex,follow'));
});
