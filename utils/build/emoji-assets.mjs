import fs from 'node:fs/promises';
import path from 'node:path';

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function downloadWithRetry(url, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchWithTimeout(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function ensureBaseEmojiAssets({ rootDir, model, config, refresh = false }) {
  const targetDir = path.join(rootDir, config.assets.emojiLocalDir);
  await fs.mkdir(targetDir, { recursive: true });

  const baseEntries = model.emojiEntries.filter((entry) => entry.useLocalAsset);
  const uniqueHex = [...new Set(baseEntries.map((entry) => entry.assetHex))].sort((a, b) => a.localeCompare(b));

  let downloaded = 0;
  let skipped = 0;
  const failed = [];

  const pendingHex = [];
  for (const hex of uniqueHex) {
    const filePath = path.join(targetDir, `${hex}.svg`);
    if (!refresh && (await pathExists(filePath))) {
      skipped += 1;
      continue;
    }
    pendingHex.push(hex);
  }

  const workerCount = 16;
  let pointer = 0;

  async function worker() {
    while (pointer < pendingHex.length) {
      const current = pointer;
      pointer += 1;
      const hex = pendingHex[current];

      const filePath = path.join(targetDir, `${hex}.svg`);
      const url = config.assets.emojiCdnTemplate.replace('{HEX}', hex);

      try {
        const svg = await downloadWithRetry(url, 2);
        await fs.writeFile(filePath, svg, 'utf8');
        downloaded += 1;
      } catch (error) {
        failed.push({ hex, error: error?.message || String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (failed.length > 0) {
    const preview = failed.slice(0, 8).map((item) => `${item.hex} (${item.error})`).join(', ');
    throw new Error(`Failed to download ${failed.length} emoji assets: ${preview}`);
  }

  return {
    total: uniqueHex.length,
    downloaded,
    skipped,
    directory: config.assets.emojiLocalDir,
  };
}
