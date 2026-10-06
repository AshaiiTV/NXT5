import { canonicalChampion } from './champions.js';

export const DDRAGON_FALLBACK_VERSIONS = ['16.16.1', '16.15.1', '16.14.1', '16.13.1', '16.11.1', '15.24.1'];

export function championPortraitUrls(rowOrChampion, explicitChampion = '') {
  const championId = rowOrChampion?.raw?.championId || rowOrChampion?.championId;
  const champion = explicitChampion || (typeof rowOrChampion === 'string' ? rowOrChampion : rowOrChampion?.champion);
  const id = canonicalChampion(champion);
  return [...new Set([
    championId ? `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png` : '',
    ...DDRAGON_FALLBACK_VERSIONS.map(version => id ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png` : ''),
    id ? `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg` : '',
  ].filter(Boolean))];
}

export function itemIconUrls(itemId) {
  const id = Number(itemId || 0);
  if (!id) return [];
  return [...new Set([
    ...DDRAGON_FALLBACK_VERSIONS.map(version => `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`),
    `https://raw.communitydragon.org/latest/game/assets/items/icons2d/${id}.png`,
    `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/${id}.png`,
  ])];
}
