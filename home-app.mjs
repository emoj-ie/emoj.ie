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
  const recentList = document.getElementById('recent-results');

  if (!searchInput || !groupFilter || !subgroupFilter || !copyMode || !resultsList) {
    return;
  }

  const RECENT_KEY = 'recentEmojisV2';
  const COPY_MODE_KEY = 'copyMode';

  let allEntries = [];
  let grouped = {};
  let state = parseUiState(window.location.search, localStorage.getItem(COPY_MODE_KEY) || 'emoji');
  let currentResultButtons = [];

  function track(eventName, props) {
    if (typeof window.plausible !== 'function') return;
    window.plausible(eventName, { props: props || {} });
  }

  function isVariant(entry) {
    if (entry.group === 'component') return true;
    if (entry.skintone || entry.skintone_combination) return true;
    if (entry.skintone_base_hexcode && entry.skintone_base_hexcode.toLowerCase() !== entry.hexLower) return true;
    return /\\bfacing right\\b/i.test(entry.annotation || '') || /^(man|woman)\\b/i.test(entry.annotation || '');
  }

  function resolveAsset(entry) {
    const upperHex = entry.hexLower.toUpperCase();
    if (!isVariant(entry) && entry.group !== 'component') {
      return {
        src: `/assets/emoji/base/${upperHex}.svg`,
        cdn: `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${upperHex}.svg`,
      };
    }

    const cdn = `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${upperHex}.svg`;
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

  function flattenData(data) {
    const rows = [];
    for (const [group, subgroups] of Object.entries(data)) {
      for (const [subgroup, emojis] of Object.entries(subgroups)) {
        for (const emoji of emojis) {
          const hexLower = normalizeHex(emoji.hexcode);
          rows.push({
            ...emoji,
            group,
            subgroup,
            hexLower,
            useLocalAsset: !isVariant({ ...emoji, group, subgroup, hexLower }),
            detailRoute: detailRouteFromEmoji({ ...emoji, group, subgroup }),
          });
        }
      }
    }
    return rows;
  }

  function populateGroups() {
    const groups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    for (const group of groups) {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = humanize(group);
      groupFilter.appendChild(option);
    }
  }

  function populateSubgroups(group) {
    subgroupFilter.innerHTML = '<option value="">All Subcategories</option>';

    if (!group || !grouped[group]) {
      subgroupFilter.disabled = true;
      return;
    }

    const subgroups = Object.keys(grouped[group]).sort((a, b) => a.localeCompare(b));
    for (const subgroup of subgroups) {
      const option = document.createElement('option');
      option.value = subgroup;
      option.textContent = humanize(subgroup);
      subgroupFilter.appendChild(option);
    }

    subgroupFilter.disabled = false;
  }

  function filterEntries() {
    const query = state.q.toLowerCase();

    return allEntries.filter((entry) => {
      if (state.g && entry.group !== state.g) return false;
      if (state.sg && entry.subgroup !== state.sg) return false;
      if (!query) return true;

      const haystack = [entry.annotation, entry.tags, entry.group, entry.subgroup]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
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

  function renderResults(pushHistory = true, emitAnalytics = false) {
    persistState(pushHistory);

    const filtered = filterEntries();
    const limited = filtered.slice(0, 400);

    resultsList.innerHTML = '';
    for (const entry of limited) {
      resultsList.appendChild(entryToCard(entry));
    }

    updateKeyboardCollection();

    const suffix = filtered.length > limited.length ? ` (showing first ${limited.length})` : '';
    resultsCount.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'}${suffix}`;

    if (emitAnalytics) {
      if (state.q) {
        track('search', {
          source: window.location.pathname,
          hex: '',
          group: state.g || 'all',
          subgroup: state.sg || 'all',
          format: state.copy,
          query_length: String(state.q.length),
          results: String(filtered.length),
        });
      }

      track('filter', {
        source: window.location.pathname,
        hex: '',
        group: state.g || 'all',
        subgroup: state.sg || 'all',
        format: state.copy,
        copy: state.copy,
        results: String(filtered.length),
      });
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
      const empty = document.createElement('p');
      empty.className = 'recent-empty';
      empty.textContent = 'No recent emojis yet.';
      recentList.appendChild(empty);
      return;
    }

    for (const item of recents) {
      recentList.appendChild(entryToCard(item));
    }
  }

  function addRecentFromButton(button) {
    const detailRoute = button.dataset.route;
    if (!detailRoute) return;

    const next = {
      emoji: button.dataset.emoji,
      hexcode: button.dataset.hex,
      hexLower: button.dataset.hex,
      annotation: button.dataset.copyLabel || button.dataset.label || 'emoji',
      group: button.dataset.group,
      subgroup: button.dataset.subgroup,
      detailRoute,
      tags: '',
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
    }
  }

  window.addEventListener('popstate', () => {
    state = parseUiState(window.location.search, localStorage.getItem(COPY_MODE_KEY) || 'emoji');
    applyStateToControls();
    renderResults(false);
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
    state.q = searchInput.value.trim();
    renderResults(false);
  });

  searchInput.addEventListener('change', () => {
    state.q = searchInput.value.trim();
    renderResults(true, true);
  });

  copyMode.addEventListener('change', () => {
    state.copy = copyMode.value;
    renderResults(true, true);
  });

  clearButton.addEventListener('click', () => {
    state = { q: '', g: '', sg: '', copy: state.copy };
    applyStateToControls();
    renderResults(true, true);
  });

  resultsList.addEventListener('keydown', handleKeyNavigation);

  document.addEventListener('emoji:copied', (event) => {
    const trigger = event.detail?.trigger;
    if (!trigger || !trigger.dataset || !trigger.dataset.route) {
      return;
    }
    addRecentFromButton(trigger);
  });

  fetch('grouped-openmoji.json')
    .then((response) => response.json())
    .then((data) => {
      grouped = data;
      allEntries = flattenData(grouped);
      populateGroups();
      applyStateToControls();
      renderResults(false);
      renderRecents();
    })
    .catch(() => {
      resultsCount.textContent = 'Unable to load emoji data.';
    });
})();
