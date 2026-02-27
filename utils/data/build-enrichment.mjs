import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeHex } from '../build/slug.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const CLDR_ANNOTATIONS_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json';
const CLDR_DERIVED_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-derived-full/annotationsDerived/en/annotations.json';

const TWEMOJI_TEMPLATE =
  'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/{HEX}.svg';

function splitKeywords(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toHexFromSymbol(symbol = '') {
  const codepoints = Array.from(String(symbol), (char) => char.codePointAt(0))
    .filter((value) => Number.isFinite(value))
    .map((value) => value.toString(16).toLowerCase());

  if (codepoints.length === 0) return '';
  return normalizeHex(codepoints.join('-'));
}

function removeVariationSelectors(hex = '') {
  return String(hex)
    .split('-')
    .filter((part) => part && part !== 'fe0f')
    .join('-');
}

async function readJsonFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.json();
}

function addAnnotationToMap(targetMap, symbol, payload) {
  const hex = toHexFromSymbol(symbol);
  if (!hex) return;

  const shortName = splitKeywords(payload?.tts)[0] || '';
  const keywords = splitKeywords(payload?.default);
  if (!shortName && keywords.length === 0) {
    return;
  }

  if (!targetMap.has(hex)) {
    targetMap.set(hex, {
      cldrShortName: '',
      cldrKeywords: new Set(),
    });
  }

  const entry = targetMap.get(hex);
  if (!entry.cldrShortName && shortName) {
    entry.cldrShortName = shortName;
  }
  for (const keyword of keywords) {
    entry.cldrKeywords.add(keyword);
  }
}

function buildCldrMap(fullJson, derivedJson) {
  const map = new Map();

  const fullAnnotations = fullJson?.annotations?.annotations || {};
  for (const [symbol, payload] of Object.entries(fullAnnotations)) {
    addAnnotationToMap(map, symbol, payload);
  }

  const derivedAnnotations = derivedJson?.annotationsDerived?.annotations || {};
  for (const [symbol, payload] of Object.entries(derivedAnnotations)) {
    addAnnotationToMap(map, symbol, payload);
  }

  return map;
}

async function loadGroupedHexes(groupedPath) {
  const grouped = JSON.parse(await fs.readFile(groupedPath, 'utf8'));
  const hexes = new Set();
  for (const subgroups of Object.values(grouped)) {
    for (const emojis of Object.values(subgroups)) {
      for (const emoji of emojis) {
        const hex = normalizeHex(emoji.hexcode || '');
        if (hex) {
          hexes.add(hex);
        }
      }
    }
  }
  return [...hexes].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

function buildEnrichmentEntries(hexes, cldrMap) {
  const entries = {};
  const twemojiEntries = {};
  let cldrCoverageCount = 0;

  for (const hex of hexes) {
    const compactHex = removeVariationSelectors(hex);
    const cldr = cldrMap.get(hex) || cldrMap.get(compactHex);
    const twemojiHex = compactHex || hex;
    const twemojiSvg = TWEMOJI_TEMPLATE.replace('{HEX}', twemojiHex);
    twemojiEntries[hex] = twemojiSvg;

    const cldrShortName = cldr?.cldrShortName ? String(cldr.cldrShortName).trim() : '';
    const cldrKeywords = cldr
      ? [...cldr.cldrKeywords]
          .map((keyword) => String(keyword || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
      : [];

    if (cldrShortName || cldrKeywords.length > 0) {
      cldrCoverageCount += 1;
    }

    entries[hex] = {
      cldrShortName,
      cldrKeywords,
      twemojiSvg,
    };
  }

  return {
    entries,
    twemojiEntries,
    cldrCoverageCount,
  };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const configPath = path.join(ROOT_DIR, 'utils/site.config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const groupedPath = path.join(ROOT_DIR, config.paths.groupedData);
  const enrichmentPath = path.join(
    ROOT_DIR,
    config.paths.enrichmentData || 'data/emoji-enrichment.json'
  );
  const twemojiMapPath = path.join(ROOT_DIR, config.paths.twemojiMap || 'data/twemoji-map.json');

  const [fullJson, derivedJson, hexes] = await Promise.all([
    readJsonFromUrl(CLDR_ANNOTATIONS_URL),
    readJsonFromUrl(CLDR_DERIVED_URL),
    loadGroupedHexes(groupedPath),
  ]);

  const cldrMap = buildCldrMap(fullJson, derivedJson);
  const { entries, twemojiEntries, cldrCoverageCount } = buildEnrichmentEntries(hexes, cldrMap);

  const enrichmentPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources: {
      cldrAnnotations: CLDR_ANNOTATIONS_URL,
      cldrDerived: CLDR_DERIVED_URL,
      twemojiTemplate: TWEMOJI_TEMPLATE,
    },
    stats: {
      openmojiHexes: hexes.length,
      cldrCoverage: cldrCoverageCount,
      cldrCoveragePct: Number(((cldrCoverageCount / Math.max(1, hexes.length)) * 100).toFixed(2)),
    },
    entries,
  };

  const twemojiPayload = {
    version: 1,
    generatedAt: enrichmentPayload.generatedAt,
    sourceTemplate: TWEMOJI_TEMPLATE,
    entries: twemojiEntries,
  };

  await Promise.all([writeJson(enrichmentPath, enrichmentPayload), writeJson(twemojiMapPath, twemojiPayload)]);

  console.log(
    `Wrote enrichment artifacts: ${path.relative(ROOT_DIR, enrichmentPath)}, ${path.relative(
      ROOT_DIR,
      twemojiMapPath
    )}`
  );
  console.log(
    `Coverage: ${cldrCoverageCount}/${hexes.length} (${enrichmentPayload.stats.cldrCoveragePct}%)`
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
