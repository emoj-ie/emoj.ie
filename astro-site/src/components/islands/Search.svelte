<script lang="ts">
  import { loadSearchData } from '../../lib/search/index';
  import { filterAndRankEntries, type SearchEntry } from '../../lib/search/engine';

  let query = $state('');
  let results = $state<SearchEntry[]>([]);
  let isOpen = $state(false);
  let isLoading = $state(false);
  let dataLoaded = $state(false);
  let searchData: SearchEntry[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inputEl: HTMLInputElement | undefined = $state();
  let containerEl: HTMLDivElement | undefined = $state();

  async function ensureDataLoaded() {
    if (dataLoaded) return;
    isLoading = true;
    try {
      searchData = await loadSearchData();
      dataLoaded = true;
    } catch (err) {
      console.error('Failed to load search data:', err);
    } finally {
      isLoading = false;
    }
  }

  function performSearch() {
    if (!query.trim()) {
      results = [];
      isOpen = false;
      return;
    }

    if (!dataLoaded) return;

    const matched = filterAndRankEntries(searchData, query);
    results = matched.slice(0, 20);
    isOpen = results.length > 0;
  }

  function handleInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch();
    }, 150);
  }

  async function handleFocus() {
    await ensureDataLoaded();
    if (query.trim() && results.length > 0) {
      isOpen = true;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      query = '';
      results = [];
      isOpen = false;
      inputEl?.blur();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  function getResultImgSrc(entry: SearchEntry): string {
    const hex = String(entry.hexcode || entry.hexLower || '').toUpperCase();
    if (entry.useLocalAsset !== false) {
      return `/assets/emoji/base/${hex}.svg`;
    }
    return `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${hex}.svg`;
  }

  function getResultLink(entry: SearchEntry): string {
    if (entry.detailRoute) {
      // Search data has old format: "emoji/grinning-face--1f3a8/"
      // Astro pages use: /emoji/grinning-face/ (no hex suffix)
      // Strip the --hexcode suffix to match.
      let route = String(entry.detailRoute);
      if (!route.startsWith('/')) route = `/${route}`;
      return route.replace(/--[0-9a-f][-0-9a-f]*\//i, '/');
    }
    return '/';
  }

  // Register click-outside listener
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="search-island" bind:this={containerEl}>
  <div class="header-search" role="search">
    <input
      bind:this={inputEl}
      type="search"
      placeholder="Search emojis..."
      aria-label="Search emojis"
      autocomplete="off"
      value={query}
      oninput={handleInput}
      onfocus={handleFocus}
      onkeydown={handleKeydown}
    />
    <span class="header-search-icon" aria-hidden="true">&#x1F50D;</span>
  </div>

  {#if isLoading && query.trim()}
    <div class="search-overlay">
      <div class="search-loading">Loading search data...</div>
    </div>
  {/if}

  {#if isOpen && results.length > 0}
    <div class="search-overlay" role="listbox" aria-label="Search results">
      {#each results as entry (entry.hexcode || entry.hexLower)}
        <a
          href={getResultLink(entry)}
          class="search-result"
          role="option"
        >
          <img
            src={getResultImgSrc(entry)}
            alt=""
            width="28"
            height="28"
            loading="lazy"
            class="search-result-img"
          />
          <span class="search-result-text">
            <span class="search-result-emoji" aria-hidden="true">{entry.emoji || ''}</span>
            <span class="search-result-name">{entry.annotation || ''}</span>
          </span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search-island {
    position: relative;
    flex: 1;
    min-width: 0;
    max-width: 32rem;
  }

  .header-search {
    display: flex;
    align-items: center;
    position: relative;
  }

  .header-search input {
    width: 100%;
    padding: 0.5rem 2.25rem 0.5rem 0.75rem;
    border: 1px solid var(--border-default, #ddd);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-family: inherit;
    background: var(--bg-surface, #fff);
    color: var(--text-body, #333);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .header-search input:focus {
    border-color: var(--color-accent, #3b82f6);
    box-shadow: 0 0 0 2px var(--color-accent-subtle, rgba(59, 130, 246, 0.15));
  }

  .header-search-icon {
    position: absolute;
    right: 0.6rem;
    pointer-events: none;
    font-size: 1rem;
    line-height: 1;
  }

  .search-overlay {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    margin-top: 0.25rem;
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-default, #ddd);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 24rem;
    overflow-y: auto;
  }

  .search-loading {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted, #888);
    font-size: 0.9rem;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    text-decoration: none;
    color: var(--text-body, #333);
    transition: background-color 0.1s ease;
  }

  .search-result:hover {
    background-color: var(--bg-hover, #f5f5f5);
  }

  .search-result-img {
    flex-shrink: 0;
    object-fit: contain;
  }

  .search-result-text {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .search-result-emoji {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .search-result-name {
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: capitalize;
  }
</style>
