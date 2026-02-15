import {
  COPY_MODES,
  detailRouteFromEmoji,
  formatCopyValue,
  humanize,
  normalizeHex,
  parseUiState,
  toSearchParams,
} from './home-utils.mjs';

(function () {
  const searchInput = document.getElementById('search');
  const groupFilter = document.getElementById('group-filter');
  const subgroupFilter = document.getElementById('subgroup-filter');
  const copyMode = document.getElementById('copy-mode');
  const clearButton = document.getElementById('clear-filters');
  const resultsCount = document.getElementById('results-count');
  const resultsList = document.getElementById('home-results');
  const resultsSentinel = document.getElementById('results-sentinel');
  const loadMoreButton = document.getElementById('results-load-more');
  const recentList = document.getElementById('recent-results');

  if (!searchInput || !groupFilter || !subgroupFilter || !copyMode || !resultsList) {
    return;
  }

  const RECENT_KEY = 'recentEmojisV2';
  const COPY_MODE_KEY = 'copyMode';
  const CHUNK_MIN = 72;
  const CHUNK_MAX = 220;
  const SEARCH_INPUT_DEBOUNCE_MS = 90;

  let allEntries = [];
  let subgroupsByGroup = new Map();
  let filteredEntries = [];
  let renderedCount = 0;
  let currentResultButtons = [];
  let observer = null;
  let searchDebounce = null;
  let state = parseUiState(window.location.search, localStorage.getItem(COPY_MODE_KEY) || 'emoji');

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

  function isVariant(entry) {
    if (entry.group === 'component') return true;
    if (entry.skintone || entry.skintone_combination) return true;
    if (entry.skintone_base_hexcode && entry.skintone_base_hexcode.toLowerCase() !== entry.hexLower) return true;
    return /\\bfacing right\\b/i.test(entry.annotation || '') || /^(man|woman)\\b/i.test(entry.annotation || '');
  }

  function resolveAsset(entry) {
    const upperHex = entry.hexLower.toUpperCase();
    const local = `/assets/emoji/base/${upperHex}.svg`;
    const cdn = `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${upperHex}.svg`;

    if (entry.useLocalAsset || (!isVariant(entry) && entry.group !== 'component')) {
      return { src: local, cdn };
    }

    return { src: cdn, cdn };
  }

  function persistState(pushHistory = true) {
    localStorage.setItem(COPY_MODE_KEY, state.copy);

    const query = toSearchParams(state);
    const target = query ? `?${query}` : window.location.pathname;

    if (pushHistory) {
      window.history.pushState({}, '', target);
    } else {
      window.history.replaceState({}, '', target);
    }
  }

  function normalizeEntry(entry) {
    const hexLower = normalizeHex(entry.hexLower || entry.hexcode || '');
    const normalized = {
      ...entry,
      annotation: (entry.annotation || '').trim(),
      group: entry.group,
      subgroup: entry.subgroup,
      hexcode: entry.hexcode || hexLower,
      hexLower,
      detailRoute: entry.detailRoute || detailRouteFromEmoji(entry),
      tags: Array.isArray(entry.tags) ? entry.tags.join(' ') : String(entry.tags || ''),
      useLocalAsset: Boolean(entry.useLocalAsset),
    };

    normalized.searchText = [
      normalized.annotation,
      normalized.tags,
      normalized.group,
      normalized.subgroup,
      normalized.hexLower,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return normalized;
  }

  function flattenGroupedData(groupedData) {
    const rows = [];
    for (const [group, subgroups] of Object.entries(groupedData)) {
      for (const [subgroup, emojis] of Object.entries(subgroups)) {
        for (const emoji of emojis) {
          rows.push(normalizeEntry({ ...emoji, group, subgroup }));
        }
      }
    }
    return rows;
  }

  function setupGroupMaps(entries) {
    subgroupsByGroup = new Map();
    for (const entry of entries) {
      if (!subgroupsByGroup.has(entry.group)) {
        subgroupsByGroup.set(entry.group, new Set());
      }
      subgroupsByGroup.get(entry.group).add(entry.subgroup);
    }
  }

  function populateGroups() {
    const groups = Array.from(subgroupsByGroup.keys()).sort((a, b) => a.localeCompare(b));
    groupFilter.innerHTML = '<option value="">All Categories</option>';

    for (const group of groups) {
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

    const subgroups = Array.from(subgroupsByGroup.get(group)).sort((a, b) => a.localeCompare(b));
    for (const subgroup of subgroups) {
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
  }

  function filterEntries() {
    const query = state.q.toLowerCase();

    return allEntries.filter((entry) => {
      if (state.g && entry.group !== state.g) return false;
      if (state.sg && entry.subgroup !== state.sg) return false;
      if (!query) return true;
      return entry.searchText.includes(query);
    });
  }

  function entryToCard(entry) {
    const li = document.createElement('li');
    li.className = 'emoji';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-copy';
    button.setAttribute('aria-label', `Copy ${entry.annotation}`);
    button.dataset.copyLabel = entry.annotation;
    button.dataset.copyValue = formatCopyValue(state.copy, entry);
    button.dataset.copyFormat = state.copy;
    button.dataset.emoji = entry.emoji;
    button.dataset.hex = entry.hexLower;
    button.dataset.group = entry.group;
    button.dataset.subgroup = entry.subgroup;
    button.dataset.route = entry.detailRoute;

    const img = document.createElement('img');
    const asset = resolveAsset(entry);
    img.src = asset.src;
    img.alt = entry.annotation;
    img.width = 48;
    img.height = 48;
    img.loading = 'lazy';
    img.dataset.cdnSrc = asset.cdn;
    img.dataset.hex = entry.hexLower;

    button.appendChild(img);

    const divider = document.createElement('hr');

    const link = document.createElement('a');
    link.href = `/${entry.detailRoute}`;
    const small = document.createElement('small');
    small.textContent = entry.annotation;
    link.appendChild(small);

    li.appendChild(button);
    li.appendChild(divider);
    li.appendChild(link);

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
      resultsCount.textContent = 'No results found. Adjust filters or search terms.';
      return;
    }

    const showing = Math.min(renderedCount, filteredEntries.length);
    const total = filteredEntries.length;
    if (showing < total) {
      resultsCount.textContent = `${total} results, showing ${showing}. Scroll to load more.`;
      return;
    }

    resultsCount.textContent = `${total} result${total === 1 ? '' : 's'} loaded.`;
  }

  function updateLoadControls() {
    const showLoad = hasMoreResults();

    if (loadMoreButton) {
      loadMoreButton.hidden = !showLoad;
    }

    if (resultsSentinel) {
      resultsSentinel.hidden = !showLoad;
    }
  }

  function appendResultChunk() {
    if (filteredEntries.length === 0 || !hasMoreResults()) {
      updateResultStatus();
      updateLoadControls();
      return;
    }

    const chunkSize = computeChunkSize();
    const nextCount = Math.min(filteredEntries.length, renderedCount + chunkSize);
    const fragment = document.createDocumentFragment();

    for (let index = renderedCount; index < nextCount; index += 1) {
      fragment.appendChild(entryToCard(filteredEntries[index]));
    }

    resultsList.appendChild(fragment);
    renderedCount = nextCount;

    updateKeyboardCollection();
    updateResultStatus();
    updateLoadControls();
  }

  function renderEmptyState() {
    resultsList.innerHTML = '';
    const empty = document.createElement('li');
    empty.className = 'emoji-empty';
    empty.textContent = 'No matching emojis found.';
    resultsList.appendChild(empty);
    renderedCount = 0;
    updateKeyboardCollection();
    updateResultStatus();
    updateLoadControls();
  }

  function emitAnalytics() {
    if (state.q) {
      track('search', {
        source: window.location.pathname,
        hex: '',
        group: state.g || 'all',
        subgroup: state.sg || 'all',
        format: state.copy,
        query_length: String(state.q.length),
        results: String(filteredEntries.length),
      });
    }

    track('filter', {
      source: window.location.pathname,
      hex: '',
      group: state.g || 'all',
      subgroup: state.sg || 'all',
      format: state.copy,
      copy: state.copy,
      results: String(filteredEntries.length),
    });
  }

  function renderResults(pushHistory = true, emit = false) {
    persistState(pushHistory);

    filteredEntries = filterEntries();
    resultsList.innerHTML = '';
    renderedCount = 0;

    if (filteredEntries.length === 0) {
      renderEmptyState();
    } else {
      appendResultChunk();
    }

    if (emit) {
      emitAnalytics();
    }
  }

  function readRecents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(parsed)) return parsed;
      return [];
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
      const empty = document.createElement('li');
      empty.className = 'emoji-empty';
      empty.textContent = 'No recent emojis yet.';
      recentList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of recents) {
      fragment.appendChild(entryToCard(normalizeEntry(item)));
    }
    recentList.appendChild(fragment);
  }

  function addRecentFromButton(button) {
    const detailRoute = button.dataset.route;
    if (!detailRoute) return;

    const next = {
      emoji: button.dataset.emoji,
      hexcode: button.dataset.hex,
      annotation: button.dataset.copyLabel || 'emoji',
      group: button.dataset.group,
      subgroup: button.dataset.subgroup,
      detailRoute,
      tags: '',
      useLocalAsset: button.dataset.group !== 'component',
    };

    const prev = readRecents().filter((item) => item.detailRoute !== detailRoute);
    prev.unshift(next);
    writeRecents(prev);
    renderRecents();
  }

  function handleKeyNavigation(event) {
    if (!currentResultButtons.length) return;

    const activeIndex = currentResultButtons.indexOf(document.activeElement);

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
      renderResults(true, true);
    }
  }

  function scheduleSearchRender() {
    if (searchDebounce) {
      window.clearTimeout(searchDebounce);
    }

    searchDebounce = window.setTimeout(() => {
      state.q = searchInput.value.trim();
      renderResults(false, false);
      searchDebounce = null;
    }, SEARCH_INPUT_DEBOUNCE_MS);
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

  function bindInteractions() {
    window.addEventListener('popstate', () => {
      state = parseUiState(window.location.search, localStorage.getItem(COPY_MODE_KEY) || 'emoji');
      applyStateToControls();
      renderResults(false, false);
    });

    groupFilter.addEventListener('change', () => {
      state.g = groupFilter.value;
      state.sg = '';
      populateSubgroups(state.g);
      renderResults(true, true);
    });

    subgroupFilter.addEventListener('change', () => {
      state.sg = subgroupFilter.value;
      renderResults(true, true);
    });

    searchInput.addEventListener('input', () => {
      scheduleSearchRender();
    });

    searchInput.addEventListener('change', () => {
      state.q = searchInput.value.trim();
      renderResults(true, true);
    });

    copyMode.addEventListener('change', () => {
      state.copy = copyMode.value;
      renderResults(true, true);
      renderRecents();
    });

    clearButton.addEventListener('click', () => {
      state = { q: '', g: '', sg: '', copy: state.copy };
      applyStateToControls();
      renderResults(true, true);
    });

    if (loadMoreButton) {
      loadMoreButton.addEventListener('click', () => {
        appendResultChunk();
      });
    }

    resultsList.addEventListener('keydown', handleKeyNavigation);
    document.addEventListener('keydown', handleKeyNavigation);

    document.addEventListener('emoji:copied', (event) => {
      const trigger = event.detail?.trigger;
      if (!trigger || !trigger.dataset || !trigger.dataset.route) {
        return;
      }
      addRecentFromButton(trigger);
    });

    window.addEventListener('resize', () => {
      updateResultStatus();
    });
  }

  function initWithEntries(entries) {
    allEntries = entries.map((entry) => normalizeEntry(entry));
    setupGroupMaps(allEntries);
    populateGroups();
    applyStateToControls();
    renderResults(false, false);
    renderRecents();
    setupInfiniteObserver();
  }

  function loadData() {
    return fetch('home-data.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((rows) => {
        if (!Array.isArray(rows)) {
          throw new Error('home-data.json must be an array');
        }
        return rows;
      })
      .catch(() =>
        fetch('grouped-openmoji.json')
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
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
      resultsCount.textContent = 'Unable to load emoji data.';
    });
})();
