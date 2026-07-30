#!/usr/bin/env node
// Deterministic static file server for locally built production output.
//
// This exists so that browser validation always runs against `astro-site/dist`
// (the exact bytes that ship) and never against `astro dev`. It is started and
// killed by utils/ci/run-local-ci.mjs.
//
// Usage:
//   node utils/ci/lib/static-server.mjs --root <dist-dir> [--host 127.0.0.1] [--port 0]
//
// On successful bind it prints a single JSON line to stdout:
//   {"ready":true,"url":"http://127.0.0.1:34567","root":"/abs/dist"}

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MIME = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webmanifest': 'application/manifest+json',
    '.map': 'application/json; charset=utf-8',
  })
);

function parseArgs(argv) {
  const out = { host: '127.0.0.1', port: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    i += 1;
    if (key === 'root') out.root = path.resolve(value);
    else if (key === 'host') out.host = value;
    else if (key === 'port') out.port = Number(value);
    else throw new Error(`Unknown option --${key}`);
  }
  if (!out.root) throw new Error('Missing required option --root');
  if (!Number.isInteger(out.port) || out.port < 0) {
    throw new Error(`Invalid --port value: ${out.port}`);
  }
  return out;
}

function contentType(filePath) {
  return MIME.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

async function statOrNull(target) {
  try {
    return await fsp.stat(target);
  } catch {
    return null;
  }
}

/**
 * Resolve a request pathname to a file inside root.
 * Mirrors the `trailingSlash: 'always'` + `output: 'static'` Astro contract:
 * directories resolve to index.html, and `/foo` redirects to `/foo/`.
 */
async function resolveTarget(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = path.posix.normalize(decoded);
  const relative = normalized.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative);

  // Reject traversal outside the served root.
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return { kind: 'forbidden' };
  }

  const stats = await statOrNull(candidate);

  if (stats?.isFile()) {
    return { kind: 'file', file: candidate };
  }

  if (stats?.isDirectory()) {
    const index = path.join(candidate, 'index.html');
    if ((await statOrNull(index))?.isFile()) {
      if (!normalized.endsWith('/')) {
        return { kind: 'redirect', location: `${normalized}/` };
      }
      return { kind: 'file', file: index };
    }
  }

  return { kind: 'missing' };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const rootStats = await statOrNull(options.root);
  if (!rootStats?.isDirectory()) {
    throw new Error(`Served root is not a directory: ${options.root}`);
  }

  const notFoundPage = path.join(options.root, '404.html');
  const hasNotFoundPage = (await statOrNull(notFoundPage))?.isFile() === true;

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' });
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const resolved = await resolveTarget(options.root, url.pathname);

      if (resolved.kind === 'forbidden') {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (resolved.kind === 'redirect') {
        res.writeHead(301, { location: resolved.location + url.search });
        res.end();
        return;
      }

      if (resolved.kind === 'missing') {
        const body = hasNotFoundPage
          ? await fsp.readFile(notFoundPage)
          : Buffer.from('Not Found', 'utf8');
        res.writeHead(404, {
          'content-type': hasNotFoundPage ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
          'content-length': String(body.byteLength),
          'cache-control': 'no-store',
        });
        res.end(req.method === 'HEAD' ? undefined : body);
        return;
      }

      const stats = await fsp.stat(resolved.file);
      res.writeHead(200, {
        'content-type': contentType(resolved.file),
        'content-length': String(stats.size),
        'cache-control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(resolved.file).pipe(res);
    } catch (error) {
      process.stderr.write(`static-server error: ${error?.stack || error}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    }
  });

  server.on('error', (error) => {
    process.stderr.write(`static-server fatal: ${error?.stack || error}\n`);
    process.exit(1);
  });

  await new Promise((resolve) => server.listen(options.port, options.host, resolve));

  const address = server.address();
  const url = `http://${options.host}:${address.port}`;
  process.stdout.write(`${JSON.stringify({ ready: true, url, root: options.root })}\n`);

  const shutdown = () => {
    server.close(() => process.exit(0));
    // Do not wait forever on keep-alive sockets.
    setTimeout(() => process.exit(0), 2_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  process.stderr.write(`static-server failed: ${error?.stack || error}\n`);
  process.exit(1);
});
