import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ensureTrailingSlash,
  isLikelyVariantAnnotation,
  normalizeHex,
  routeToFile,
  slugify,
  toBaseAnnotationKey,
} from './slug.mjs';

const GROUP_DESCRIPTIONS = {
  'smileys-emotion': 'Faces and emotions for reactions, mood, and expression.',
  'people-body': 'People, body parts, gestures, and appearance modifiers.',
  'animals-nature': 'Animals, plants, weather, and nature-themed emojis.',
  'food-drink': 'Food, beverages, dishes, and meal-related symbols.',
  'travel-places': 'Places, transport, landmarks, and travel icons.',
  activities: 'Sports, games, events, and recreational symbols.',
  objects: 'Household, office, tools, and everyday object symbols.',
  symbols: 'Arrows, signs, punctuation, and symbolic marks.',
  flags: 'Country, subdivision, and symbolic flags.',
  component: 'Emoji building blocks including skin tone and hair style modifiers.',
  'extras-openmoji': 'OpenMoji-specific extras outside the core Unicode set.',
  'extras-unicode': 'Unicode extras and supporting symbols.',
};

const TAG_STOPWORDS = new Set([
  'and',
  'emoji',
  'symbol',
  'sign',
  'face',
  'person',
  'with',
  'without',
  'for',
  'the',
  'of',
  'to',
  'in',
  'on',
  'a',
  'an',
]);

const SEARCH_TOKEN_SPLIT_RE = /[^a-z0-9]+/g;

const CURATED_SEARCH_TOPICS = [
  {
    key: 'happy',
    title: 'Happy Emoji',
    description: 'Find happy, upbeat emojis for positive messages and celebrations.',
    keywords: ['smile', 'joy', 'grin', 'laugh', 'cheerful', 'positive'],
    groupBoost: ['smileys-emotion'],
  },
  {
    key: 'sad',
    title: 'Sad Emoji',
    description: 'Find sad and emotional emojis for sympathy, setbacks, and serious moments.',
    keywords: ['cry', 'tears', 'upset', 'disappointed', 'worry', 'pain'],
    groupBoost: ['smileys-emotion'],
  },
  {
    key: 'love',
    title: 'Love Emoji',
    description: 'Find love and affection emojis for romance, support, and kind messages.',
    keywords: ['heart', 'romance', 'kiss', 'affection', 'care', 'valentine'],
    groupBoost: ['smileys-emotion', 'symbols'],
  },
  {
    key: 'party',
    title: 'Party Emoji',
    description: 'Find party and celebration emojis for birthdays, wins, and announcements.',
    keywords: ['celebration', 'birthday', 'confetti', 'tada', 'festival', 'cheers'],
    groupBoost: ['activities', 'food-drink', 'smileys-emotion'],
  },
  {
    key: 'hands',
    title: 'Hand Emoji',
    description: 'Find hand gesture emojis for reactions, approvals, and quick replies.',
    keywords: ['gesture', 'thumb', 'clap', 'wave', 'fingers', 'palm'],
    groupBoost: ['people-body'],
  },
  {
    key: 'animals',
    title: 'Animal Emoji',
    description: 'Find animal emojis for pets, wildlife, and nature content.',
    keywords: ['pet', 'wildlife', 'bird', 'mammal', 'creature', 'zoo'],
    groupBoost: ['animals-nature'],
  },
  {
    key: 'food',
    title: 'Food Emoji',
    description: 'Find food emojis for meals, recipes, menus, and cravings.',
    keywords: ['meal', 'snack', 'fruit', 'vegetable', 'dish', 'dessert'],
    groupBoost: ['food-drink'],
  },
  {
    key: 'drink',
    title: 'Drink Emoji',
    description: 'Find drink emojis for coffee chats, celebrations, and menu copy.',
    keywords: ['coffee', 'tea', 'juice', 'cocktail', 'beverage', 'glass'],
    groupBoost: ['food-drink'],
  },
  {
    key: 'weather',
    title: 'Weather Emoji',
    description: 'Find weather emojis for forecasts, trips, and seasonal updates.',
    keywords: ['sun', 'rain', 'cloud', 'snow', 'storm', 'wind'],
    groupBoost: ['animals-nature', 'travel-places'],
  },
  {
    key: 'travel',
    title: 'Travel Emoji',
    description: 'Find travel emojis for itineraries, locations, and adventure posts.',
    keywords: ['trip', 'vacation', 'flight', 'map', 'place', 'tour'],
    groupBoost: ['travel-places'],
  },
  {
    key: 'sports',
    title: 'Sports Emoji',
    description: 'Find sports emojis for workouts, game days, and team updates.',
    keywords: ['athlete', 'fitness', 'game', 'ball', 'medal', 'competition'],
    groupBoost: ['activities'],
  },
  {
    key: 'music',
    title: 'Music Emoji',
    description: 'Find music emojis for playlists, concerts, and creative updates.',
    keywords: ['song', 'audio', 'listen', 'dance', 'instrument', 'concert'],
    groupBoost: ['objects', 'activities'],
  },
  {
    key: 'work',
    title: 'Work Emoji',
    description: 'Find work and office emojis for updates, planning, and team chats.',
    keywords: ['office', 'business', 'task', 'meeting', 'project', 'productivity'],
    groupBoost: ['objects', 'people-body'],
  },
  {
    key: 'money',
    title: 'Money Emoji',
    description: 'Find money emojis for finance topics, pricing updates, and payments.',
    keywords: ['cash', 'bank', 'coin', 'dollar', 'finance', 'pay'],
    groupBoost: ['objects', 'symbols'],
  },
  {
    key: 'fire',
    title: 'Fire Emoji',
    description: 'Find fire and energy emojis for hype, momentum, and standout moments.',
    keywords: ['hot', 'flame', 'lit', 'energy', 'intense', 'spark'],
    groupBoost: ['smileys-emotion', 'symbols', 'animals-nature'],
  },
  {
    key: 'stars',
    title: 'Star Emoji',
    description: 'Find star and sparkle emojis for highlights, ratings, and standout ideas.',
    keywords: ['sparkle', 'shine', 'favorite', 'highlight', 'night', 'cosmic'],
    groupBoost: ['symbols', 'smileys-emotion'],
  },
];

