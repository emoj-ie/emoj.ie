export function buildLegacyRedirects(emojiEntries, { preferBaseForCollisions = true } = {}) {
  const bucket = new Map();

  for (const entry of emojiEntries) {
    if (!bucket.has(entry.legacyRoute)) {
      bucket.set(entry.legacyRoute, []);
    }
    bucket.get(entry.legacyRoute).push(entry);
  }

  const redirects = [];

  for (const [route, entries] of bucket.entries()) {
    if (entries.length === 0) {
      continue;
    }

    let selected = entries[0];

    if (entries.length > 1 && preferBaseForCollisions) {
      selected =
        entries.find((entry) => !entry.isVariant && entry.baseHex === entry.hexLower) ||
        entries.find((entry) => entry.hexLower === entry.baseHex) ||
        [...entries].sort((a, b) => a.hexLower.length - b.hexLower.length)[0];
    }

    redirects.push({
      route,
      targetRoute: selected.canonicalRoute,
      collisionCount: entries.length,
    });
  }

  return redirects.sort((a, b) => a.route.localeCompare(b.route));
}
