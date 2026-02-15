import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { detailRouteFromEmoji } from '../home-utils.mjs';

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

test('service worker cache key is tied to build hash and uses fixed response type check', () => {
  const manifest = JSON.parse(read('build-manifest.json'));
  const sw = read('sw.js');

  assert.match(sw, new RegExp(`emojie-${manifest.buildHash}`));
  assert.match(sw, /response\.type !== 'basic'/);
});

test('local base emoji asset directory exists with substantial coverage', () => {
  const dir = path.join(root, 'assets/emoji/base');
  assert.ok(fs.existsSync(dir));

  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.svg'));
  assert.ok(files.length > 1500, `expected >1500 local emoji svg files, found ${files.length}`);
});

test('base emoji pages prefer local asset path with CDN fallback metadata', () => {
  const page = read('smileys-emotion/face-smiling/grinning-face--1f600/index.html');
  assert.match(page, /\/assets\/emoji\/base\/1F600\.svg/);
  assert.match(page, /data-cdn-src="https:\/\/cdn\.jsdelivr\.net\//);
});

test('variant emoji pages keep CDN source', () => {
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

  assert.ok(variant, 'expected variant emoji from grouped data');

  const route = detailRouteFromEmoji(variant);
  const html = read(`${route}index.html`);
  assert.match(html, /cdn\.jsdelivr\.net/);
});
