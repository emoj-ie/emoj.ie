import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const style = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

test('style rules avoid transition-all and outline-none anti-patterns', () => {
  assert.ok(!/transition:\s*all\b/.test(style));
  assert.ok(!/outline:\s*none\b/.test(style));
  assert.match(style, /touch-action:\s*manipulation/);
  assert.match(style, /-webkit-tap-highlight-color/);
  assert.match(style, /:focus-visible/);
});

test('key templates include skip link and heading hierarchy anchor', () => {
  const home = read('index.html');
  const group = read('smileys-emotion/index.html');
  const detail = read('smileys-emotion/face-smiling/grinning-face--1f600/index.html');

  assert.match(home, /class="skip-link"/);
  assert.match(group, /class="skip-link"/);
  assert.match(detail, /class="skip-link"/);

  assert.match(home, /<h1\b/);
  assert.match(group, /<h1\b/);
  assert.match(detail, /<h1\b/);
});

test('sampled generated HTML avoids inline onclick and includes image dimensions', () => {
  const htmlFiles = manifest.files.filter((filePath) => filePath.endsWith('.html')).slice(0, 400);
  assert.ok(htmlFiles.length > 0);

  for (const filePath of htmlFiles) {
    const html = read(filePath);
    assert.ok(!html.includes('onclick='), `inline onclick found in ${filePath}`);

    const images = html.match(/<img\b[^>]*>/g) || [];
    for (const imageTag of images) {
      assert.match(imageTag, /\bwidth="\d+"/);
      assert.match(imageTag, /\bheight="\d+"/);
    }
  }
});
