import type { Context } from '@netlify/functions';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { opponentUuid, requireOpponentTeam } from './_lib/opponents';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { TEAM_STAFF_ROLES } from './_lib/teams';
import { STANDARD_DRAFT_TURNS } from '../../shared/draft-order.js';
import championIds from '../../shared/riot-champion-ids.json';

const champions = new Set(championIds.map(([, name]) => name));
const other = side => side === 'blue' ? 'red' : 'blue';
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const missing = () => fail('Salle introuvable ou invitation invalide.', 404);
function invitation(id: string) {
  assertSessionSecret();
  const secret = (globalThis as any).Netlify?.env?.get?.('SESSION_SECRET') || process.env.SESSION_SECRET!;
  return createHmac('sha256', secret).update('nxt5:draft-room:guest:v1:' + id).digest('base64url');
}
function guestAccess(id: string, token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)
    || !timingSafeEqual(Buffer.from(invitation(id)), Buffer.from(token))) throw missing();
}
function view(room, side: string, host: boolean) {
  return { id: room.id, blueName: room.blue_name, redName: room.red_name, moves: room.moves, side,
    ...(host ? { invite: invitation(room.id), matchId: room.match_id ?? null } : {}) };
}
function snapshotFor(room, moves: (string | null)[]) {
  const sourceId = 'nxt5_' + createHash('sha256').update(room.id).digest('hex');
  const snapshot = { source: 'nxt5', sourceId, sourceDraftId: room.id, gameNumber: 1, sourceUrl: '/draft/salle?room=' + room.id,
    blueName: room.blue_name, redName: room.red_name, firstPick: 'blue', fearless: false, ironman: false, patch: null,
    status: 'completed', importedAt: new Date().toISOString(), warnings: [], bluePicks: [], redPicks: [], blueBans: [], redBans: [],
    banStates: { blue: [], red: [] }, orderEvidence: { version: 1, format: 'standard-20', basis: 'room-turns', firstPick: 'blue' } };
  moves.forEach((champion, index) => {
    const [kind, side] = STANDARD_DRAFT_TURNS[index];
    snapshot[String(side) + (kind === 'ban' ? 'Bans' : 'Picks')].push(champion);
    if (kind === 'ban') snapshot.banStates[String(side)].push(champion === null ? 'skipped' : 'selected');
  });
  return snapshot;
}

