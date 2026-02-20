import {
  COPY_MODES,
  detailRouteFromEmoji,
  formatCopyValue,
  humanize,
  normalizeHex,
  parseUiState,
  toSearchParams,
} from './home-utils.mjs';

const SEARCH_SYNONYMS = Object.freeze({
  happy: ['smile', 'joy', 'grin', 'cheerful'],
  sad: ['cry', 'tears', 'upset'],
  laugh: ['lol', 'joy', 'funny', 'haha'],
  love: ['heart', 'romance', 'affection'],
  party: ['celebration', 'birthday', 'confetti'],
  angry: ['mad', 'rage', 'annoyed'],
  cat: ['kitty', 'feline'],
  dog: ['puppy', 'canine'],
  food: ['meal', 'eat', 'drink'],
  weather: ['sun', 'rain', 'cloud', 'snow'],
  work: ['office', 'job', 'business'],
  money: ['cash', 'bank', 'dollar', 'coin'],
});

const TOKEN_SPLIT_RE = /[^a-z0-9]+/g;

const SYNONYM_LOOKUP = (() => {
  const lookup = new Map();

  for (const [key, values] of Object.entries(SEARCH_SYNONYMS)) {
    const bag = new Set([key, ...values]);
    for (const token of bag) {
      const existing = lookup.get(token) || new Set();
      for (const value of bag) {
        existing.add(value);
      }
      lookup.set(token, existing);
    }
  }

  return lookup;
})();

function tokenizeSearch(value = '') {
  return String(value)
    .toLowerCase()
    .split(TOKEN_SPLIT_RE)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function expandQueryTokens(tokens = []) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const aliases = SYNONYM_LOOKUP.get(token);
    if (!aliases) continue;
    for (const alias of aliases) {
      expanded.add(alias);
    }
  }

  return [...expanded];
}

function withinDistance(a, b, maxDistance = 1) {
  const source = String(a || '').toLowerCase();
  const target = String(b || '').toLowerCase();

  if (!source || !target) return false;
  if (source === target) return true;
  if (Math.abs(source.length - target.length) > maxDistance) return false;

  const rows = source.length + 1;
  const cols = target.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let col = 1; col < cols; col += 1) {
      const cost = source[row - 1] === target[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
      rowMin = Math.min(rowMin, matrix[row][col]);
    }

    if (rowMin > maxDistance) {
      return false;
    }
  }

  return matrix[rows - 1][cols - 1] <= maxDistance;
}

