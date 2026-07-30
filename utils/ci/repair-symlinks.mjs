import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Symlinks that are known to escape the repository and must always be
 * neutralised, expressed relative to the staging tree root.
 *
 * `astro-site/public/assets/emoji/base` is tracked as an absolute symlink into
 * a developer home directory (`/home/sionnach/...`). On a machine where that
 * directory happens to exist, following it would splice machine-specific files
 * that are not part of the commit into the build — so the run would no longer
 * validate the exact requested SHA.
 */
export const KNOWN_EXTERNAL_SYMLINKS = ['astro-site/public/assets/emoji/base'];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/**
 * Decide whether a symlink points outside the staging tree.
 *
 * The target is resolved lexically, never by touching the filesystem: whether
 * the host happens to have the target must not change the outcome.
 */
function classify(root, linkPath, target) {
  if (path.isAbsolute(target)) return 'absolute-target';
  const resolved = path.resolve(path.dirname(linkPath), target);
  const relative = path.relative(root, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return 'escapes-tree';
  }
  return null;
}

/**
 * Replace every symlink in a staging tree that points outside that tree with an
 * empty directory, so the build can only ever consume files contained in the
 * archived commit.
 *
 * This is applied unconditionally — a link is neutralised whether or not its
 * target resolves on this host — which is what makes a run reproducible across
 * workers. The tracked symlink in the repository itself is never modified;
 * only the throwaway staging copy is.
 *
 * Returns one entry per neutralised link, for the evidence manifest, and throws
 * if any escaping link survives or a known external link is left in place.
 */
export async function neutraliseExternalSymlinks(root) {
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
        const target = await fsp.readlink(full).catch(() => null);
        if (target === null) {
          throw new Error(`unreadable symlink in the staging tree: ${toPosix(path.relative(root, full))}`);
        }
        const reason = classify(root, full, target);
        if (reason) {
          await fsp.unlink(full);
          await fsp.mkdir(full, { recursive: true });
          repaired.push({
            path: toPosix(path.relative(root, full)),
            target,
            reason,
            replacedWith: 'empty-directory',
          });
        }
        // Never descend through a symlink, repaired or not.
        continue;
      }
      if (entry.isDirectory()) await walk(full);
    }
  }

  await walk(root);

  // Post-conditions. A missed link would silently reintroduce host state.
  for (const known of KNOWN_EXTERNAL_SYMLINKS) {
    const full = path.join(root, known);
    const stat = await fsp.lstat(full).catch(() => null);
    if (!stat) continue; // not present at this commit
    // Present and still a link means the walk missed it; a plain directory or
    // file means it is already contained in the archived commit.
    if (stat.isSymbolicLink()) {
      throw new Error(`known external symlink was not neutralised: ${known}`);
    }
  }

  return repaired;
}

/** Assert that no symlink escaping `root` remains. Used as a verification pass. */
export async function assertNoExternalSymlinks(root) {
  const offenders = [];

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
        const target = await fsp.readlink(full).catch(() => '<unreadable>');
        if (classify(root, full, target)) {
          offenders.push(`${toPosix(path.relative(root, full))} -> ${target}`);
        }
        continue;
      }
      if (entry.isDirectory()) await walk(full);
    }
  }

  await walk(root);
  if (offenders.length > 0) {
    throw new Error(`staging tree still contains symlinks pointing outside it: ${offenders.join(', ')}`);
  }
}
