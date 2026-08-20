export function assetProxyUrl(url) {
  return url ? `/.netlify/functions/asset-proxy?url=${encodeURIComponent(url)}` : "";
}

export function cleanOpponentName(value) {
  const text = String(value || "").trim();
  return /^(enemy team|adversaire inconnu)$/i.test(text) ? "" : text;
}

export function opponentLabelFromParticipants(match) {
  const names = (match?.participants || [])
    .filter((row) => row.team_key === "ENEMY")
    .map((row) => row.summoner_name || row.riot_id)
    .map((name) => String(name || "").split("#")[0].trim())
    .filter(Boolean);
  if (!names.length) return "";
  if (names.length <= 2) return names.join(" / ");
  return `${names.slice(0, 2).join(" / ")} +${names.length - 2}`;
}

export function matchDisplayName(match, fallback = "Game") {
  return cleanOpponentName(match?.raw?.nxt5Label) || cleanOpponentName(match?.opponent) || opponentLabelFromParticipants(match) || match?.game_id || fallback;
}

export function matchCategoryIds(match) {
  const ids = Array.isArray(match?.category_ids) ? match.category_ids : [];
  const combined = [...ids, match?.category_id].map((id) => String(id || "").trim()).filter(Boolean);
  return [...new Set(combined)];
}

export function matchHasCategory(match, categoryId) {
  if (!categoryId) return true;
  return matchCategoryIds(match).some((id) => String(id) === String(categoryId));
}

export function opponentRoleRow(match, role, participantId = 0) {
  const enemies = (match?.participants || []).filter((row) => row.team_key === "ENEMY");
  const wantedRole = String(role || "").toUpperCase();
  const order = ["TOP", "JGL", "MID", "ADC", "SUP"];
  return enemies.find((item) => String(item.role || "").toUpperCase() === wantedRole)
    || enemies.find((item) => Number(item.raw?.participantId || item.participantId || 0) === Number(participantId || 0) + 5)
    || enemies[Math.max(0, order.indexOf(wantedRole))] || null;
}
