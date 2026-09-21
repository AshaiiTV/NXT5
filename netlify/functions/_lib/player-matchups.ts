import { sql } from './db';
import { assertSchemaReady } from './migrations';

export const PLAYER_MATCHUPS_SCHEMA_VERSION = 'player-matchups-20260915-v1';
let ready: Promise<void> | undefined;

export function ensurePlayerMatchupsSchema(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await assertSchemaReady();
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${PLAYER_MATCHUPS_SCHEMA_VERSION}`;
    if (!rows.length) throw new Error('Missing player matchups migration');
  })().catch(() => {
    ready = undefined;
    throw Object.assign(new Error('Mise à jour de la base requise pour les carnets de matchups.'), {
      status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Les carnets sont en cours de mise à jour. Réessaie dans quelques instants.'
    });
  });
  return ready;
}

export const STAFF_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message = 'Carnet de matchup invalide.'): never {
  throw Object.assign(new Error(message), { status: 400, code: 'INVALID_MATCHUP_NOTEBOOK' });
}

function object(value: unknown, fields: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (Object.keys(value).some(key => !fields.includes(key))) invalid('Le carnet contient des champs non reconnus.');
  return value as Record<string, any>;
}

function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) invalid('Un texte du carnet est invalide ou trop long.');
  const result = value.trim();
  if (required && !result) invalid('Le titre de chaque essai est requis.');
  return result;
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) invalid('Un identifiant du carnet est invalide.');
  return value.toLowerCase();
}

export function canonicalChampion(value: unknown): string {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function champion(value: unknown): string {
  if (typeof value !== 'string' || value.length > 80) invalid('Champion invalide.');
  const result = canonicalChampion(value);
  if (!result) invalid('Champion requis.');
  return result;
}

export function matchupRole(value: unknown): string {
  const role = String(value ?? '').trim().toUpperCase();
  return ({ TOP: 'TOP', JGL: 'JGL', JUNGLE: 'JGL', MID: 'MID', MIDDLE: 'MID', ADC: 'ADC', BOTTOM: 'ADC', BOT: 'ADC', SUP: 'SUP', SUPPORT: 'SUP', UTILITY: 'SUP' } as Record<string, string>)[role] || '';
}

export type MatchupPlan = { lanePlan: string; vigilance: string; toKeep: string };
export type MatchupExperiment = {
  id: string; title: string; plan: string; observation: string; conclusion: string;
  status: 'planned' | 'active' | 'concluded'; matchIds: string[];
};
type MatchupScope = { teamId: string; playerId: string; champion: string };
type MatchupList = MatchupScope & { action: 'list' };
export type MatchupSave = MatchupScope & {
  action: 'save'; opponentChampion: string; role: string; expectedRevision: number;
  plan: MatchupPlan; experiments: MatchupExperiment[];
};

export function validateMatchupRequest(value: unknown): MatchupList | MatchupSave {
  const body = object(value, ['action', 'teamId', 'playerId', 'champion', 'opponentChampion', 'role', 'expectedRevision', 'plan', 'experiments']);
  if (body.action !== 'list' && body.action !== 'save') invalid('Action de carnet inconnue.');
  const scope = { teamId: uuid(body.teamId), playerId: uuid(body.playerId), champion: champion(body.champion) };
  if (body.action === 'list') {
    object(body, ['action', 'teamId', 'playerId', 'champion']);
    return { action: 'list', ...scope };
  }
  const opponentChampion = champion(body.opponentChampion);
  if (!ROLES.includes(body.role)) invalid('Poste du matchup invalide.');
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647) invalid('Version de carnet invalide.');
  const sourcePlan = object(body.plan, ['lanePlan', 'vigilance', 'toKeep']);
  const plan = {
    lanePlan: text(sourcePlan.lanePlan, 4000), vigilance: text(sourcePlan.vigilance, 4000), toKeep: text(sourcePlan.toKeep, 4000)
  };
  if (!Array.isArray(body.experiments) || body.experiments.length > 20) invalid('Le carnet peut contenir au maximum 20 essais.');
  const experiments: MatchupExperiment[] = body.experiments.map(value => {
    const exp = object(value, ['id', 'title', 'plan', 'observation', 'conclusion', 'status', 'matchIds']);
    if (!['planned', 'active', 'concluded'].includes(exp.status)) invalid('État de l’essai invalide.');
    if (!Array.isArray(exp.matchIds) || exp.matchIds.length > 50) invalid('Un essai peut associer au maximum 50 parties.');
    const matchIds = exp.matchIds.map(uuid);
    if (new Set(matchIds).size !== matchIds.length) invalid('Une partie ne peut apparaître qu’une fois dans un essai.');
    return {
      id: uuid(exp.id), title: text(exp.title, 120, true), plan: text(exp.plan, 2000),
      observation: text(exp.observation, 2000), conclusion: text(exp.conclusion, 2000), status: exp.status, matchIds
    };
  });
  if (new Set(experiments.map(exp => exp.id)).size !== experiments.length) invalid('Chaque essai doit avoir un identifiant distinct.');
  if (new Set(experiments.flatMap(exp => exp.matchIds)).size > 200) invalid('Le carnet peut associer au maximum 200 parties différentes.');
  return { action: 'save', ...scope, opponentChampion, role: body.role, expectedRevision: body.expectedRevision, plan, experiments };
}

export function canEditMatchup(userId: string, membership: Record<string, any>, player: Record<string, any>): boolean {
  return membership.owner_id === userId || STAFF_ROLES.includes(String(membership.role || '').toLowerCase()) || player.user_id === userId;
}

// Match evidence uses stored profile links and explicit roles only. In particular,
// a nickname collision or a guessed lane cannot attach another player's game.
export function isLinkedMatchup(rows: Record<string, any>[], scope: MatchupSave): boolean {
  if (!rows.length || rows.some(row => row.team_id !== scope.teamId)) return false;
  const allies = rows.filter(row => row.team_key === 'ALLY' && row.player_id === scope.playerId);
  if (allies.length !== 1 || canonicalChampion(allies[0].champion) !== scope.champion || matchupRole(allies[0].role) !== scope.role) return false;
  const enemies = rows.filter(row => row.team_key === 'ENEMY' && matchupRole(row.role) === scope.role);
  return enemies.length === 1 && canonicalChampion(enemies[0].champion) === scope.opponentChampion;
}

export function serializeMatchup(row: Record<string, any>) {
  return {
    id: row.id, champion: row.champion, opponentChampion: row.opponent_champion, role: row.role,
    plan: row.plan, experiments: row.experiments, revision: Number(row.revision),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    updatedByName: row.updated_by_name || null
  };
}
