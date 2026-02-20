import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ensureTrailingSlash,
  escapeHtml,
  formatHexForAsset,
  humanizeSlug,
  normalizeHex,
  routeToFile,
  slugify,
} from './slug.mjs';
import { DAILY_EMOJI_EDITORIAL } from './daily-emoji-editorial.mjs';

const COMPETITOR_ALTERNATIVES = [
  {
    key: 'emojipedia',
    name: 'Emojipedia',
    route: 'alternatives/emojipedia/',
    whySwitch:
      'People looking for a faster copy workflow and less reading overhead usually compare emoj.ie with Emojipedia.',
    switchSignals: [
      'You need to copy emojis quickly during writing, chat, or social publishing.',
      'You want keyboard-led navigation and low-friction favorites/recents.',
      'You care more about execution speed than long editorial history pages.',
    ],
    emojieStrengths: [
      'Faster copy flow with local-first recents and favorites',
      'Cleaner category and search-topic navigation',
      'Low-friction static pages with fewer moving parts',
    ],
    competitorStrengths: [
      'Deep editorial coverage and historical context',
      'Large documentation footprint across emoji updates',
      'Strong brand recognition and broad backlink profile',
    ],
    bestForEmojie:
      'Choose emoj.ie when your goal is fast discovery, copy reliability, and repeat usage with local memory.',
    bestForCompetitor:
      'Choose Emojipedia when you want richer editorial explainers and historical release context.',
    migrationPlan: [
      'Save your most-used emojis in emoj.ie favorites.',
      'Use category and tag hubs to rebuild your recurring workflow in under five minutes.',
      'Keep Emojipedia open only for deep-reference sessions.',
    ],
  },
  {
    key: 'getemoji',
    name: 'GetEmoji',
    route: 'alternatives/getemoji/',
    whySwitch:
      'Users who outgrow a single-page copy wall often compare emoj.ie against GetEmoji for stronger discovery depth.',
    switchSignals: [
      'You still need one-click copy, but also want better route-level navigation.',
      'You want emoji detail pages with meaning, codes, and related suggestions.',
      'You want categories, tags, and curated search topics in one place.',
    ],
    emojieStrengths: [
      'Canonical emoji pages with context and related links',
      'Tag, category, and curated search-topic hubs',
      'Keyboard-friendly flow plus persistent local favorites',
    ],
    competitorStrengths: [
      'Extremely simple copy-first single-page experience',
      'Minimal learning curve for first-time visitors',
      'Straightforward visual scanning',
    ],
    bestForEmojie:
      'Choose emoj.ie when you need speed plus guided discovery and reusable workflows.',
    bestForCompetitor:
      'Choose GetEmoji when you only need quick one-off copy from a single long page.',
    migrationPlan: [
      'Start with the search bar and saved favorites to replicate your fastest copy flow.',
      'Use category pages when search feels too broad.',
      'Switch copy mode once and keep it persistent for future sessions.',
    ],
  },
  {
    key: 'findemoji',
    name: 'FindEmoji',
    route: 'alternatives/findemoji/',
    whySwitch:
      'Users comparing app-like emoji explorers often evaluate emoj.ie for static speed and deterministic behavior.',
    switchSignals: [
      'You prefer static reliability over heavier app shells.',
      'You want route clarity for SEO, bookmarking, and shareability.',
      'You want local-first behavior without account dependency.',
    ],
    emojieStrengths: [
      'Static-first architecture tuned for GitHub Pages delivery',
      'Direct category-to-subgroup-to-detail navigation model',
      'Clear canonical and noindex controls for SEO hygiene',
    ],
    competitorStrengths: [
      'Application-style interface with broad route footprint',
      'Modern visual shell and utility-oriented interaction patterns',
      'Useful discovery depth in category navigation',
    ],
    bestForEmojie:
      'Choose emoj.ie when you prioritize predictable speed, low complexity, and static-hosting reliability.',
    bestForCompetitor:
      'Choose FindEmoji when you prefer an application-style browsing environment.',
    migrationPlan: [
      'Use the same search terms and compare result quality side by side.',
      'Pin recurring emojis in favorites to remove repeated search work.',
      'Switch to category/tag routes for focused exploration.',
    ],
  },
];

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

