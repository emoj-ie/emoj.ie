/**
 * Internal link and asset check over the prerendered build/ output.
 *
 * Scans every index.html for same-origin href/src references and verifies
 * each resolves to a real file in the build directory (directories must
 * contain index.html). External URLs (CDN images, fonts, analytics) are
 * skipped — CI must not depend on third-party availability.
 *
 * Also cross-checks the sitemaps: every sitemap URL must exist in the
 * build output.
 *
 * Exits non-zero listing every broken reference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(siteDir, 'build');

if (!fs.existsSync(buildDir)) {
  console.error(`Build directory not found: ${buildDir} — run npm run build first.`);
  process.exit(1);
}

const ATTR_RE = /(?:href|src)=["']([^"']+)["']/g;

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* htmlFiles(full);
    } else if (entry.name.endsWith('.html')) {
      yield full;
    }
  }
}

function targetExists(urlPath) {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (clean === '' || clean === '/') return fs.existsSync(path.join(buildDir, 'index.html'));
  const full = path.join(buildDir, clean);
  if (fs.existsSync(full)) {
    return fs.statSync(full).isDirectory() ? fs.existsSync(path.join(full, 'index.html')) : true;
  }
  // Directory reference without trailing slash
  return fs.existsSync(path.join(buildDir, clean, 'index.html'));
}

const broken = [];
let checked = 0;

for (const file of htmlFiles(buildDir)) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(buildDir, file);
  for (const match of html.matchAll(ATTR_RE)) {
    const url = match[1];
    if (!url.startsWith('/') || url.startsWith('//')) continue; // external, fragment, data:
    checked += 1;
    if (!targetExists(url)) {
      broken.push(`${rel}: ${url}`);
    }
  }
}

// Sitemap cross-check: every listed URL must exist in the build output.
for (const sitemap of ['sitemap-core.xml', 'sitemap-emoji.xml']) {
  const file = path.join(buildDir, sitemap);
  if (!fs.existsSync(file)) {
    broken.push(`missing sitemap: ${sitemap}`);
    continue;
  }
  const xml = fs.readFileSync(file, 'utf8');
  for (const match of xml.matchAll(/<loc>https:\/\/emoj\.ie([^<]*)<\/loc>/g)) {
    checked += 1;
    if (!targetExists(match[1])) {
      broken.push(`${sitemap}: ${match[1]}`);
    }
  }
}

if (broken.length > 0) {
  console.error(`Broken internal references (${broken.length}):`);
  for (const line of broken.slice(0, 50)) console.error(`  ${line}`);
  if (broken.length > 50) console.error(`  ...and ${broken.length - 50} more`);
  process.exit(1);
}

console.log(`link check: ${checked} internal references OK, 0 broken`);
