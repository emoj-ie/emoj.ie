import { normalizeHex } from './home-utils.mjs';

const DIACRITIC_RE = /\p{Diacritic}/gu;
const TOKEN_SPLIT_RE = /[^a-z0-9]+/g;
const HEX_PART_RE = /^[0-9a-f]{4,6}$/;
const HEX_SEQUENCE_RE = /(?:u\+|0x)?([0-9a-f]{4,6}(?:-[0-9a-f]{4,6})*)/gi;
const EMOJI_QUERY_RE = /\p{Extended_Pictographic}/gu;
const WORD_RE = /[a-z0-9]+/g;

const QUERY_ALIASES = Object.freeze({
  lol: ['laugh', 'joy', 'tears', 'funny', 'rofl', 'lmao', 'haha'],
  lmao: ['laugh', 'joy', 'rofl', 'lol'],
  rofl: ['laugh', 'rolling', 'floor', 'lol'],
  haha: ['laugh', 'joy', 'smile'],
  usa: ['us', 'u.s', 'america', 'american', 'states', 'flag'],
  us: ['usa', 'u.s', 'america', 'american', 'states'],
  uk: ['gb', 'britain', 'british', 'kingdom', 'england', 'flag'],
  gb: ['uk', 'britain', 'british', 'kingdom'],
  poop: ['poo', 'turd', 'shit'],
  poo: ['poop', 'turd'],
  cry: ['sad', 'tears', 'sob'],
  crying: ['cry', 'tears', 'sob'],
  happy: ['smile', 'joy', 'cheerful', 'grin'],
  sad: ['cry', 'tears', 'upset', 'sorrow'],
  love: ['heart', 'romance', 'affection', 'valentine'],
  party: ['celebration', 'birthday', 'confetti', 'tada'],
  money: ['cash', 'bank', 'dollar', 'coin', 'finance'],
  work: ['office', 'business', 'job'],
  weather: ['sun', 'rain', 'cloud', 'snow', 'storm'],
  food: ['meal', 'eat', 'dish', 'snack'],
  drink: ['beverage', 'coffee', 'tea', 'cocktail', 'juice'],
  job: ['work', 'office', 'business', 'career'],
  cat: ['kitty', 'feline'],
  dog: ['puppy', 'canine'],
  plane: ['airplane', 'flight'],
  thumbs: ['thumb', 'hand', 'gesture'],
  smiley: ['smile', 'grin', 'face'],
  smileys: ['smile', 'grin', 'face'],
  ':)': ['smile', 'happy'],
  ':(': ['sad', 'upset'],
  '<3': ['heart', 'love'],
});

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

function normalizeSearchValue(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(DIACRITIC_RE, '')
    .toLowerCase()
    .trim();
}

function stemToken(token = '') {
  const value = String(token);
  if (value.length <= 3) return value;

  if (value.endsWith('ies') && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('ing') && value.length > 5) {
    return value.slice(0, -3);
  }

  if (value.endsWith('ed') && value.length > 4) {
    return value.slice(0, -2);
  }

  if (value.endsWith('es') && value.length > 4) {
    return value.slice(0, -2);
  }

  if (value.endsWith('s') && value.length > 3 && !value.endsWith('ss')) {
    return value.slice(0, -1);
  }

  return value;
}

export function tokenizeSearch(value = '', { minLength = 1 } = {}) {
  return normalizeSearchValue(value)
    .split(TOKEN_SPLIT_RE)
    .map((part) => part.trim())
    .filter((part) => part.length >= minLength);
}

function tokenizeWords(value = '') {
  return normalizeSearchValue(value).match(WORD_RE) || [];
}

function extractHexCandidates(rawQuery = '') {
  const normalized = normalizeSearchValue(rawQuery).replace(/\s+/g, '');
  const matches = new Set();

  for (const token of normalized.match(HEX_SEQUENCE_RE) || []) {
    let value = token.replace(/^u\+|^0x/i, '');
    value = value.replace(/_/g, '-');
    if (!value.includes('-') && value.length > 6 && value.length % 2 === 0) {
      const chunks = value.match(/.{1,4}/g) || [];
      if (chunks.every((chunk) => HEX_PART_RE.test(chunk))) {
        matches.add(chunks.join('-'));
      }
    }

    const parts = value.split('-');
    if (parts.length > 0 && parts.every((part) => HEX_PART_RE.test(part))) {
      matches.add(parts.join('-'));
    }
  }

  for (const token of tokenizeSearch(rawQuery, { minLength: 4 })) {
    const compact = token.replace(/^u\+|^0x/i, '').replace(/_/g, '-');
    if (compact.split('-').every((part) => HEX_PART_RE.test(part))) {
      matches.add(compact);
    }
  }

  return [...matches].map((value) => normalizeHex(value));
}