function renderHeader({
  prefix,
  showSearch,
  showMenuToggle,
  menuControlsId = 'advanced-menu',
}) {
  const menuToggle = showMenuToggle
    ? `<button
        type="button"
        id="header-menu-toggle"
        class="header-menu-toggle"
        aria-label="Open advanced options"
        aria-controls="${escapeHtml(menuControlsId)}"
        aria-expanded="false"
      >
        <span></span><span></span><span></span>
      </button>`
    : '';

  const search = showSearch
    ? `<form class="header-search" action="${prefix}" method="get" role="search">
        <label for="search" class="visually-hidden">Search Emojis</label>
        <span class="header-search-icon" aria-hidden="true">⌕</span>
        <input id="search" name="q" type="search" autocomplete="off" placeholder="Search by emoji, meaning, or keyword…" />
      </form>`
    : '';

  return `<header class="header">
      <div class="header-container">
        <a href="${prefix}" class="logo" aria-label="emoj.ie home">
          <span class="logo-badge" aria-hidden="true">
            <img
              class="logo-emoji"
              data-logo-emoji-image
              src="/assets/emoji/base/1F600.svg"
              data-cdn-src="https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/1F600.svg"
              alt=""
              width="30"
              height="30"
              loading="eager"
              decoding="async"
            />
            <span class="logo-emoji-fallback" data-logo-emoji-fallback>😀</span>
          </span>
          <span class="logo-wordmark">emoj.ie</span>
        </a>
        ${search}
        ${menuToggle}
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

function renderGlobalAdvancedMenu() {
  return `<aside id="global-advanced-menu" class="advanced-menu advanced-menu-global" hidden>
    <div class="advanced-header">
      <h2>Quick Options</h2>
      <button type="button" id="global-advanced-close" class="copy-btn secondary">Close</button>
    </div>
    <div class="advanced-grid">
      <div class="control-group">
        <label for="global-copy-mode">Default Copy Format</label>
        <select id="global-copy-mode" aria-label="Select default copy format">
          <option value="emoji">Emoji</option>
          <option value="unicode">Unicode Hex</option>
          <option value="html">HTML Entity</option>
          <option value="shortcode">Shortcode</option>
        </select>
      </div>
      <div class="control-group">
        <label for="global-skin-tone-mode">Default Skin Tone</label>
        <select id="global-skin-tone-mode" aria-label="Select default skin tone">
          <option value="5">Dark</option>
          <option value="4">Medium-Dark</option>
          <option value="3">Medium</option>
          <option value="2">Medium-Light</option>
          <option value="1">Light</option>
          <option value="0">Yellow</option>
        </select>
      </div>
      <div class="control-group">
        <label for="global-theme-toggle">Theme</label>
        <button
          type="button"
          id="global-theme-toggle"
          class="copy-btn secondary menu-theme-toggle"
          data-theme-toggle
          data-theme-preference="system"
        >
          <span class="theme-toggle-glyph" aria-hidden="true">◐</span>
          <span class="theme-toggle-label">Theme: System</span>
        </button>
      </div>
    </div>
    <a class="copy-btn secondary" href="/">Open Full Explorer</a>
  </aside>
  <button type="button" id="global-advanced-backdrop" class="advanced-backdrop" hidden tabindex="-1" aria-hidden="true"></button>`;
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
  showMenuToggle = true,
  scripts = [],
  jsonLd = [],
  pageClass = 'page-default',
}) {
  const prefix = relativePrefix(route);
  const pageTitle = `${title} | ${config.site.title}`;
  const socialImage = toAssetUrl(config.site.baseUrl, config.site.socialImage);
  const robotsTag = robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '';
  const isHomePage = pageClass === 'page-home';
  const menuControlsId = isHomePage ? 'advanced-menu' : 'global-advanced-menu';
  const globalAdvancedMenu = showMenuToggle && !isHomePage ? renderGlobalAdvancedMenu() : '';

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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
    <link rel="icon" href="${prefix}favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="${prefix}style.css" />
    ${renderAnalyticsScript(config)}
    ${schemaScripts}
  </head>
  <body class="${escapeHtml(pageClass)}">
    <a href="#main-content" class="skip-link">Skip To Main Content</a>
    <div class="page-glow" aria-hidden="true"></div>
    ${renderHeader({ prefix, showSearch: showHeaderSearch, showMenuToggle, menuControlsId })}
    ${breadcrumbs || ''}
    <main id="main-content" class="page-main">
      ${body}
    </main>
    ${globalAdvancedMenu}
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
  const targetRoute =
    entry.indexable && entry.canonicalRoute ? entry.canonicalRoute : entry.detailRoute;
  const detailHref = `/${targetRoute}`;

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
    <a class="emoji-label" href="${escapeHtml(detailHref)}" title="${escapeHtml(label)}"><small>${escapeHtml(label)}</small></a>
  </li>`;
}

