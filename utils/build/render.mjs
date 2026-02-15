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

function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}

function breadcrumbSchema(baseUrl, crumbs, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: crumb.href
        ? absoluteUrl(baseUrl, String(crumb.href).replace(/^\//, ''))
        : canonicalUrl,
    })),
  };
}

function renderHeader({ prefix, showSearch }) {
  const search = showSearch
    ? `<form class="header-search" action="${prefix}" method="get" role="search">
        <label for="search" class="visually-hidden">Search Emojis</label>
        <input id="search" name="q" type="search" autocomplete="off" placeholder="Search emojis…" />
        <button type="submit">Search</button>
      </form>`
    : '';

  return `<header class="header">
      <div class="header-container">
        <a href="${prefix}" class="logo">
          <img src="${prefix}logo.svg" alt="emoj.ie logo" width="90" height="40" />
        </a>
        ${search}
      </div>
    </header>`;
}

function renderScripts(prefix, scripts = []) {
  return scripts
    .map((script) => {
      const attrs = [];
      attrs.push(`src="${escapeHtml(prefix + script.src)}"`);
      if (script.type) attrs.push(`type="${escapeHtml(script.type)}"`);
      if (script.defer !== false) attrs.push('defer');
      return `<script ${attrs.join(' ')}></script>`;
    })
    .join('\n    ');
}

function emojiAssetSource(entry) {
  if (entry.useLocalAsset && entry.localAssetPath) {
    return entry.localAssetPath;
  }
  return entry.cdnAssetPath;
}

