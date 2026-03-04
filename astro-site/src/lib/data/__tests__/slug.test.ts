import { describe, it, expect } from 'vitest';
import { slugify, normalizeHex, buildSlugMap } from '../slug';
import type { EmojiEntry } from '../types';

describe('slugify', () => {
  it('converts simple annotation to slug', () => {
    expect(slugify('grinning face')).toBe('grinning-face');
  });

  it('handles gendered annotation', () => {
    expect(slugify('man frowning')).toBe('man-frowning');
  });

  it('converts to lowercase', () => {
    expect(slugify('Thumbs Up')).toBe('thumbs-up');
  });

  it('removes diacritics', () => {
    expect(slugify('pina colada')).toBe('pina-colada');
  });

  it('strips non-alphanumeric chars', () => {
    // Apostrophe becomes space then dash in slugification
    expect(slugify("it's a test!")).toBe('it-s-a-test');
    expect(slugify("hello world!")).toBe('hello-world');
  });

  it('collapses multiple dashes', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });

  it('returns "emoji" for empty input', () => {
    expect(slugify('')).toBe('emoji');
  });
});

describe('normalizeHex', () => {
  it('lowercases hex code', () => {
    expect(normalizeHex('1F600')).toBe('1f600');
  });

  it('preserves dashes in compound codes', () => {
    expect(normalizeHex('1F468-200D-1F469')).toBe('1f468-200d-1f469');
  });

  it('trims whitespace', () => {
    expect(normalizeHex(' 1F600 ')).toBe('1f600');
  });
});

describe('buildSlugMap', () => {
  function makeEntry(overrides: Partial<EmojiEntry>): EmojiEntry {
    return {
      annotation: 'test',
      emoji: '',
      hexcode: '1F600',
      hexLower: '1f600',
      group: 'smileys-emotion',
      subgroup: 'face-smiling',
      slug: 'test',
      pageSlug: '',
      detailRoute: '',
      isSkinToneVariant: false,
      isRightFacingVariant: false,
      isGenderVariant: false,
      isVariant: false,
      baseHex: '1f600',
      noindex: false,
      indexable: true,
      assetHex: '1F600',
      localAssetPath: '',
      cdnAssetPath: '',
      useLocalAsset: false,
      cldrShortName: '',
      cldrKeywords: [],
      tags: [],
      openmoji_tags: [],
      ...overrides,
    };
  }

  it('produces unique pageSlug for each entry', () => {
    const entries = [
      makeEntry({ annotation: 'grinning face', hexLower: '1f600', slug: 'grinning-face' }),
      makeEntry({ annotation: 'smiling face', hexLower: '1f60a', slug: 'smiling-face' }),
    ];
    const map = buildSlugMap(entries);
    expect(map.get('1f600')).toBe('grinning-face');
    expect(map.get('1f60a')).toBe('smiling-face');
  });

  it('disambiguates duplicate slugs with hex suffix', () => {
    const entries = [
      makeEntry({ annotation: 'frowning', hexLower: '1f64d', slug: 'frowning' }),
      makeEntry({ annotation: 'frowning', hexLower: '2639', slug: 'frowning' }),
    ];
    const map = buildSlugMap(entries);
    expect(map.get('1f64d')).toBe('frowning-1f64d');
    expect(map.get('2639')).toBe('frowning-2639');
  });

  it('only includes non-variant entries', () => {
    const entries = [
      makeEntry({ hexLower: '1f600', slug: 'grinning-face', isVariant: false }),
      makeEntry({ hexLower: '1f601', slug: 'grinning-face', isVariant: true }),
    ];
    const map = buildSlugMap(entries);
    expect(map.get('1f600')).toBe('grinning-face');
    expect(map.has('1f601')).toBe(false);
  });
});