function parseEntryTags(entry) {
  const raw = [
    Array.isArray(entry.tags) ? entry.tags.join(',') : String(entry.tags || ''),
    Array.isArray(entry.openmoji_tags)
      ? entry.openmoji_tags.join(',')
      : String(entry.openmoji_tags || ''),
    String(entry.annotation || ''),
  ]
    .filter(Boolean)
    .join(',');
  const seen = new Set();
  const result = [];

  for (const part of raw.split(',')) {
    const normalized = slugify(part || '');
    if (!normalized || normalized.length < 2) continue;
    if (!/[a-z]/.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function unicodeCodepointLabel(hexLower) {
  return String(hexLower || '')
    .split('-')
    .filter(Boolean)
    .map((part) => `U+${String(part).toUpperCase()}`)
    .join(' ');
}

function htmlEntityLabel(hexLower) {
  return String(hexLower || '')
    .split('-')
    .filter(Boolean)
    .map((part) => `&#x${String(part).toUpperCase()};`)
    .join('');
}

function renderKeywordPills(tags, tagRouteKeys) {
  const items = tags.slice(0, 8).map((tag) => {
    const label = tag.replace(/-/g, ' ');
    if (tagRouteKeys && tagRouteKeys.has(tag)) {
      return `<li><a href="/tag/${tag}/">${escapeHtml(label)}</a></li>`;
    }
    return `<li><span>${escapeHtml(label)}</span></li>`;
  });

  return items.join('');
}

function renderRelatedEntryList(relatedEntries = []) {
  const items = relatedEntries.slice(0, 6).map((related) => {
    const route =
      related.indexable && related.canonicalRoute ? related.canonicalRoute : related.detailRoute;
    const label = humanizeSlug(related.slug || '');
    return `<li><a href="/${route}"><span>${escapeHtml(related.emoji || '')}</span><small>${escapeHtml(
      label
    )}</small></a></li>`;
  });

  return items.join('');
}

function renderHomePage(model, config) {
  const groupOptions = model.groups
    .map((group) => `<option value="${escapeHtml(group.key)}">${escapeHtml(group.title)}</option>`)
    .join('');

  const body = `<section class="panel-shell home-emoji-shell" aria-label="Emoji Explorer">
    <h1 class="visually-hidden">Emoji Categories</h1>
    <a id="home-category-index-link" class="visually-hidden" href="/category/">Browse category pages</a>
    <div id="panel-grid" class="panel-grid" data-level="group" aria-live="polite"></div>
    <section class="results-shell" aria-label="Emoji Results">
      <div class="results-toolbar">
        <p id="results-count" class="results-count">Loading…</p>
        <button type="button" id="results-load-more" class="copy-btn secondary" hidden>Load More</button>
      </div>
      <ul id="home-results" class="emoji-list" aria-label="Search results"></ul>
      <div id="results-sentinel" class="results-sentinel" aria-hidden="true"></div>
    </section>
  </section>

  <aside id="advanced-menu" class="advanced-menu" hidden>
    <div class="advanced-header">
      <h2>Advanced Options</h2>
      <button type="button" id="advanced-close" class="copy-btn secondary">Close</button>
    </div>
    <div class="advanced-grid">
      <div class="control-group">
        <label for="copy-mode">Copy Format</label>
        <select id="copy-mode" aria-label="Select copy format">
          <option value="emoji">Emoji</option>
          <option value="unicode">Unicode Hex</option>
          <option value="html">HTML Entity</option>
          <option value="shortcode">Shortcode</option>
        </select>
      </div>
      <div class="control-group">
        <label for="skin-tone-mode">Default Skin Tone</label>
        <select id="skin-tone-mode" aria-label="Select default skin tone">
          <option value="5">Dark</option>
          <option value="4">Medium-Dark</option>
          <option value="3">Medium</option>
          <option value="2">Medium-Light</option>
          <option value="1">Light</option>
          <option value="0">Yellow</option>
        </select>
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
        <label for="advanced-theme-toggle">Theme</label>
        <button
          type="button"
          id="advanced-theme-toggle"
          class="copy-btn secondary menu-theme-toggle"
          data-theme-toggle
          data-theme-preference="system"
        >
          <span class="theme-toggle-glyph" aria-hidden="true">◐</span>
          <span class="theme-toggle-label">Theme: System</span>
        </button>
      </div>
    </div>
    <button type="button" id="clear-filters" class="copy-btn secondary advanced-clear">Reset Selection</button>
  </aside>
  <button type="button" id="advanced-backdrop" class="advanced-backdrop" hidden tabindex="-1" aria-hidden="true"></button>

  <section id="favorites-section" class="recent-section" hidden>
    <h2>Favorites</h2>
    <ul id="favorite-results" class="emoji-list" aria-label="Favorite emojis"></ul>
  </section>

  <section id="recents-section" class="recent-section" hidden>
    <h2>Recently Copied</h2>
    <ul id="recent-results" class="emoji-list" aria-label="Recently copied emojis"></ul>
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
    showHeaderSearch: true,
    showMenuToggle: true,
    scripts: [{ src: 'home-app.mjs', type: 'module', defer: true }],
    jsonLd: homeJsonLd,
    pageClass: 'page-home',
  });
}

function renderAboutPage(config) {
  const starterWall = [
    ['😀', 'grinning face'],
    ['🤖', 'robot'],
    ['🎉', 'party popper'],
    ['🌈', 'rainbow'],
    ['🦊', 'fox'],
    ['🍕', 'pizza'],
    ['⚽', 'soccer ball'],
    ['🎧', 'headphones'],
    ['🚀', 'rocket'],
    ['🧠', 'brain'],
    ['✨', 'sparkles'],
    ['💡', 'light bulb'],
  ];

  const starterWallMarkup = starterWall
    .map(
      ([emoji, label]) => `<li>
        <button
          type="button"
          class="about-emoji-chip"
          data-copy-value="${escapeHtml(emoji)}"
          data-copy-label="${escapeHtml(label)}"
          data-copy-format="emoji"
          aria-label="Copy ${escapeHtml(label)} emoji"
        >
          <span class="about-emoji-glyph" aria-hidden="true">${escapeHtml(emoji)}</span>
          <small>${escapeHtml(label)}</small>
        </button>
      </li>`
    )
    .join('');

  const body = `<article class="about-page about-page-v2">
    <p class="collection-kicker">About</p>
    <h1>Emoji should feel instant.</h1>
    <p class="about-lede">emoj.ie helps you find, copy, and reuse the right emoji in seconds. It is fast, friendly, and simple on desktop and mobile.</p>
    <div class="about-pill-row" aria-label="What emoj.ie stands for">
      <span>⚡ Fast</span>
      <span>🎯 Clear</span>
      <span>🔒 Local-first</span>
      <span>🧒 Kid-friendly</span>
    </div>
    <section class="about-grid about-grid-signals">
      <section class="about-card">
        <h2>Made for speed</h2>
        <p>Open the site, pick a category, and copy in a tap. No account or setup required.</p>
      </section>
      <section class="about-card">
        <h2>Made for humans</h2>
        <p>Simple navigation, clear labels, and responsive layouts keep the focus on emoji, not UI clutter.</p>
      </section>
      <section class="about-card">
        <h2>Made to remember</h2>
        <p>Favorites and recents stay on your device so your everyday emoji set is always close.</p>
      </section>
    </section>
    <section class="about-card about-playground" aria-labelledby="about-playground-title">
      <div class="about-playground-head">
        <div>
          <h2 id="about-playground-title">Emoji playground</h2>
          <p>Tap any tile to copy. Hit shuffle to spark new ideas.</p>
        </div>
        <button type="button" id="about-shuffle" class="copy-btn secondary">Shuffle</button>
      </div>
      <ul id="about-emoji-wall" class="about-emoji-wall" aria-live="polite">${starterWallMarkup}</ul>
    </section>
    <section class="about-grid">
      <section class="about-card">
        <h2>Open data, clear credit</h2>
        <p>Emoji artwork and base metadata come from OpenMoji under CC BY-SA 4.0, with open keyword enrichment.</p>
      </section>
      <section class="about-card">
        <h2>Contact</h2>
        <p>Questions, ideas, or partnerships:</p>
        <p><a href="mailto:info@emoj.ie">info@emoj.ie</a></p>
      </section>
    </section>
    <div class="about-cta-row">
      <a class="copy-btn" href="/">Browse emojis</a>
      <a class="copy-btn secondary" href="/category/">Open categories</a>
    </div>
  </article>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'about/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'About' },
  ];

  return renderLayout({
    route: 'about/',
    title: 'About emoj.ie',
    description: 'Why emoj.ie exists: a fast, friendly emoji finder built for instant copy and simple discovery.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd: [breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl)],
    pageClass: 'page-about',
  });
}

function renderAlternativeIndexPage(config) {
  const items = COMPETITOR_ALTERNATIVES.map(
    (item) =>
      `<li><a href="/${item.route}"><span>${escapeHtml(item.name)} alternative</span><small>Use-case fit, strengths, and migration checklist</small></a></li>`
  ).join('');

  const body = `<section class="group">
    <p class="collection-kicker">Competitor Alternatives</p>
    <h1>Emoji Site Alternatives</h1>
    <p>Compare emoj.ie against popular emoji tools with honest strengths, tradeoffs, and best-fit guidance.</p>
    <div class="collection-stat-row">
      <span><strong>${COMPETITOR_ALTERNATIVES.length}</strong> comparison pages</span>
      <span><strong>4</strong> fit dimensions per page</span>
      <span><strong>0</strong> fluff claims</span>
    </div>
    <ul class="group-link-list">${items}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'alternatives/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Alternatives' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Emoji Site Alternatives',
      url: canonicalUrl,
      description: 'Compare emoj.ie with other emoji tools.',
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: 'alternatives/',
    title: 'Emoji Site Alternatives',
    description: 'Compare emoj.ie with other emoji tools and pick the best fit.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-alternatives-index',
  });
}

function renderAlternativePage(item, config) {
  const switchSignals = item.switchSignals
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  const strengthList = item.emojieStrengths
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  const competitorList = item.competitorStrengths
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  const migrationSteps = (item.migrationPlan || [])
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');

  const body = `<article class="about-page">
    <p class="collection-kicker">Comparison</p>
    <h1>emoj.ie vs ${escapeHtml(item.name)}</h1>
    <p class="about-lede">${escapeHtml(item.whySwitch)}</p>
    <section class="about-card">
      <h2>Switch Signals</h2>
      <ul class="story-list">${switchSignals}</ul>
    </section>
    <section class="about-grid">
      <section class="about-card">
        <h2>Where emoj.ie wins</h2>
        <ul class="story-list">${strengthList}</ul>
      </section>
      <section class="about-card">
        <h2>Where ${escapeHtml(item.name)} wins</h2>
        <ul class="story-list">${competitorList}</ul>
      </section>
    </section>
    <section class="about-card">
      <h2>Best-Fit Guidance</h2>
      <p><strong>Choose emoj.ie:</strong> ${escapeHtml(item.bestForEmojie || '')}</p>
      <p><strong>Choose ${escapeHtml(item.name)}:</strong> ${escapeHtml(item.bestForCompetitor || '')}</p>
    </section>
    <section class="about-card">
      <h2>Migration In 3 Steps</h2>
      <ol class="story-list ordered">${migrationSteps}</ol>
    </section>
  </article>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, item.route);
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Alternatives', href: '/alternatives/' },
    { label: `${item.name} alternative` },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `emoj.ie vs ${item.name}`,
      url: canonicalUrl,
      description: item.whySwitch,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: item.route,
    title: `emoj.ie vs ${item.name}`,
    description: item.whySwitch,
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-alternative',
  });
}

