import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));

const htmlFiles = manifest.files.filter((filePath) => filePath.endsWith('.html'));
const missing = [];

function existsTarget(targetPath) {
  return fs.existsSync(path.join(root, targetPath));
}

function resolvePath(currentFile, reference) {
  const withoutHash = reference.split('#')[0].split('?')[0];
  if (!withoutHash) return null;

  if (withoutHash.startsWith('http://') || withoutHash.startsWith('https://') || withoutHash.startsWith('mailto:') || withoutHash.startsWith('tel:') || withoutHash.startsWith('data:')) {
    return null;
  }

  if (withoutHash.startsWith('/')) {
    const clean = withoutHash.replace(/^\//, '');
    if (!clean) return 'index.html';
    if (clean.endsWith('/')) return `${clean}index.html`;
    if (path.extname(clean)) return clean;
    if (existsTarget(clean)) return clean;
    return `${clean}/index.html`;
  }

  const baseDir = path.dirname(currentFile);
  const joined = path.normalize(path.join(baseDir, withoutHash)).replace(/\\/g, '/');
  if (joined.endsWith('/')) return `${joined}index.html`;
  if (path.extname(joined)) return joined;
  if (existsTarget(joined)) return joined;
  return `${joined}/index.html`;
}

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(path.join(root, filePath), 'utf8');
  const refs = [
    ...html.matchAll(/\bhref="([^"]+)"/g),
    ...html.matchAll(/\bsrc="([^"]+)"/g),
  ];

  for (const match of refs) {
    const reference = match[1];
    const resolved = resolvePath(filePath, reference);
    if (!resolved) continue;

    if (!existsTarget(resolved)) {
      missing.push({ filePath, reference, resolved });
    }
  }
}

if (missing.length > 0) {
  const preview = missing.slice(0, 25).map((item) => `${item.filePath} -> ${item.reference} (${item.resolved})`).join('\n');
  console.error(`Broken links/assets found (${missing.length}):\n${preview}`);
  process.exit(1);
}

console.log(`Link check passed for ${htmlFiles.length} HTML files.`);
