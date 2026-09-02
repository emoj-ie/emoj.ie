/**
 * Copies the OpenMoji SVG assets from the repo-root source of truth
 * (assets/emoji/base) into site/static/assets/emoji/base so the built
 * site self-hosts them. The destination is gitignored; this runs before
 * every dev/build (npm run assets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteDir, '..');
const source = path.join(repoRoot, 'assets', 'emoji', 'base');
const dest = path.join(siteDir, 'static', 'assets', 'emoji', 'base');

if (!fs.existsSync(source)) {
  console.error(`Emoji asset source not found: ${source}`);
  process.exit(1);
}

const sourceFiles = fs.readdirSync(source).filter((f) => f.endsWith('.svg'));

fs.mkdirSync(dest, { recursive: true });
const existing = new Set(fs.readdirSync(dest));

let copied = 0;
for (const file of sourceFiles) {
  const from = path.join(source, file);
  const to = path.join(dest, file);
  if (!existing.has(file) || fs.statSync(from).mtimeMs > fs.statSync(to).mtimeMs) {
    fs.copyFileSync(from, to);
    copied += 1;
  }
}

console.log(`emoji assets: ${sourceFiles.length} in source, ${copied} copied to static/`);
