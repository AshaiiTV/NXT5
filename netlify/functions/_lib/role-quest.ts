// Riot Data Dragon 16.23.1, data/en_US/item.json. Some rewards replace the
// quest itself in roleBoundItem (bot boots and support Control Wards).
const itemsByRole = {
  TOP: [1090, 1200, 1220, 1221, 1222],
  JGL: [1094, 1204, 1205, 1209, 1210, 1211],
  MID: [1091, 1201, 1206],
  ADC: [1092, 1202, 1207, 1001, 2422, 3006, 3008, 3009, 3010, 3013, 3020, 3047,
    3111, 3117, 3158, 3168, 3170, 3171, 3173, 3174, 3175, 3176],
  SUP: [1093, 1203, 1208, 2055],
};

/** Ordinary inventory slots can contain boots or wards on any player. */
export function questRole(participant: { roleBoundItem?: number | string }, mapId: unknown) {
  if (mapId != null && Number(mapId) !== 11) return null;
  const item = participant?.roleBoundItem;
  if (typeof item !== 'number' && typeof item !== 'string') return null;
  return Object.entries(itemsByRole).find(([, ids]) => ids.includes(Number(item)))?.[0] ?? null;
}
