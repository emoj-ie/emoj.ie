/**
 * Post-build sitemap generation. Scans the prerendered output in build/
 * and emits:
 *   sitemap-core.xml  - home, category, and subgroup index routes
 *   sitemap-emoji.xml - emoji detail routes
 *   sitemap.xml       - sitemap index referencing both
 *
 * Pages whose HTML carries <meta name="robots" content="noindex..."> are
 * excluded (component-group and variant pages). Scanning the real output
 * guarantees the sitemap and the deployed pages can never drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://emoj.ie';
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(siteDir, 'build');

if (!fs.existsSync(buildDir)) {
  console.error(`Build directory not found: ${buildDir} — run vite build first.`);
  process.exit(1);
}

const NOINDEX_RE = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i;

/** Recursively collect route paths for every index.html under dir. */
function collectRoutes(dir, prefix = '/') {
  const routes = [];
  const indexFile = path.join(dir, 'index.html');
  if (fs.existsSync(indexFile)) {
    const html = fs.readFileSync(indexFile, 'utf8');
    if (!NOINDEX_RE.test(html)) {
      routes.push(prefix);
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_app' || entry.name === 'assets') continue;
    routes.push(...collectRoutes(path.join(dir, entry.name), `${prefix}${entry.name}/`));
  }
  return routes;
}

const allRoutes = collectRoutes(buildDir).sort();
const emojiRoutes = allRoutes.filter((r) => r.startsWith('/emoji/'));
const coreRoutes = allRoutes.filter((r) => !r.startsWith('/emoji/'));

function urlset(routes) {
  const urls = routes.map((r) => `  <url><loc>${SITE_URL}${r}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap-core.xml</loc></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-emoji.xml</loc></sitemap>
</sitemapindex>
`;

fs.writeFileSync(path.join(buildDir, 'sitemap-core.xml'), urlset(coreRoutes));
fs.writeFileSync(path.join(buildDir, 'sitemap-emoji.xml'), urlset(emojiRoutes));
fs.writeFileSync(path.join(buildDir, 'sitemap.xml'), sitemapIndex);

console.log(
  `sitemaps: ${coreRoutes.length} core routes, ${emojiRoutes.length} emoji routes (noindex pages excluded)`
);

if (emojiRoutes.length < 1500) {
  console.error('Sanity check failed: expected at least 1500 indexable emoji routes.');
  process.exit(1);
}