function renderAnalyticsScript(config) {
  if (!config.analytics?.enabled || config.analytics?.provider !== 'plausible') {
    return '';
  }

  const domain = escapeHtml(config.analytics.domain || config.site.title);
  const src = escapeHtml(config.analytics.scriptSrc || 'https://plausible.io/js/script.js');
  return `<script defer data-domain="${domain}" src="${src}"></script>`;
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
  showHeaderSearch = true,
  scripts = [],
  jsonLd = [],
}) {
  const prefix = relativePrefix(route);
  const pageTitle = `${title} | ${config.site.title}`;
  const socialImage = toAssetUrl(config.site.baseUrl, config.site.socialImage);
  const robotsTag = robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '';

  const defaultScripts = [{ src: 'generated-pages.js', defer: true }];
  const schemaScripts = jsonLd.map((item) => jsonLdScript(item)).join('\n    ');

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
    ${renderAnalyticsScript(config)}
    ${schemaScripts}
  </head>
  <body>
    <a href="#main-content" class="skip-link">Skip To Main Content</a>
    ${renderHeader({ prefix, showSearch: showHeaderSearch })}
    ${breadcrumbs || ''}
    <main id="main-content">
      ${body}
    </main>
    <footer>
      <p>© 2026 emoj.ie | <a href="${prefix}about">About</a></p>
    </footer>
    <div id="live-region" aria-live="polite" aria-atomic="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;"></div>
    ${renderScripts(prefix, [...defaultScripts, ...scripts])}
  </body>
</html>`;
}

function renderEmojiCard(entry, assetTemplate) {
  const imageHex = formatHexForAsset(entry.hexLower);
  const src = emojiAssetSource(entry);
  const cdnSrc = entry.cdnAssetPath || assetTemplate.replace('{HEX}', imageHex);
  const label = humanizeSlug(entry.slug);
  const detailHref = `/${entry.detailRoute}`;

  return `<li class="emoji">
    <button
      type="button"
      class="emoji-copy"
      data-copy-value="${escapeHtml(entry.emoji)}"
      data-copy-label="${escapeHtml(label)}"
      data-copy-format="emoji"
      data-emoji="${escapeHtml(entry.emoji)}"
      data-hex="${escapeHtml(entry.hexLower)}"
      data-group="${escapeHtml(entry.group)}"
      data-subgroup="${escapeHtml(entry.subgroup)}"
      data-route="${escapeHtml(entry.detailRoute)}"
      aria-label="Copy ${escapeHtml(label)} emoji"
      title="Copy ${escapeHtml(label)}"
    >
      <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" width="48" height="48" loading="lazy" data-cdn-src="${escapeHtml(cdnSrc)}" data-hex="${escapeHtml(entry.hexLower)}" />
    </button>
    <hr />
    <a href="${escapeHtml(detailHref)}"><small>${escapeHtml(label)}</small></a>
  </li>`;
}

function renderHomePage(model, config) {
  const groupOptions = model.groups
    .map((group) => `<option value="${escapeHtml(group.key)}">${escapeHtml(group.title)}</option>`)
    .join('');

  const groupLinks = model.groups
    .map(
      (group) => `<li><a href="/${group.route}">${escapeHtml(group.title)}</a></li>`
    )
    .join('');

  const body = `<section class="home-hero">
    <h1>Emoji Search, Copy, And Explore</h1>
    <p>Fast emoji discovery with deep-linkable filters and copy formats.</p>
  </section>
  <section class="home-controls" aria-label="Emoji Search Controls">
    <div class="control-group control-search">
      <label for="search">Search</label>
      <input id="search" type="search" autocomplete="off" placeholder="Search emojis…" />
    </div>
    <div class="control-group">
      <label for="group-filter">Category</label>
      <select id="group-filter" aria-label="Filter by category">
        <option value="">All Categories</option>
        ${groupOptions}
      </select>
    </div>
    <div class="control-group">
      <label for="subgroup-filter">Subcategory</label>
      <select id="subgroup-filter" aria-label="Filter by subcategory" disabled>
        <option value="">All Subcategories</option>
      </select>
    </div>
    <div class="control-group">
      <label for="copy-mode">Copy Format</label>
      <select id="copy-mode" aria-label="Select copy format">
        <option value="emoji">Emoji</option>
        <option value="unicode">Unicode Hex</option>
        <option value="html">HTML Entity</option>
        <option value="shortcode">Shortcode</option>
      </select>
    </div>
    <div class="control-group control-actions">
      <button type="button" id="clear-filters" class="copy-btn secondary">Clear</button>
    </div>
  </section>
  <p id="results-count" class="results-count">Loading…</p>
  <ul id="home-results" class="emoji-list" aria-label="Search results"></ul>
  <section class="recent-section">
    <h2>Recently Copied</h2>
    <ul id="recent-results" class="emoji-list" aria-label="Recently copied emojis"></ul>
  </section>
  <section class="group-directory">
    <h2>Browse Categories</h2>
    <ul class="group-link-list">${groupLinks}</ul>
  </section>`;

  const homeUrl = absoluteUrl(config.site.baseUrl, '');
  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: config.site.title,
      url: homeUrl,
      logo: absoluteUrl(config.site.baseUrl, 'logo.svg'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.site.title,
      url: homeUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${homeUrl}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return renderLayout({
    route: '',
    title: 'Search, Copy, And Explore Emojis',
    description: 'Search emojis by category, copy in multiple formats, and jump to detailed pages.',
    canonicalUrl: absoluteUrl(config.site.baseUrl, ''),
    robots: '',
    body,
    breadcrumbs: '',
    config,
    showHeaderSearch: false,
    scripts: [{ src: 'home-app.mjs', type: 'module', defer: true }],
    jsonLd: homeJsonLd,
  });
}

function renderAboutPage(config) {
  const body = `<article class="about-page">
    <h1>About emoj.ie</h1>
    <p>emoj.ie is a fast, static emoji explorer focused on reliable search and copy workflows.</p>
    <h2>Data Source</h2>
    <p>Emoji data and artwork are sourced from the OpenMoji project under CC BY-SA 4.0.</p>
    <h2>Contact</h2>
    <p><a href="mailto:info@emoj.ie">info@emoj.ie</a></p>
  </article>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'about/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'About' },
  ];

  return renderLayout({
    route: 'about/',
    title: 'About',
    description: 'About the emoj.ie emoji explorer and data sources.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd: [breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl)],
  });
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
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: group.title },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${group.title} Emojis`,
      url: canonicalUrl,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: group.route,
    title: `${group.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
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
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: group.title, href: `/${group.route}` },
    { label: subgroup.title },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${subgroup.title} Emojis`,
      url: canonicalUrl,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: subgroup.route,
    title: `${subgroup.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
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
      return `<li><a href="/${variant.detailRoute}" data-variant-select="true" data-variant-from="${escapeHtml(
        entry.hexLower
      )}" data-variant-to="${escapeHtml(variant.hexLower)}" data-group="${escapeHtml(
        entry.group
      )}" data-subgroup="${escapeHtml(entry.subgroup)}" data-route="${escapeHtml(
        variant.detailRoute
      )}" data-format="variant">${escapeHtml(humanizeSlug(variant.slug))} (${escapeHtml(
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
  const imageSrc = emojiAssetSource(entry);
  const cdnSrc = entry.cdnAssetPath || config.assets.emojiCdnTemplate.replace('{HEX}', imageHex);
  const canonicalUrl = absoluteUrl(config.site.baseUrl, entry.canonicalRoute);
  const detailUrl = absoluteUrl(config.site.baseUrl, entry.detailRoute);
  const label = humanizeSlug(entry.slug);

  const body = `<article class="emoji-detail">
    <h1>${escapeHtml(label)}</h1>
    <p class="emoji-detail-hero">${escapeHtml(entry.emoji)}</p>
    <p>
      <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(label)}" width="96" height="96" loading="eager" data-cdn-src="${escapeHtml(cdnSrc)}" data-hex="${escapeHtml(entry.hexLower)}" />
    </p>
    <p>
      <button
        type="button"
        class="copy-btn"
        data-copy-value="${escapeHtml(entry.emoji)}"
        data-copy-label="${escapeHtml(label)}"
        data-copy-format="emoji"
        data-emoji="${escapeHtml(entry.emoji)}"
        data-hex="${escapeHtml(entry.hexLower)}"
        data-group="${escapeHtml(entry.group)}"
        data-subgroup="${escapeHtml(entry.subgroup)}"
        data-route="${escapeHtml(entry.detailRoute)}"
      >Copy Emoji</button>
      <button type="button" class="copy-btn secondary" data-copy-value="${escapeHtml(
        entry.hexLower
      )}" data-copy-label="${escapeHtml(label)} hex code" data-copy-format="unicode" data-hex="${escapeHtml(
        entry.hexLower
      )}" data-group="${escapeHtml(entry.group)}" data-subgroup="${escapeHtml(
        entry.subgroup
      )}" data-route="${escapeHtml(entry.detailRoute)}">Copy Hex</button>
      <button type="button" class="copy-btn secondary" data-share-url="${escapeHtml(
        detailUrl
      )}" data-route="${escapeHtml(entry.detailRoute)}" data-hex="${escapeHtml(
        entry.hexLower
      )}" data-group="${escapeHtml(entry.group)}" data-subgroup="${escapeHtml(
        entry.subgroup
      )}" data-format="url">Share Link</button>
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
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: group.title, href: `/${group.route}` },
    { label: subgroup.title, href: `/${subgroup.route}` },
    { label },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${label} Emoji`,
      url: detailUrl,
      description,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: label,
      termCode: entry.hexLower,
      url: detailUrl,
      inDefinedTermSet: absoluteUrl(config.site.baseUrl, subgroup.route),
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: entry.detailRoute,
    title: `${label} Emoji`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
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
    await writeRouteHtml(tempRoot, '', renderHomePage(model, config), generatedFiles);
    coreRoutes.add('');
  }

  if (config.indexing?.includeAboutPage) {
    await writeRouteHtml(tempRoot, 'about/', renderAboutPage(config), generatedFiles);
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
