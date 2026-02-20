function escapeXml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(baseUrl, route = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  const cleanRoute = String(route).replace(/^\/+/, '');
  if (!cleanRoute) {
    return `${base}/`;
  }
  return `${base}/${cleanRoute}`;
}

export function buildSitemapXml(routes, { baseUrl, lastmod, priority = '0.8' }) {
  const sortedRoutes = [...routes].sort((a, b) => a.localeCompare(b));

  const items = sortedRoutes
    .map((route) => {
      const loc = absoluteUrl(baseUrl, route);
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n    <priority>${escapeXml(priority)}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export function buildSitemapIndexXml(files, { baseUrl, lastmod }) {
  const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));

  const entries = sortedFiles
    .map((file) => {
      const cleanFile = String(file).replace(/^\/+/, '');
      const loc = absoluteUrl(baseUrl, cleanFile);
      return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n  </sitemap>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export function buildRobotsTxt({ baseUrl, sitemapIndexFile = 'sitemap.xml' }) {
  const sitemapUrl = absoluteUrl(baseUrl, String(sitemapIndexFile).replace(/^\/+/, ''));
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}