(function () {
  const searchInput = document.getElementById('search');
  const groupFilter = document.getElementById('group-filter');
  const subgroupFilter = document.getElementById('subgroup-filter');
  const copyMode = document.getElementById('copy-mode');
  const skinToneMode = document.getElementById('skin-tone-mode');
  const clearButton = document.getElementById('clear-filters');

  const panelGrid = document.getElementById('panel-grid');
  const panelHome = document.getElementById('panel-home');
  const panelCurrent = document.getElementById('panel-current');

  const resultsShell = document.querySelector('.results-shell');
  const resultsCount = document.getElementById('results-count');
  const resultsList = document.getElementById('home-results');
  const resultsSentinel = document.getElementById('results-sentinel');
  const loadMoreButton = document.getElementById('results-load-more');

  const favoritesSection = document.getElementById('favorites-section');
  const recentsSection = document.getElementById('recents-section');
  const favoriteList = document.getElementById('favorite-results');
  const recentList = document.getElementById('recent-results');

  const menuToggle = document.getElementById('header-menu-toggle');
  const advancedMenu = document.getElementById('advanced-menu');
  const advancedClose = document.getElementById('advanced-close');
  const advancedBackdrop = document.getElementById('advanced-backdrop');

  if (
    !searchInput ||
    !groupFilter ||
    !subgroupFilter ||
    !copyMode ||
    !panelGrid ||
    !resultsList ||
    !resultsShell
  ) {
    return;
  }

  const RECENT_KEY = 'recentEmojisV2';
  const FAVORITE_KEY = 'favoriteEmojisV1';
  const COPY_MODE_KEY = 'copyMode';
  const SKIN_TONE_KEY = 'defaultSkinTone';

  const CHUNK_MIN = 72;
  const CHUNK_MAX = 220;
  const SEARCH_DEBOUNCE_MS = 90;

  let allEntries = [];
  let baseEntries = [];
  let groupKeys = [];
  let subgroupsByGroup = new Map();
  let variantsByBaseTone = new Map();
  let groupPreviewEntries = new Map();
  let subgroupPreviewEntries = new Map();
  let subgroupEntryCounts = new Map();
  let entryByRoute = new Map();
  let favoriteRouteSet = new Set();

  let filteredEntries = [];
  let renderedCount = 0;
  let currentResultButtons = [];
  let observer = null;
  let searchDebounce = null;

  const initialCopy = localStorage.getItem(COPY_MODE_KEY) || 'emoji';
  let state = parseUiState(window.location.search, initialCopy);
  let defaultSkinTone = localStorage.getItem(SKIN_TONE_KEY) || '0';

  if (!['0', '1', '2', '3', '4', '5'].includes(defaultSkinTone)) {
    defaultSkinTone = '0';
  }

  function track(eventName, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(eventName, { props: props || {} });
  }

  function computeChunkSize() {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const areaFactor = Math.max(1, Math.min(3, (vw * vh) / 900000));
    const base = Math.round(CHUNK_MIN * areaFactor);
    return Math.min(CHUNK_MAX, Math.max(CHUNK_MIN, base));
  }

  function normalizeEntry(entry) {
    const hexLower = normalizeHex(entry.hexLower || entry.hexcode || '');
    const baseHex = normalizeHex(entry.baseHex || entry.skintoneBaseHex || entry.skintone_base_hexcode || hexLower);
    const skintone = Number(entry.skintone || 0) || 0;

    const normalized = {
      ...entry,
      emoji: String(entry.emoji || ''),
      annotation: String(entry.annotation || '').trim(),
      group: String(entry.group || '').trim(),
      subgroup: String(entry.subgroup || '').trim(),
      hexLower,
      hexcode: entry.hexcode || hexLower,
      detailRoute: String(entry.detailRoute || detailRouteFromEmoji(entry)).trim(),
      tags: Array.isArray(entry.tags) ? entry.tags.join(' ') : String(entry.tags || ''),
      useLocalAsset: Boolean(entry.useLocalAsset),
      baseHex,
      isVariant: Boolean(entry.isVariant),
      skintone,
    };

    normalized.searchText = [
      normalized.annotation,
      normalized.tags,
      normalized.group,
      normalized.subgroup,
      normalized.hexLower,
      normalized.emoji,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    normalized.searchTokens = tokenizeSearch(normalized.searchText);
    normalized.searchTokenSet = new Set(normalized.searchTokens);

    return normalized;
  }

  function flattenGroupedData(groupedData) {
    const rows = [];
    for (const [group, subgroups] of Object.entries(groupedData)) {
      for (const [subgroup, emojis] of Object.entries(subgroups)) {
        for (const emoji of emojis) {
          rows.push(
            normalizeEntry({
              ...emoji,
              group,
              subgroup,
              skintoneBaseHex: emoji.skintone_base_hexcode,
              baseHex: emoji.skintone_base_hexcode || emoji.hexcode,
              isVariant:
                Boolean(emoji.skintone && Number(emoji.skintone) > 0) ||
                /\bfacing right\b/i.test(emoji.annotation || '') ||
                /^(man|woman)\b/i.test(emoji.annotation || ''),
            })
          );
        }
      }
    }
    return rows;
  }

  function isRealBaseEntry(entry) {
    if (entry.group === 'component') return true;
    if (entry.skintone > 0) return false;
    if (!entry.isVariant) return true;
    return entry.baseHex === entry.hexLower;
  }

  function initializeData(entries) {
    allEntries = entries
      .map((entry) => normalizeEntry(entry))
      .sort((a, b) => a.detailRoute.localeCompare(b.detailRoute, 'en', { sensitivity: 'base' }));

    groupKeys = [];
    subgroupsByGroup = new Map();
    variantsByBaseTone = new Map();
    groupPreviewEntries = new Map();
    subgroupPreviewEntries = new Map();
    subgroupEntryCounts = new Map();
    entryByRoute = new Map();

    const groupSet = new Set();
    const baseSeen = new Set();
    baseEntries = [];

    for (const entry of allEntries) {
      entryByRoute.set(entry.detailRoute, entry);
      groupSet.add(entry.group);

      if (!subgroupsByGroup.has(entry.group)) {
        subgroupsByGroup.set(entry.group, new Set());
      }
      subgroupsByGroup.get(entry.group).add(entry.subgroup);

      if (!variantsByBaseTone.has(entry.baseHex)) {
        variantsByBaseTone.set(entry.baseHex, new Map());
      }
      if (entry.skintone > 0) {
        variantsByBaseTone.get(entry.baseHex).set(String(entry.skintone), entry);
      }

      if (isRealBaseEntry(entry)) {
        const key = `${entry.group}::${entry.subgroup}::${entry.baseHex}`;
        if (!baseSeen.has(key)) {
          baseSeen.add(key);
          baseEntries.push(entry);

          const groupPreview = groupPreviewEntries.get(entry.group) || [];
          if (groupPreview.length < 6) {
            groupPreview.push(entry);
            groupPreviewEntries.set(entry.group, groupPreview);
          }

          const subgroupKey = `${entry.group}::${entry.subgroup}`;
          subgroupEntryCounts.set(subgroupKey, (subgroupEntryCounts.get(subgroupKey) || 0) + 1);

          const subgroupPreview = subgroupPreviewEntries.get(subgroupKey) || [];
          if (subgroupPreview.length < 6) {
            subgroupPreview.push(entry);
            subgroupPreviewEntries.set(subgroupKey, subgroupPreview);
          }
        }
      }
    }

    groupKeys = [...groupSet].sort((a, b) => a.localeCompare(b));
  }

  function resolveAsset(entry) {
    const upperHex = entry.hexLower.toUpperCase();
    const local = `/assets/emoji/base/${upperHex}.svg`;
    const cdn = `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${upperHex}.svg`;

    if (entry.useLocalAsset && entry.group !== 'component') {
      return { src: local, cdn };
    }

    return { src: cdn, cdn };
  }

  function resolveSkinToneEntry(baseEntry) {
    if (defaultSkinTone === '0' || !baseEntry.baseHex) {
      return baseEntry;
    }

    const toneMap = variantsByBaseTone.get(baseEntry.baseHex);
    if (!toneMap) {
      return baseEntry;
    }

    return toneMap.get(defaultSkinTone) || baseEntry;
  }

  function persistState(pushHistory = true) {
    localStorage.setItem(COPY_MODE_KEY, state.copy);
    localStorage.setItem(SKIN_TONE_KEY, defaultSkinTone);

    const query = toSearchParams(state);
    const target = query ? `?${query}` : window.location.pathname;

    if (pushHistory) {
      window.history.pushState({}, '', target);
    } else {
      window.history.replaceState({}, '', target);
    }
  }

  function currentLevel() {
    if (state.g && state.sg) return 'emoji';
    if (state.g) return 'subgroup';
    return 'group';
  }

  function populateGroups() {
    groupFilter.innerHTML = '<option value="">All Categories</option>';
    for (const group of groupKeys) {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = humanize(group);
      groupFilter.appendChild(option);
    }
  }

  function populateSubgroups(group) {
    subgroupFilter.innerHTML = '<option value="">All Subcategories</option>';

    if (!group || !subgroupsByGroup.has(group)) {
      subgroupFilter.disabled = true;
      return;
    }

    const values = [...subgroupsByGroup.get(group)].sort((a, b) => a.localeCompare(b));
    for (const subgroup of values) {
      const option = document.createElement('option');
      option.value = subgroup;
      option.textContent = humanize(subgroup);
      subgroupFilter.appendChild(option);
    }
    subgroupFilter.disabled = false;
  }

  function applyStateToControls() {
    searchInput.value = state.q;
    groupFilter.value = state.g;

    populateSubgroups(state.g);
    if (state.sg && subgroupFilter.querySelector(`option[value="${CSS.escape(state.sg)}"]`)) {
      subgroupFilter.value = state.sg;
    } else {
      state.sg = '';
      subgroupFilter.value = '';
    }

    if (!COPY_MODES.includes(state.copy)) {
      state.copy = 'emoji';
    }
    copyMode.value = state.copy;

    if (skinToneMode) {
      skinToneMode.value = defaultSkinTone;
    }
  }

  function buildPanelPreview(entries, limit = 4) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    return entries
      .slice(0, limit)
      .map((entry) => resolveSkinToneEntry(entry))
      .filter((entry) => Boolean(entry && entry.hexLower));
  }

  function createPanelCard(label, meta, previewEntries, onClick, href = '') {
    const card = href ? document.createElement('a') : document.createElement('button');
    card.className = 'panel-card';

    if (href) {
      card.classList.add('panel-card-link');
      card.href = href;
    } else {
      card.type = 'button';
    }

    const title = document.createElement('span');
    title.className = 'panel-card-title';
    title.textContent = label;

    const detail = document.createElement('small');
    detail.className = 'panel-card-meta';
    detail.textContent = meta;

    card.appendChild(title);
    card.appendChild(detail);
    if (Array.isArray(previewEntries) && previewEntries.length > 0) {
      const previewNode = document.createElement('span');
      previewNode.className = 'panel-card-preview';
      previewNode.setAttribute('aria-hidden', 'true');

      for (const entry of previewEntries) {
        const previewImage = document.createElement('img');
        const asset = resolveAsset(entry);
        previewImage.className = 'panel-card-preview-img';
        previewImage.src = asset.src;
        previewImage.dataset.cdnSrc = asset.cdn;
        previewImage.dataset.hex = entry.hexLower;
        previewImage.alt = '';
        previewImage.width = 22;
        previewImage.height = 22;
        previewImage.loading = 'lazy';
        previewNode.appendChild(previewImage);
      }

      card.appendChild(previewNode);
    }
    if (typeof onClick === 'function') {
      card.addEventListener('click', onClick);
    }
    return card;
  }

  function updatePanelCrumbs(level) {
    if (!panelCurrent) return;

    if (level === 'group') {
      panelCurrent.textContent = 'Categories';
      panelHome.disabled = true;
      return;
    }

    panelHome.disabled = false;
    if (level === 'subgroup') {
      panelCurrent.textContent = `${humanize(state.g)} / Subcategories`;
      return;
    }

    panelCurrent.textContent = `${humanize(state.g)} / ${humanize(state.sg)}`;
  }

  function panelSearchFilter(values) {
    const query = state.q.toLowerCase();
    if (!query) return values;
    return values.filter((value) => value.toLowerCase().includes(query));
  }

  function renderGroupPanels() {
    panelGrid.hidden = false;
    panelGrid.innerHTML = '';

    const groups = panelSearchFilter(groupKeys);
    for (const group of groups) {
      const subgroupCount = subgroupsByGroup.get(group)?.size || 0;
      const preview = buildPanelPreview(groupPreviewEntries.get(group));
      panelGrid.appendChild(
        createPanelCard(
          humanize(group),
          `${subgroupCount} subcategories`,
          preview,
          () => {
            state.g = group;
            state.sg = '';
            applyStateToControls();
            renderExplorer(true, true);
          }
        )
      );
    }

    resultsShell.hidden = true;
    resultsCount.textContent = `${groups.length} categor${groups.length === 1 ? 'y' : 'ies'} available.`;
    if (loadMoreButton) loadMoreButton.hidden = true;
  }

  function renderSubgroupPanels() {
    panelGrid.hidden = false;
    panelGrid.innerHTML = '';

    const subgroups = [...(subgroupsByGroup.get(state.g) || [])].sort((a, b) => a.localeCompare(b));
    const filtered = panelSearchFilter(subgroups);

    for (const subgroup of filtered) {
      const subgroupKey = `${state.g}::${subgroup}`;
      const count = subgroupEntryCounts.get(subgroupKey) || 0;
      const preview = buildPanelPreview(subgroupPreviewEntries.get(subgroupKey));
      panelGrid.appendChild(
        createPanelCard(
          humanize(subgroup),
          `${count} emoji${count === 1 ? '' : 's'}`,
          preview,
          () => {
            state.sg = subgroup;
            applyStateToControls();
            renderExplorer(true, true);
          }
        )
      );
    }

    resultsShell.hidden = true;
    resultsCount.textContent = `${filtered.length} subcategor${filtered.length === 1 ? 'y' : 'ies'} in ${humanize(state.g)}.`;
    if (loadMoreButton) loadMoreButton.hidden = true;
  }

  function entryToCard(entry) {
    const display = resolveSkinToneEntry(entry);

    const li = document.createElement('li');
    li.className = 'emoji';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-copy';
    button.setAttribute('aria-label', `Copy ${display.annotation}`);
    button.dataset.copyLabel = display.annotation;
    button.dataset.copyValue = formatCopyValue(state.copy, display);
    button.dataset.copyFormat = state.copy;
    button.dataset.emoji = display.emoji;
    button.dataset.hex = display.hexLower;
    button.dataset.group = display.group;
    button.dataset.subgroup = display.subgroup;
    button.dataset.route = display.detailRoute;

    const img = document.createElement('img');
    const asset = resolveAsset(display);
    img.src = asset.src;
    img.alt = display.annotation;
    img.width = 48;
    img.height = 48;
    img.loading = 'lazy';
    img.dataset.cdnSrc = asset.cdn;
    img.dataset.hex = display.hexLower;

    button.appendChild(img);

    const divider = document.createElement('hr');

    const link = document.createElement('a');
    link.href = `/${display.detailRoute}`;
    const small = document.createElement('small');
    small.textContent = display.annotation;
    link.appendChild(small);
    const favorite = createFavoriteButton(display);

    li.appendChild(button);
    li.appendChild(divider);
    li.appendChild(link);
    li.appendChild(favorite);

    return li;
  }

  function updateKeyboardCollection() {
    currentResultButtons = Array.from(resultsList.querySelectorAll('.emoji-copy'));
  }

  function hasMoreResults() {
    return renderedCount < filteredEntries.length;
  }

  function updateResultStatus() {
    if (!resultsCount) return;

    if (filteredEntries.length === 0) {
      resultsCount.textContent = 'No emojis match this selection.';
      return;
    }

    const showing = Math.min(renderedCount, filteredEntries.length);
    if (showing < filteredEntries.length) {
      resultsCount.textContent = `${filteredEntries.length} emojis, showing ${showing}. Scroll to load more.`;
    } else {
      resultsCount.textContent = `${filteredEntries.length} emoji${filteredEntries.length === 1 ? '' : 's'} loaded.`;
    }
  }

  function updateLoadControls() {
    const show = hasMoreResults();
    if (loadMoreButton) loadMoreButton.hidden = !show;
    if (resultsSentinel) resultsSentinel.hidden = !show;
  }

  function appendResultChunk() {
    if (!hasMoreResults()) {
      updateResultStatus();
      updateLoadControls();
      return;
    }

    const chunkSize = computeChunkSize();
    const next = Math.min(filteredEntries.length, renderedCount + chunkSize);
    const fragment = document.createDocumentFragment();

    for (let index = renderedCount; index < next; index += 1) {
      fragment.appendChild(entryToCard(filteredEntries[index]));
    }

    resultsList.appendChild(fragment);
    renderedCount = next;

    updateKeyboardCollection();
    updateResultStatus();
    updateLoadControls();
  }

  function entryQueryScore(entry, query, expandedTokens) {
    const searchText = entry.searchText || '';
    const annotation = (entry.annotation || '').toLowerCase();
    const tokenSet = entry.searchTokenSet || new Set();
    const tokenList = entry.searchTokens || [];

    let score = 0;

    if (searchText.includes(query)) {
      score += 90;
    }

    if (annotation.startsWith(query)) {
      score += 24;
    }

    for (const token of expandedTokens) {
      if (!token || token.length < 2) continue;

      if (tokenSet.has(token)) {
        score += 30;
        continue;
      }

      if (tokenList.some((candidate) => candidate.startsWith(token))) {
        score += 12;
        continue;
      }

      if (token.length < 4) {
        continue;
      }

      const maxDistance = token.length >= 7 ? 2 : 1;
      const fuzzy = tokenList.some((candidate) => {
        if (!candidate || Math.abs(candidate.length - token.length) > maxDistance) {
          return false;
        }
        return withinDistance(candidate, token, maxDistance);
      });

      if (fuzzy) {
        score += 6;
      }
    }

    return score;
  }

  function filterEmojiEntries() {
    const query = state.q.toLowerCase();
    const scoped = baseEntries.filter((entry) => {
      if (state.g && entry.group !== state.g) return false;
      if (state.sg && entry.subgroup !== state.sg) return false;
      return true;
    });

    if (!query) {
      return scoped;
    }

    const queryTokens = tokenizeSearch(query).slice(0, 5);
    const expandedTokens = expandQueryTokens(queryTokens).slice(0, 20);
    const scored = [];

    for (const entry of scoped) {
      const score = entryQueryScore(entry, query, expandedTokens);
      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.annotation.localeCompare(b.entry.annotation, 'en', { sensitivity: 'base' });
    });

    return scored.map((item) => item.entry);
  }

  function renderEmojiPanel() {
    panelGrid.hidden = true;
    resultsShell.hidden = false;
    resultsList.innerHTML = '';
    renderedCount = 0;

    filteredEntries = filterEmojiEntries();

    if (filteredEntries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'emoji-empty';
      empty.textContent = 'No emojis found for this subcategory and search.';
      resultsList.appendChild(empty);
      updateKeyboardCollection();
      updateResultStatus();
      updateLoadControls();
      return;
    }

    appendResultChunk();
  }

  function emitAnalytics() {
    track('filter', {
      source: window.location.pathname,
      hex: '',
      group: state.g || 'all',
      subgroup: state.sg || 'all',
      format: state.copy,
      results: String(filteredEntries.length || 0),
    });

    if (state.q) {
      track('search', {
        source: window.location.pathname,
        hex: '',
        group: state.g || 'all',
        subgroup: state.sg || 'all',
        format: state.copy,
        query_length: String(state.q.length),
        results: String(filteredEntries.length || 0),
      });
    }
  }

  function renderExplorer(pushHistory = true, emit = false) {
    persistState(pushHistory);

    const level = currentLevel();
    updatePanelCrumbs(level);

    if (level === 'group') {
      renderGroupPanels();
      filteredEntries = [];
    } else if (level === 'subgroup') {
      renderSubgroupPanels();
      filteredEntries = [];
    } else {
      renderEmojiPanel();
    }

    if (emit) {
      emitAnalytics();
    }
  }

  function snapshotEntry(entry) {
    return {
      emoji: entry.emoji || '',
      hexcode: entry.hexLower || entry.hexcode || '',
      annotation: entry.annotation || 'emoji',
      group: entry.group || '',
      subgroup: entry.subgroup || '',
      detailRoute: entry.detailRoute || '',
      tags: Array.isArray(entry.tags) ? entry.tags.join(' ') : String(entry.tags || ''),
      useLocalAsset: Boolean(entry.useLocalAsset),
      baseHex: entry.baseHex || entry.hexLower || entry.hexcode || '',
      isVariant: Boolean(entry.isVariant),
      skintone: entry.skintone === '' || entry.skintone == null ? 0 : Number(entry.skintone) || 0,
      skintoneBaseHex: entry.skintoneBaseHex || '',
    };
  }

  function resolveStoredEntry(raw) {
    if (raw && raw.detailRoute && entryByRoute.has(raw.detailRoute)) {
      return normalizeEntry(entryByRoute.get(raw.detailRoute));
    }
    return normalizeEntry(raw || {});
  }

  function readFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeFavorites(items) {
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(items.slice(0, 40)));
  }

  function refreshFavoriteSet() {
    favoriteRouteSet = new Set(readFavorites().map((item) => item?.detailRoute).filter(Boolean));
  }

  function applyFavoriteState(button) {
    const route = button.dataset.route || '';
    const label = button.dataset.copyLabel || 'emoji';
    const active = route ? favoriteRouteSet.has(route) : false;
    button.textContent = active ? '★' : '☆';
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute(
      'aria-label',
      active ? `Remove ${label} from favorites` : `Save ${label} to favorites`
    );
    button.title = active ? 'Remove favorite' : 'Save favorite';
  }

  function createFavoriteButton(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-favorite';
    button.dataset.route = entry.detailRoute || '';
    button.dataset.hex = entry.hexLower || entry.hexcode || '';
    button.dataset.group = entry.group || '';
    button.dataset.subgroup = entry.subgroup || '';
    button.dataset.emoji = entry.emoji || '';
    button.dataset.copyLabel = entry.annotation || 'emoji';
    applyFavoriteState(button);
    return button;
  }

  function syncFavoriteButtons() {
    const buttons = document.querySelectorAll('.emoji-favorite');
    for (const button of buttons) {
      applyFavoriteState(button);
    }
  }

  function toggleFavoriteEntry(entryLike, source = 'manual') {
    const detailRoute = String(entryLike?.detailRoute || '').trim();
    if (!detailRoute) {
      return;
    }

    const previous = readFavorites();
    const existing = previous.find((item) => item.detailRoute === detailRoute);
    let next;
    let eventName;

    if (existing) {
      next = previous.filter((item) => item.detailRoute !== detailRoute);
      eventName = 'favorite_remove';
    } else {
      const reference = entryByRoute.get(detailRoute) || normalizeEntry(entryLike);
      next = [snapshotEntry(reference), ...previous.filter((item) => item.detailRoute !== detailRoute)];
      eventName = 'favorite_add';
    }

    writeFavorites(next);
    refreshFavoriteSet();
    renderFavorites();
    syncFavoriteButtons();

    const normalized = entryByRoute.get(detailRoute) || normalizeEntry(entryLike);
    track(eventName, {
      source: window.location.pathname,
      hex: normalized.hexLower || '',
      group: normalized.group || 'all',
      subgroup: normalized.subgroup || 'all',
      format: state.copy,
      trigger: source,
    });
  }

  function toggleFavoriteFromButton(button, source = 'button') {
    if (!button || !button.dataset) return;

    toggleFavoriteEntry(
      {
        emoji: button.dataset.emoji,
        hexcode: button.dataset.hex,
        annotation: button.dataset.copyLabel || 'emoji',
        group: button.dataset.group,
        subgroup: button.dataset.subgroup,
        detailRoute: button.dataset.route,
        tags: '',
        useLocalAsset: button.dataset.group !== 'component',
        baseHex: button.dataset.hex,
        isVariant: false,
        skintone: 0,
      },
      source
    );
  }

  function readRecents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeRecents(items) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 20)));
  }

  function renderRecents() {
    if (!recentList) return;

    const recents = readRecents();
    recentList.innerHTML = '';

    if (recents.length === 0) {
      if (recentsSection) recentsSection.hidden = true;
      return;
    }

    if (recentsSection) recentsSection.hidden = false;

    const fragment = document.createDocumentFragment();
    for (const raw of recents) {
      const entry = resolveStoredEntry(raw);
      const display = resolveSkinToneEntry(entry);

      const li = document.createElement('li');
      li.className = 'emoji';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'emoji-copy';
      button.setAttribute('aria-label', `Copy ${display.annotation}`);
      button.dataset.copyLabel = display.annotation;
      button.dataset.copyValue = formatCopyValue(state.copy, display);
      button.dataset.copyFormat = state.copy;
      button.dataset.emoji = display.emoji;
      button.dataset.hex = display.hexLower;
      button.dataset.group = display.group;
      button.dataset.subgroup = display.subgroup;
      button.dataset.route = display.detailRoute;

      const img = document.createElement('img');
      const asset = resolveAsset(display);
      img.src = asset.src;
      img.alt = display.annotation;
      img.width = 48;
      img.height = 48;
      img.loading = 'lazy';
      img.dataset.cdnSrc = asset.cdn;
      img.dataset.hex = display.hexLower;

      button.appendChild(img);

      const divider = document.createElement('hr');
      const link = document.createElement('a');
      link.href = `/${display.detailRoute}`;
      const small = document.createElement('small');
      small.textContent = display.annotation;
      link.appendChild(small);
      const favorite = createFavoriteButton(display);

      li.appendChild(button);
      li.appendChild(divider);
      li.appendChild(link);
      li.appendChild(favorite);

      fragment.appendChild(li);
    }

    recentList.appendChild(fragment);
    syncFavoriteButtons();
  }

  function renderFavorites() {
    if (!favoriteList) return;

    const favorites = readFavorites();
    favoriteList.innerHTML = '';

    if (favorites.length === 0) {
      if (favoritesSection) favoritesSection.hidden = true;
      return;
    }

    if (favoritesSection) favoritesSection.hidden = false;

    const fragment = document.createDocumentFragment();
    for (const raw of favorites) {
      const entry = resolveStoredEntry(raw);
      const display = resolveSkinToneEntry(entry);

      const li = document.createElement('li');
      li.className = 'emoji';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'emoji-copy';
      button.setAttribute('aria-label', `Copy ${display.annotation}`);
      button.dataset.copyLabel = display.annotation;
      button.dataset.copyValue = formatCopyValue(state.copy, display);
      button.dataset.copyFormat = state.copy;
      button.dataset.emoji = display.emoji;
      button.dataset.hex = display.hexLower;
      button.dataset.group = display.group;
      button.dataset.subgroup = display.subgroup;
      button.dataset.route = display.detailRoute;

      const img = document.createElement('img');
      const asset = resolveAsset(display);
      img.src = asset.src;
      img.alt = display.annotation;
      img.width = 48;
      img.height = 48;
      img.loading = 'lazy';
      img.dataset.cdnSrc = asset.cdn;
      img.dataset.hex = display.hexLower;
      button.appendChild(img);

      const divider = document.createElement('hr');
      const link = document.createElement('a');
      link.href = `/${display.detailRoute}`;
      const small = document.createElement('small');
      small.textContent = display.annotation;
      link.appendChild(small);
      const favorite = createFavoriteButton(display);

      li.appendChild(button);
      li.appendChild(divider);
      li.appendChild(link);
      li.appendChild(favorite);
      fragment.appendChild(li);
    }

    favoriteList.appendChild(fragment);
    syncFavoriteButtons();
  }

  function addRecentFromButton(button) {
    const detailRoute = button.dataset.route;
    if (!detailRoute) return;

    const next = snapshotEntry(
      entryByRoute.get(detailRoute) || {
        emoji: button.dataset.emoji,
        hexcode: button.dataset.hex,
        annotation: button.dataset.copyLabel || 'emoji',
        group: button.dataset.group,
        subgroup: button.dataset.subgroup,
        detailRoute,
        tags: '',
        useLocalAsset: button.dataset.group !== 'component',
        baseHex: button.dataset.hex,
        isVariant: false,
        skintone: 0,
      }
    );

    const prev = readRecents().filter((item) => item.detailRoute !== detailRoute);
    prev.unshift(next);
    writeRecents(prev);
    renderRecents();
  }

  function handleKeyNavigation(event) {
    if (event.key === 'Escape' && advancedMenu && !advancedMenu.hidden) {
      closeAdvancedMenu();
      return;
    }

    const activeElement = document.activeElement;
    const activeTag = activeElement?.tagName?.toLowerCase() || '';
    const inEditableContext =
      activeTag === 'input' ||
      activeTag === 'textarea' ||
      activeTag === 'select' ||
      Boolean(activeElement?.isContentEditable);

    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !inEditableContext
    ) {
      event.preventDefault();
      searchInput.focus();
      return;
    }

    if ((event.key === 'f' || event.key === 'F') && activeElement?.classList?.contains('emoji-copy')) {
      event.preventDefault();
      toggleFavoriteFromButton(activeElement, 'keyboard');
      return;
    }

    if (!currentResultButtons.length) return;

    const activeIndex = currentResultButtons.indexOf(activeElement);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      const nextIndex = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, currentResultButtons.length - 1);
      currentResultButtons[nextIndex].focus();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      const prevIndex = activeIndex < 0 ? 0 : Math.max(activeIndex - 1, 0);
      currentResultButtons[prevIndex].focus();
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && document.activeElement === searchInput) {
      state.q = searchInput.value.trim();
      renderExplorer(true, true);
    }
  }

  function scheduleSearchRender() {
    if (searchDebounce) {
      window.clearTimeout(searchDebounce);
    }

    searchDebounce = window.setTimeout(() => {
      state.q = searchInput.value.trim();
      renderExplorer(false, false);
      searchDebounce = null;
    }, SEARCH_DEBOUNCE_MS);
  }

  function setupInfiniteObserver() {
    if (!resultsSentinel || !('IntersectionObserver' in window)) {
      return;
    }

    if (observer) {
      observer.disconnect();
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (currentLevel() !== 'emoji') return;

        for (const entry of entries) {
          if (entry.isIntersecting && hasMoreResults()) {
            appendResultChunk();
          }
        }
      },
      {
        rootMargin: '280px 0px 280px 0px',
        threshold: 0,
      }
    );

    observer.observe(resultsSentinel);
  }

  function openAdvancedMenu() {
    if (!advancedMenu) return;
    advancedMenu.hidden = false;
    if (advancedBackdrop) advancedBackdrop.hidden = false;
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
  }

  function closeAdvancedMenu() {
    if (!advancedMenu) return;
    advancedMenu.hidden = true;
    if (advancedBackdrop) advancedBackdrop.hidden = true;
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  function bindInteractions() {
    const searchForm = searchInput.closest('form');

    window.addEventListener('popstate', () => {
      state = parseUiState(window.location.search, localStorage.getItem(COPY_MODE_KEY) || 'emoji');
      applyStateToControls();
      renderExplorer(false, false);
      renderFavorites();
      renderRecents();
    });

    searchInput.addEventListener('input', scheduleSearchRender);
    searchInput.addEventListener('change', () => {
      state.q = searchInput.value.trim();
      renderExplorer(true, true);
    });

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        state.q = searchInput.value.trim();
        renderExplorer(true, true);
      });
    }

    groupFilter.addEventListener('change', () => {
      state.g = groupFilter.value;
      state.sg = '';
      populateSubgroups(state.g);
      renderExplorer(true, true);
    });

    subgroupFilter.addEventListener('change', () => {
      state.sg = subgroupFilter.value;
      renderExplorer(true, true);
    });

    copyMode.addEventListener('change', () => {
      state.copy = copyMode.value;
      renderExplorer(true, true);
      renderRecents();
      renderFavorites();
    });

    if (skinToneMode) {
      skinToneMode.addEventListener('change', () => {
        defaultSkinTone = skinToneMode.value;
        renderExplorer(true, true);
        renderFavorites();
        renderRecents();
      });
    }

    clearButton.addEventListener('click', () => {
      state = { q: '', g: '', sg: '', copy: state.copy };
      searchInput.value = '';
      applyStateToControls();
      renderExplorer(true, true);
    });

    panelHome.addEventListener('click', () => {
      state.g = '';
      state.sg = '';
      applyStateToControls();
      renderExplorer(true, true);
    });

    if (loadMoreButton) {
      loadMoreButton.addEventListener('click', () => {
        appendResultChunk();
      });
    }

    if (menuToggle && advancedMenu) {
      menuToggle.addEventListener('click', () => {
        if (advancedMenu.hidden) {
          openAdvancedMenu();
        } else {
          closeAdvancedMenu();
        }
      });
    }

    if (advancedClose) {
      advancedClose.addEventListener('click', closeAdvancedMenu);
    }

    if (advancedBackdrop) {
      advancedBackdrop.addEventListener('click', closeAdvancedMenu);
    }

    resultsList.addEventListener('keydown', handleKeyNavigation);
    document.addEventListener('keydown', handleKeyNavigation);

    const favoriteClickHandler = (event) => {
      const button = event.target.closest('.emoji-favorite');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteFromButton(button, 'click');
    };

    resultsList.addEventListener('click', favoriteClickHandler);
    if (recentList) {
      recentList.addEventListener('click', favoriteClickHandler);
    }
    if (favoriteList) {
      favoriteList.addEventListener('click', favoriteClickHandler);
    }

    document.addEventListener('emoji:copied', (event) => {
      const trigger = event.detail?.trigger;
      if (!trigger || !trigger.dataset || !trigger.dataset.route) {
        return;
      }
      addRecentFromButton(trigger);
    });
  }

  function initWithEntries(entries) {
    initializeData(entries);
    refreshFavoriteSet();
    populateGroups();
    applyStateToControls();
    renderExplorer(false, false);
    renderFavorites();
    renderRecents();
    syncFavoriteButtons();
    setupInfiniteObserver();
  }

  function loadData() {
    return fetch('home-data.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((rows) => {
        if (!Array.isArray(rows)) throw new Error('home-data.json must be array');
        return rows;
      })
      .catch(() =>
        fetch('grouped-openmoji.json')
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((groupedData) => flattenGroupedData(groupedData))
      );
  }

  bindInteractions();

  loadData()
    .then((rows) => {
      initWithEntries(rows);
    })
    .catch(() => {
      if (resultsCount) {
        resultsCount.textContent = 'Unable to load emoji data.';
      }
    });
})();
