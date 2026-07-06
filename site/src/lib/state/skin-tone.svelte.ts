/**
 * Skin tone preference state with localStorage sync using Svelte 5 runes.
 *
 * Stores the user's default skin tone preference.
 * Empty string = no preference (default yellow).
 */

const STORAGE_KEY = 'skinTone';

function loadFromStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    // Ignore storage errors
  }
  return '';
}

function saveToStorage(tone: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tone);
  } catch {
    // Ignore quota errors
  }
}

let skinTone = $state<string>(loadFromStorage());

export function getSkinTone(): string {
  return skinTone;
}

export function setSkinTone(tone: string): void {
  skinTone = tone;
  saveToStorage(tone);
}
