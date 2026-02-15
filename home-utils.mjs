const DIACRITIC_RE = /\p{Diacritic}/gu;
const NON_SLUG_RE = /[^a-z0-9\s-]/g;
const SPACE_RE = /\s+/g;
const DASH_RE = /-+/g;

export const COPY_MODES = ['emoji', 'unicode', 'html', 'shortcode'];

export function normalizeHex(hexcode = '') {
  return String(hexcode).trim().toLowerCase().replace(/\s+/g, '-');
}

export function slugify(input = '') {
  const normalized = String(input)
    .normalize('NFKD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .replace(NON_SLUG_RE, ' ')
    .replace(SPACE_RE, '-')
    .replace(DASH_RE, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return normalized || 'emoji';
}

export function parseUiState(search = '', fallbackCopy = 'emoji') {
  const params = new URLSearchParams(search);
  const copy = params.get('copy') || fallbackCopy;

  return {
    q: (params.get('q') || '').trim(),
    g: (params.get('g') || '').trim(),
    sg: (params.get('sg') || '').trim(),
    copy: COPY_MODES.includes(copy) ? copy : 'emoji',
  };
}

export function toSearchParams(state) {
  const params = new URLSearchParams();

  if (state.q) params.set('q', state.q);
  if (state.g) params.set('g', state.g);
  if (state.sg) params.set('sg', state.sg);
  if (state.copy && state.copy !== 'emoji') params.set('copy', state.copy);

  return params.toString();
}

export function detailRouteFromEmoji(entry) {
  const slug = slugify(entry.annotation || entry.hexcode || 'emoji');
  const hexLower = normalizeHex(entry.hexcode || '');
  return `${entry.group}/${entry.subgroup || entry.subgroups}/${slug}--${hexLower}/`;
}

export function formatCopyValue(mode, entry) {
  const safeMode = COPY_MODES.includes(mode) ? mode : 'emoji';
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

export function humanize(value = '') {
  return String(value)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
