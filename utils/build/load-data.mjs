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
    entry.canonicalRoute = entry.isVariant ? baseEntry.detailRoute : entry.detailRoute;

    const groupNoindex = getGroupNoindex(config, entry.group);
    const variantNoindex = Boolean(config.indexing?.noindexVariants && entry.isVariant);
    entry.noindex = groupNoindex || variantNoindex;

    const onlyBaseInSitemap = Boolean(config.indexing?.emojiSitemapBaseOnly);
    entry.indexable = !entry.noindex && (!onlyBaseInSitemap || !entry.isVariant);

    entry.localAssetPath = config.assets.emojiLocalTemplate.replace('{HEX}', entry.assetHex);
    entry.cdnAssetPath = config.assets.emojiCdnTemplate.replace('{HEX}', entry.assetHex);
    entry.useLocalAsset = !entry.isVariant && entry.group !== 'component';
  }

  const groups = [];
  for (const [groupKey, subgroupObject] of groupEntries) {
    const groupRoute = ensureTrailingSlash(groupKey);
    const groupNoindex = getGroupNoindex(config, groupKey);

    const subgroupEntries = Object.entries(subgroupObject)
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([subgroupKey]) => {
        const subgroupRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}`);
        const subgroupEmojis = emojiEntries.filter(
          (entry) => entry.group === groupKey && entry.subgroup === subgroupKey
        );

        return {
          key: subgroupKey,
          title: subgroupKey.replace(/-/g, ' '),
          route: subgroupRoute,
          file: routeToFile(subgroupRoute),
          noindex: groupNoindex,
          description: `Explore ${subgroupKey.replace(/-/g, ' ')} emojis.`,
          emojis: subgroupEmojis,
        };
      });

    groups.push({
      key: groupKey,
      title: groupKey.replace(/-/g, ' '),
      route: groupRoute,
      file: routeToFile(groupRoute),
      noindex: groupNoindex,
      description: GROUP_DESCRIPTIONS[groupKey] || `Explore ${groupKey.replace(/-/g, ' ')} emojis.`,
      subgroups: subgroupEntries,
    });
  }

  return {
    groups,
    emojiEntries,
    groupedDataPath,
  };
}
