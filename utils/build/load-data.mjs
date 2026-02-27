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

const TOPIC_TAG_BRIDGES = [
  { topicKey: 'happy', topicTitle: 'Happy', tagKey: 'happy' },
  { topicKey: 'sad', topicTitle: 'Sad', tagKey: 'sad' },
  { topicKey: 'love', topicTitle: 'Love', tagKey: 'love' },
  { topicKey: 'party', topicTitle: 'Party', tagKey: 'party' },
  { topicKey: 'hands', topicTitle: 'Hands', tagKey: 'hand' },
  { topicKey: 'animals', topicTitle: 'Animals', tagKey: 'animal' },
  { topicKey: 'food', topicTitle: 'Food', tagKey: 'food' },
  { topicKey: 'drink', topicTitle: 'Drink', tagKey: 'drink' },
  { topicKey: 'weather', topicTitle: 'Weather', tagKey: 'weather' },
  { topicKey: 'travel', topicTitle: 'Travel', tagKey: 'travel' },
  { topicKey: 'sports', topicTitle: 'Sports', tagKey: 'sport' },
  { topicKey: 'music', topicTitle: 'Music', tagKey: 'music' },
  { topicKey: 'work', topicTitle: 'Work', tagKey: 'work' },
  { topicKey: 'money', topicTitle: 'Money', tagKey: 'money' },
  { topicKey: 'fire', topicTitle: 'Fire', tagKey: 'fire' },
  { topicKey: 'stars', topicTitle: 'Stars', tagKey: 'star' },
];

function compareKeys(a, b) {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
}

function removeVariationSelectorsHex(hex = '') {
  return String(hex)
    .split('-')
    .filter((part) => part && part !== 'fe0f')
    .join('-');
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
    Array.isArray(entry.cldrKeywords)
      ? entry.cldrKeywords.join(',')
      : String(entry.cldrKeywords || ''),
    String(entry.cldrShortName || ''),
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function buildTopicTagLinks(tags) {
  const tagByKey = new Map((tags || []).map((tag) => [tag.key, tag]));

  return TOPIC_TAG_BRIDGES.map((bridge) => {
    const tag = tagByKey.get(bridge.tagKey);
    if (!tag) {
      return null;
    }
    return {
      topicKey: bridge.topicKey,
      topicTitle: bridge.topicTitle,
      tagKey: tag.key,
      tagTitle: tag.title,
      tagRoute: tag.route,
      searchRoute: ensureTrailingSlash(`search/${bridge.topicKey}`),
    };
  })
    .filter(Boolean)
    .sort((a, b) => compareKeys(a.topicKey, b.topicKey));
}

export async function loadEmojiModel({ rootDir, config }) {
  const groupedDataPath = path.join(rootDir, config.paths.groupedData);
  const grouped = JSON.parse(await fs.readFile(groupedDataPath, 'utf8'));
  const enrichmentPath = config.paths?.enrichmentData
    ? path.join(rootDir, config.paths.enrichmentData)
    : '';
  const twemojiMapPath = config.paths?.twemojiMap ? path.join(rootDir, config.paths.twemojiMap) : '';
  const [enrichmentPayload, twemojiPayload] = await Promise.all([
    enrichmentPath ? readJsonIfExists(enrichmentPath) : null,
    twemojiMapPath ? readJsonIfExists(twemojiMapPath) : null,
  ]);
  const enrichmentEntries = enrichmentPayload?.entries || {};
  const twemojiEntries = twemojiPayload?.entries || {};

  const groupEntries = Object.entries(grouped).sort(([a], [b]) => compareKeys(a, b));

  const emojiEntries = [];
  const annotationLookup = new Map();

  for (const [groupKey, subgroupObject] of groupEntries) {
    const subgroupEntries = Object.entries(subgroupObject).sort(([a], [b]) => compareKeys(a, b));

    for (const [subgroupKey, emojis] of subgroupEntries) {
      for (const emoji of emojis) {
        const slug = slugify(emoji.annotation || emoji.hexcode);
        const hexLower = normalizeHex(emoji.hexcode);
        const compactHex = removeVariationSelectorsHex(hexLower);
        const enrichmentEntry = enrichmentEntries[hexLower] || enrichmentEntries[compactHex] || {};
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
          cldrShortName: String(enrichmentEntry.cldrShortName || '').trim(),
          cldrKeywords: Array.isArray(enrichmentEntry.cldrKeywords)
            ? enrichmentEntry.cldrKeywords
                .map((keyword) => String(keyword || '').trim())
                .filter(Boolean)
            : [],
          twemojiSvg: String(
            enrichmentEntry.twemojiSvg || twemojiEntries[hexLower] || twemojiEntries[compactHex] || ''
          ).trim(),
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
        const subgroupRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}`);
        const subgroupLegacyRoute = ensureTrailingSlash(`category/${groupKey}/${subgroupKey}`);
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
    route: group.route,
    file: routeToFile(group.route),
    legacyRoute: group.categoryRoute,
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

  const topicTagLinks = buildTopicTagLinks(tags);

  return {
    groups,
    categories,
    tags,
    topicTagLinks,
    emojiEntries,
    groupedDataPath,
  };
}
