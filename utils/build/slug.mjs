const NON_ASCII_MARKS = /\p{Diacritic}/gu;
const NON_SLUG_CHARS = /[^a-z0-9\s-]/g;
const WHITESPACE = /\s+/g;
const DASH_RUNS = /-+/g;

export function normalizeHex(hexcode = '') {
  return String(hexcode).trim().toLowerCase().replace(/\s+/g, '-');
}

export function formatHexForAsset(hexcode = '') {
  return normalizeHex(hexcode).toUpperCase();
}

export function humanizeSlug(value = '') {
  return String(value)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(input = '') {
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

export function toBaseAnnotationKey(annotation = '') {
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

export function isLikelyVariantAnnotation(annotation = '') {
  const value = String(annotation).toLowerCase();
  return (
    value.includes('skin tone') ||
    value.includes('facing right') ||
    /^man\s/.test(value) ||
    /^woman\s/.test(value)
  );
}

export function routeFromPath(pathname = '') {
  return String(pathname)
    .replace(/\\/g, '/')
    .replace(/^\//, '')
    .replace(/index\.html$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

export function routeToFile(route = '') {
  const clean = String(route).replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${clean}/index.html` : 'index.html';
}

export function ensureTrailingSlash(route = '') {
  const clean = String(route).replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${clean}/` : '';
}

export function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
