import fs from 'node:fs/promises';
import path from 'node:path';

import {
  escapeHtml,
  formatHexForAsset,
  humanizeSlug,
  routeToFile,
} from './slug.mjs';

function absoluteUrl(baseUrl, route = '') {
  const base = String(baseUrl).replace(/\/+$/, '');
  const cleanRoute = String(route).replace(/^\/+/, '');
  if (!cleanRoute) {
    return `${base}/`;
  }
  return `${base}/${cleanRoute}`;
}

function toAssetUrl(baseUrl, assetPath) {
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }
  return absoluteUrl(baseUrl, String(assetPath).replace(/^\/+/, ''));
}

function relativePrefix(route) {
  const depth = String(route)
    .split('/')
    .filter(Boolean).length;
  return '../'.repeat(depth);
}

function renderBreadcrumbs(items) {
  const html = items
    .map((item, index) => {
      const last = index === items.length - 1;
      if (last || !item.href) {
        return `<span>${escapeHtml(item.label)}</span>`;
      }
      return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
    })
    .join(' / ');

  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${html}</nav>`;
}

function renderLayout({
  route,
  title,
  description,
  canonicalUrl,
  robots,
  body,
  breadcrumbs,
  config,
}) {
  const prefix = relativePrefix(route);
  const pageTitle = `${title} | ${config.site.title}`;
  const socialImage = toAssetUrl(config.site.baseUrl, config.site.socialImage);
  const robotsTag = robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${robotsTag}
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(socialImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(socialImage)}" />
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link rel="icon" href="${prefix}favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="${prefix}style.css" />
  </head>
  <body>
    <a href="#main-content" class="skip-link">Skip To Main Content</a>
    <header class="header">
      <div class="header-container">
        <a href="${prefix}" class="logo">
          <img src="${prefix}logo.svg" alt="emoj.ie logo" width="90" height="40" />
        </a>
      </div>
    </header>
    ${breadcrumbs}
    <main id="main-content">
      ${body}
    </main>
    <footer>
      <p>© 2026 emoj.ie | <a href="${prefix}about">About</a></p>
    </footer>
    <div id="live-region" aria-live="polite" aria-atomic="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;"></div>
    <script src="${prefix}generated-pages.js" defer></script>
  </body>
</html>`;
}

function renderEmojiCard(entry, assetTemplate) {
  const imageHex = formatHexForAsset(entry.hexLower);
  const src = assetTemplate.replace('{HEX}', imageHex);
  const label = humanizeSlug(entry.slug);
  const detailHref = `/${entry.detailRoute}`;

  return `<li class="emoji">
    <button
      type="button"
      class="emoji-copy"
      data-copy-value="${escapeHtml(entry.emoji)}"
      data-copy-label="${escapeHtml(label)}"
      aria-label="Copy ${escapeHtml(label)} emoji"
      title="Copy ${escapeHtml(label)}"
    >
      <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" width="48" height="48" loading="lazy" />
    </button>
    <hr />
    <a href="${escapeHtml(detailHref)}"><small>${escapeHtml(label)}</small></a>
  </li>`;
}

function renderGroupPage(group, config) {
  const subgroupSections = group.subgroups
    .map((subgroup) => {
      const emojiList = subgroup.emojis
        .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
        .join('');

      return `<section class="subgroup">
        <a href="/${subgroup.route}"><h2>${escapeHtml(subgroup.title)}</h2></a>
        <p>${escapeHtml(subgroup.description)}</p>
        <ul class="emoji-list">${emojiList}</ul>
      </section>`;
    })
    .join('');

  const body = `<section class="group">
    <h1>${escapeHtml(group.title)}</h1>
    <p>${escapeHtml(group.description)}</p>
    <hr class="group-divider" />
    ${subgroupSections}
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, group.route);
  const description = `Browse ${group.title} emojis and copy them instantly.`;
  const robots = group.noindex ? 'noindex,follow' : '';

  return renderLayout({
    route: group.route,
    title: `${group.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs([
      { label: 'Home', href: '/' },
      { label: group.title },
    ]),
    config,
  });
}

function renderSubgroupPage(group, subgroup, config) {
  const emojiList = subgroup.emojis
    .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
    .join('');

  const body = `<section class="subgroup">
    <h1>${escapeHtml(subgroup.title)}</h1>
    <p>${escapeHtml(subgroup.description)}</p>
    <ul class="emoji-list">${emojiList}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, subgroup.route);
  const description = `Explore ${subgroup.title} emojis in ${group.title}.`;
  const robots = subgroup.noindex ? 'noindex,follow' : '';

  return renderLayout({
    route: subgroup.route,
    title: `${subgroup.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs([
      { label: 'Home', href: '/' },
      { label: group.title, href: `/${group.route}` },
      { label: subgroup.title },
    ]),
    config,
  });
}

