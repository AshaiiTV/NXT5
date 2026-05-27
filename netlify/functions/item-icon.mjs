const DDRAGON_ITEM_BASE = 'https://ddragon.leagueoflegends.com/cdn/16.11.1/img/item/';
const CDRAGON_ITEMS = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json';
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';

let itemIconMap = null;
let itemIconMapLoadedAt = 0;

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function notFound() {
  return new Response('Item icon not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function loadItemIconMap() {
  const fresh = itemIconMap && Date.now() - itemIconMapLoadedAt < 12 * 60 * 60 * 1000;
  if (fresh) return itemIconMap;

  const response = await fetch(CDRAGON_ITEMS, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NXT5'
    }
  });
  if (!response.ok) return itemIconMap || new Map();

  const items = await response.json();
  itemIconMap = new Map((Array.isArray(items) ? items : []).map((item) => {
    const path = String(item?.iconPath || '').toLowerCase().replace('/lol-game-data/assets', '/assets');
    return [String(item?.id || ''), path ? `${CDRAGON_BASE}${path}` : ''];
  }).filter(([id, path]) => id && path));
  itemIconMapLoadedAt = Date.now();
  return itemIconMap;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').replace(/[^0-9]/g, '');
  if (!id || id === '0') return notFound();

  const map = await loadItemIconMap();
  const cdragonUrl = map.get(id);
  return redirect(cdragonUrl || `${DDRAGON_ITEM_BASE}${id}.png`);
}
