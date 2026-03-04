import { slugify, normalizeHex } from '../data/slug';

export const COPY_MODES = ['emoji', 'unicode', 'html', 'shortcode'] as const;
export type CopyMode = (typeof COPY_MODES)[number];

interface CopyEntry {
  emoji?: string;
  hexLower?: string;
  hexcode?: string;
  annotation?: string;
  slug?: string;
}

export function formatCopyValue(mode: string, entry: CopyEntry): string {
  const safeMode = (COPY_MODES as readonly string[]).includes(mode) ? mode : 'emoji';
  const hexLower = normalizeHex(entry.hexLower || entry.hexcode || '');

  if (safeMode === 'unicode') {
    return hexLower;
  }

  if (safeMode === 'shortcode') {
    return `:${slugify(entry.annotation || hexLower)}:`;
  }

  if (safeMode === 'html') {
    const parts = hexLower.split('-').filter(Boolean);
    return parts.map((part) => `&#x${part.toUpperCase()};`).join('');
  }

  return entry.emoji || '';
}

export function humanize(value = ''): string {
  return String(value)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
