const http = require('node:http');
const { exec } = require('node:child_process');

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

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command, () => {});
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function html(error = '') {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NXT5 Importer</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 20% 0%, rgba(34,211,238,.25), transparent 34%), radial-gradient(circle at 84% 5%, rgba(217,70,239,.22), transparent 32%), linear-gradient(135deg, #040711, #08111f 52%, #02030a); color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 42px 42px; mask-image: radial-gradient(circle at center, black, transparent 78%); }
    main { position: relative; width: min(92vw, 780px); border: 1px solid rgba(34,211,238,.22); border-radius: 28px; padding: 30px; background: rgba(5,9,20,.86); box-shadow: 0 0 80px rgba(34,211,238,.18); backdrop-filter: blur(18px); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 22px; }
    h1 { margin: 0; font-size: clamp(38px, 6vw, 68px); line-height: .9; letter-spacing: -.03em; text-transform: uppercase; }
    .mark { display: grid; place-items: center; width: 104px; height: 104px; border: 1px solid rgba(34,211,238,.35); border-radius: 28px; color: #67e8f9; font-size: 68px; font-weight: 1000; background: linear-gradient(135deg, rgba(34,211,238,.12), rgba(217,70,239,.16)); box-shadow: 0 0 60px rgba(34,211,238,.24); }
    p { color: #cbd5e1; line-height: 1.7; font-weight: 700; }
    label { display: block; margin-top: 16px; }
    label span { display: block; margin-bottom: 8px; color: #94a3b8; font-size: 11px; font-weight: 1000; letter-spacing: .22em; text-transform: uppercase; }
    input { width: 100%; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 15px 16px; color: white; background: rgba(15,23,42,.74); outline: none; font-size: 15px; font-weight: 800; }
    input:focus { border-color: rgba(34,211,238,.64); box-shadow: 0 0 0 4px rgba(34,211,238,.1); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    button { width: 100%; margin-top: 22px; border: 0; border-radius: 18px; padding: 17px 18px; color: #020617; background: linear-gradient(135deg, #67e8f9, #38bdf8 45%, #d946ef); font-weight: 1000; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; box-shadow: 0 0 32px rgba(34,211,238,.22); }
    .error { margin-top: 18px; border: 1px solid rgba(251,113,133,.34); border-radius: 18px; padding: 15px 16px; color: #ffe4e6; background: rgba(244,63,94,.14); font-weight: 900; line-height: 1.5; }
    code { color: #67e8f9; }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <h1>NXT5 Importer</h1>
        <p>Colle un Game ID Riot, ajoute ta clé Riot temporaire, puis génère un fichier JSON prêt à importer dans NXT5.</p>
      </div>
      <div class="mark">5</div>
    </div>
    <form method="post" action="/export">
      <label><span>Game ID</span><input name="gameId" placeholder="EUW1_7123456789" required /></label>
      <label><span>Clé Riot API</span><input name="apiKey" placeholder="RGAPI-..." required /></label>
      <div class="grid">
        <label><span>Nom de l'import</span><input name="label" placeholder="Scrim, tournoi, round..." /></label>
        <label><span>Adversaire</span><input name="opponent" placeholder="Equipe adverse" /></label>
      </div>
      <button type="submit">Générer le fichier NXT5</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <p>Ensuite : NXT5 → Intégration → <code>Importer un fichier NXT5 local</code>.</p>
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
    let detail = '';
    try {
      const payload = await riotResponse.json();
      detail = payload?.status?.message || payload?.message || '';
    } catch {
      detail = await riotResponse.text().catch(() => '');
    }
    if (riotResponse.status === 401 || riotResponse.status === 403) return send(res, 403, html('Riot refuse la clé API. Vérifie qu’elle est valide et pas expirée.'));
    if (riotResponse.status === 404) return send(res, 404, html('Game introuvable. Vérifie le Game ID et son préfixe serveur.'));
    if (riotResponse.status === 429) return send(res, 429, html('Rate limit Riot atteint. Attends un peu avant de réessayer.'));
    return send(res, riotResponse.status, html(`Erreur Riot ${riotResponse.status}. ${detail}`));
  }

  const match = await riotResponse.json();
  const payload = {
    source: 'nxt5-importer-exe',
    version: 1,
    gameId,
    label,
    opponent,
    exportedAt: new Date().toISOString(),
    match
  };
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="nxt5-${gameId}.json"`
  });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/export') return await handleExport(req, res);
    return send(res, 200, html());
  } catch (err) {
    return send(res, 500, html(err.message || 'Erreur locale inconnue.'));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`NXT5 Importer: ${url}`);
  openBrowser(url);
});