function renderCategoryIndexPage(categories, config) {
  const items = categories
    .slice(0, 40)
    .map(
      (category) =>
        `<li><a href="/${category.route}"><span>${escapeHtml(category.title)}</span><small>${category.subgroups.length} subcategories</small></a></li>`
    )
    .join('');
  const visibleCategories = categories.slice(0, 40).length;
  const totalSubgroups = categories
    .slice(0, 40)
    .reduce((sum, category) => sum + Number(category.subgroups?.length || 0), 0);

  const body = `<section class="group">
    <p class="collection-kicker">Category Directory</p>
    <h1>Emoji Categories</h1>
    <p>Browse category hubs to move from broad intent to exact emoji selections with fewer clicks.</p>
    <div class="collection-stat-row">
      <span><strong>${visibleCategories}</strong> top-level categories</span>
      <span><strong>${totalSubgroups}</strong> indexed subcategories</span>
      <span><strong>Keyboard-ready</strong> copy workflow</span>
    </div>
    <ul class="group-link-list">${items}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'category/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Categories' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Emoji Categories',
      url: canonicalUrl,
      description: 'Browse emoji categories to discover focused emoji collections.',
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: 'category/',
    title: 'Emoji Categories',
    description: 'Browse emoji categories to discover focused emoji collections.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-category-index',
  });
}

function renderTagIndexPage(tags, config) {
  const items = tags
    .slice(0, 260)
    .map(
      (tag) =>
        `<li><a href="/${tag.route}"><span>${escapeHtml(tag.title)}</span><small>${tag.emojis.length} emojis</small></a></li>`
    )
    .join('');
  const visibleTags = tags.slice(0, 260);
  const totalTagCoverage = visibleTags.reduce(
    (sum, tag) => sum + Number(tag.emojis?.length || 0),
    0
  );

  const body = `<section class="group">
    <p class="collection-kicker">Tag Directory</p>
    <h1>Emoji Tags</h1>
    <p>Use tags when you know the vibe but not the exact emoji. Each tag groups meaning-adjacent options.</p>
    <div class="collection-stat-row">
      <span><strong>${visibleTags.length}</strong> curated tags</span>
      <span><strong>${totalTagCoverage.toLocaleString('en-US')}</strong> tag-to-emoji links</span>
      <span><strong>Meaning-driven</strong> discovery</span>
    </div>
    <ul class="group-link-list">${items}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'tag/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Tags' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Emoji Tags',
      url: canonicalUrl,
      description: 'Browse emoji tags and discover related emoji collections.',
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: 'tag/',
    title: 'Emoji Tags',
    description: 'Browse emoji tags and discover related emoji collections.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-tag-index',
  });
}

function renderTagPage(tag, config) {
  const emojiList = tag.emojis
    .slice(0, 360)
    .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
    .join('');

  const body = `<section class="subgroup">
    <p class="collection-kicker">Tag Collection</p>
    <h1>${escapeHtml(tag.title)} emojis</h1>
    <p>${escapeHtml(tag.description)} This set is tuned for fast copy and adjacent idea discovery.</p>
    <p class="subgroup-meta">${tag.emojis.length} emoji${tag.emojis.length === 1 ? '' : 's'} tagged with ${escapeHtml(
      tag.title
    )}.</p>
    <ul class="emoji-list">${emojiList}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, tag.route);
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Tags', href: '/tag/' },
    { label: tag.title },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${tag.title} Emojis`,
      url: canonicalUrl,
      description: tag.description,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: tag.route,
    title: `${tag.title} Emojis`,
    description: tag.description,
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-tag',
  });
}

