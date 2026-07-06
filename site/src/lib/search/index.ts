/**
 * Search data management.
 *
 * Lazily loads /home-data.json on first user interaction,
 * pre-builds search index for each entry, and caches the result.
 */

import { buildEntrySearchIndex, type SearchEntry } from './engine';

let cachedData: SearchEntry[] | null = null;
let loadPromise: Promise<SearchEntry[]> | null = null;

/**
 * Lazily fetch and index search data.
 * Only fetches once; subsequent calls return cached data.
 */
export async function loadSearchData(): Promise<SearchEntry[]> {
  if (cachedData) return cachedData;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const response = await fetch('/home-data.json');
    if (!response.ok) {
      throw new Error(`Failed to load search data: ${response.status}`);
    }

    const raw: SearchEntry[] = await response.json();

    // Pre-build search index for each entry
    for (const entry of raw) {
      entry.searchIndex = buildEntrySearchIndex(entry);
    }

    cachedData = raw;
    return raw;
  })();

  return loadPromise;
}