function buildWeightedQueryTokens(query, queryTokens) {
  const weighted = new Map();

  const addWeight = (token, weight) => {
    if (!token) return;
    const existing = weighted.get(token) || 0;
    if (weight > existing) {
      weighted.set(token, weight);
    }
  };

  for (const token of queryTokens) {
    addWeight(token, 1);
    const stemmed = stemToken(token);
    if (stemmed !== token) {
      addWeight(stemmed, 0.86);
    }
  }

  for (const token of queryTokens) {
    const aliases = QUERY_ALIASES[token] || [];
    for (const alias of aliases) {
      for (const aliasToken of tokenizeWords(alias)) {
        addWeight(aliasToken, 0.64);
        const stemmed = stemToken(aliasToken);
        if (stemmed !== aliasToken) {
          addWeight(stemmed, 0.58);
        }
      }
    }
  }

  return weighted;
}

function getEditDistanceThreshold(token) {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

function withinDistance(source, target, maxDistance = 1) {
  const a = String(source || '');
  const b = String(target || '');

  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > maxDistance) return false;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    let rowMin = Number.POSITIVE_INFINITY;
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
      rowMin = Math.min(rowMin, matrix[row][col]);
    }
    if (rowMin > maxDistance) return false;
  }

  return matrix[rows - 1][cols - 1] <= maxDistance;
}

function hasWordBoundaryMatch(haystack, phrase) {
  if (!haystack || !phrase) return false;
  const source = ` ${haystack} `;
  const needle = ` ${phrase} `;
  return source.includes(needle);
}

function cleanTagTokens(tags) {
  return tokenizeSearch(tags, { minLength: 1 }).filter(
    (token) => !STOPWORDS.has(token) && token.length > 1
  );
}

function buildPrefixedSet(tokens) {
  const set = new Set(tokens);
  for (const token of tokens) {
    const stemmed = stemToken(token);
    if (stemmed && stemmed !== token) {
      set.add(stemmed);
    }
  }
  return set;
}

function findPrefixToken(token, tokenSet) {
  if (token.length <= 3) return false;
  for (const candidate of tokenSet) {
    if (candidate.startsWith(token)) {
      return true;
    }
  }
  return false;
}

function findFuzzyToken(token, tokenSet) {
  const threshold = getEditDistanceThreshold(token);
  if (threshold === 0) return false;

  for (const candidate of tokenSet) {
    if (!candidate || candidate[0] !== token[0]) continue;
    if (Math.abs(candidate.length - token.length) > threshold) continue;
    if (withinDistance(candidate, token, threshold)) {
      return true;
    }
  }
  return false;
}

export function buildEntrySearchIndex(entry) {
  const annotation = normalizeSearchValue(entry.annotation || '');
  const tags = normalizeSearchValue(Array.isArray(entry.tags) ? entry.tags.join(' ') : entry.tags || '');
  const group = normalizeSearchValue(entry.group || '');
  const subgroup = normalizeSearchValue(entry.subgroup || '');
  const hexLower = normalizeHex(entry.hexLower || entry.hexcode || '');
  const emoji = String(entry.emoji || '');

  const annotationTokens = buildPrefixedSet(tokenizeSearch(annotation, { minLength: 1 }));
  const tagTokens = buildPrefixedSet(cleanTagTokens(tags));
  const groupTokens = buildPrefixedSet(tokenizeSearch(group, { minLength: 1 }));
  const subgroupTokens = buildPrefixedSet(tokenizeSearch(subgroup, { minLength: 1 }));
  const hexTokens = new Set(
    [hexLower, hexLower.replace(/-/g, ''), ...tokenizeSearch(hexLower, { minLength: 1 })].filter(Boolean)
  );

  const searchableTokens = new Set([
    ...annotationTokens,
    ...tagTokens,
    ...groupTokens,
    ...subgroupTokens,
    ...hexTokens,
  ]);

  return {
    annotation,
    tags,
    group,
    subgroup,
    hexLower,
    hexCompact: hexLower.replace(/-/g, ''),
    emoji,
    annotationTokens,
    tagTokens,
    groupTokens,
    subgroupTokens,
    searchableTokens,
    searchableText: [annotation, tags, group, subgroup, hexLower].filter(Boolean).join(' '),
  };
}

