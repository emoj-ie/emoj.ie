import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmojiEntry, Category, Subgroup, EmojiModel } from './types';
import {
  slugify,
  normalizeHex,
  ensureTrailingSlash,
  toBaseAnnotationKey,
  isLikelyVariantAnnotation,
  buildSlugMap,
} from './slug';

const SITE_URL = 'https://emoj.ie';
const CDN_TEMPLATE = 'https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/{HEX}.svg';
const LOCAL_TEMPLATE = '/assets/emoji/base/{HEX}.svg';

const GROUP_DESCRIPTIONS: Record<string, string> = {
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

const NOINDEX_GROUPS = new Set(['component']);

function compareKeys(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
}

function removeVariationSelectorsHex(hex = ''): string {
  return String(hex)
    .split('-')
    .filter((part) => part && part !== 'fe0f')
    .join('-');
}

function toAnnotationLookupKey(group: string, subgroup: string, annotation: string): string {
  return `${group}::${subgroup}::${toBaseAnnotationKey(annotation)}`;
}

function isSkinToneVariant(emoji: any): boolean {
  // An emoji is a skin tone variant only if it has an actual skin tone applied.
  // skintone_combination indicates the emoji SUPPORTS skin tones, not that it IS one.
  // The base emoji has skintone: "" (no tone) and skintone_combination: "single" (supports tones).
  if (emoji.skintone && String(emoji.skintone).trim()) {
    return true;
  }
  if (emoji.skintone_base_hexcode) {
    return normalizeHex(emoji.skintone_base_hexcode) !== normalizeHex(emoji.hexcode);
  }
  return false;
}

function isRightFacingVariant(emoji: any): boolean {
  return /\bfacing right\b/i.test(String(emoji.annotation || ''));
}

function isGenderVariant(emoji: any): boolean {
  return /^(man|woman)\b/i.test(String(emoji.annotation || ''));
}

function chooseBaseCandidate(candidates: any[]): any | null {
  if (candidates.length === 0) {
    return null;
  }

  const nonVariant = candidates.find(
    (candidate: any) => !isLikelyVariantAnnotation(candidate.annotation)
  );
  if (nonVariant) {
    return nonVariant;
  }

  return [...candidates].sort((a, b) => a.hexLower.length - b.hexLower.length)[0];
}

async function readJsonIfExists(filePath: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Module-level cache
let cachedModel: EmojiModel | null = null;

export async function loadEmojiModel(): Promise<EmojiModel> {
  if (cachedModel) {
    return cachedModel;
  }

  // Find repo root: process.cwd() is the astro-site directory during both
  // dev and build. The repo root is one level up from there.
  const repoRoot = path.resolve(process.cwd(), '..');

  const groupedDataPath = path.join(repoRoot, 'grouped-openmoji.json');
  const enrichmentPath = path.join(repoRoot, 'data', 'emoji-enrichment.json');

  const grouped = JSON.parse(await fs.readFile(groupedDataPath, 'utf8'));
  const enrichmentPayload = await readJsonIfExists(enrichmentPath);
  const enrichmentEntries = enrichmentPayload?.entries || {};

  const groupEntries: [string, any][] = Object.entries(grouped).sort(([a], [b]) =>
    compareKeys(a, b)
  );

  const emojiEntries: EmojiEntry[] = [];
  const annotationLookup = new Map<string, any[]>();

  for (const [groupKey, subgroupObject] of groupEntries) {
    const subgroupEntries: [string, any[]][] = Object.entries(subgroupObject as Record<string, any[]>).sort(
      ([a], [b]) => compareKeys(a, b)
    );

    for (const [subgroupKey, emojis] of subgroupEntries) {
      for (const emoji of emojis) {
        const slug = slugify(emoji.annotation || emoji.hexcode);
        const hexLower = normalizeHex(emoji.hexcode);
        const compactHex = removeVariationSelectorsHex(hexLower);
        const enrichmentEntry = enrichmentEntries[hexLower] || enrichmentEntries[compactHex] || {};

        const tagsRaw = emoji.tags;
        const tags: string[] = typeof tagsRaw === 'string'
          ? tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
          : Array.isArray(tagsRaw) ? tagsRaw : [];

        const openmojiTagsRaw = emoji.openmoji_tags;
        const openmoji_tags: string[] = typeof openmojiTagsRaw === 'string'
          ? openmojiTagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
          : Array.isArray(openmojiTagsRaw) ? openmojiTagsRaw : [];

        const entry: EmojiEntry = {
          annotation: emoji.annotation || '',
          emoji: emoji.emoji || '',
          hexcode: emoji.hexcode || '',
          hexLower,
          group: groupKey,
          subgroup: subgroupKey,
          slug,
          pageSlug: '', // Set after slug map is built
          detailRoute: '', // Set after slug map is built
          isSkinToneVariant: false,
          isRightFacingVariant: false,
          isGenderVariant: false,
          isVariant: false,
          baseHex: hexLower,
          noindex: false,
          indexable: false,
          assetHex: hexLower.toUpperCase(),
          localAssetPath: LOCAL_TEMPLATE.replace('{HEX}', hexLower.toUpperCase()),
          cdnAssetPath: CDN_TEMPLATE.replace('{HEX}', hexLower.toUpperCase()),
          useLocalAsset: false,
          cldrShortName: String(enrichmentEntry.cldrShortName || '').trim(),
          cldrKeywords: Array.isArray(enrichmentEntry.cldrKeywords)
            ? enrichmentEntry.cldrKeywords
                .map((keyword: string) => String(keyword || '').trim())
                .filter(Boolean)
            : [],
          tags,
          openmoji_tags,
          skintone: emoji.skintone || undefined,
          skintone_combination: emoji.skintone_combination || undefined,
          skintone_base_hexcode: emoji.skintone_base_hexcode || undefined,
          unicode: emoji.unicode || undefined,
        };

        emojiEntries.push(entry);

        const lookupKey = toAnnotationLookupKey(groupKey, subgroupKey, emoji.annotation || '');
        if (!annotationLookup.has(lookupKey)) {
          annotationLookup.set(lookupKey, []);
        }
        annotationLookup.get(lookupKey)!.push(entry);
      }
    }
  }

  // Classify variants
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
        (candidate: any) => candidate.hexLower !== entry.hexLower
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

  // Set noindex and indexable
  for (const entry of emojiEntries) {
    const groupNoindex = NOINDEX_GROUPS.has(entry.group);
    const variantNoindex = entry.isVariant;
    entry.noindex = groupNoindex || variantNoindex;
    entry.indexable = !entry.noindex && !entry.isVariant;
    entry.useLocalAsset = !entry.isVariant && entry.group !== 'component';
  }

  // Build slug map and set pageSlug / detailRoute
  const slugMap = buildSlugMap(emojiEntries);
  for (const entry of emojiEntries) {
    const pageSlug = slugMap.get(entry.hexLower) || entry.slug;
    entry.pageSlug = pageSlug;
    entry.detailRoute = `/emoji/${pageSlug}/`;
  }

  // Build groups and categories
  const subgroupEntryLookup = new Map<string, EmojiEntry[]>();
  for (const entry of emojiEntries) {
    const key = `${entry.group}::${entry.subgroup}`;
    if (!subgroupEntryLookup.has(key)) {
      subgroupEntryLookup.set(key, []);
    }
    subgroupEntryLookup.get(key)!.push(entry);
  }

  const groups: Category[] = [];
  for (const [groupKey, subgroupObject] of groupEntries) {
    const groupRoute = ensureTrailingSlash(groupKey);
    const groupNoindex = NOINDEX_GROUPS.has(groupKey);

    const subgroupItems: Subgroup[] = Object.entries(subgroupObject as Record<string, any[]>)
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([subgroupKey]) => {
        const subgroupRoute = ensureTrailingSlash(`${groupKey}/${subgroupKey}`);
        const subgroupEmojis = subgroupEntryLookup.get(`${groupKey}::${subgroupKey}`) || [];

        return {
          key: subgroupKey,
          title: subgroupKey.replace(/-/g, ' '),
          route: subgroupRoute,
          noindex: groupNoindex,
          description: `Explore ${subgroupKey.replace(/-/g, ' ')} emojis.`,
          emojis: subgroupEmojis,
        };
      });

    groups.push({
      key: groupKey,
      title: groupKey.replace(/-/g, ' '),
      route: `/${groupRoute}`,
      noindex: groupNoindex,
      description: GROUP_DESCRIPTIONS[groupKey] || `Explore ${groupKey.replace(/-/g, ' ')} emojis.`,
      subgroups: subgroupItems,
    });
  }

  const categories = groups.map((group) => ({
    key: group.key,
    title: group.title,
    route: group.route,
    noindex: group.noindex,
    description: group.description,
    subgroups: group.subgroups,
  }));

  cachedModel = {
    groups,
    categories,
    emojiEntries,
  };

  return cachedModel;
}

/**
 * Reset the module-level cache (useful for testing).
 */
export function resetCache(): void {
  cachedModel = null;
}
