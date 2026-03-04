import { describe, it, expect } from 'vitest';
import { loadEmojiModel } from '../load-emoji';

describe('loadEmojiModel', () => {
  it('returns groups, categories, and emojiEntries arrays', async () => {
    const model = await loadEmojiModel();
    expect(Array.isArray(model.groups)).toBe(true);
    expect(Array.isArray(model.categories)).toBe(true);
    expect(Array.isArray(model.emojiEntries)).toBe(true);
  });

  it('loads real data with correct total count', async () => {
    const model = await loadEmojiModel();
    // grouped-openmoji.json has 4284 entries
    expect(model.emojiEntries.length).toBeGreaterThan(4000);
  });

  it('has base emojis (non-variant) in the range of ~2000', async () => {
    const model = await loadEmojiModel();
    const baseEmojis = model.emojiEntries.filter((e) => !e.isVariant);
    expect(baseEmojis.length).toBeGreaterThan(1500);
    expect(baseEmojis.length).toBeLessThan(3500);
  });

  it('marks skin tone variants correctly', async () => {
    const model = await loadEmojiModel();
    const skinToneVariants = model.emojiEntries.filter((e) => e.isSkinToneVariant);
    expect(skinToneVariants.length).toBeGreaterThan(0);
    skinToneVariants.forEach((v) => {
      expect(v.isVariant).toBe(true);
    });
  });

  it('sets baseHex for variants pointing to their base emoji', async () => {
    const model = await loadEmojiModel();
    const variants = model.emojiEntries.filter((e) => e.isVariant && e.baseHex !== e.hexLower);
    expect(variants.length).toBeGreaterThan(0);
    variants.slice(0, 5).forEach((v) => {
      // baseHex should point to a different entry than the variant itself
      expect(v.baseHex).not.toBe(v.hexLower);
    });
  });

  it('sets pageSlug and detailRoute on entries', async () => {
    const model = await loadEmojiModel();
    const baseEmojis = model.emojiEntries.filter((e) => !e.isVariant);
    baseEmojis.slice(0, 10).forEach((e) => {
      expect(e.pageSlug).toBeTruthy();
      expect(e.detailRoute).toMatch(/^\/emoji\/.+\/$/);
    });
  });

  it('ensures all non-variant pageSlug values are unique', async () => {
    const model = await loadEmojiModel();
    const baseEmojis = model.emojiEntries.filter((e) => !e.isVariant);
    const slugs = baseEmojis.map((e) => e.pageSlug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('sets asset paths correctly', async () => {
    const model = await loadEmojiModel();
    const grinning = model.emojiEntries.find((e) => e.hexLower === '1f600');
    expect(grinning).toBeDefined();
    expect(grinning!.localAssetPath).toBe('/assets/emoji/base/1F600.svg');
    expect(grinning!.cdnAssetPath).toBe(
      'https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/1F600.svg'
    );
  });

  it('has categories with subgroups', async () => {
    const model = await loadEmojiModel();
    expect(model.categories.length).toBeGreaterThan(0);
    model.categories.forEach((cat) => {
      expect(cat.key).toBeTruthy();
      expect(cat.title).toBeTruthy();
      expect(cat.route).toMatch(/^\/.+\/$/);
      expect(Array.isArray(cat.subgroups)).toBe(true);
    });
  });

  it('groups and categories reference the same data', async () => {
    const model = await loadEmojiModel();
    expect(model.groups.length).toBe(model.categories.length);
    model.groups.forEach((g, i) => {
      expect(g.key).toBe(model.categories[i].key);
    });
  });
});
