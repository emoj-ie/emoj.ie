/**
 * Recents state with localStorage sync using Svelte 5 runes.
 *
 * Stores an array of recently-copied emoji hex codes (max 20).
 * Storage key: 'recentEmojis' matches the existing site.
 */

const STORAGE_KEY = 'recentEmojis';
const MAX_RECENTS = 20;

function loadFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Old site stored full objects with hexcode property; new site stores hex strings.
        // Handle both formats for migration compatibility.
        return parsed
          .map((v) => {
            if (typeof v === 'string') return v;
            if (v && typeof v === 'object' && typeof v.hexcode === 'string') return v.hexcode.toLowerCase();
            return null;
          })
          .filter((v): v is string => v !== null)
          .slice(0, MAX_RECENTS);
      }
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

let recents = $state<string[]>(loadFromStorage());

export function getRecents(): string[] {
  return recents;
}

export function addRecent(hex: string): void {
  // Remove if already exists, then add to front
  recents = [hex, ...recents.filter((h) => h !== hex)].slice(0, MAX_RECENTS);
  saveToStorage(recents);
}

export function clearRecents(): void {
  recents = [];
  saveToStorage(recents);
}
