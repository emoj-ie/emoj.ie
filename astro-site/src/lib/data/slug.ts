import type { EmojiEntry } from './types';

const NON_ASCII_MARKS = /\p{Diacritic}/gu;
const NON_SLUG_CHARS = /[^a-z0-9\s-]/g;
const WHITESPACE = /\s+/g;
const DASH_RUNS = /-+/g;

export function normalizeHex(hexcode = ''): string {
  return String(hexcode).trim().toLowerCase().replace(/\s+/g, '-');
}

export function slugify(input = ''): string {
  const base = String(input)
    .normalize('NFKD')
    .replace(NON_ASCII_MARKS, '')
    .toLowerCase()
    .replace(NON_SLUG_CHARS, ' ')
    .replace(WHITESPACE, '-')
    .replace(DASH_RUNS, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return base || 'emoji';
}

export function toBaseAnnotationKey(annotation = ''): string {
  let value = String(annotation)
    .normalize('NFKD')
    .replace(NON_ASCII_MARKS, '')
    .toLowerCase();

  // Skin tone variants are represented as "name: ... skin tone".
  value = value.replace(/:\s*[^:]*skin tone\b/g, '');

  // Directional variants usually end in "facing right".
  value = value.replace(/\s+facing right\b/g, '');

  // Gendered variants often have man/woman base forms.
  value = value.replace(/^woman\s+/, 'person ');
  value = value.replace(/^man\s+/, 'person ');

  return value
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

export function isLikelyVariantAnnotation(annotation = ''): boolean {
  const value = String(annotation).toLowerCase();
  return (
    value.includes('skin tone') ||
    value.includes('facing right') ||
    /^man\s/.test(value) ||
    /^woman\s/.test(value)
  );
}

export function ensureTrailingSlash(route = ''): string {
  const clean = String(route).replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${clean}/` : '';
}

/**
 * Build a map from hexLower to unique pageSlug for all non-variant entries.
 * Duplicate slugs get disambiguated with a hex suffix: {slug}-{hexLower}
 */
export function buildSlugMap(entries: EmojiEntry[]): Map<string, string> {
  const nonVariant = entries.filter((e) => !e.isVariant);

  // Count slug frequencies
  const slugCounts = new Map<string, number>();
  for (const entry of nonVariant) {
    const count = slugCounts.get(entry.slug) || 0;
    slugCounts.set(entry.slug, count + 1);
  }

  // Build map with disambiguation
  const result = new Map<string, string>();
  for (const entry of nonVariant) {
    const needsDisambiguation = (slugCounts.get(entry.slug) || 0) > 1;
    const pageSlug = needsDisambiguation
      ? `${entry.slug}-${entry.hexLower}`
      : entry.slug;
    result.set(entry.hexLower, pageSlug);
  }

  return result;
}
