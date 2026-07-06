import { error } from '@sveltejs/kit';
import { loadEmojiModel } from '$lib/data/load-emoji';
import type { EntryGenerator } from './$types';

// Every base (non-variant) emoji gets a page. Do not rely on crawling:
// detail pages in unlinked groups would be missed.
export const entries: EntryGenerator = async () => {
  const model = await loadEmojiModel();
  return model.emojiEntries.filter((e) => !e.isVariant).map((e) => ({ slug: e.pageSlug }));
};

export async function load({ params }) {
  const model = await loadEmojiModel();
  const emoji = model.emojiEntries.find((e) => !e.isVariant && e.pageSlug === params.slug);

  if (!emoji) {
    error(404, 'Emoji not found');
  }

  // Only this emoji's data and its variants reach the page.
  const variants = model.emojiEntries.filter(
    (v) => v.baseHex === emoji.hexLower && v.hexLower !== emoji.hexLower
  );

  const parentCategory = model.categories.find((c) => c.key === emoji.group);
  const parentSubgroup = parentCategory?.subgroups.find((sg) => sg.key === emoji.subgroup);

  const skinToneVariants = variants
    .filter((v) => v.isSkinToneVariant)
    .map((v) => ({
      emoji: v.emoji,
      hexLower: v.hexLower,
      annotation: v.annotation,
      localAssetPath: v.localAssetPath,
      cdnAssetPath: v.cdnAssetPath,
      assetHex: v.assetHex,
      useLocalAsset: v.useLocalAsset,
    }));

  const otherVariants = variants
    .filter((v) => !v.isSkinToneVariant)
    .map((v) => ({
      emoji: v.emoji,
      annotation: v.annotation,
      assetHex: v.assetHex,
      useLocalAsset: v.useLocalAsset,
    }));

  return {
    emoji: {
      annotation: emoji.annotation,
      emoji: emoji.emoji,
      hexLower: emoji.hexLower,
      assetHex: emoji.assetHex,
      pageSlug: emoji.pageSlug,
      detailRoute: emoji.detailRoute,
      group: emoji.group,
      subgroup: emoji.subgroup,
      noindex: emoji.noindex,
      useLocalAsset: emoji.useLocalAsset,
      cdnAssetPath: emoji.cdnAssetPath,
      unicode: emoji.unicode ?? null,
      cldrShortName: emoji.cldrShortName,
      cldrKeywords: emoji.cldrKeywords,
      tags: emoji.tags,
    },
    skinToneVariants,
    otherVariants,
    breadcrumbData: {
      categoryKey: emoji.group,
      categoryRoute: parentCategory?.route || `/${emoji.group}/`,
      subgroupKey: emoji.subgroup,
      subgroupRoute: parentSubgroup
        ? `/${emoji.group}/${parentSubgroup.key}/`
        : `/${emoji.group}/${emoji.subgroup}/`,
    },
    bodyClass: 'page-detail',
  };
}
