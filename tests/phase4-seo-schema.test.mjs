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
