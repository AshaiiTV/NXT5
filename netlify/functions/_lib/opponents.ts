import crypto from 'node:crypto';
import { sql } from './db';
import { assertSessionSecret } from './auth';
import { TEAM_STAFF_ROLES } from './teams';
import type { DrafterSnapshot } from './drafter-import';
import { canonicalChampion } from '../../../shared/champions.js';

export const OPPONENTS_SCHEMA_VERSION = 'opponents-drafts-20261012-v1';
export const MATCH_DRAFTS_SCHEMA_VERSION = 'match-drafts-20261012-v1';
export const MATCH_OPPONENTS_SCHEMA_VERSION = 'match-opponents-20261012-v1';
export const OPPONENT_LIMITS = { opponents: 100, drafts: 200, opponentMatches: 2000 };
const PREVIEW_LIFETIME_MS = 15 * 60 * 1000;
const TOKEN_CONTEXT = 'nxt5:drafter-preview:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message: string, status = 400, code = 'INVALID_OPPONENT_INPUT') {
  return Object.assign(new Error(message), { status, code });
}

export function opponentUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw failure('Identifiant invalide.');
  return value.toLowerCase();
}

export function opponentInput(name: unknown, notes: unknown = '') {
  if (typeof name !== 'string' || typeof notes !== 'string') throw failure('Nom et notes invalides.');
  const cleanName = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const cleanNotes = notes.replace(/\r\n?/g, '\n').trim();
  if (!cleanName || cleanName.length > 80 || /[\u0000-\u001f\u007f]/.test(cleanName)) {
    throw failure('Le nom doit contenir entre 1 et 80 caractères.');
  }
  if (cleanNotes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cleanNotes)) {
    throw failure('Les notes doivent contenir au maximum 2 000 caractères.');
  }
  return { name: cleanName, normalizedName: cleanName.toLowerCase(), notes: cleanNotes };
}

