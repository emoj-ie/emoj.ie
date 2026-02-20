import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  detailRouteFromEmoji,
  formatCopyValue,
  parseUiState,
  slugify,
  toSearchParams,
} from '../home-utils.mjs';

const root = process.cwd();

const sample = {
  emoji: '👋',
  annotation: 'waving hand',
  hexcode: '1F44B',
  hexLower: '1f44b',
  group: 'people-body',
  subgroup: 'hand-fingers-open',
};

test('url state parsing and serialization handles q/g/sg/copy', () => {
  const parsed = parseUiState('?q=smile&g=smileys-emotion&sg=face-smiling&copy=html', 'emoji');
  assert.deepEqual(parsed, {
    q: 'smile',
    g: 'smileys-emotion',
    sg: 'face-smiling',
    copy: 'html',
  });

  const query = toSearchParams(parsed);
  assert.equal(query, 'q=smile&g=smileys-emotion&sg=face-smiling&copy=html');
});

test('slugify and detail route produce slug--hex format', () => {
  assert.equal(slugify('São Tomé & Príncipe'), 'sao-tome-principe');
  const route = detailRouteFromEmoji(sample);
  assert.equal(route, 'people-body/hand-fingers-open/waving-hand--1f44b/');
});

test('copy mode formatter returns expected values', () => {
  assert.equal(formatCopyValue('emoji', sample), '👋');
  assert.equal(formatCopyValue('unicode', sample), '1f44b');
  assert.equal(formatCopyValue('shortcode', sample), ':waving-hand:');
  assert.equal(formatCopyValue('html', sample), '&#x1F44B;');
});

test('generated homepage contains phase 2 controls and module script', () => {
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(indexHtml, /id="group-filter"/);
  assert.match(indexHtml, /id="subgroup-filter"/);
  assert.match(indexHtml, /id="copy-mode"/);
  assert.match(indexHtml, /id="home-results"/);
  assert.match(indexHtml, /src="home-app\.mjs" type="module" defer/);
  assert.match(indexHtml, /src="emoji-diagnostics\.js" defer/);
  assert.match(indexHtml, /href="\/search\/"/);
  assert.match(indexHtml, /href="\/tag\/"/);
  assert.match(indexHtml, /href="\/alternatives\/"/);
  assert.match(indexHtml, /href="\/tofu\/"/);
  assert.match(indexHtml, /data-tofu-score-root/);
  assert.match(indexHtml, /<option value="5">Dark<\/option>/);
  assert.match(indexHtml, /<option value="0">Yellow<\/option>/);
  assert.match(indexHtml, /<h2>Options<\/h2>/);
  assert.ok(!indexHtml.includes('Advanced Options'));
  assert.ok(!indexHtml.includes('Quick Options'));
  assert.ok(!indexHtml.includes('<option value="0">None</option>'));
  assert.ok(!indexHtml.includes('onclick='));
});

test('generated about page uses shared shell and no inline handlers', () => {
  const aboutHtml = fs.readFileSync(path.join(root, 'about/index.html'), 'utf8');
  assert.match(aboutHtml, /class="header-search"/);
  assert.match(aboutHtml, /id="header-menu-toggle"/);
  assert.match(aboutHtml, /id="global-advanced-menu"[^>]*\shidden\b/);
  assert.match(aboutHtml, /id="about-shuffle"[^>]*>🔀<\/button>/);
  assert.match(aboutHtml, /id="about-emoji-wall"/);
  assert.match(aboutHtml, /<h2>Options<\/h2>/);
  assert.match(aboutHtml, /class="footer-links"/);
  assert.match(aboutHtml, /href="\/tag\/"/);
  assert.match(aboutHtml, /data-credits-run-marker/);
  assert.match(aboutHtml, /data-credits-run="1"/);
  assert.match(aboutHtml, /data-credits-run="2"/);
  assert.match(aboutHtml, /data-credits-run="3"/);
  assert.ok(!aboutHtml.includes('Quick Options'));
  assert.ok(!aboutHtml.includes('Credits Galaxy'));
  assert.ok(!aboutHtml.includes('Tap any tile to open. Use ⧉ to copy.'));
  assert.ok(!aboutHtml.includes('onclick='));
});
