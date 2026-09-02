/**
 * Favorites state with localStorage sync using Svelte 5 runes.
 *
 * Stores an array of emoji hex codes (max 40).
 * Storage key: 'recentEmojis' was used by old site for recents;
 * favorites uses 'favoriteEmojisV1' to avoid conflicts.
 */

const STORAGE_KEY = 'favoriteEmojisV1';
const MAX_FAVORITES = 40;

function loadFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveToStorage(hexes: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hexes));
  } catch {
    // Ignore quota errors
  }
}

let favorites = $state<string[]>(loadFromStorage());

export function getFavorites(): string[] {
  return favorites;
}

export function toggleFavorite(hex: string): void {
  const index = favorites.indexOf(hex);
  if (index >= 0) {
    favorites = favorites.filter((h) => h !== hex);
  } else {
    favorites = [hex, ...favorites].slice(0, MAX_FAVORITES);
  }
  saveToStorage(favorites);
}

export function isFavorite(hex: string): boolean {
  return favorites.includes(hex);
}

export function clearFavorites(): void {
  favorites = [];
  saveToStorage(favorites);
}
