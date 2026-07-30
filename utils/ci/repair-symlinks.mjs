import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Replace dangling symlinks inside a staging tree with empty directories.
 *
 * `astro-site/public/assets/emoji/base` is a tracked absolute symlink into a
 * developer home directory. A clean worker will not have that path, and Astro
 * fails while copying `public/`. This repairs the staging copy only — the
 * tracked symlink itself is never modified.
 *
 * Returns one entry per repaired link, for the evidence manifest.
 */
export async function repairDanglingSymlinks(root) {
  const repaired = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          await fsp.stat(full); // follows the link
        } catch {
          const target = await fsp.readlink(full).catch(() => '<unreadable>');
          await fsp.unlink(full);
          await fsp.mkdir(full, { recursive: true });
          repaired.push({ path: path.relative(root, full), target });
        }
        continue; // never descend through a symlink
      }
      if (entry.isDirectory()) await walk(full);
    }
  }

  await walk(root);
  return repaired;
}
