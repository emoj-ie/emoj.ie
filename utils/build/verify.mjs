export function verifyModel({ emojiEntries, legacyRedirects }) {
  const detailRoutes = new Set();
  const duplicateDetailRoutes = [];

  for (const entry of emojiEntries) {
    if (!/--[a-f0-9-]+\/$/.test(entry.detailRoute)) {
      throw new Error(`Invalid detail route format: ${entry.detailRoute}`);
    }

    if (detailRoutes.has(entry.detailRoute)) {
      duplicateDetailRoutes.push(entry.detailRoute);
    }
    detailRoutes.add(entry.detailRoute);
  }

  if (duplicateDetailRoutes.length > 0) {
    throw new Error(`Duplicate detail routes found: ${duplicateDetailRoutes.slice(0, 20).join(', ')}`);
  }

  const knownRoutes = detailRoutes;
  for (const entry of emojiEntries) {
    if (!knownRoutes.has(entry.baseRoute)) {
      throw new Error(`Missing base route for ${entry.detailRoute}: ${entry.baseRoute}`);
    }
  }

  const redirectRoutes = new Set();
  for (const redirect of legacyRedirects) {
    if (redirectRoutes.has(redirect.route)) {
      throw new Error(`Duplicate redirect route: ${redirect.route}`);
    }
    redirectRoutes.add(redirect.route);

    if (!knownRoutes.has(redirect.targetRoute)) {
      throw new Error(`Redirect target does not exist: ${redirect.route} -> ${redirect.targetRoute}`);
    }
  }
}

export function verifyRenderResult({ generatedFiles, coreRoutes, emojiRoutes }) {
  if (generatedFiles.size === 0) {
    throw new Error('No files were rendered.');
  }

  if (coreRoutes.size === 0) {
    throw new Error('No core sitemap routes were generated.');
  }

  if (emojiRoutes.size === 0) {
    throw new Error('No emoji sitemap routes were generated.');
  }
}
