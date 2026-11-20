export function publicDrafterLink(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(input)) return null;
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'drafter.lol' || url.port || url.username || url.password) return null;
  const path = /^\/draft\/([A-Za-z0-9_-]{6,64})$/.exec(url.pathname);
  const games = url.searchParams.getAll('game');
  if (!path || games.length > 1 || (games.length === 1 && !/^[1-5]$/.test(games[0]))) return null;
  const gameNumber = games.length ? Number(games[0]) : 1;
  return { sourceId: path[1], gameNumber, sourceUrl: `https://drafter.lol/draft/${path[1]}?game=${gameNumber}` };
}