export function buildQueryContext(rawQuery = '') {
  const query = normalizeSearchValue(rawQuery);
  const queryTokens = tokenizeSearch(query, { minLength: 1 }).slice(0, 8);
  const primaryTokens = queryTokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
  const weightedTokens = buildWeightedQueryTokens(query, primaryTokens);
  const phrase = primaryTokens.join(' ');

  return {
    rawQuery,
    query,
    phrase,
    primaryTokens,
    weightedTokens,
    emojiChars: [...new Set(String(rawQuery).match(EMOJI_QUERY_RE) || [])],
    hexCandidates: extractHexCandidates(rawQuery),
  };
}

export function scoreEntryAgainstQuery(entry, queryContext) {
  const index = entry.searchIndex || buildEntrySearchIndex(entry);
  const {
    query,
    phrase,
    primaryTokens,
    weightedTokens,
    emojiChars,
    hexCandidates,
  } = queryContext;

  if (!query) return 0;

  let score = 0;
  let directTokenMatches = 0;
  let fuzzyMatches = 0;

  if (emojiChars.length > 0) {
    if (emojiChars.includes(index.emoji)) {
      score += 760;
    } else {
      return 0;
    }
  }

  if (hexCandidates.length > 0) {
    if (hexCandidates.includes(index.hexLower) || hexCandidates.includes(index.hexCompact)) {
      score += 620;
    } else if (hexCandidates.some((candidate) => index.hexLower.startsWith(candidate))) {
      score += 320;
    }
  }

  if (query.length >= 2) {
    if (index.annotation === query) {
      score += 360;
    } else if (index.annotation.startsWith(`${query} `) || index.annotation === query) {
      score += 260;
    } else if (hasWordBoundaryMatch(index.annotation, query)) {
      score += 180;
    }
  }

  if (phrase && phrase.length >= 4) {
    if (hasWordBoundaryMatch(index.annotation, phrase)) {
      score += 150;
    } else if (hasWordBoundaryMatch(index.tags, phrase)) {
      score += 120;
    } else if (hasWordBoundaryMatch(index.searchableText, phrase)) {
      score += 70;
    }
  }

  for (const [token, weight] of weightedTokens.entries()) {
    if (!token || token.length === 1) continue;
    let matched = false;

    if (index.annotationTokens.has(token)) {
      score += 98 * weight;
      matched = true;
    } else if (index.tagTokens.has(token)) {
      score += 86 * weight;
      matched = true;
    } else if (index.subgroupTokens.has(token)) {
      score += 52 * weight;
      matched = true;
    } else if (index.groupTokens.has(token)) {
      score += 46 * weight;
      matched = true;
    } else if (index.searchableTokens.has(token)) {
      score += 38 * weight;
      matched = true;
    } else if (findPrefixToken(token, index.annotationTokens)) {
      score += 34 * weight;
      matched = true;
    } else if (findPrefixToken(token, index.tagTokens)) {
      score += 28 * weight;
      matched = true;
    } else if (findFuzzyToken(token, index.annotationTokens) || findFuzzyToken(token, index.tagTokens)) {
      score += 18 * weight;
      matched = true;
      fuzzyMatches += 1;
    }

    if (matched && primaryTokens.includes(token)) {
      directTokenMatches += 1;
    }
  }

  if (primaryTokens.length > 0) {
    if (directTokenMatches === primaryTokens.length) {
      score += 84;
    } else if (directTokenMatches > 0) {
      score += directTokenMatches * 12;
      score -= (primaryTokens.length - directTokenMatches) * 18;
    } else {
      const aliasOnlyThreshold = query.length <= 3 ? 120 : 90;
      if (score < aliasOnlyThreshold) {
        return 0;
      }
    }
  }

  if (query.length <= 3 && score < 72 && hexCandidates.length === 0 && emojiChars.length === 0) {
    return 0;
  }

  if (fuzzyMatches > 0 && score < 48) {
    return 0;
  }

  if (index.group.startsWith('extras-')) {
    score -= 8;
  }

  return Math.round(score);
}

export function filterAndRankEntries(entries, rawQuery) {
  const queryContext = buildQueryContext(rawQuery);
  const query = queryContext.query;

  if (!query) {
    return entries;
  }

  const scored = [];
  for (const entry of entries) {
    const score = scoreEntryAgainstQuery(entry, queryContext);
    if (score <= 0) continue;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.entry.annotation || '').localeCompare(String(b.entry.annotation || ''), 'en', {
      sensitivity: 'base',
    });
  });

  return scored.map((row) => row.entry);
}
