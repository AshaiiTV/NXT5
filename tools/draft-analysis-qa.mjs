// Local QA server with synthetic state only. No .env, real identity, database or team API.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getFixture, getOpponentFixture, teamId } from './draft-analysis-qa/fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
// Dependencies can be shared through a checkout-local symlink. Allow only its
// resolved directory as well as this checkout, including bundled Inter fonts.
const dependencyRoot = realpathSync(new URL('../node_modules', import.meta.url));
const port = Number(process.env.NXT5_QA_PORT || 5192);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid QA port');
const origin = `http://127.0.0.1:${port}`;
const publicAssets = process.env.NXT5_QA_PUBLIC_ASSETS === '1';
const imageCache = new Map();
const fixtureSessions = new Map();
const json = (res, payload, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(payload));
function fixtureFor(req) {
  const referer = new URL(req.headers.referer || origin);
  const surface = req.headers['x-nxt5-qa-surface'] === 'opponents' || referer.pathname === '/games' ? 'opponents' : 'drafts';
  const scenario = String(req.headers['x-nxt5-qa-scenario'] || referer.searchParams.get('qa') || 'full');
  const key = `${surface}:${scenario}`;
  if (!fixtureSessions.has(key)) fixtureSessions.set(key, structuredClone(surface === 'opponents' ? getOpponentFixture(scenario) : getFixture(scenario)));
  return fixtureSessions.get(key);
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('Request too large'); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
const server = await createServer({
  configFile: false, envFile: false, root, appType: 'mpa',
  plugins: [react(), { name: 'local-draft-analysis-qa', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end('Local QA only'); return; }
      const url = new URL(req.url || '/', origin);
      if (['/', '/tendances', '/games'].includes(url.pathname)) { req.url = '/tools/draft-analysis-qa/index.html'; next(); return; }
      if (!url.pathname.startsWith('/.netlify/functions/')) { next(); return; }
      if (url.pathname === '/.netlify/functions/account-subscription') { json(res, { subscription: { status: 'none', planCode: 'free' } }); return; }
      if (url.pathname === '/.netlify/functions/opponents-drafts' || url.pathname === '/.netlify/functions/match-details') {
        const fixture = fixtureFor(req);
        if (fixture.scenario === 'error') { json(res, { error: 'Échec de chargement simulé pour la QA locale.' }, 503); return; }
        if (fixture.scenario === 'loading') return; // Wait for the real client timeout/abort.
        let body;
        try { body = await readBody(req); } catch { json(res, { error: 'Requête QA invalide.' }, 400); return; }
        if (body.teamId && body.teamId !== teamId) { json(res, { error: 'Équipe absente du harness local.' }, 403); return; }
        if (url.pathname === '/.netlify/functions/match-details') {
          const ids = Array.isArray(body.matchIds) ? body.matchIds : [];
          json(res, { matches: fixture.data.matches.filter(match => ids.includes(match.id)) }); return;
        }
        const collection = fixture.payload;
        const canEdit = collection.canEdit !== false;
        const match = fixture.data.matches.find(value => value.id === body.matchId);
        const group = collection.opponentGroups?.find(value => value.id === body.archiveId);
        const action = body.action || 'list';
        if (action === 'list') { json(res, collection); return; }
        if (action === 'list-opponents') { json(res, { opponents: collection.opponents, canEdit }); return; }
        if (action === 'get-match-draft') {
          json(res, { draft: collection.drafts.find(draft => draft.matchId === body.matchId) || null, opponents: collection.opponents, canEdit }); return;
        }
        if (action === 'get-match-opponent') {
          json(res, { opponentId: match?.opponent_id || null, opponents: collection.opponents,
            linkedGroups: (collection.opponentGroups || []).filter(value => value.matchIds.includes(body.matchId)).map(({ id, name, opponentId }) => ({ id, name, opponentId })), canEdit }); return;
        }
        if (action === 'get-group-opponent') {
          json(res, { opponentId: group?.opponentId || null, matchCount: group?.matchIds.length || 0, opponents: collection.opponents, canEdit }); return;
        }
        if (action === 'create-opponent') {
          if (!canEdit) { json(res, { error: 'Scénario QA en lecture seule.' }, 403); return; }
          const name = typeof body.name === 'string' ? body.name.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
          const notes = typeof body.notes === 'string' ? body.notes.replace(/\r\n?/g, '\n').trim() : '';
          if (!name || name.length > 80 || notes.length > 2000) { json(res, { error: 'Nom ou notes invalides pour la fiche fictive.' }, 400); return; }
          let opponent = collection.opponents.find(value => value.name.toLocaleLowerCase('fr-FR') === name.toLocaleLowerCase('fr-FR'));
          if (!opponent) {
            opponent = { id: `qa-created-${collection.opponents.length + 1}`, name, notes, createdAt: '2026-10-12T18:00:00.000Z' };
            collection.opponents.push(opponent);
          }
          json(res, { opponent }); return;
        }
        json(res, { error: 'Cette action n’est pas simulée par le harness. Aucune donnée réelle n’a été modifiée.' }, 501); return;
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
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, dependencyRoot] } },
  optimizeDeps: { entries: ['tools/draft-analysis-qa/index.html'] },
});
await server.listen();
console.log(`QA Drafts & bans : ${origin}/tendances?rubrique=drafts&qa=full\nQA Équipes adverses : ${origin}/games?view=teams&qa=full\nDonnées fictives seulement ; images publiques : ${publicAssets ? 'activées' : 'désactivées'}.\nLes fiches créées restent en mémoire locale jusqu’à l’arrêt du serveur.\nCtrl+C pour arrêter.`);
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; await server.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
