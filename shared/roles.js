/** NXT5 gameplay roles, in lane order. */
export const ROLES = Object.freeze(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);

/** Riot match positions (teamPosition, individualPosition) and their NXT5 role. */
export const RIOT_POSITION_ROLES = Object.freeze({ JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP', SUPPORT: 'SUP' });

const ROLE_ALIASES = Object.freeze({
  ...Object.fromEntries(ROLES.map((role) => [role, role])),
  ...RIOT_POSITION_ROLES,
  BOT: 'ADC',
});

/** Converts Riot positions to NXT5 roles; any other value comes back uppercased (TOP, SUB, COACH, ''). */
export function normalizeRole(value) {
  const raw = String(value || '').toUpperCase();
  return RIOT_POSITION_ROLES[raw] || raw;
}

/** Strict variant: trims, also accepts BOT, and returns '' for anything that is not a gameplay role. */
export function canonicalRole(value) {
  return ROLE_ALIASES[String(value ?? '').trim().toUpperCase()] || '';
}

/** 1-based lane order (TOP = 1), keyed by NXT5 role and by Riot position. */
export const ROLE_SORT_ORDER = Object.freeze(Object.fromEntries(
  [...ROLES, ...Object.keys(RIOT_POSITION_ROLES)].map((key) => [key, ROLES.indexOf(RIOT_POSITION_ROLES[key] || key) + 1])
));
