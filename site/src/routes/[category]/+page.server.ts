import { error } from '@sveltejs/kit';
import { loadEmojiModel } from '$lib/data/load-emoji';
import type { EntryGenerator } from './$types';

// Prerender every category, including the ones not linked from the home
// page (component, extras-*): the crawler alone would never find them.
export const entries: EntryGenerator = async () => {
  const model = await loadEmojiModel();
  return model.categories.map((category) => ({ category: category.key }));
};

export async function load({ params }) {
  const model = await loadEmojiModel();
  const category = model.categories.find((c) => c.key === params.category);

  if (!category) {
    error(404, 'Category not found');
  }

  // Slice data at build time: only preview emojis per subgroup reach the page.
  const subgroups = category.subgroups.map((sg) => {
    const nonVariant = sg.emojis.filter((e) => !e.isVariant);
    const preview = nonVariant[0];
    return {
      key: sg.key,
      title: sg.title,
      route: `/${category.key}/${sg.key}/`,
      noindex: sg.noindex,
      description: sg.description,
      previewEmoji: preview
        ? {
            annotation: preview.annotation,
            emoji: preview.emoji,
            assetHex: preview.assetHex,
            useLocalAsset: preview.useLocalAsset,
          }
        : null,
      totalCount: nonVariant.length,
    };
  });

  return {
    category: {
      key: category.key,
      title: category.title,
      route: category.route,
      noindex: category.noindex,
      description: category.description,
    },
    subgroups,
    bodyClass: 'page-group',
  };
}