export async function assertOpponentsSchemaReady() {
  try {
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = any(${[OPPONENTS_SCHEMA_VERSION, MATCH_DRAFTS_SCHEMA_VERSION, MATCH_OPPONENTS_SCHEMA_VERSION]}::text[])`;
    if (rows.length !== 3) throw new Error('Missing opponents migration');
  } catch {
    throw Object.assign(new Error('Service en cours de mise à jour.'), {
      status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
    });
  }
}

export async function requireOpponentTeam(teamId: string, userId: string, edit = false) {
  const rows = await sql`
    select t.owner_id, m.role from teams t
    left join team_members m on m.team_id = t.id and m.user_id = ${userId}
    where t.id = ${teamId} and (t.owner_id = ${userId} or m.user_id = ${userId}) limit 1
  `;
  if (!rows[0]) throw failure('Accès à cette équipe refusé.', 403, 'OPPONENT_ACCESS_DENIED');
  const canEdit = rows[0].owner_id === userId || TEAM_STAFF_ROLES.includes(rows[0].role);
  if (edit && !canEdit) throw failure('Seul le propriétaire ou le staff peut gérer les adversaires et les drafts.', 403, 'OPPONENT_ACCESS_DENIED');
  return canEdit;
}

function secret(): string {
  assertSessionSecret();
  return (globalThis as any).Netlify?.env?.get?.('SESSION_SECRET') || process.env.SESSION_SECRET || '';
}

function signature(payload: string) {
  return crypto.createHmac('sha256', secret()).update(TOKEN_CONTEXT + payload).digest();
}

/** Bind the trusted import to its authenticated viewer and team. Saving never
 * accepts a client-supplied snapshot or re-fetches a draft that may have changed. */
export function createDraftPreviewToken(snapshot: DrafterSnapshot, teamId: string, userId: string, now = Date.now()) {
  const encoded = Buffer.from(JSON.stringify({ version: 1, teamId, userId, expiresAt: now + PREVIEW_LIFETIME_MS, snapshot })).toString('base64url');
  if (encoded.length > 20000) throw failure('Cette draft est trop volumineuse.', 422, 'DRAFTER_SNAPSHOT_TOO_LARGE');
  return `${encoded}.${signature(encoded).toString('base64url')}`;
}

export function readDraftPreviewToken(token: unknown, teamId: string, userId: string, now = Date.now()): DrafterSnapshot {
  const invalid = () => failure('Aperçu invalide ou expiré. Importe à nouveau le lien.', 409, 'DRAFTER_PREVIEW_EXPIRED');
  if (typeof token !== 'string' || token.length > 20100) throw invalid();
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) throw invalid();
  const actual = Buffer.from(match[2], 'base64url');
  const expected = signature(match[1]);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw invalid();
  let payload;
  try { payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); } catch { throw invalid(); }
  if (payload?.version !== 1 || payload.teamId !== teamId || payload.userId !== userId
    || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now
    || payload.expiresAt > now + PREVIEW_LIFETIME_MS || payload.snapshot?.source !== 'drafter.lol'
    || payload.snapshot.status !== 'completed') throw invalid();
  return payload.snapshot;
}

function opponentView(row) {
  return { id: row.id, name: row.name, notes: row.notes, createdAt: new Date(row.created_at).toISOString() };
}

function draftView(row) {
  return { id: row.id, opponentId: row.match_opponent_id ?? null, matchId: row.match_id || null, allySide: row.ally_side, sourceId: row.source_id,
    gameNumber: row.game_number, sourceUrl: row.source_url, importedAt: new Date(row.imported_at).toISOString(), snapshot: row.snapshot };
}

export async function listOpponents(teamId: string) {
  const [opponents, drafts, matches] = await Promise.all([
    sql`select id, name, notes, created_at from team_opponents where team_id = ${teamId} order by name, id limit ${OPPONENT_LIMITS.opponents + 1}`,
    sql`select d.*, m.opponent_id as match_opponent_id
      from opponent_drafts d left join matches m on m.team_id = d.team_id and m.id = d.match_id
      where d.team_id = ${teamId} order by d.imported_at desc, d.id limit ${OPPONENT_LIMITS.drafts + 1}`,
    sql`select m.id, m.opponent_id, m.game_id, m.opponent, m.result, m.created_at,
        left(m.raw->>'nxt5Label', 200) as label, m.raw->'info'->>'gameCreation' as game_creation,
        (select jsonb_agg(p.champion order by p.role, p.id) from match_participants p
          where p.match_id = m.id and p.team_key = 'ENEMY') as enemy_champions
      from matches m where m.team_id = ${teamId} and m.opponent_id is not null
      order by m.created_at desc, m.id desc limit ${OPPONENT_LIMITS.opponentMatches + 1}`
  ]);
  // Never present incomplete counts as complete opponent trends.
  if (opponents.length > OPPONENT_LIMITS.opponents || drafts.length > OPPONENT_LIMITS.drafts
    || matches.length > OPPONENT_LIMITS.opponentMatches) {
    throw failure('La limite de ce prototype est dépassée. Contacte le staff NXT5.', 409, 'OPPONENT_LIMIT_REACHED');
  }
  return { opponents: opponents.map(opponentView), drafts: drafts.map(draftView), opponentMatches: matches.map(opponentMatchView), limits: OPPONENT_LIMITS };
}

function opponentMatchView(row) {
  const champions: unknown[] = Array.isArray(row.enemy_champions) ? row.enemy_champions : [];
  const picks = champions.map(value => typeof value === 'string' && value.length <= 48
    ? canonicalChampion(value) : '').filter(value => value && !/^(none|null|unknown|undefined|0)$/i.test(value));
  const enemyPicks = [...new Set(picks)];
  const gameCreation = Number(row.game_creation);
  const gameDate = Number.isFinite(gameCreation) && gameCreation > 0 ? new Date(gameCreation) : null;
  return { id: row.id, opponentId: row.opponent_id, gameId: row.game_id,
    label: row.label?.trim() || row.opponent?.trim() || row.game_id,
    date: gameDate && Number.isFinite(gameDate.getTime()) ? gameDate.toISOString() : new Date(row.created_at).toISOString(),
    result: row.result, enemyPicks, enemyPicksComplete: champions.length === 5 && enemyPicks.length === 5 };
}

export async function getMatchDraft(teamId: string, matchId: string) {
  const [matches, opponents] = await Promise.all([
    sql`select d.*, m.opponent_id as match_opponent_id from matches m left join opponent_drafts d on d.team_id = m.team_id and d.match_id = m.id
      where m.team_id = ${teamId} and m.id = ${matchId} limit 1`,
    sql`select id, name, notes, created_at from team_opponents where team_id = ${teamId} order by name, id limit ${OPPONENT_LIMITS.opponents + 1}`
  ]);
  if (!matches.length) throw failure('Partie introuvable dans cette équipe.', 404, 'DRAFT_MATCH_NOT_FOUND');
  if (opponents.length > OPPONENT_LIMITS.opponents) {
    throw failure('La limite de ce prototype est dépassée. Contacte le staff NXT5.', 409, 'OPPONENT_LIMIT_REACHED');
  }
  return { draft: matches[0].id ? draftView(matches[0]) : null, opponents: opponents.map(opponentView) };
}

export async function getMatchOpponent(teamId: string, matchId: string) {
  const [matches, opponents] = await Promise.all([
    sql`select opponent_id from matches where team_id = ${teamId} and id = ${matchId} limit 1`,
    sql`select id, name, notes, created_at from team_opponents where team_id = ${teamId} order by name, id limit ${OPPONENT_LIMITS.opponents + 1}`
  ]);
  if (!matches.length) throw failure('Partie introuvable dans cette équipe.', 404, 'DRAFT_MATCH_NOT_FOUND');
  if (opponents.length > OPPONENT_LIMITS.opponents) {
    throw failure('La limite de ce prototype est dépassée. Contacte le staff NXT5.', 409, 'OPPONENT_LIMIT_REACHED');
  }
  return { opponentId: matches[0].opponent_id, opponents: opponents.map(opponentView) };
}

/** Team lock serializes quotas; member lock prevents a concurrent staff
 * demotion/removal from racing the final authorization check and insert. */
async function mutateOpponentTeam(teamId: string, userId: string, mutation) {
  const results = await sql.transaction(tx => [
    tx`set local statement_timeout = '5000ms'`,
    tx`set local lock_timeout = '3000ms'`,
    tx`select id from teams where id = ${teamId} for update`,
    tx`select user_id from team_members where team_id = ${teamId} and user_id = ${userId} for update`,
    mutation(tx)
  ]);
  const result = results[4]?.[0];
  if (!result?.authorized) throw failure('Accès à cette équipe refusé.', 403, 'OPPONENT_ACCESS_DENIED');
  return result;
}

export async function setMatchOpponent(teamId: string, userId: string, matchId: string, opponentId: string | null) {
  const result = await mutateOpponentTeam(teamId, userId, tx => tx`
    with authorized as (
      select id from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
        select 1 from team_members m where m.team_id = t.id and m.user_id = ${userId} and m.role = any(${TEAM_STAFF_ROLES}::text[])
      ))
    ), target_match as (
      select id from matches where team_id = ${teamId} and id = ${matchId} for update
    ), opponent as (
      select id from team_opponents where team_id = ${teamId} and id = ${opponentId}::uuid for key share
    ), saved as (
      update matches set opponent_id = ${opponentId}::uuid where team_id = ${teamId} and id = ${matchId}
        and exists(select 1 from authorized) and exists(select 1 from target_match)
        and (${opponentId}::uuid is null or exists(select 1 from opponent))
      returning opponent_id
    )
    select exists(select 1 from authorized) as authorized, exists(select 1 from target_match) as match_exists,
      (${opponentId}::uuid is null or exists(select 1 from opponent)) as opponent_exists,
      (select opponent_id from saved) as opponent_id
  `);
  if (!result.match_exists) throw failure('Partie introuvable dans cette équipe.', 404, 'DRAFT_MATCH_NOT_FOUND');
  if (!result.opponent_exists) throw failure('Adversaire introuvable dans cette équipe.', 404, 'OPPONENT_NOT_FOUND');
  return result.opponent_id;
}

export async function createOpponent(teamId: string, userId: string, input: ReturnType<typeof opponentInput>) {
  const result = await mutateOpponentTeam(teamId, userId, tx => tx`
    with authorized as (
      select id from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
        select 1 from team_members m where m.team_id = t.id and m.user_id = ${userId} and m.role = any(${TEAM_STAFF_ROLES}::text[])
      ))
    ), existing as (
      select * from team_opponents where team_id = ${teamId} and normalized_name = ${input.normalizedName}
    ), inserted as (
      insert into team_opponents(team_id, created_by, name, normalized_name, notes)
      select id, ${userId}, ${input.name}, ${input.normalizedName}, ${input.notes} from authorized
      where not exists(select 1 from existing)
        and (select count(*) from team_opponents where team_id = ${teamId}) < ${OPPONENT_LIMITS.opponents}
      on conflict (team_id, normalized_name) do nothing returning *
    )
    select exists(select 1 from authorized) as authorized,
      coalesce((select to_jsonb(inserted) from inserted), (select to_jsonb(existing) from existing)) as opponent
  `);
  if (!result.opponent) throw failure(`Ce prototype accepte ${OPPONENT_LIMITS.opponents} adversaires par équipe.`, 409, 'OPPONENT_LIMIT_REACHED');
  return opponentView(result.opponent);
}

export async function saveOpponentDraft(teamId: string, userId: string, opponentId: string, allySide: 'blue' | 'red', snapshot: DrafterSnapshot) {
  const result = await mutateOpponentTeam(teamId, userId, tx => tx`
    with authorized as (
      select id from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
        select 1 from team_members m where m.team_id = t.id and m.user_id = ${userId} and m.role = any(${TEAM_STAFF_ROLES}::text[])
      ))
    ), opponent as (
      select id from team_opponents where team_id = ${teamId} and id = ${opponentId} for key share
    ), saved as (
      insert into opponent_drafts(team_id, opponent_id, ally_side, source_id, game_number, source_url, snapshot, imported_by)
      select authorized.id, opponent.id, ${allySide}, ${snapshot.sourceId}, ${snapshot.gameNumber}, ${snapshot.sourceUrl}, ${JSON.stringify(snapshot)}::jsonb, ${userId}
      from authorized cross join opponent
      where (select count(*) from opponent_drafts where team_id = ${teamId}) < ${OPPONENT_LIMITS.drafts}
        or exists(select 1 from opponent_drafts where team_id = ${teamId} and source_id = ${snapshot.sourceId} and game_number = ${snapshot.gameNumber})
      on conflict(team_id, source_id, game_number) do update set
        opponent_id = excluded.opponent_id, ally_side = excluded.ally_side, source_url = excluded.source_url,
        snapshot = excluded.snapshot, imported_by = excluded.imported_by, imported_at = now()
      returning *
    )
    select exists(select 1 from authorized) as authorized, exists(select 1 from opponent) as opponent_exists,
      (select to_jsonb(saved) || jsonb_build_object('match_opponent_id', m.opponent_id)
        from saved left join matches m on m.team_id = saved.team_id and m.id = saved.match_id) as draft
  `);
  if (!result.opponent_exists) throw failure('Adversaire introuvable dans cette équipe.', 404, 'OPPONENT_NOT_FOUND');
  if (!result.draft) throw failure(`Ce prototype accepte ${OPPONENT_LIMITS.drafts} drafts par équipe.`, 409, 'OPPONENT_LIMIT_REACHED');
  return draftView(result.draft);
}

/** All validations precede every write. The CTE dependency on `released`
 * frees a previous link before the unique match constraint sees the new link.
 * The old snapshot stays in history; attaching an already linked source
 * elsewhere is an explicit conflict rather than an implicit move. */
export async function saveMatchDraft(teamId: string, userId: string, matchId: string,
  allySide: 'blue' | 'red', snapshot: DrafterSnapshot) {
  const result = await mutateOpponentTeam(teamId, userId, tx => tx`
    with authorized as (
      select id from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
        select 1 from team_members m where m.team_id = t.id and m.user_id = ${userId} and m.role = any(${TEAM_STAFF_ROLES}::text[])
      ))
    ), target_match as (
      select id, opponent_id from matches where team_id = ${teamId} and id = ${matchId} for key share
    ), existing_source as (
      select id, match_id from opponent_drafts
      where team_id = ${teamId} and source_id = ${snapshot.sourceId} and game_number = ${snapshot.gameNumber} for update
    ), validation as (
      select exists(select 1 from authorized) as authorized,
        exists(select 1 from target_match) as match_exists,
        exists(select 1 from existing_source where match_id is not null and match_id <> ${matchId}::uuid) as source_linked_elsewhere,
        (exists(select 1 from existing_source) or (select count(*) from opponent_drafts where team_id = ${teamId}) < ${OPPONENT_LIMITS.drafts}) as draft_capacity
    ), eligible as (
      select 1 from validation where authorized and match_exists and not source_linked_elsewhere and draft_capacity
    ), released as (
      update opponent_drafts set match_id = null
      where team_id = ${teamId} and match_id = ${matchId}
        and (source_id <> ${snapshot.sourceId} or game_number <> ${snapshot.gameNumber})
        and exists(select 1 from eligible)
      returning id
    ), saved as (
      insert into opponent_drafts(team_id, match_id, ally_side, source_id, game_number, source_url, snapshot, imported_by)
      select ${teamId}::uuid, target_match.id, ${allySide}, ${snapshot.sourceId}, ${snapshot.gameNumber},
        ${snapshot.sourceUrl}, ${JSON.stringify(snapshot)}::jsonb, ${userId}::uuid
      from eligible cross join target_match cross join (select count(*) from released) release_done
      on conflict(team_id, source_id, game_number) do update set
        match_id = excluded.match_id, ally_side = excluded.ally_side,
        source_url = excluded.source_url, snapshot = excluded.snapshot, imported_by = excluded.imported_by, imported_at = now()
      returning *
    )
    select validation.*, (select to_jsonb(saved) || jsonb_build_object('match_opponent_id', target_match.opponent_id)
      from saved cross join target_match) as draft from validation
  `);
  if (!result.match_exists) throw failure('Partie introuvable dans cette équipe.', 404, 'DRAFT_MATCH_NOT_FOUND');
  if (result.source_linked_elsewhere) {
    throw failure('Cette draft est déjà liée à une autre partie. Détache-la de cette partie avant de la réutiliser.', 409, 'DRAFT_ALREADY_LINKED');
  }
  if (!result.draft_capacity || !result.draft) {
    throw failure(`Ce prototype accepte ${OPPONENT_LIMITS.drafts} drafts par équipe.`, 409, 'OPPONENT_LIMIT_REACHED');
  }
  return draftView(result.draft);
}

export async function unlinkMatchDraft(teamId: string, userId: string, matchId: string) {
  const result = await mutateOpponentTeam(teamId, userId, tx => tx`
    with authorized as (
      select id from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
        select 1 from team_members m where m.team_id = t.id and m.user_id = ${userId} and m.role = any(${TEAM_STAFF_ROLES}::text[])
      ))
    ), target_match as (
      select id from matches where team_id = ${teamId} and id = ${matchId} for key share
    ), unlinked as (
      update opponent_drafts set match_id = null
      where team_id = ${teamId} and match_id = ${matchId}
        and exists(select 1 from authorized) and exists(select 1 from target_match)
      returning id
    )
    select exists(select 1 from authorized) as authorized, exists(select 1 from target_match) as match_exists,
      (select count(*) from unlinked) as unlinked
  `);
  if (!result.match_exists) throw failure('Partie introuvable dans cette équipe.', 404, 'DRAFT_MATCH_NOT_FOUND');
}
