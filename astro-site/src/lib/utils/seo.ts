const SITE_URL = 'https://emoj.ie';
const SITE_NAME = 'emoj.ie';
const SITE_DESCRIPTION =
  'Find and copy emojis quickly from categories like smileys, animals, and flags.';

export function organizationSchema(): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/logo.svg`,
    description: SITE_DESCRIPTION,
  };
}

export function websiteSchema(): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'en',
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function webPageSchema(
  title: string,
  description: string,
  url: string
): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: title,
    description,
    url,
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    about: {
      '@id': `${SITE_URL}/#organization`,
    },
  };
}

interface EmojiDetailInput {
  annotation: string;
  hexLower: string;
  pageSlug: string;
  group: string;
  subgroup: string;
}

export function emojiDetailSchema(emoji: EmojiDetailInput): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: emoji.annotation,
    termCode: emoji.hexLower,
    url: `${SITE_URL}/emoji/${emoji.pageSlug}/`,
    inDefinedTermSet: `${SITE_URL}/${emoji.group}/${emoji.subgroup}/`,
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

interface CategoryInput {
  key: string;
  title: string;
  route: string;
  description: string;
}

export function categoryPageSchema(category: CategoryInput): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.title} Emojis`,
    description: category.description,
    url: `${SITE_URL}${category.route}`,
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
  };
}