function renderSearchIndexPage(searchPages, config) {
  const items = searchPages
    .slice(0, 80)
    .map(
      (searchPage) =>
        `<li><a href="/${searchPage.route}"><span>${escapeHtml(searchPage.title)}</span><small>${searchPage.emojis.length} matches</small></a></li>`
    )
    .join('');
  const visibleTopics = searchPages.slice(0, 80);
  const totalTopicCoverage = visibleTopics.reduce(
    (sum, topic) => sum + Number(topic.emojis?.length || 0),
    0
  );

  const body = `<section class="group">
    <p class="collection-kicker">Search Topic Directory</p>
    <h1>Emoji Search Topics</h1>
    <p>Browse curated intent clusters built from emoji meanings, tags, and real search language.</p>
    <div class="collection-stat-row">
      <span><strong>${visibleTopics.length}</strong> curated search topics</span>
      <span><strong>${totalTopicCoverage.toLocaleString('en-US')}</strong> topic-to-emoji links</span>
      <span><strong>Intent-matched</strong> exploration</span>
    </div>
    <ul class="group-link-list">${items}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, 'search/');
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Search Topics' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Emoji Search Topics',
      url: canonicalUrl,
      description: 'Browse curated emoji search topics.',
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: 'search/',
    title: 'Emoji Search Topics',
    description: 'Browse curated emoji search topics.',
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-search-index',
  });
}

function renderSearchPage(searchPage, config) {
  const emojiList = searchPage.emojis
    .slice(0, 360)
    .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
    .join('');

  const body = `<section class="subgroup">
    <p class="collection-kicker">Search Topic</p>
    <h1>${escapeHtml(searchPage.title)}</h1>
    <p>${escapeHtml(searchPage.description)} Copy fast, then branch into related options below.</p>
    <p class="subgroup-meta">${searchPage.emojis.length} emoji${searchPage.emojis.length === 1 ? '' : 's'} matched this curated search topic.</p>
    <ul class="emoji-list">${emojiList}</ul>
  </section>`;

  const canonicalUrl = absoluteUrl(config.site.baseUrl, searchPage.route);
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Search Topics', href: '/search/' },
    { label: searchPage.title },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: searchPage.title,
      url: canonicalUrl,
      description: searchPage.description,
      isPartOf: {
        '@type': 'WebSite',
        name: config.site.title,
        url: absoluteUrl(config.site.baseUrl, ''),
      },
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: searchPage.route,
    title: searchPage.title,
    description: searchPage.description,
    canonicalUrl,
    robots: '',
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-search',
  });
}

function renderGroupPage(group, config, options = {}) {
  const renderedRoute = ensureTrailingSlash(options.route || group.route);
  const canonicalRoute = ensureTrailingSlash(options.canonicalRoute || renderedRoute);
  const canonicalUrl = absoluteUrl(config.site.baseUrl, canonicalRoute);
  const isCanonicalRoute = renderedRoute === canonicalRoute;
  const breadcrumbs = options.breadcrumbs || [
    { label: 'Home', href: '/' },
    { label: group.title },
  ];
  const pageClass = options.pageClass || 'page-group';
  const introLabel = options.introLabel || group.title;
  const description =
    options.description || `Browse ${introLabel} emojis and copy them instantly.`;
  const previewLimit = Math.max(8, Number(config.ui?.groupPreviewLimit || 24));
  const subgroupSections = group.subgroups
    .map((subgroup) => {
      const preview = subgroup.emojis.slice(0, previewLimit);
      const emojiList = preview
        .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
        .join('');

      return `<section class="subgroup">
        <h2><a href="/${subgroup.route}">${escapeHtml(subgroup.title)}</a></h2>
        <p class="subgroup-meta">${subgroup.emojis.length} emoji${subgroup.emojis.length === 1 ? '' : 's'}.</p>
        <ul class="emoji-list">${emojiList}</ul>
      </section>`;
    })
    .join('');
  const subgroupCount = group.subgroups.length;
  const emojiCount = group.subgroups.reduce(
    (sum, subgroup) => sum + Number(subgroup.emojis?.length || 0),
    0
  );

  const body = `<section class="group">
    <h1>${escapeHtml(group.title)}</h1>
    <p class="subgroup-meta">${subgroupCount} subcategories, ${emojiCount.toLocaleString('en-US')} emojis.</p>
    ${subgroupSections}
  </section>`;

  const robots =
    group.noindex || options.forceNoindex || !isCanonicalRoute ? 'noindex,follow' : '';

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
    breadcrumbSchema(config.site.baseUrl, breadcrumbs, canonicalUrl),
  ];

  return renderLayout({
    route: renderedRoute,
    title: `${group.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(breadcrumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass,
  });
}