function compareKeys(a, b) {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
}

function toAnnotationLookupKey(group, subgroup, annotation) {
  return `${group}::${subgroup}::${toBaseAnnotationKey(annotation)}`;
}

function isSkinToneVariant(emoji) {
  if (emoji.skintone || emoji.skintone_combination) {
    return true;
  }
  if (emoji.skintone_base_hexcode) {
    return normalizeHex(emoji.skintone_base_hexcode) !== normalizeHex(emoji.hexcode);
  }
  return false;
}

function isRightFacingVariant(emoji) {
  return /\bfacing right\b/i.test(String(emoji.annotation || ''));
}

function isGenderVariant(emoji) {
  return /^(man|woman)\b/i.test(String(emoji.annotation || ''));
}

function chooseBaseCandidate(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  const nonVariant = candidates.find((candidate) => !isLikelyVariantAnnotation(candidate.annotation));
  if (nonVariant) {
    return nonVariant;
  }

  return [...candidates].sort((a, b) => a.hexLower.length - b.hexLower.length)[0];
}

function getGroupNoindex(config, groupKey) {
  const noindexGroups = config.indexing?.noindexGroups || [];
  return noindexGroups.includes(groupKey);
}

function normalizedTagList(entry) {
  const raw = [
    Array.isArray(entry.tags) ? entry.tags.join(',') : String(entry.tags || ''),
    Array.isArray(entry.openmoji_tags)
      ? entry.openmoji_tags.join(',')
      : String(entry.openmoji_tags || ''),
    String(entry.annotation || ''),
  ]
    .filter(Boolean)
    .join(',');
  const parts = raw
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const normalized = new Set();
  for (const part of parts) {
    const slug = slugify(part);
    if (!slug || slug.length < 2) continue;
    if (!/[a-z]/.test(slug)) continue;
    if (TAG_STOPWORDS.has(slug)) continue;
    normalized.add(slug);
  }

  return [...normalized];
}