export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, 'POST');
    const body = await readJson(request, 4096);
    const { action } = body;
    if (!['list','create','read','move','link'].includes(action)) throw fail('Action inconnue.');
    const guest = body.invite !== undefined;
    let teamId: string | null = null, userId: string | null = null, canEdit = false;
    if (guest) {
      if (action !== 'read' && action !== 'move') throw missing();
      guestAccess(opponentUuid(body.roomId), body.invite);
    } else {
      const user = await requireAuth(request, context);
      userId = user.id;
      teamId = opponentUuid(body.teamId);
      canEdit = await requireOpponentTeam(teamId, user.id, !['read','list'].includes(action));
    }

    if (action === 'list') {
      const rooms = await sql`select id, blue_name, red_name, ally_side, jsonb_array_length(moves) as step, created_at
        from draft_rooms where team_id = ${teamId} order by created_at desc, id desc limit 40`;
      return json({ rooms, canEdit });
    }
    if (action === 'create') {
      const key = opponentUuid(body.creationKey);
      const side = body.side, name = typeof body.opponent === 'string' ? body.opponent.trim() : '';
      if (!['red','blue'].includes(side) || name.length > 80) throw fail('Vérifie le côté et le nom adverse.');
      await assertSubjectRateLimit('draft-room-create', userId!, { limit: 12, windowSeconds: 60 });
      const enemy = name || 'Adversaire';
      const [room] = await sql`insert into draft_rooms(team_id,created_by,creation_key,ally_side,blue_name,red_name)
        select t.id, ${userId}, ${key}, ${side}, case when ${side}='blue' then left(t.name,80) else ${enemy} end,
          case when ${side}='red' then left(t.name,80) else ${enemy} end from teams t
        where t.id=${teamId} and (t.owner_id=${userId} or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=${userId} and m.role=any(${TEAM_STAFF_ROLES})))
        on conflict(team_id,creation_key) do update set creation_key=excluded.creation_key returning *`;
      if (!room) throw missing();
      return json({ room: view(room, room.ally_side, true) });
    }

    const id = opponentUuid(body.roomId);
    const [room] = await sql`select r.*, d.match_id from draft_rooms r left join opponent_drafts d on d.id=r.id and d.team_id=r.team_id
      where r.id=${id} and (${guest} or r.team_id=${teamId}::uuid)`;
    if (!room) throw missing();
    const side = guest ? other(room.ally_side) : room.ally_side;
    const result = (data) => json({ room: view(data, canEdit || guest ? side : null, canEdit) });
    if (action === 'read') return result(room);
    if (action === 'link') {
      const matchId = opponentUuid(body.matchId);
      const rows = await sql`update opponent_drafts d set match_id=m.id from matches m, teams t
        where d.id=${id} and d.team_id=${teamId} and m.team_id=d.team_id and m.id=${matchId}
          and (d.match_id is null or d.match_id=m.id) and t.id=d.team_id
          and (t.owner_id=${userId} or exists(select 1 from team_members s where s.team_id=t.id and s.user_id=${userId} and s.role=any(${TEAM_STAFF_ROLES})))
        returning d.id`;
      if (!rows.length) throw fail('Cette salle ne peut pas être associée à cette partie.', 409);
      return result({ ...room, match_id: matchId });
    }

    const { step, champion } = body;
    if (!Number.isInteger(step) || step < 0 || step >= STANDARD_DRAFT_TURNS.length) throw fail('Tour invalide.');
    const [kind, activeSide] = STANDARD_DRAFT_TURNS[step];
    if (activeSide !== side) throw fail('C’est au camp adverse de jouer.', 403);
    if (!(champion === null && kind === 'ban') && !champions.has(champion)) throw fail('Champion invalide.');
    // A lost response can be retried even after later moves have been played.
    if (step < room.moves.length && room.moves[step] === champion) return result(room);
    if (step !== room.moves.length || (champion !== null && room.moves.includes(champion))) throw fail('Le plateau a changé. Vérifie le tour en cours.', 409);
    const moves = [...room.moves, champion];
    const snapshot = moves.length === STANDARD_DRAFT_TURNS.length ? snapshotFor(room, moves) : null;
    // The version check serializes moves. Publishing the twentieth move and its analysis is one SQL statement.
    const [saved] = await sql`with advanced as (
      update draft_rooms r set moves=${JSON.stringify(moves)}::jsonb where r.id=${id} and jsonb_array_length(r.moves)=${step}
        and (${guest} or exists(select 1 from teams t where t.id=r.team_id and t.id=${teamId}::uuid and (t.owner_id=${userId}::uuid or exists(
          select 1 from team_members m where m.team_id=t.id and m.user_id=${userId}::uuid and m.role=any(${TEAM_STAFF_ROLES})))))
      returning r.*
    ), published as (
      insert into opponent_drafts(id,team_id,ally_side,source_id,game_number,source_url,snapshot,imported_by)
      select id,team_id,ally_side,${snapshot?.sourceId ?? null},1,${snapshot?.sourceUrl ?? null},${JSON.stringify(snapshot)}::jsonb,created_by
      from advanced where jsonb_array_length(moves)=20 returning id
    ) select * from advanced`;
    if (!saved) throw fail('Le plateau a changé. Vérifie le tour en cours.', 409);
    return result(saved);
  } catch (error) {
    if ((error as any)?.code === '23505') return handleError(fail('Une draft est déjà associée à cette partie.', 409));
    return handleError(error);
  }
}