function renderVariantSection(entry, variantEntries) {
  if (!variantEntries || variantEntries.length <= 1) {
    return '';
  }

  const items = variantEntries
    .map((variant) => {
      const current = variant.detailRoute === entry.detailRoute;
      if (current) {
        return `<li><strong>${escapeHtml(humanizeSlug(variant.slug))} (${escapeHtml(variant.hexLower)})</strong></li>`;
      }
      return `<li><a href="/${variant.detailRoute}">${escapeHtml(humanizeSlug(variant.slug))} (${escapeHtml(
        variant.hexLower
      )})</a></li>`;
    })
    .join('');

  return `<section>
    <h2>Variants</h2>
    <ul>${items}</ul>
  </section>`;
}

function renderEmojiPage(group, subgroup, entry, variantEntries, config) {
  const imageHex = formatHexForAsset(entry.hexLower);
  const imageSrc = config.assets.emojiCdnTemplate.replace('{HEX}', imageHex);
  const canonicalUrl = absoluteUrl(config.site.baseUrl, entry.canonicalRoute);
  const detailUrl = absoluteUrl(config.site.baseUrl, entry.detailRoute);
  const label = humanizeSlug(entry.slug);

  const body = `<article class="emoji-detail">
    <h1>${escapeHtml(label)}</h1>
    <p>${escapeHtml(entry.emoji)}</p>
    <p>
      <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(label)}" width="96" height="96" loading="eager" />
    </p>
    <p>
      <button type="button" class="copy-btn" data-copy-value="${escapeHtml(entry.emoji)}" data-copy-label="${escapeHtml(
        label
      )}">Copy Emoji</button>
      <button type="button" class="copy-btn secondary" data-copy-value="${escapeHtml(
        entry.hexLower
      )}" data-copy-label="${escapeHtml(label)} hex code">Copy Hex</button>
    </p>
    <dl>
      <dt>Unicode</dt><dd><code>${escapeHtml(entry.hexLower)}</code></dd>
      <dt>Group</dt><dd>${escapeHtml(group.title)}</dd>
      <dt>Subgroup</dt><dd>${escapeHtml(subgroup.title)}</dd>
      <dt>Canonical</dt><dd><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></dd>
      <dt>Permalink</dt><dd><a href="${escapeHtml(detailUrl)}">${escapeHtml(detailUrl)}</a></dd>
    </dl>
    ${renderVariantSection(entry, variantEntries)}
  </article>`;

  const robots = entry.noindex ? 'noindex,follow' : '';
  const description = `${label} emoji. Copy ${label} instantly.`;

  return renderLayout({
    route: entry.detailRoute,
    title: `${label} Emoji`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs([
      { label: 'Home', href: '/' },
      { label: group.title, href: `/${group.route}` },
      { label: subgroup.title, href: `/${subgroup.route}` },
      { label },
    ]),
    config,
  });
}

function renderRedirectPage(route, targetRoute, config) {
  const targetUrl = absoluteUrl(config.site.baseUrl, targetRoute);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecting…</title>
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${escapeHtml(targetUrl)}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}" />
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</a>…</p>
  </body>
</html>`;
}

async function writeRouteHtml(tempRoot, route, html, generatedFiles) {
  const file = routeToFile(route);
  const outputPath = path.join(tempRoot, file);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, 'utf8');
  generatedFiles.add(file);
}

export async function renderSite({ model, legacyRedirects, config, tempRoot }) {
  const generatedFiles = new Set();
  const coreRoutes = new Set();
  const emojiRoutes = new Set();

  if (config.indexing?.includeHomePage) {
    coreRoutes.add('');
  }
  if (config.indexing?.includeAboutPage) {
    coreRoutes.add('about/');
  }

  const variantsByBase = new Map();
  for (const entry of model.emojiEntries) {
    if (!variantsByBase.has(entry.baseHex)) {
      variantsByBase.set(entry.baseHex, []);
    }
    variantsByBase.get(entry.baseHex).push(entry);
  }

  for (const group of model.groups) {
    await writeRouteHtml(tempRoot, group.route, renderGroupPage(group, config), generatedFiles);

    if (!group.noindex) {
      coreRoutes.add(group.route);
    }

    for (const subgroup of group.subgroups) {
      await writeRouteHtml(
        tempRoot,
        subgroup.route,
        renderSubgroupPage(group, subgroup, config),
        generatedFiles
      );

      if (!subgroup.noindex) {
        coreRoutes.add(subgroup.route);
      }

      for (const entry of subgroup.emojis) {
        const variantEntries = variantsByBase.get(entry.baseHex) || [entry];
        await writeRouteHtml(
          tempRoot,
          entry.detailRoute,
          renderEmojiPage(group, subgroup, entry, variantEntries, config),
          generatedFiles
        );

        if (entry.indexable) {
          emojiRoutes.add(entry.detailRoute);
        }
      }
    }
  }

  if (config.redirects?.generateLegacySlugRedirects) {
    for (const redirect of legacyRedirects) {
      if (redirect.route === redirect.targetRoute) {
        continue;
      }
      await writeRouteHtml(
        tempRoot,
        redirect.route,
        renderRedirectPage(redirect.route, redirect.targetRoute, config),
        generatedFiles
      );
    }
  }

  return {
    generatedFiles,
    coreRoutes,
    emojiRoutes,
  };
}
