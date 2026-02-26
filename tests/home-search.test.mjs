import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEntrySearchIndex,
  buildQueryContext,
  filterAndRankEntries,
  scoreEntryAgainstQuery,
} from '../home-search.mjs';

function entry({
  emoji,
  annotation,
  group = 'smileys-emotion',
  subgroup = 'face-smiling',
  tags = '',
  hexcode,
}) {
  const row = {
    emoji,
    annotation,
    group,
    subgroup,
    tags,
    hexcode,
    hexLower: hexcode.toLowerCase(),
  };
  row.searchIndex = buildEntrySearchIndex(row);
  return row;
}

test('query alias usa favors United States over incidental substring matches', () => {
  const rows = [
    entry({
      emoji: '🇺🇸',
      annotation: 'United States',
      group: 'flags',
      subgroup: 'country-flag',
      tags: 'US, USA, flag, america, united states',
      hexcode: '1f1fa-1f1f8',
    }),
    entry({
      emoji: '🌭',
      annotation: 'hot dog',
      group: 'food-drink',
      subgroup: 'food-prepared',
      tags: 'frankfurter, hotdog, sausage',
      hexcode: '1f32d',
    }),
    entry({
      emoji: '🛍️',
      annotation: 'reusable bag',
      group: 'extras-openmoji',
      subgroup: 'objects',
      tags: '',
      hexcode: '267b',
    }),
  ];

  const ranked = filterAndRankEntries(rows, 'usa');
  assert.equal(ranked[0]?.annotation, 'United States');
});

test('short token uk does not drift to ukraine or tuk tuk', () => {
  const rows = [
    entry({
      emoji: '🇬🇧',
      annotation: 'United Kingdom',
      group: 'flags',
      subgroup: 'country-flag',
      tags: 'GB, UK, flag, britain, great britain',
      hexcode: '1f1ec-1f1e7',
    }),
    entry({
      emoji: '🇺🇦',
      annotation: 'Ukraine',
      group: 'flags',
      subgroup: 'country-flag',
      tags: 'UA, flag, ukraine',
      hexcode: '1f1fa-1f1e6',
    }),
    entry({
      emoji: '🛺',
      annotation: 'auto rickshaw',
      group: 'travel-places',
      subgroup: 'transport-ground',
      tags: 'tuk tuk',
      hexcode: '1f6fa',
    }),
  ];

  const ranked = filterAndRankEntries(rows, 'uk');
  assert.equal(ranked[0]?.annotation, 'United Kingdom');
  assert.equal(ranked.some((item) => item.annotation === 'auto rickshaw'), false);
});

test('lol prioritizes laughter emojis ahead of lollipop', () => {
  const rows = [
    entry({
      emoji: '😂',
      annotation: 'face with tears of joy',
      tags: 'face, joy, laugh, tear',
      hexcode: '1f602',
    }),
    entry({
      emoji: '🍭',
      annotation: 'lollipop',
      group: 'food-drink',
      subgroup: 'food-sweet',
      tags: 'candy, dessert, sweet',
      hexcode: '1f36d',
    }),
  ];

  const ranked = filterAndRankEntries(rows, 'lol');
  assert.equal(ranked[0]?.annotation, 'face with tears of joy');
});

test('hex query and emoji query strongly match exact emoji', () => {
  const joy = entry({
    emoji: '😂',
    annotation: 'face with tears of joy',
    tags: 'face, joy, laugh, tear',
    hexcode: '1f602',
  });
  const fire = entry({
    emoji: '🔥',
    annotation: 'fire',
    group: 'travel-places',
    subgroup: 'sky-weather',
    tags: 'flame, hot',
    hexcode: '1f525',
  });

  const hexContext = buildQueryContext('1F602');
  const emojiContext = buildQueryContext('😂');

  assert.ok(scoreEntryAgainstQuery(joy, hexContext) > scoreEntryAgainstQuery(fire, hexContext));
  assert.ok(scoreEntryAgainstQuery(joy, emojiContext) > 0);
  assert.equal(scoreEntryAgainstQuery(fire, emojiContext), 0);
});

test('fuzzy misspelling still finds intended face', () => {
  const rows = [
    entry({
      emoji: '😢',
      annotation: 'crying face',
      tags: 'cry, face, sad, tear',
      hexcode: '1f622',
    }),
    entry({
      emoji: '🍳',
      annotation: 'cooking',
      group: 'food-drink',
      subgroup: 'food-prepared',
      tags: 'breakfast, frying, pan',
      hexcode: '1f373',
    }),
  ];

  const ranked = filterAndRankEntries(rows, 'cryng');
  assert.equal(ranked[0]?.annotation, 'crying face');
});
