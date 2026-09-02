/**
 * Theme state with localStorage sync using Svelte 5 runes.
 *
 * Three modes: 'light', 'dark', 'system'.
 * On init, reads from localStorage (key: 'theme') or defaults to 'system'.
 * Applies `data-theme` attribute to <html> immediately to prevent flash.
 */

type ThemeValue = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const VALID_THEMES: ThemeValue[] = ['light', 'dark', 'system'];

function loadFromStorage(): ThemeValue {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID_THEMES as string[]).includes(raw)) {
      return raw as ThemeValue;
    }
  } catch {
    // Ignore storage errors
  }
  return 'system';
}

function saveToStorage(value: ThemeValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore quota errors
  }
}

function resolveTheme(theme: ThemeValue): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyThemeToDocument(theme: ThemeValue): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
}

let theme = $state<ThemeValue>(loadFromStorage());

// Apply immediately on load
if (typeof window !== 'undefined') {
  applyThemeToDocument(theme);

  // Listen for system theme changes when in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') {
      applyThemeToDocument(theme);
    }
  });
}

export function getTheme(): ThemeValue {
  return theme;
}

export function setTheme(newTheme: ThemeValue): void {
  theme = newTheme;
  saveToStorage(newTheme);
  applyThemeToDocument(newTheme);
}

export function getResolvedTheme(): 'light' | 'dark' {
  return resolveTheme(theme);
}
