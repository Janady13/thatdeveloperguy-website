/** Serves dist/site with the same rules as the nginx vhost (no SPA fallback, real 404s, trailing-slash redirect) for local browser tests. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
const site = resolve(import.meta.dirname, '../dist/site');
const port = Number(process.env.PORT ?? 4411);
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.riv': 'application/octet-stream', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path.length > 1 && path.endsWith('/')) { res.writeHead(301, { location: path.replace(/\/+$/, '') + url.search }); res.end(); return; }
  const send = (file: string, status = 200) => { res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'x-robots-tag': 'noindex' }); createReadStream(file).pipe(res); };
  const direct = join(site, path);
  if (existsSync(direct) && statSync(direct).isFile()) return send(direct);
  const index = join(site, path, 'index.html');
  if (existsSync(index)) return send(index);
  send(join(site, '404.html'), 404);
}).listen(port, '127.0.0.1', () => console.log(`dist/site on http://127.0.0.1:${port}`));
