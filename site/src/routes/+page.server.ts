import { loadEmojiModel } from '$lib/data/load-emoji';

// Browsable categories exclude component, extras-openmoji, extras-unicode
const EXCLUDED_HOME_GROUPS = new Set(['component', 'extras-openmoji', 'extras-unicode']);

export async function load() {
  const model = await loadEmojiModel();

  const browsableCategories = model.categories
    .filter((cat) => !EXCLUDED_HOME_GROUPS.has(cat.key))
    .map((cat) => {
      const allNonVariant = cat.subgroups.flatMap((sg) => sg.emojis).filter((e) => !e.isVariant);
      const preview = allNonVariant[0];

      return {
        key: cat.key,
        title: cat.title,
        description: cat.description,
        route: cat.route,
        previewEmoji: preview
          ? {
              annotation: preview.annotation,
              emoji: preview.emoji,
              assetHex: preview.assetHex,
              useLocalAsset: preview.useLocalAsset,
            }
          : null,
        totalCount: allNonVariant.length,
      };
    });

  return {
    browsableCategories,
    bodyClass: 'page-home',
  };
}
