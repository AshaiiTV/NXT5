// Local QA server for the draft room lobby, deletion and correction. Synthetic state only:
// no .env, identity, database or team API. Rooms live in memory until the server stops.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { draftTurns } from '../shared/draft-order.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dependencyRoot = realpathSync(new URL('../node_modules', import.meta.url));
const port = Number(process.env.NXT5_QA_PORT || 5194);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid QA port');
const origin = `http://127.0.0.1:${port}`;
const teamId = '00000000-0000-4000-8000-0000000000aa';
const invite = 'q'.repeat(43);
const names = ['Lissandra','Vi','Aatrox','JarvanIV','MonkeyKing','Taliyah','Neeko','XinZhao','Ezreal','Hwei','Amumu','Syndra','Olaf','Alistar','Kaisa','Trundle','Renekton','Malphite','Ashe','Bard'];
const second = ['JarvanIV','Lissandra','Vi','Aatrox','Taliyah','MonkeyKing','Nocturne','Viktor','Ornn','Orianna','Sett','Xayah','Braum','Nautilus','Rakan',null,'Pantheon','Sivir','Leona','Swain'];
const fresh = () => [
  { id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-11-22T18:00:00Z', blue: 'Équipe Test', red: 'Rivaux fictifs', mode: 'fearless', length: 2, linked: [true, false],
    games: [{ side: 'blue', firstPick: 'blue', moves: names }, { side: 'red', firstPick: 'blue', moves: second, swap: true }] },
  { id: '22222222-2222-4222-8222-222222222222', createdAt: '2026-11-21T20:30:00Z', blue: 'Équipe Test', red: 'Adversaire très long nom pour tester le retour à la ligne', mode: 'standard', length: 1, linked: [false],
    games: [{ side: 'blue', firstPick: 'blue', moves: names.slice(0, 7) }] },
  { id: '33333333-3333-4333-8333-333333333333', createdAt: '2026-11-19T09:00:00Z', blue: 'Équipe Test', red: 'Adversaire', mode: 'standard', length: 1, linked: [false],
    games: [{ side: 'blue', firstPick: 'blue', moves: [] }] },
];
let rooms = fresh();
const json = (res, payload, status = 200) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(payload));
const picks = game => game.moves.filter((c, i) => c && draftTurns(game.firstPick)[i][0] === 'pick');
function view(room, n) {
  const game = room.games[n - 1];
  return { id: room.id, gameId: room.id + '-' + n, gameNumber: n, seriesLength: room.length, turnSeconds: 0, turnStartedAt: null, serverTime: Date.now(),
    canStart: false, latestGame: room.games.length, mode: room.mode, firstPick: game.firstPick,
    blocked: room.mode === 'fearless' ? room.games.slice(0, n - 1).flatMap(picks) : [],
    blueName: game.swap ? room.red : room.blue, redName: game.swap ? room.blue : room.red, moves: game.moves, side: game.side,
    invite, spectatorInvite: 'watch.' + invite, matchId: room.linked[n - 1] ? '44444444-4444-4444-8444-444444444444' : null,
    started: game.moves.length > 0 || Boolean(game.hostReady && game.guestReady),
    ready: { [game.side]: Boolean(game.hostReady), [game.side === 'blue' ? 'red' : 'blue']: Boolean(game.guestReady) },
    canReady: game.moves.length === 0 && !game.hostReady };
}
async function readBody(req) {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
const server = await createServer({
  configFile: false, envFile: false, root, appType: 'mpa',
  plugins: [react(), { name: 'local-draft-room-qa', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end('Local QA only'); return; }
      const url = new URL(req.url || '/', origin);
      if (['/', '/draft/salle'].includes(url.pathname)) { req.url = '/tools/draft-room-qa/index.html'; next(); return; }
      if (url.pathname === '/__qa/reset') { rooms = fresh(); json(res, { ok: true }); return; }
      if (url.pathname === '/.netlify/functions/asset-proxy') {
        // Public champion art only (set NXT5_QA_PUBLIC_ASSETS=0 to exercise the initials fallback). No cookie leaves this process.
        if (process.env.NXT5_QA_PUBLIC_ASSETS === '0') { res.writeHead(404).end(); return; }
        try {
          const target = new URL(url.searchParams.get('url') || '');
          if (target.protocol !== 'https:' || !['ddragon.leagueoflegends.com', 'raw.communitydragon.org'].includes(target.hostname)) { res.writeHead(403).end(); return; }
          const response = await fetch(target.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
          const type = response.headers.get('content-type') || '';
          if (!response.ok || !type.startsWith('image/')) { res.writeHead(404).end(); return; }
          res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' }).end(Buffer.from(await response.arrayBuffer()));
        } catch { res.writeHead(404).end(); }
        return;
      }
      if (url.pathname !== '/.netlify/functions/draft-rooms') {
        if (url.pathname.startsWith('/.netlify/functions/')) { json(res, { error: 'Endpoint absent du harness local.' }, 404); return; }
        next(); return;
      }
      let body; try { body = await readBody(req); } catch { json(res, { error: 'Requête QA invalide.' }, 400); return; }
      if (body.teamId !== teamId) { json(res, { error: 'Accès à cette équipe refusé.' }, 403); return; }
      if (body.action === 'list') {
        json(res, { canEdit: true, rooms: rooms.map(r => { const g = r.games[r.games.length - 1];
          return { id: r.id, blue_name: g.swap ? r.red : r.blue, red_name: g.swap ? r.blue : r.red, game_number: r.games.length, series_length: r.length, step: g.moves.length, linked: r.linked.filter(Boolean).length,
            ally_side: g.side, mode: r.mode, first_pick: g.firstPick, moves: g.moves, created_at: r.createdAt }; }) });
        return;
      }
      const room = rooms.find(r => r.id === body.roomId);
      if (!room) { json(res, { error: 'Salle introuvable ou invitation invalide.' }, 404); return; }
      const n = body.gameNumber || room.games.length;
      if (body.action === 'read') { json(res, { room: view(room, n) }); return; }
      if (body.action === 'ready') { const game = room.games[n - 1]; game.hostReady = true; json(res, { room: view(room, n) }); return; }
      if (body.action === '__guest_ready') { room.games[n - 1].guestReady = true; json(res, { room: view(room, n) }); return; }
      if (body.action === 'delete') { rooms = rooms.filter(r => r !== room); json(res, { deleted: { id: room.id, games: room.games.length, drafts: room.games.length } }); return; }
      if (body.action === 'correct') {
        const game = room.games[n - 1];
        if (JSON.stringify(body.expected) !== JSON.stringify(game.moves)) { json(res, { error: 'Le plateau a changé. Vérifie le tour en cours.' }, 409); return; }
        const others = new Set(room.mode === 'fearless' ? room.games.filter((_, i) => i !== n - 1).flatMap(picks) : []);
        const clash = body.moves.find((c, i) => c && draftTurns(game.firstPick)[i][0] === 'pick' && others.has(c));
        if (clash) { json(res, { error: `${clash} est déjà joué dans une autre partie de la série Fearless.` }, 409); return; }
        game.moves = body.moves; json(res, { room: view(room, n) }); return;
      }
      json(res, { error: 'Cette action n’est pas simulée par le harness.' }, 501);
    });
  } }],
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, dependencyRoot] } },
  optimizeDeps: { entries: ['tools/draft-room-qa/index.html'] },
});
await server.listen();
console.log(`QA Salle de draft : ${origin}/draft/salle\nDonnées fictives en mémoire ; ${origin}/__qa/reset les restaure.\nCtrl+C pour arrêter.`);
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; await server.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