function renderSubgroupPage(group, subgroup, config, options = {}) {
  const emojiList = subgroup.emojis
    .map((emoji) => renderEmojiCard(emoji, config.assets.emojiCdnTemplate))
    .join('');

  const renderedRoute = ensureTrailingSlash(options.route || subgroup.route);
  const canonicalRoute = ensureTrailingSlash(options.canonicalRoute || subgroup.route);
  const canonicalUrl = absoluteUrl(config.site.baseUrl, canonicalRoute);
  const description = options.description || `Explore ${subgroup.title} emojis in ${group.title}.`;
  const isCanonicalRoute = renderedRoute === canonicalRoute;
  const robots =
    subgroup.noindex || options.forceNoindex || !isCanonicalRoute ? 'noindex,follow' : '';
  const pageClass = options.pageClass || 'page-subgroup';
  const body = `<section class="subgroup">
    <h1>${escapeHtml(subgroup.title)}</h1>
    <p class="subgroup-meta">${subgroup.emojis.length} emoji${subgroup.emojis.length === 1 ? '' : 's'}.</p>
    <ul class="emoji-list">${emojiList}</ul>
  </section>`;

  const categoryRoute = group.categoryRoute || group.route;
  const crumbs = options.breadcrumbs || [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/category/' },
    { label: group.title, href: `/${categoryRoute}` },
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
    route: renderedRoute,
    title: `${subgroup.title} Emojis`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass,
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

  return `<section class="variant-section">
    <h2>Variants</h2>
    <ul class="variant-list">${items}</ul>
  </section>`;
}

function renderEmojiPage(
  group,
  subgroup,
  entry,
  variantEntries,
  config,
  routeOverride = '',
  options = {}
) {
  const imageHex = formatHexForAsset(entry.hexLower);
  const imageSrc = emojiAssetSource(entry);
  const cdnSrc = entry.cdnAssetPath || config.assets.emojiCdnTemplate.replace('{HEX}', imageHex);
  const renderedRoute = ensureTrailingSlash(routeOverride || entry.detailRoute);
  const canonicalRoute = ensureTrailingSlash(entry.canonicalRoute || entry.detailRoute);
  const canonicalUrl = absoluteUrl(config.site.baseUrl, canonicalRoute);
  const renderedUrl = absoluteUrl(config.site.baseUrl, renderedRoute);
  const shareUrl = canonicalUrl;
  const label = humanizeSlug(entry.slug);
  const isCanonicalRoute = renderedRoute === canonicalRoute;
  const tagRouteKeys = options.tagRouteKeys || new Set();
  const relatedEntries = options.relatedEntries || [];
  const entryTags = parseEntryTags(entry);
  const keywordPills = renderKeywordPills(entryTags, tagRouteKeys);
  const relatedList = renderRelatedEntryList(relatedEntries);
  const unicodeLabel = unicodeCodepointLabel(entry.hexLower);
  const htmlEntity = htmlEntityLabel(entry.hexLower);
  const shortcode = `:${entry.slug}:`;
  const topKeywords = entryTags.slice(0, 3).map((token) => token.replace(/-/g, ' '));
  const keywordHint =
    topKeywords.length > 0
      ? `It is most often used around ${topKeywords.join(', ')} contexts.`
      : 'It is commonly used as a visual shortcut in conversation.';
  const usageLine = `${label} belongs to ${group.title} / ${subgroup.title}. ${keywordHint}`;
  const usagePrompts = topKeywords.slice(0, 3).map((keyword) => {
    const sentenceKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    return `${sentenceKeyword} posts and reactions`;
  });
  const promptList =
    usagePrompts.length > 0
      ? usagePrompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join('')
      : '<li>General chat and status updates</li>';

  const body = `<article class="emoji-detail">
    <p class="collection-kicker">Emoji Detail</p>
    <h1>${escapeHtml(label)}</h1>
    <p class="emoji-detail-lede">Copy the emoji, inspect code formats, and check related options before you publish.</p>
    <section class="emoji-hero-panel">
      <p class="emoji-detail-hero">${escapeHtml(entry.emoji)}</p>
      <p class="emoji-detail-art">
        <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(label)}" width="96" height="96" loading="eager" data-cdn-src="${escapeHtml(cdnSrc)}" data-hex="${escapeHtml(entry.hexLower)}" />
      </p>
      <div class="emoji-actions">
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
          data-route="${escapeHtml(canonicalRoute)}"
        >Copy Emoji</button>
        <button type="button" class="copy-btn secondary" data-copy-value="${escapeHtml(
          entry.hexLower
        )}" data-copy-label="${escapeHtml(label)} hex code" data-copy-format="unicode" data-hex="${escapeHtml(
          entry.hexLower
        )}" data-group="${escapeHtml(entry.group)}" data-subgroup="${escapeHtml(
          entry.subgroup
        )}" data-route="${escapeHtml(canonicalRoute)}">Copy Hex</button>
        <button type="button" class="copy-btn secondary" data-copy-value="${escapeHtml(
          shortcode
        )}" data-copy-label="${escapeHtml(label)} shortcode" data-copy-format="shortcode" data-hex="${escapeHtml(
          entry.hexLower
        )}" data-group="${escapeHtml(entry.group)}" data-subgroup="${escapeHtml(
          entry.subgroup
        )}" data-route="${escapeHtml(canonicalRoute)}">Copy Shortcode</button>
        <button type="button" class="copy-btn secondary" data-share-url="${escapeHtml(
          shareUrl
        )}" data-route="${escapeHtml(canonicalRoute)}" data-hex="${escapeHtml(
          entry.hexLower
        )}" data-group="${escapeHtml(entry.group)}" data-subgroup="${escapeHtml(
          entry.subgroup
        )}" data-format="url">Share Link</button>
      </div>
    </section>
    <dl class="emoji-meta">
      <dt>Unicode</dt><dd><code>${escapeHtml(entry.hexLower)}</code></dd>
      <dt>Group</dt><dd>${escapeHtml(group.title)}</dd>
      <dt>Subgroup</dt><dd>${escapeHtml(subgroup.title)}</dd>
      <dt>Canonical</dt><dd><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></dd>
      <dt>Permalink</dt><dd><a href="${escapeHtml(renderedUrl)}">${escapeHtml(renderedUrl)}</a></dd>
    </dl>
    <section class="emoji-context">
      <h2>Meaning And Usage</h2>
      <p>${escapeHtml(usageLine)}</p>
      <ul class="story-list compact">${promptList}</ul>
      ${
        keywordPills
          ? `<ul class="keyword-pills" aria-label="Emoji keywords">${keywordPills}</ul>`
          : '<p class="emoji-context-note">No curated keywords available for this emoji yet.</p>'
      }
    </section>
    <section class="emoji-code-grid" aria-label="Copy and code formats">
      <article class="emoji-code-card">
        <h3>Shortcode</h3>
        <code>${escapeHtml(shortcode)}</code>
      </article>
      <article class="emoji-code-card">
        <h3>Unicode</h3>
        <code>${escapeHtml(unicodeLabel)}</code>
      </article>
      <article class="emoji-code-card">
        <h3>HTML Entity</h3>
        <code>${escapeHtml(htmlEntity)}</code>
      </article>
    </section>
    ${
      relatedList
        ? `<section class="emoji-related">
      <h2>Related Emojis</h2>
      <ul class="emoji-related-list">${relatedList}</ul>
    </section>`
        : ''
    }
    ${renderVariantSection(entry, variantEntries)}
  </article>`;

  const robots = entry.noindex || !isCanonicalRoute ? 'noindex,follow' : '';
  const description = `${label} emoji. Copy ${label} instantly.`;
  const categoryRoute = group.categoryRoute || group.route;
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: group.title, href: `/${categoryRoute}` },
    { label: subgroup.title, href: `/${subgroup.route}` },
    { label },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${label} Emoji`,
      url: canonicalUrl,
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
      url: canonicalUrl,
      inDefinedTermSet: absoluteUrl(config.site.baseUrl, subgroup.route),
    },
    breadcrumbSchema(config.site.baseUrl, crumbs, canonicalUrl),
  ];

  return renderLayout({
    route: renderedRoute,
    title: `${label} Emoji`,
    description,
    canonicalUrl,
    robots,
    body,
    breadcrumbs: renderBreadcrumbs(crumbs),
    config,
    showHeaderSearch: true,
    jsonLd,
    pageClass: 'page-detail',
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

async function writeGeneratedFile(tempRoot, file, contents, generatedFiles) {
  const outputPath = path.join(tempRoot, file);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, contents, 'utf8');
  generatedFiles.add(file);
}

function buildHomeDataPayload(emojiEntries) {
  const rows = [...emojiEntries]
    .sort((a, b) => a.detailRoute.localeCompare(b.detailRoute, 'en', { sensitivity: 'base' }))
    .map((entry) => ({
      emoji: entry.emoji || '',
      annotation: entry.annotation || '',
      group: entry.group,
      subgroup: entry.subgroup,
      hexcode: entry.hexLower,
      tags: Array.isArray(entry.tags) ? entry.tags.join(' ') : String(entry.tags || ''),
      detailRoute: entry.indexable ? entry.canonicalRoute || entry.detailRoute : entry.detailRoute,
      useLocalAsset: Boolean(entry.useLocalAsset),
      baseHex: entry.baseHex || entry.hexLower,
      isVariant: Boolean(entry.isVariant),
      skintone: entry.skintone === '' || entry.skintone == null ? 0 : Number(entry.skintone) || 0,
      skintoneBaseHex: entry.skintone_base_hexcode ? normalizeHex(entry.skintone_base_hexcode) : '',
    }));

  return `${JSON.stringify(rows)}\n`;
}

function buildDailyEmojiPayload(emojiEntries) {
  const source = [...emojiEntries]
    .filter((entry) => entry.indexable && !entry.isVariant && entry.group !== 'component')
    .map((entry) => {
      const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : String(entry.tags || '');
      const searchText = [
        String(entry.annotation || ''),
        String(entry.group || ''),
        String(entry.subgroup || ''),
        tags,
      ]
        .join(' ')
        .toLowerCase();

      return {
        ...entry,
        hexLower: normalizeHex(entry.hexLower || entry.hexcode || ''),
        searchText,
      };
    })
    .sort((a, b) => a.detailRoute.localeCompare(b.detailRoute, 'en', { sensitivity: 'base' }));

  const fallbackSource =
    source.length > 0
      ? source
      : [...emojiEntries]
          .map((entry) => ({
            ...entry,
            hexLower: normalizeHex(entry.hexLower || entry.hexcode || ''),
            searchText: [
              String(entry.annotation || ''),
              String(entry.group || ''),
              String(entry.subgroup || ''),
            ]
              .join(' ')
              .toLowerCase(),
          }))
          .sort((a, b) => a.detailRoute.localeCompare(b.detailRoute, 'en', { sensitivity: 'base' }));

  const entryByHex = new Map();
  for (const entry of fallbackSource) {
    if (entry.hexLower && !entryByHex.has(entry.hexLower)) {
      entryByHex.set(entry.hexLower, entry);
    }
  }

  const fixedDateHexes = DAILY_EMOJI_EDITORIAL.fixedDateHexes || {};
  const reservedOverrideHexes = new Set();
  for (const hexes of Object.values(fixedDateHexes)) {
    const list = Array.isArray(hexes) ? hexes : [hexes];
    for (const hex of list) {
      const normalized = normalizeHex(hex || '');
      if (normalized && entryByHex.has(normalized)) {
        reservedOverrideHexes.add(normalized);
      }
    }
  }

  const monthGroupBias = {
    '01': ['travel-places', 'activities'],
    '02': ['smileys-emotion', 'food-drink'],
    '03': ['animals-nature', 'travel-places'],
    '04': ['animals-nature', 'travel-places'],
    '05': ['animals-nature', 'activities'],
    '06': ['travel-places', 'activities'],
    '07': ['activities', 'travel-places'],
    '08': ['food-drink', 'travel-places'],
    '09': ['objects', 'food-drink'],
    '10': ['activities', 'animals-nature'],
    '11': ['food-drink', 'travel-places'],
    '12': ['activities', 'travel-places'],
  };

  const weeklyThemeKeywords = [
    ['smile', 'joy', 'sparkle'],
    ['animal', 'nature', 'bird'],
    ['food', 'drink', 'fruit'],
    ['travel', 'place', 'weather'],
    ['sport', 'game', 'activity'],
    ['object', 'tool', 'light'],
    ['symbol', 'star', 'moon'],
  ];

  const usedHexes = new Set();

  const pickByHexList = (hexList = [], { allowReserved = false } = {}) => {
    for (const hex of hexList) {
      const normalized = normalizeHex(hex || '');
      const entry = entryByHex.get(normalized);
      if (!entry || usedHexes.has(entry.hexLower)) {
        continue;
      }
      if (!allowReserved && reservedOverrideHexes.has(entry.hexLower)) {
        continue;
      }
      return entry;
    }
    return null;
  };

  const scoreEntry = (entry, keywords, monthKey) => {
    let score = 0;
    const text = entry.searchText || '';
    for (const rawKeyword of keywords) {
      const keyword = String(rawKeyword || '').trim().toLowerCase();
      if (!keyword) continue;
      if (text.includes(keyword)) {
        score += keyword.includes(' ') ? 6 : 4;
        continue;
      }

      const parts = keyword.split(/\s+/).filter(Boolean);
      for (const part of parts) {
        if (part.length >= 3 && text.includes(part)) {
          score += 1;
        }
      }
    }

    if ((monthGroupBias[monthKey] || []).includes(entry.group)) {
      score += 1;
    }

    return score;
  };

  const pickByKeywords = (keywords = [], monthKey, { allowReserved = false } = {}) => {
    let best = null;
    let bestScore = 0;

    for (const entry of fallbackSource) {
      if (usedHexes.has(entry.hexLower)) {
        continue;
      }
      if (!allowReserved && reservedOverrideHexes.has(entry.hexLower)) {
        continue;
      }

      const score = scoreEntry(entry, keywords, monthKey);
      if (score <= 0) {
        continue;
      }

      if (
        score > bestScore ||
        (score === bestScore &&
          best &&
          entry.detailRoute.localeCompare(best.detailRoute, 'en', { sensitivity: 'base' }) < 0)
      ) {
        best = entry;
        bestScore = score;
      } else if (!best) {
        best = entry;
        bestScore = score;
      }
    }

    return best;
  };

  const rows = [];
  for (let dayIndex = 1; dayIndex <= 366; dayIndex += 1) {
    const date = new Date(Date.UTC(2024, 0, dayIndex));
    const monthKey = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dayKey = String(date.getUTCDate()).padStart(2, '0');
    const monthDay = `${monthKey}-${dayKey}`;
    const dayOfMonth = date.getUTCDate();

    const fixedHexes = fixedDateHexes[monthDay] || [];
    const fixedList = Array.isArray(fixedHexes) ? fixedHexes : [fixedHexes];
    const monthThemes = DAILY_EMOJI_EDITORIAL.monthThemeKeywords?.[monthKey] || [];
    const dateTheme = DAILY_EMOJI_EDITORIAL.dateKeywordOverrides?.[monthDay] || [];
    const monthFallback = DAILY_EMOJI_EDITORIAL.monthFallbackHexes?.[monthKey] || [];
    const weeklyThemes = weeklyThemeKeywords[(dayOfMonth - 1) % weeklyThemeKeywords.length];
    const fallbackKeywords = DAILY_EMOJI_EDITORIAL.fallbackKeywords || [];

    let selected = pickByHexList(fixedList, { allowReserved: true });
    if (!selected) {
      selected = pickByKeywords([...dateTheme, ...monthThemes, ...weeklyThemes], monthKey);
    }
    if (!selected) {
      selected = pickByKeywords(monthThemes, monthKey);
    }
    if (!selected) {
      selected = pickByHexList(monthFallback, { allowReserved: false });
    }
    if (!selected) {
      selected = pickByKeywords([...weeklyThemes, ...fallbackKeywords], monthKey, {
        allowReserved: false,
      });
    }
    if (!selected) {
      selected = fallbackSource.find(
        (entry) => !usedHexes.has(entry.hexLower) && !reservedOverrideHexes.has(entry.hexLower)
      );
    }
    if (!selected) {
      selected = fallbackSource.find((entry) => !usedHexes.has(entry.hexLower));
    }
    if (!selected) {
      selected = {
        emoji: '😀',
        annotation: 'emoji',
        detailRoute: '',
        hexLower: '1f600',
      };
    }

    usedHexes.add(selected.hexLower);
    rows.push({
      monthDay,
      month: monthKey,
      dayOfMonth,
      emoji: selected.emoji || '😀',
      annotation: selected.annotation || 'emoji',
      detailRoute: selected.canonicalRoute || selected.detailRoute || '',
      hexcode: normalizeHex(selected.hexLower || selected.hexcode || '') || '1f600',
    });
  }

  return `${JSON.stringify(rows)}\n`;
}

export async function renderSite({ model, legacyRedirects, config, tempRoot }) {
  const generatedFiles = new Set();
  const coreRoutes = new Set();
  const emojiRoutes = new Set();
  const writtenCanonicalEmojiRoutes = new Set();

  await writeGeneratedFile(
    tempRoot,
    'home-data.json',
    buildHomeDataPayload(model.emojiEntries),
    generatedFiles
  );
  await writeGeneratedFile(
    tempRoot,
    'daily-emoji.json',
    buildDailyEmojiPayload(model.emojiEntries),
    generatedFiles
  );

  if (config.indexing?.includeHomePage) {
    await writeRouteHtml(tempRoot, '', renderHomePage(model, config), generatedFiles);
    coreRoutes.add('');
  }

  if (config.indexing?.includeAboutPage) {
    await writeRouteHtml(tempRoot, 'about/', renderAboutPage(config), generatedFiles);
    coreRoutes.add('about/');
  }

  await writeRouteHtml(
    tempRoot,
    'alternatives/',
    renderAlternativeIndexPage(config),
    generatedFiles
  );
  coreRoutes.add('alternatives/');

  for (const item of COMPETITOR_ALTERNATIVES) {
    await writeRouteHtml(tempRoot, item.route, renderAlternativePage(item, config), generatedFiles);
    coreRoutes.add(item.route);
  }

  const groupByKey = new Map((model.groups || []).map((group) => [group.key, group]));

  if (Array.isArray(model.categories) && model.categories.length > 0) {
    await writeRouteHtml(
      tempRoot,
      'category/',
      renderCategoryIndexPage(model.categories, config),
      generatedFiles
    );
    coreRoutes.add('category/');

    for (const category of model.categories) {
      const group = groupByKey.get(category.key);
      if (!group) continue;

      const canonicalCrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Categories', href: '/category/' },
        { label: category.title },
      ];

      await writeRouteHtml(
        tempRoot,
        category.route,
        renderGroupPage(group, config, {
          route: category.route,
          canonicalRoute: category.route,
          breadcrumbs: canonicalCrumbs,
          pageClass: 'page-category',
          description: `Browse ${category.title} emojis by subcategory and copy instantly.`,
        }),
        generatedFiles
      );

      if (!category.noindex) {
        coreRoutes.add(category.route);
      }

      if (category.legacyRoute && category.legacyRoute !== category.route) {
        await writeRouteHtml(
          tempRoot,
          category.legacyRoute,
          renderGroupPage(group, config, {
            route: category.legacyRoute,
            canonicalRoute: category.route,
            breadcrumbs: canonicalCrumbs,
            forceNoindex: true,
            pageClass: 'page-group-legacy',
            description: `Browse ${category.title} emojis by subcategory and copy instantly.`,
          }),
          generatedFiles
        );
      }
    }
  }

  if (Array.isArray(model.tags) && model.tags.length > 0) {
    await writeRouteHtml(tempRoot, 'tag/', renderTagIndexPage(model.tags, config), generatedFiles);
    coreRoutes.add('tag/');

    for (const tag of model.tags) {
      await writeRouteHtml(tempRoot, tag.route, renderTagPage(tag, config), generatedFiles);
      coreRoutes.add(tag.route);
    }
  }

  if (Array.isArray(model.searchPages) && model.searchPages.length > 0) {
    await writeRouteHtml(
      tempRoot,
      'search/',
      renderSearchIndexPage(model.searchPages, config),
      generatedFiles
    );
    coreRoutes.add('search/');

    for (const searchPage of model.searchPages) {
      await writeRouteHtml(tempRoot, searchPage.route, renderSearchPage(searchPage, config), generatedFiles);
      coreRoutes.add(searchPage.route);
    }
  }

  const tagRouteKeys = new Set((model.tags || []).map((tag) => tag.key));
  const variantsByBase = new Map();
  for (const entry of model.emojiEntries) {
    if (!variantsByBase.has(entry.baseHex)) {
      variantsByBase.set(entry.baseHex, []);
    }
    variantsByBase.get(entry.baseHex).push(entry);
  }

  for (const group of model.groups) {
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

      if (subgroup.legacyRoute && subgroup.legacyRoute !== subgroup.route) {
        await writeRouteHtml(
          tempRoot,
          subgroup.legacyRoute,
          renderSubgroupPage(group, subgroup, config, {
            route: subgroup.legacyRoute,
            canonicalRoute: subgroup.route,
            forceNoindex: true,
            pageClass: 'page-subgroup-legacy',
          }),
          generatedFiles
        );
      }

      const relatedPool = subgroup.emojis.filter(
        (candidate) => candidate.indexable && !candidate.isVariant
      );

      for (const entry of subgroup.emojis) {
        const variantEntries = variantsByBase.get(entry.baseHex) || [entry];
        const relatedEntries = relatedPool
          .filter((candidate) => candidate.hexLower !== entry.hexLower)
          .slice(0, 6);

        await writeRouteHtml(
          tempRoot,
          entry.detailRoute,
          renderEmojiPage(group, subgroup, entry, variantEntries, config, entry.detailRoute, {
            relatedEntries,
            tagRouteKeys,
          }),
          generatedFiles
        );

        if (entry.indexable) {
          if (entry.canonicalRoute === entry.detailRoute) {
            writtenCanonicalEmojiRoutes.add(entry.canonicalRoute);
          } else if (!writtenCanonicalEmojiRoutes.has(entry.canonicalRoute)) {
            await writeRouteHtml(
              tempRoot,
              entry.canonicalRoute,
              renderEmojiPage(group, subgroup, entry, variantEntries, config, entry.canonicalRoute, {
                relatedEntries,
                tagRouteKeys,
              }),
              generatedFiles
            );
            writtenCanonicalEmojiRoutes.add(entry.canonicalRoute);
          }

          emojiRoutes.add(entry.canonicalRoute);
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
