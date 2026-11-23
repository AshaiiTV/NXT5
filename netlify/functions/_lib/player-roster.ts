import { assertSchemaReady } from './migrations';

export const PLAYER_ROSTER_STATUSES = ['MAIN', 'SUB', 'INACTIVE'] as const;
export type PlayerRosterStatus = (typeof PLAYER_ROSTER_STATUSES)[number];

export function isPlayerRosterStatus(value: unknown): value is PlayerRosterStatus {
  return PLAYER_ROSTER_STATUSES.includes(String(value || '').trim().toUpperCase() as PlayerRosterStatus);
}

export function normalizePlayerRosterStatus(value: unknown, fallback: PlayerRosterStatus = 'MAIN'): PlayerRosterStatus {
  const normalized = String(value || '').trim().toUpperCase();
  return isPlayerRosterStatus(normalized) ? normalized as PlayerRosterStatus : fallback;
}

export async function ensurePlayerRosterSchema() {
  await assertSchemaReady();
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const RIOT_ID_FORMAT = /^[^#\r\n]{1,100}#[^#\s]{1,16}$/;
const MAX_OPGG_URL_LENGTH = 500;

function invalidProfile(message: string): never {
  throw Object.assign(new Error(message), { status: 400, code: 'PLAYER_INVALID' });
}

/** Same rules as the roster import: name ≤ 80, Riot ID ≤ 128 in Name#TAG form. */
export function validatePlayerName(name: string): string {
  if (!name || name.length > 80 || CONTROL_CHARS.test(name)) invalidProfile('Nom du profil invalide (80 caractères maximum).');
  return name;
}

export function validatePlayerRiotId(riotId: string | null): string | null {
  if (!riotId) return null;
  if (riotId.length > 128 || CONTROL_CHARS.test(riotId) || !RIOT_ID_FORMAT.test(riotId)) invalidProfile('Riot ID invalide. Utilise le format Pseudo#TAG.');
  return riotId;
}

/** An empty OP.GG link is allowed; otherwise only a bounded https URL. */
export function validatePlayerOpggUrl(opggUrl: string | null): string | null {
  if (!opggUrl) return null;
  let parsed: URL | null = null;
  try { parsed = new URL(opggUrl); } catch {}
  if (opggUrl.length > MAX_OPGG_URL_LENGTH || CONTROL_CHARS.test(opggUrl) || parsed?.protocol !== 'https:') {
    invalidProfile('Lien OP.GG invalide. Indique une adresse https (500 caractères maximum).');
  }
  return opggUrl;
}
