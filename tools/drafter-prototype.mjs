// Review the real component, importer, handler and SQL migration locally.
// Authentication and database alone are replaced by a local demo identity and
// persistent PGlite. This runner never reads .env or uses a production database.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { build } from 'esbuild';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.NXT5_PROTOTYPE_PORT || 5188);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid prototype port');
const origin = `http://127.0.0.1:${port}`;
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
process.env.PUBLIC_SITE_URL = origin;
const runtimePath = fileURLToPath(new URL('./drafter-prototype/runtime.mjs', import.meta.url));
const runtime = await import(pathToFileURL(runtimePath).href);
const bundleDir = resolve(root, '.nxt5-drafter-prototype');
await mkdir(bundleDir, { recursive: true });
const outfile = resolve(bundleDir, 'handler.mjs');
await build({
  entryPoints: [resolve(root, 'netlify/functions/opponents-drafts.ts')], outfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'local-prototype-only', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)(?:auth|db)$/ }, args => {
      const target = resolve(dirname(args.importer), args.path);
      if (target === resolve(root, 'netlify/functions/_lib/auth') || target === resolve(root, 'netlify/functions/_lib/db')) {
        return { path: pathToFileURL(runtimePath).href, external: true };
      }
    });
  } }],
});
const { default: handler } = await import(pathToFileURL(outfile).href);
const assetOutfile = resolve(bundleDir, 'asset-proxy.mjs');
await build({ entryPoints: [resolve(root, 'netlify/functions/asset-proxy.ts')], outfile: assetOutfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { default: assetHandler } = await import(pathToFileURL(assetOutfile).href);
const matchOutfile = resolve(bundleDir, 'match-details.mjs');
await build({ entryPoints: [resolve(root, 'netlify/functions/match-details.ts')], outfile: matchOutfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'local-match-runtime', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)(?:auth|db)$/ }, args => {
      const target = resolve(dirname(args.importer), args.path);
      if (target === resolve(root, 'netlify/functions/_lib/auth') || target === resolve(root, 'netlify/functions/_lib/db')) {
        return { path: pathToFileURL(runtimePath).href, external: true };
      }
    });
  } }],
});
const { default: matchHandler } = await import(pathToFileURL(matchOutfile).href);
const server = await createServer({
  configFile: false, envFile: false, root, appType: 'mpa', plugins: [react(), {
    name: 'drafter-prototype-api', configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        // No network exposure or DNS-rebinding entry into the demo identity.
        if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end('Local prototype only'); return; }
        if (['/', '/games', '/tendances'].includes(new URL(req.url || '/', origin).pathname)) req.url = '/tools/drafter-prototype/index.html';
        if (!req.url?.startsWith('/.netlify/functions/')) { next(); return; }
        const pathname = new URL(req.url, origin).pathname;
        if (pathname === '/.netlify/functions/prototype-data' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(await runtime.getDemoData())); return;
        }
        const routeHandler = pathname === '/.netlify/functions/opponents-drafts' ? handler
          : pathname === '/.netlify/functions/asset-proxy' ? assetHandler
          : pathname === '/.netlify/functions/match-details' ? matchHandler : null;
        if (!routeHandler) { res.writeHead(404).end(); return; }
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 65536) { res.writeHead(413).end(); return; }
            chunks.push(chunk);
          }
          const request = new Request(origin + req.url, {
            method: req.method, headers: new Headers(Object.entries(req.headers).flatMap(([key, value]) =>
              value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]])),
            ...(!['GET', 'HEAD'].includes(req.method || '') ? { body: Buffer.concat(chunks) } : {}),
          });
          const response = await routeHandler(request, {});
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Le prototype local ne peut pas répondre.' })); }
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root] } },
  optimizeDeps: { entries: ['tools/drafter-prototype/index.html'] },
});
await server.listen();
console.log(`Prototype NXT5 : ${origin}\nDonnées locales persistantes : .nxt5-drafter-prototype/db\nCtrl+C pour arrêter.`);
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; await server.close(); await runtime.db.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
