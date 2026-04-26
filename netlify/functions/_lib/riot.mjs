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

export function regionFromGameId(gameId) {
  const platform = String(gameId || '').split('_')[0]?.toUpperCase();
  return ROUTES[platform] || 'EUROPE';
}

export async function fetchRiotMatch(gameId) {
  if (!process.env.RIOT_API_KEY) {
    throw Object.assign(new Error('RIOT_API_KEY manquante. Configure la clé Riot dans Netlify.'), { status: 500 });
  }

  const regional = regionFromGameId(gameId).toLowerCase();
  const url = `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`;
  const response = await fetch(url, {
    headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
  });

  if (response.status === 404) throw Object.assign(new Error('Game ID introuvable côté Riot.'), { status: 404 });
  if (response.status === 429) throw Object.assign(new Error('Rate limit Riot atteint. Réessaie plus tard ou ajoute du cache.'), { status: 429 });
  if (!response.ok) throw Object.assign(new Error(`Erreur Riot API ${response.status}.`), { status: response.status });

  return response.json();
}