function tokenizeSearchValue(value = '') {
  return String(value)
    .toLowerCase()
    .split(SEARCH_TOKEN_SPLIT_RE)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function buildSearchTokenSet(definition) {
  const tokenSet = new Set(tokenizeSearchValue(definition.key || ''));

  for (const keyword of definition.keywords || []) {
    for (const token of tokenizeSearchValue(keyword)) {
      tokenSet.add(token);
    }
  }

  return tokenSet;
}

function scoreSearchEntry(searchRow, tokenSet, definition) {
  let score = 0;

  for (const token of tokenSet) {
    if (searchRow.text.includes(token)) {
      score += token.length >= 5 ? 5 : 4;
      continue;
    }

    if (searchRow.tagSet.has(token)) {
      score += 4;
      continue;
    }

    for (const searchToken of searchRow.tokens) {
      if (searchToken.startsWith(token) || token.startsWith(searchToken)) {
        score += 2;
        break;
      }
    }
  }

  if ((definition.groupBoost || []).includes(searchRow.entry.group)) {
    score += 2;
  }

  return score;
}

function buildCuratedSearchPages(emojiEntries) {
  const sourceEntries = emojiEntries.filter(
    (entry) => entry.indexable && !entry.isVariant && entry.group !== 'component'
  );

  const searchRows = sourceEntries.map((entry) => {
    const tags = normalizedTagList(entry);
    const text = [
      String(entry.annotation || ''),
      String(entry.group || ''),
      String(entry.subgroup || ''),
      tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return {
      entry,
      tokens: tokenizeSearchValue(text),
      tagSet: new Set(tags),
      text,
    };
  });

  const pages = [];
  for (const definition of CURATED_SEARCH_TOPICS) {
    const tokenSet = buildSearchTokenSet(definition);
    const matches = [];

    for (const row of searchRows) {
      const score = scoreSearchEntry(row, tokenSet, definition);
      if (score <= 0) continue;
      matches.push({ entry: row.entry, score });
    }

    const emojis = matches
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.entry.annotation || '').localeCompare(String(b.entry.annotation || ''), 'en', {
          sensitivity: 'base',
        });
      })
      .map((match) => match.entry)
      .slice(0, 320);

    const uniqueGroupCount = new Set(emojis.map((entry) => entry.group)).size;
    if (emojis.length < 18 || uniqueGroupCount < 2) {
      continue;
    }

    const searchSlug = slugify(definition.key);
    const route = ensureTrailingSlash(`search/${searchSlug}`);
    pages.push({
      key: searchSlug,
      query: definition.key,
      title: definition.title,
      route,
      file: routeToFile(route),
      description: definition.description,
      tokenCount: tokenSet.size,
      uniqueGroupCount,
      emojis,
    });
  }

  return pages.sort((a, b) => b.emojis.length - a.emojis.length || compareKeys(a.key, b.key));
}

