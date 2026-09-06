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
