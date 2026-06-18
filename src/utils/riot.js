const GAME_ID_PATTERN = /^EUW1_\d{10,}$/;
const RIOT_ID_PATTERN = /^[^#\s][^#]{1,30}#[A-Za-z0-9]{2,5}$/;

export function normalizeGameId(value) {
  return String(value || "").trim().toUpperCase();
}

export function isValidGameId(value) {
  return GAME_ID_PATTERN.test(normalizeGameId(value));
}

export function parseGameId(value) {
  const gameId = normalizeGameId(value);
  if (!isValidGameId(gameId)) {
    throw new Error("Game ID invalide. Format attendu : EUW1_XXXXXXXXXX.");
  }
  const [platform, numericId] = gameId.split("_");
  return { gameId, platform, numericId };
}

export function normalizeRiotId(value) {
  return String(value || "").trim().replace(/\s*#\s*/g, "#");
}

export function isValidRiotId(value) {
  return RIOT_ID_PATTERN.test(normalizeRiotId(value));
}

export function buildChampionPool(rows = []) {
  const pool = new Map();
  for (const row of rows) {
    const champion = String(row?.champion || "").trim();
    if (!champion) continue;
    const playerId = String(row?.player_id || row?.playerId || row?.player_name || row?.playerName || "team");
    const key = `${playerId}:${champion.toLowerCase()}`;
    const current = pool.get(key) || {
      player_id: row?.player_id || row?.playerId || null,
      player_name: row?.player_name || row?.playerName || "",
      champion,
      games: 0,
      wins: 0,
      losses: 0,
      kdaTotal: 0,
    };
    const won = row?.result === "Victoire" || row?.win === true || row?.won === true;
    const kills = Number(row?.kills || 0);
    const deaths = Number(row?.deaths || 0);
    const assists = Number(row?.assists || 0);
    current.games += 1;
    current.wins += won ? 1 : 0;
    current.losses += won ? 0 : 1;
    current.kdaTotal += (kills + assists) / Math.max(1, deaths);
    pool.set(key, current);
  }
  return Array.from(pool.values())
    .map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      champion: row.champion,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      winrate: row.games ? Math.round((row.wins / row.games) * 100) : 0,
      kda: row.games ? Number((row.kdaTotal / row.games).toFixed(2)) : 0,
    }))
    .sort((a, b) => (b.games - a.games) || (b.winrate - a.winrate) || a.champion.localeCompare(b.champion));
}