export async function loadEmojiModel({ rootDir, config }) {
  const groupedDataPath = path.join(rootDir, config.paths.groupedData);
  const grouped = JSON.parse(await fs.readFile(groupedDataPath, 'utf8'));

  const groupEntries = Object.entries(grouped).sort(([a], [b]) => compareKeys(a, b));

  const emojiEntries = [];
  const annotationLookup = new Map();

  for (const [groupKey, subgroupObject] of groupEntries) {
    const subgroupEntries = Object.entries(subgroupObject).sort(([a], [b]) => compareKeys(a, b));

    for (const [subgroupKey, emojis] of subgroupEntries) {
      for (const emoji of emojis) {
        const slug = slugify(emoji.annotation || emoji.hexcode);
        const hexLower = normalizeHex(emoji.hexcode);
        const detailSlug = `${slug}--${hexLower}`;
        const detailRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}/${detailSlug}`);
        const emojiRoute = ensureTrailingSlash(`emoji/${detailSlug}`);
        const detailFile = routeToFile(detailRoute);
        const legacyRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}/${slug}`);
        const legacyFile = routeToFile(legacyRoute);

        const entry = {
          ...emoji,
          group: groupKey,
          subgroup: subgroupKey,
          slug,
          hexLower,
          detailSlug,
          detailRoute,
          emojiRoute,
          detailFile,
          legacyRoute,
          legacyFile,
          annotationLookupKey: toAnnotationLookupKey(groupKey, subgroupKey, emoji.annotation || ''),
          isSkinToneVariant: false,
          isRightFacingVariant: false,
          isGenderVariant: false,
          isVariant: false,
          baseHex: hexLower,
          baseRoute: detailRoute,
          canonicalRoute: detailRoute,
          noindex: false,
          indexable: false,
          assetHex: hexLower.toUpperCase(),
          localAssetPath: '',
          cdnAssetPath: '',
          useLocalAsset: false,
        };

        emojiEntries.push(entry);

        if (!annotationLookup.has(entry.annotationLookupKey)) {
          annotationLookup.set(entry.annotationLookupKey, []);
        }
        annotationLookup.get(entry.annotationLookupKey).push(entry);
      }
    }
  }

  for (const entry of emojiEntries) {
    entry.isSkinToneVariant = isSkinToneVariant(entry);
    entry.isRightFacingVariant = isRightFacingVariant(entry);
    entry.isGenderVariant = isGenderVariant(entry);

    let baseHex = '';

    if (entry.isSkinToneVariant && entry.skintone_base_hexcode) {
      baseHex = normalizeHex(entry.skintone_base_hexcode);
    }

    if (!baseHex && (entry.isRightFacingVariant || entry.isGenderVariant)) {
      const baseKey = toAnnotationLookupKey(entry.group, entry.subgroup, entry.annotation || '');
      const candidates = (annotationLookup.get(baseKey) || []).filter(
        (candidate) => candidate.hexLower !== entry.hexLower
      );
      const baseCandidate = chooseBaseCandidate(candidates);
      if (baseCandidate) {
        baseHex = baseCandidate.hexLower;
      }
    }

    if (!baseHex) {
      baseHex = entry.hexLower;
    }

    entry.baseHex = baseHex;
    entry.isVariant =
      baseHex !== entry.hexLower ||
      entry.isSkinToneVariant ||
      entry.isRightFacingVariant ||
      entry.isGenderVariant;
  }

  const entryByHex = new Map();
  for (const entry of emojiEntries) {
    const existing = entryByHex.get(entry.hexLower);
    if (!existing) {
      entryByHex.set(entry.hexLower, entry);
      continue;
    }
    if (existing.isVariant && !entry.isVariant) {
      entryByHex.set(entry.hexLower, entry);
    }
  }

  for (const entry of emojiEntries) {
    const baseEntry = entryByHex.get(entry.baseHex) || entry;
    entry.baseRoute = baseEntry.detailRoute;
    entry.canonicalRoute = entry.isVariant ? baseEntry.emojiRoute : entry.emojiRoute;

    const groupNoindex = getGroupNoindex(config, entry.group);
    const variantNoindex = Boolean(config.indexing?.noindexVariants && entry.isVariant);
    entry.noindex = groupNoindex || variantNoindex;

    const onlyBaseInSitemap = Boolean(config.indexing?.emojiSitemapBaseOnly);
    entry.indexable = !entry.noindex && (!onlyBaseInSitemap || !entry.isVariant);

    if (entry.group === 'component' && !entry.indexable) {
      entry.canonicalRoute = entry.detailRoute;
    }

    entry.localAssetPath = config.assets.emojiLocalTemplate.replace('{HEX}', entry.assetHex);
    entry.cdnAssetPath = config.assets.emojiCdnTemplate.replace('{HEX}', entry.assetHex);
    entry.useLocalAsset = !entry.isVariant && entry.group !== 'component';
  }

  const subgroupEntryLookup = new Map();
  for (const entry of emojiEntries) {
    const key = `${entry.group}::${entry.subgroup}`;
    if (!subgroupEntryLookup.has(key)) {
      subgroupEntryLookup.set(key, []);
    }
    subgroupEntryLookup.get(key).push(entry);
  }

  const groups = [];
  for (const [groupKey, subgroupObject] of groupEntries) {
    const groupRoute = ensureTrailingSlash(groupKey);
    const categoryRoute = ensureTrailingSlash(`category/${groupKey}`);
    const groupNoindex = getGroupNoindex(config, groupKey);

    const subgroupEntries = Object.entries(subgroupObject)
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([subgroupKey]) => {
        const subgroupRoute = ensureTrailingSlash(`category/${groupKey}/${subgroupKey}`);
        const subgroupLegacyRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}`);
        const subgroupEmojis = subgroupEntryLookup.get(`${groupKey}::${subgroupKey}`) || [];

        return {
          key: subgroupKey,
          title: subgroupKey.replace(/-/g, ' '),
          route: subgroupRoute,
          file: routeToFile(subgroupRoute),
          legacyRoute: subgroupLegacyRoute,
          legacyFile: routeToFile(subgroupLegacyRoute),
          noindex: groupNoindex,
          description: `Explore ${subgroupKey.replace(/-/g, ' ')} emojis.`,
          emojis: subgroupEmojis,
        };
      });

    groups.push({
      key: groupKey,
      title: groupKey.replace(/-/g, ' '),
      route: groupRoute,
      categoryRoute,
      file: routeToFile(groupRoute),
      noindex: groupNoindex,
      description: GROUP_DESCRIPTIONS[groupKey] || `Explore ${groupKey.replace(/-/g, ' ')} emojis.`,
      subgroups: subgroupEntries,
    });
  }

  const categories = groups.map((group) => ({
    key: group.key,
    title: group.title,
    route: group.categoryRoute,
    file: routeToFile(group.categoryRoute),
    legacyRoute: group.route,
    noindex: group.noindex,
    description: group.description,
    subgroups: group.subgroups,
  }));

  const tagMap = new Map();
  for (const entry of emojiEntries) {
    if (!entry.indexable) continue;
    if (entry.group === 'component') continue;
    if (entry.isVariant) continue;

    for (const tagKey of normalizedTagList(entry)) {
      if (!tagMap.has(tagKey)) {
        tagMap.set(tagKey, []);
      }
      tagMap.get(tagKey).push(entry);
    }
  }

  const tags = [...tagMap.entries()]
    .map(([key, emojis]) => ({
      key,
      title: key.replace(/-/g, ' '),
      route: ensureTrailingSlash(`tag/${key}`),
      file: routeToFile(ensureTrailingSlash(`tag/${key}`)),
      description: `Explore ${key.replace(/-/g, ' ')} emojis and copy them instantly.`,
      emojis: [...new Set(emojis)].sort((a, b) =>
        String(a.annotation || '').localeCompare(String(b.annotation || ''), 'en', {
          sensitivity: 'base',
        })
      ),
    }))
    .filter((tag) => tag.emojis.length >= 8 && tag.emojis.length <= 260)
    .sort((a, b) => b.emojis.length - a.emojis.length || compareKeys(a.key, b.key));

  const searchPages = buildCuratedSearchPages(emojiEntries);

  return {
    groups,
    categories,
    tags,
    searchPages,
    emojiEntries,
    groupedDataPath,
  };
}
