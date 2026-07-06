import { error } from '@sveltejs/kit';
import { loadEmojiModel } from '$lib/data/load-emoji';
import type { EntryGenerator } from './$types';

// Explicit entries: subgroup pages under component/extras-* are not
// crawl-reachable from the home page.
export const entries: EntryGenerator = async () => {
  const model = await loadEmojiModel();
  const params: { category: string; subgroup: string }[] = [];
  for (const category of model.categories) {
    for (const sg of category.subgroups) {
      params.push({ category: category.key, subgroup: sg.key });
    }
  }
  return params;
};

export async function load({ params }) {
  const model = await loadEmojiModel();
  const category = model.categories.find((c) => c.key === params.category);
  const sg = category?.subgroups.find((s) => s.key === params.subgroup);

  if (!category || !sg) {
    error(404, 'Subgroup not found');
  }

  // Pass only non-variant emojis for this subgroup, only needed fields.
  const gridEmojis = sg.emojis
    .filter((e) => !e.isVariant)
    .map((e) => ({
      annotation: e.annotation,
      emoji: e.emoji,
      hexLower: e.hexLower,
      assetHex: e.assetHex,
      detailRoute: e.detailRoute,
      useLocalAsset: e.useLocalAsset,
    }));

  return {
    subgroup: {
      key: sg.key,
      route: `/${category.key}/${sg.key}/`,
      noindex: sg.noindex,
      description: sg.description,
    },
    parentCategory: {
      key: category.key,
      route: category.route,
    },
    gridEmojis,
    bodyClass: 'page-subgroup',
  };
}
