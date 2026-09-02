import { describe, it, expect } from 'vitest';
import {
  organizationSchema,
  websiteSchema,
  emojiDetailSchema,
  breadcrumbSchema,
  categoryPageSchema,
  webPageSchema,
} from '../seo';

describe('organizationSchema', () => {
  it('produces valid JSON-LD with @type Organization', () => {
    const schema = organizationSchema();
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Organization');
    expect(schema['@id']).toBe('https://emoj.ie/#organization');
    expect(schema.name).toBe('emoj.ie');
    expect(schema.url).toBe('https://emoj.ie/');
    expect(schema.logo).toBeTruthy();
  });
});

describe('websiteSchema', () => {
  it('produces valid WebSite schema with SearchAction', () => {
    const schema = websiteSchema();
    expect(schema['@type']).toBe('WebSite');
    expect(schema['@id']).toBe('https://emoj.ie/#website');
    expect(schema.potentialAction).toBeDefined();
    expect(schema.potentialAction['@type']).toBe('SearchAction');
  });
});

describe('emojiDetailSchema', () => {
  it('produces valid JSON-LD with @type DefinedTerm', () => {
    const emoji = {
      annotation: 'grinning face',
      hexLower: '1f600',
      pageSlug: 'grinning-face',
      group: 'smileys-emotion',
      subgroup: 'face-smiling',
    };
    const schema = emojiDetailSchema(emoji);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('DefinedTerm');
    expect(schema.name).toBe('grinning face');
    expect(schema.termCode).toBe('1f600');
    expect(schema.url).toBe('https://emoj.ie/emoji/grinning-face/');
  });
});

describe('breadcrumbSchema', () => {
  it('produces valid BreadcrumbList', () => {
    const items = [
      { name: 'Home', url: 'https://emoj.ie/' },
      { name: 'Smileys', url: 'https://emoj.ie/smileys-emotion/' },
    ];
    const schema = breadcrumbSchema(items);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
  });
});

describe('webPageSchema', () => {
  it('produces valid WebPage schema', () => {
    const schema = webPageSchema('Test Page', 'A test description', 'https://emoj.ie/test/');
    expect(schema['@type']).toBe('WebPage');
    expect(schema.name).toBe('Test Page');
    expect(schema.description).toBe('A test description');
    expect(schema.url).toBe('https://emoj.ie/test/');
  });
});

describe('categoryPageSchema', () => {
  it('produces valid CollectionPage schema', () => {
    const category = {
      key: 'smileys-emotion',
      title: 'smileys emotion',
      route: '/smileys-emotion/',
      description: 'Faces and emotions',
    };
    const schema = categoryPageSchema(category);
    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.name).toContain('smileys emotion');
    expect(schema.url).toBe('https://emoj.ie/smileys-emotion/');
  });
});
