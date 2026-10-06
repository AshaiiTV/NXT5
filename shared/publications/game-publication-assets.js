import { championPortraitUrls, itemIconUrls } from '../riot-assets.js';

// Both adapters use the same icons and fallbacks for the standard game PNG.
export async function loadGamePublicationAssets(snapshot, loadImage) {
  const champions = new Map();
  const items = new Map();
  const load = async (sources) => {
    for (const url of sources.slice(0, 2)) {
      try { const image = await loadImage(url); if (image) return image; } catch { /* Optional icon: try the next source. */ }
    }
    return null;
  };
  const names = [...new Set(snapshot.participants.map(row => row.champion).filter(Boolean))];
  const ids = [...new Set(snapshot.participants.flatMap(row => [...row.items, row.trinket]).filter(id => Number.isSafeInteger(id) && id > 0))];
  await Promise.all([
    ...names.map(async name => champions.set(name, await load(championPortraitUrls(name, name)))),
    ...ids.map(async id => items.set(id, await load(itemIconUrls(id)))),
  ]);
  return { champions, items };
}
