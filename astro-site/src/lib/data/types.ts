export interface EmojiEntry {
  annotation: string;
  emoji: string;
  hexcode: string;
  hexLower: string;
  group: string;
  subgroup: string;
  slug: string;
  pageSlug: string;
  detailRoute: string;
  isSkinToneVariant: boolean;
  isRightFacingVariant: boolean;
  isGenderVariant: boolean;
  isVariant: boolean;
  baseHex: string;
  noindex: boolean;
  indexable: boolean;
  assetHex: string;
  localAssetPath: string;
  cdnAssetPath: string;
  useLocalAsset: boolean;
  cldrShortName: string;
  cldrKeywords: string[];
  tags: string[];
  openmoji_tags: string[];
  skintone?: string;
  skintone_combination?: string;
  skintone_base_hexcode?: string;
  unicode?: number;
}

export interface Subgroup {
  key: string;
  title: string;
  route: string;
  noindex: boolean;
  description: string;
  emojis: EmojiEntry[];
}

export interface Category {
  key: string;
  title: string;
  route: string;
  noindex: boolean;
  description: string;
  subgroups: Subgroup[];
}

export interface EmojiModel {
  groups: Category[];
  categories: Category[];
  emojiEntries: EmojiEntry[];
}
