/**
 * Copy mode state with localStorage sync using Svelte 5 runes.
 *
 * Stores the user's preferred copy format: 'emoji' | 'unicode' | 'html' | 'shortcode'.
 */

import type { CopyMode } from '../utils/copy-formats';
import { COPY_MODES } from '../utils/copy-formats';

const STORAGE_KEY = 'copyMode';

function loadFromStorage(): CopyMode {
  if (typeof window === 'undefined') return 'emoji';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (COPY_MODES as readonly string[]).includes(raw)) {
      return raw as CopyMode;
    }
  } catch {
    // Ignore storage errors
  }
  return 'emoji';
}

function saveToStorage(mode: CopyMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore quota errors
  }
}

let copyMode = $state<CopyMode>(loadFromStorage());

export function getCopyMode(): CopyMode {
  return copyMode;
}

export function setCopyMode(mode: CopyMode): void {
  copyMode = mode;
  saveToStorage(mode);
}
