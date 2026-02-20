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
    ['tofu/index.html', ['WebPage', 'BreadcrumbList']],
    ['alternatives/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['alternatives/emojipedia/index.html', ['WebPage', 'BreadcrumbList']],
    ['smileys-emotion/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['category/smileys-emotion/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['search/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['smileys-emotion/face-smiling/index.html', ['CollectionPage', 'BreadcrumbList']],
    ['category/smileys-emotion/face-smiling/index.html', ['CollectionPage', 'BreadcrumbList']],
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

test('emoji sitemap uses canonical short emoji routes and core sitemap includes primary group/search/tag routes', () => {
  const coreSitemap = read('sitemap-core.xml');
  const emojiSitemap = read('sitemap-emoji.xml');
  const alternativesIndex = read('alternatives/index.html');
  const categoryAliasIndex = read('category/index.html');
  const searchIndex = read('search/index.html');
  const tagIndex = read('tag/index.html');
  const tofuIndex = read('tofu/index.html');

  assert.match(emojiSitemap, /https:\/\/emoj\.ie\/emoji\/[a-z0-9-]+--[a-f0-9-]+\//i);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/alternatives\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/smileys-emotion\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/search\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/tag\//);
  assert.match(coreSitemap, /https:\/\/emoj\.ie\/tofu\//);
  assert.match(alternativesIndex, /<h1\b[^>]*>Emoji Site Alternatives<\/h1>/);
  assert.match(categoryAliasIndex, /<meta http-equiv="refresh" content="0; url=https:\/\/emoj\.ie\/"/);
  assert.match(searchIndex, /<h1\b[^>]*>Emoji Search Topics<\/h1>/);
  assert.match(tagIndex, /<h1\b[^>]*>Emoji Tags<\/h1>/);
  assert.match(searchIndex, /class="panel-grid panel-grid-balanced"/);
  assert.match(tagIndex, /class="panel-grid panel-grid-balanced"/);
  assert.ok(!searchIndex.includes('group-link-list'));
  assert.ok(!tagIndex.includes('group-link-list'));
  assert.match(tofuIndex, /data-tofu-score-root/);
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

test('category-prefixed group route is canonicalized to primary group route', () => {
  const legacyGroupPage = read('category/smileys-emotion/index.html');
  const canonicalGroupPage = read('smileys-emotion/index.html');

  assert.match(
    legacyGroupPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/smileys-emotion\/"/
  );
  assert.match(legacyGroupPage, /<meta name="robots" content="noindex,follow"/);
  assert.match(
    canonicalGroupPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/smileys-emotion\/"/
  );
  assert.ok(!canonicalGroupPage.includes('noindex,follow'));
});

test('category-prefixed subgroup route is canonicalized to primary subgroup route', () => {
  const legacySubgroupPage = read('category/smileys-emotion/face-smiling/index.html');
  const canonicalSubgroupPage = read('smileys-emotion/face-smiling/index.html');

  assert.match(
    legacySubgroupPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/smileys-emotion\/face-smiling\/"/
  );
  assert.match(legacySubgroupPage, /<meta name="robots" content="noindex,follow"/);
  assert.match(
    canonicalSubgroupPage,
    /<link rel="canonical" href="https:\/\/emoj\.ie\/smileys-emotion\/face-smiling\/"/
  );
  assert.ok(!canonicalSubgroupPage.includes('noindex,follow'));
});

test('curated search pages are generated with canonical metadata', () => {
  const searchIndex = read('search/index.html');
  const match = searchIndex.match(/href="\/(search\/[a-z0-9-]+\/)"/i);
  assert.ok(match, 'expected at least one curated search page');

  const searchRoute = match[1];
  const searchPage = read(`${searchRoute}index.html`);

  assertMetaSet(searchPage, `${searchRoute}index.html`);
  assert.match(searchPage, /<h1\b[^>]*>[^<]+<\/h1>/);
  assert.match(searchPage, /<ul class="emoji-list emoji-list-panel">/);
  assert.ok(!searchPage.includes('collection-kicker'));
  assert.ok(!searchPage.includes('noindex,follow'));
});

test('robots policy is present and points crawlers to sitemap index', () => {
  const robots = read('robots.txt');

  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/emoj\.ie\/sitemap\.xml$/m);
});

test('internal link graph connects group -> subgroup -> emoji -> related', () => {
  const home = read('index.html');
  assert.match(home, /id="panel-grid"/);
  assert.match(home, /home-app\.mjs/);

  const categoryRoute = 'smileys-emotion/';

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
