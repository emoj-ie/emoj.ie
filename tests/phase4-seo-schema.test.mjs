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
    ['alternatives/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['alternatives/emojipedia/index.html', ['WebPage', 'BreadcrumbList']],
    ['category/smileys-emotion/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['smileys-emotion/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['search/index.html', ['CollectionPage', 'BreadcrumbList']],
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
  assert.ok(!coreSitemap.includes('https://emoj.ie/category/component/'));
  assert.ok(!emojiSitemap.includes(variantUrl));
});

test('emoji sitemap uses canonical short emoji routes and core sitemap includes category/search/tag routes', () => {
  const coreSitemap = read('sitemap-core.xml');
  const emojiSitemap = read('sitemap-emoji.xml');
  const alternativesIndex = read('alternatives/index.html');
  const categoryIndex = read('category/index.html');
  const searchIndex = read('search/index.html');
  const tagIndex = read('tag/index.html');

  assert.match(emojiSitemap, /https:\/\/emoj\.ie\/emoji\/[a-z0-9-]+--[a-f0-9-]+\//i);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/alternatives\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/category\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/search\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/tag\//);
  assert.match(alternativesIndex, /<h1>Emoji Site Alternatives<\/h1>/);
  assert.match(categoryIndex, /<h1>Emoji Categories<\/h1>/);
  assert.match(searchIndex, /<h1>Emoji Search Topics<\/h1>/);
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

test('legacy group route is canonicalized to category route', () => {
  const legacyGroupPage = read('smileys-emotion/index.html');
  const categoryPage = read('category/smileys-emotion/index.html');

  assert.match(
    legacyGroupPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/category\/smileys-emotion\/"/
  );
  assert.match(legacyGroupPage, /<meta name="robots" content="noindex,follow"/);
  assert.match(
    categoryPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/category\/smileys-emotion\/"/
  );
  assert.ok(!categoryPage.includes('noindex,follow'));
});

test('curated search pages are generated with canonical metadata', () => {
  const searchIndex = read('search/index.html');
  const match = searchIndex.match(/href="\/(search\/[a-z0-9-]+\/)"/i);
  assert.ok(match, 'expected at least one curated search page');

  const searchRoute = match[1];
  const searchPage = read(`${searchRoute}index.html`);

  assertMetaSet(searchPage, `${searchRoute}index.html`);
  assert.match(searchPage, /<h1>[^<]+<\/h1>/);
  assert.match(searchPage, /<ul class="emoji-list">/);
  assert.ok(!searchPage.includes('noindex,follow'));
});

test('robots policy is present and points crawlers to sitemap index', () => {
  const robots = read('robots.txt');

  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/emoj\.ie\/sitemap\.xml$/m);
});

test('internal link graph connects home -> category -> subgroup -> emoji -> related', () => {
  const home = read('index.html');
  assert.match(home, /href="\/category\/"/);

  const categoryIndex = read('category/index.html');
  const categoryMatch = categoryIndex.match(/href="\/(category\/[a-z0-9-]+\/)"/i);
  assert.ok(categoryMatch, 'expected at least one category link');
  const categoryRoute = categoryMatch[1];

  const categoryPage = read(`${categoryRoute}index.html`);
  const subgroupMatch = categoryPage.match(/href="\/([a-z0-9-]+\/[a-z0-9-]+\/)"/i);
  assert.ok(subgroupMatch, 'expected subgroup links from category page');
  const subgroupRoute = subgroupMatch[1];

  const subgroupPage = read(`${subgroupRoute}index.html`);
  const emojiMatch = subgroupPage.match(/href="\/(emoji\/[a-z0-9-]+--[a-f0-9-]+\/)"/i);
  assert.ok(emojiMatch, 'expected emoji links from subgroup page');
  const emojiRoute = emojiMatch[1];

  const emojiPage = read(`${emojiRoute}index.html`);
  assert.match(emojiPage, /<section class="emoji-related">/);
  assert.match(emojiPage, /href="\/emoji\/[a-z0-9-]+--[a-f0-9-]+\//i);
});
