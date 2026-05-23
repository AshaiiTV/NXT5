import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 5315);

const ROUTES = {
  EUW1: 'EUROPE',
  EUN1: 'EUROPE',
  TR1: 'EUROPE',
  RU: 'EUROPE',
  NA1: 'AMERICAS',
  BR1: 'AMERICAS',
  LA1: 'AMERICAS',
  LA2: 'AMERICAS',
  KR: 'ASIA',
  JP1: 'ASIA',
  OC1: 'SEA',
  PH2: 'SEA',
  SG2: 'SEA',
  TH2: 'SEA',
  TW2: 'SEA',
  VN2: 'SEA'
};

function regionalFromMatchId(matchId) {
  const platform = String(matchId || '').split('_')[0]?.toUpperCase();
  return ROUTES[platform] || 'EUROPE';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Payload trop lourd.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function html(error = '') {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NXT5 Importer</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #12204d, #050814 58%, #02030a); color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    main { width: min(92vw, 680px); border: 1px solid rgba(34,211,238,.22); border-radius: 28px; padding: 30px; background: rgba(5,9,20,.86); box-shadow: 0 0 80px rgba(34,211,238,.18); }
    h1 { margin: 0; font-size: 42px; letter-spacing: .04em; }
    p { color: #94a3b8; line-height: 1.7; font-weight: 650; }
    label { display: block; margin-top: 18px; color: #bae6fd; font-size: 12px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; }
    input, select { width: 100%; box-sizing: border-box; margin-top: 8px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.28); color: white; padding: 14px 16px; font-size: 15px; font-weight: 800; outline: none; }
    input:focus, select:focus { border-color: rgba(34,211,238,.55); box-shadow: 0 0 0 4px rgba(34,211,238,.08); }
    button { margin-top: 22px; width: 100%; border: 0; border-radius: 18px; padding: 16px 18px; color: #031018; background: linear-gradient(135deg, #67e8f9, #38bdf8 48%, #d946ef); font-weight: 1000; text-transform: uppercase; letter-spacing: .16em; cursor: pointer; }
    .error { margin-top: 18px; border: 1px solid rgba(251,113,133,.35); border-radius: 18px; padding: 14px; color: #ffe4e6; background: rgba(244,63,94,.12); font-weight: 800; }
    code { color: #67e8f9; }
  </style>
</head>
<body>
  <main>
    <h1>NXT5 Importer</h1>
    <p>Colle un Game ID Riot, ajoute une clé Riot valide, et l'outil génère un fichier JSON à importer dans NXT5. La clé reste sur cette appli locale et n'est pas stockée.</p>
    <form method="post" action="/export">
      <label>Game ID</label>
      <input name="gameId" placeholder="EUW1_7123456789" required />
      <label>Clé Riot API</label>
      <input name="apiKey" placeholder="RGAPI-..." required />
      <label>Nom de l'import</label>
      <input name="label" placeholder="Scrim, tournoi, round..." />
      <label>Adversaire</label>
      <input name="opponent" placeholder="Equipe adverse" />
      <button type="submit">Générer le JSON NXT5</button>
    </form>
    ${error ? `<div class="error">${error}</div>` : ''}
    <p>Ensuite : NXT5 > Intégration > <code>Importer un fichier NXT5 local</code>.</p>
  </main>
</body>
</html>`;
}

async function handleExport(req, res) {
  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const gameId = String(params.get('gameId') || '').trim().toUpperCase();
  const apiKey = String(params.get('apiKey') || '').trim();
  const label = String(params.get('label') || '').trim();
  const opponent = String(params.get('opponent') || '').trim();
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) return send(res, 400, html('Game ID invalide. Format attendu : EUW1_7123456789.'));
  if (!apiKey.startsWith('RGAPI-')) return send(res, 400, html('Clé Riot invalide. Elle doit commencer par RGAPI-.'));

  const regional = regionalFromMatchId(gameId).toLowerCase();
  const riotResponse = await fetch(`https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`, {
    headers: { 'X-Riot-Token': apiKey }
  });
  if (!riotResponse.ok) {
    const detail = await riotResponse.text().catch(() => '');
    return send(res, riotResponse.status, html(`Riot refuse la récupération (${riotResponse.status}). Vérifie la clé, le Game ID et la région. ${detail.slice(0, 180)}`));
  }
  const match = await riotResponse.json();
  const payload = {
    source: 'nxt5-local-importer',
    version: 1,
    gameId,
    label,
    opponent,
    exportedAt: new Date().toISOString(),
    match
  };
  const filename = `nxt5-${gameId}.json`;
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`
  });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    if (req.method === 'POST' && url.pathname === '/export') return await handleExport(req, res);
    return send(res, 200, html());
  } catch (err) {
    return send(res, 500, html(err.message || 'Erreur locale inconnue.'));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NXT5 Importer local: http://127.0.0.1:${PORT}`);
});
