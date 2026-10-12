// Local, read-only QA server. No .env, real identity, database or team API.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { getFixture } from './draft-analysis-qa/fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.NXT5_QA_PORT || 5192);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid QA port');
const origin = `http://127.0.0.1:${port}`;
const publicAssets = process.env.NXT5_QA_PUBLIC_ASSETS === '1';
const imageCache = new Map();
const json = (res, payload, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(payload));
const server = await createServer({
  configFile: false, envFile: false, root, appType: 'mpa',
  plugins: [react(), { name: 'local-draft-analysis-qa', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end('Local QA only'); return; }
      const url = new URL(req.url || '/', origin);
      if (['/', '/tendances', '/games'].includes(url.pathname)) { req.url = '/tools/draft-analysis-qa/index.html'; next(); return; }
      if (!url.pathname.startsWith('/.netlify/functions/')) { next(); return; }
      if (url.pathname === '/.netlify/functions/account-subscription') { json(res, { subscription: { status: 'none', planCode: 'free' } }); return; }
      if (url.pathname === '/.netlify/functions/opponents-drafts') {
        const referer = new URL(req.headers.referer || origin);
        const fixture = getFixture(referer.searchParams.get('qa') || 'full');
        if (fixture.scenario === 'error') { json(res, { error: 'Échec de chargement simulé pour la QA locale.' }, 503); return; }
        if (fixture.scenario === 'loading') { req.on('close', () => res.end()); return; }
        json(res, fixture.payload); return;
      }
      if (url.pathname === '/.netlify/functions/asset-proxy') {
        // Opt-in public champion art only; no cookie or account credential leaves
        // this local process. The default exercises the real native fallback.
        if (!publicAssets) { res.writeHead(404).end(); return; }
        try {
          const target = new URL(url.searchParams.get('url') || '');
          if (target.protocol !== 'https:' || target.username || target.password || target.port ||
            !['ddragon.leagueoflegends.com', 'raw.communitydragon.org'].includes(target.hostname)) { res.writeHead(403).end(); return; }
          let asset = imageCache.get(target.href);
          if (!asset) {
            const response = await fetch(target.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
            const type = response.headers.get('content-type') || '';
            if (!response.ok || !type.startsWith('image/')) { res.writeHead(404).end(); return; }
            const body = Buffer.from(await response.arrayBuffer());
            if (body.length > 5 * 1024 * 1024) { res.writeHead(413).end(); return; }
            asset = { type, body }; imageCache.set(target.href, asset);
          }
          res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'public, max-age=3600' }).end(asset.body);
        } catch { res.writeHead(404).end(); }
        return;
      }
      json(res, { error: 'Endpoint absent du harness local.' }, 404);
    });
  } }],
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root] } },
  optimizeDeps: { entries: ['tools/draft-analysis-qa/index.html'] },
});
await server.listen();
console.log(`QA Drafts & bans : ${origin}/tendances?rubrique=drafts&qa=full\nDonnées fictives seulement ; images publiques : ${publicAssets ? 'activées' : 'désactivées'}.\nCtrl+C pour arrêter.`);
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; await server.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
