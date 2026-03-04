import { describe, it, expect } from 'vitest';
import { formatCopyValue, COPY_MODES, humanize } from '../copy-formats';

describe('COPY_MODES', () => {
  it('contains all four modes', () => {
    expect(COPY_MODES).toEqual(['emoji', 'unicode', 'html', 'shortcode']);
  });
});

describe('formatCopyValue', () => {
  const entry = {
    emoji: '\u{1F600}',
    hexLower: '1f600',
    annotation: 'grinning face',
    slug: 'grinning-face',
  };

  it('returns the emoji character for "emoji" mode', () => {
    expect(formatCopyValue('emoji', entry)).toBe('\u{1F600}');
  });

  it('returns hex code for "unicode" mode', () => {
    expect(formatCopyValue('unicode', entry)).toBe('1f600');
  });

  it('returns HTML entity for "html" mode', () => {
    expect(formatCopyValue('html', entry)).toBe('&#x1F600;');
  });

  it('returns :slug: format for "shortcode" mode', () => {
    expect(formatCopyValue('shortcode', entry)).toBe(':grinning-face:');
  });

  it('handles compound hex codes in HTML mode', () => {
    const compoundEntry = {
      emoji: '',
      hexLower: '1f468-200d-1f469',
      annotation: 'family',
      slug: 'family',
    };
    expect(formatCopyValue('html', compoundEntry)).toBe('&#x1F468;&#x200D;&#x1F469;');
  });

  it('defaults to emoji for invalid mode', () => {
    expect(formatCopyValue('invalid' as any, entry)).toBe('\u{1F600}');
  });
});

describe('humanize', () => {
  it('converts dashes to spaces', () => {
    expect(humanize('grinning-face')).toBe('grinning face');
  });

  it('collapses multiple spaces', () => {
    expect(humanize('a--b')).toBe('a b');
  });

  it('trims whitespace', () => {
    expect(humanize(' test ')).toBe('test');
  });
});
