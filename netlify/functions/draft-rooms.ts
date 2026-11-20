import type { Context } from '@netlify/functions';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { opponentUuid, requireOpponentTeam } from './_lib/opponents';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { TEAM_STAFF_ROLES } from './_lib/teams';
import { draftTurns } from '../../shared/draft-order.js';
import championIds from '../../shared/riot-champion-ids.json';

const champions = new Set(championIds.map(([, name]) => name));
const other = side => side === 'blue' ? 'red' : 'blue';
const validSide = side => side === 'red' || side === 'blue';
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const missing = () => fail('Salle introuvable ou invitation invalide.', 404);
const changed = () => fail('Le plateau a changé. Vérifie le tour en cours.', 409);

function invitation(id: string, spectator = false) {
  assertSessionSecret();
  const secret = (globalThis as any).Netlify?.env?.get?.('SESSION_SECRET') || process.env.SESSION_SECRET!;
  const role = spectator ? 'spectator' : 'guest';
  const signature = createHmac('sha256', secret).update('nxt5:draft-room:' + role + ':v1:' + id).digest('base64url');
  return spectator ? 'watch.' + signature : signature;
}
function guestRole(id: string, token: unknown) {
  if (typeof token !== 'string' || !/^(watch\.)?[A-Za-z0-9_-]{43}$/.test(token)) throw missing();
  const spectator = token.startsWith('watch.');
  if (!timingSafeEqual(Buffer.from(invitation(id, spectator)), Buffer.from(token))) throw missing();
  return spectator ? 'spectator' : 'captain';
}
function lockedChampions(room, series) {
  if (room.draft_mode !== 'fearless') return [];
  return series.filter(game => game.game_number < room.game_number).flatMap(game => {
    const turns = draftTurns(game.first_pick);
    return game.moves.filter((champion,index) => champion && turns[index][0] === 'pick');
  });
}
function view(room, series, side: string | null, host: boolean) {
  const id = room.series_root || room.id;
  return { id, gameId: room.id, gameNumber: room.game_number, seriesLength: room.series_length,
    turnSeconds: room.turn_seconds, turnStartedAt: room.turn_started_at, serverTime: Date.now(),
    canStart: !host && side !== null && room.turn_seconds > 0 && !room.turn_started_at,
    latestGame: series[series.length - 1].game_number, mode: room.draft_mode, firstPick: room.first_pick,
    blocked: lockedChampions(room, series), blueName: room.blue_name, redName: room.red_name, moves: room.moves, side,
    ...(host ? { invite: invitation(id), spectatorInvite: invitation(id,true), matchId: room.match_id ?? null } : {}) };
}
function snapshotFor(room, moves: (string | null)[]) {
  const root = room.series_root || room.id;
  const sourceId = 'nxt5_' + createHash('sha256').update(root).digest('hex');
  const snapshot = { source: 'nxt5', sourceId, sourceDraftId: room.id, seriesId: root, gameNumber: room.game_number,
    sourceUrl: '/draft/salle?room=' + root + '&game=' + room.game_number,
    blueName: room.blue_name, redName: room.red_name, firstPick: room.first_pick, fearless: room.draft_mode === 'fearless', ironman: false, patch: null,
    status: 'completed', importedAt: new Date().toISOString(), warnings: [], bluePicks: [], redPicks: [], blueBans: [], redBans: [],
    banStates: { blue: [], red: [] }, orderEvidence: { version: 1, format: 'standard-20', basis: 'room-turns', firstPick: room.first_pick } };
  const turns = draftTurns(room.first_pick);
  moves.forEach((champion, index) => {
    const [kind, side] = turns[index];
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
    if (!['list','create','read','move','link','next','start'].includes(action)) throw fail('Action inconnue.');
    const guest = body.invite !== undefined;
    let teamId: string | null = null, userId: string | null = null, canEdit = false, role = '';
    if (guest) {
      role = guestRole(opponentUuid(body.roomId), body.invite);
      if (action !== 'read' && !(['move','start'].includes(action) && role === 'captain')) throw missing();
    } else {
      const user = await requireAuth(request, context);
      userId = user.id;
      teamId = opponentUuid(body.teamId);
      canEdit = await requireOpponentTeam(teamId, user.id, !['read','list'].includes(action));
    }
    if (action === 'list') {
      const rooms = await sql`select r.id, g.blue_name, g.red_name, g.game_number, r.series_length, g.ally_side,
        jsonb_array_length(g.moves) as step, r.created_at from draft_rooms r
        cross join lateral (select * from draft_rooms x where x.id=r.id or x.series_root=r.id order by game_number desc limit 1) g
        where r.team_id=${teamId} and r.series_root is null order by r.created_at desc, r.id desc limit 40`;
      return json({ rooms, canEdit });
    }
    if (action === 'create') {
      const key = opponentUuid(body.creationKey);
      const side = body.side, name = typeof body.opponent === 'string' ? body.opponent.trim() : '';
      const { firstPick = 'blue', seriesLength = 1, mode = 'standard', turnSeconds = 0 } = body;
      if (!validSide(side) || name.length > 80) throw fail('Vérifie le côté et le nom adverse.');
      if (!Number.isInteger(seriesLength) || seriesLength < 1 || seriesLength > 5 || !['standard','fearless'].includes(mode) || !validSide(firstPick) || ![0,30,60].includes(turnSeconds)) throw fail('Format de série invalide.');
      await assertSubjectRateLimit('draft-room-create', userId!, { limit: 12, windowSeconds: 60 });
      const enemy = name || 'Adversaire';
      const [room] = await sql`insert into draft_rooms(team_id,created_by,creation_key,ally_side,blue_name,red_name,series_length,draft_mode,first_pick,turn_seconds)
        select t.id, ${userId}, ${key}, ${side}, case when ${side}='blue' then left(t.name,80) else ${enemy} end,
          case when ${side}='red' then left(t.name,80) else ${enemy} end, ${seriesLength}, ${mode}, ${firstPick}, ${turnSeconds} from teams t
        where t.id=${teamId} and (t.owner_id=${userId} or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=${userId} and m.role=any(${TEAM_STAFF_ROLES})))
        on conflict(team_id,creation_key) do update set creation_key=excluded.creation_key returning *`;
      if (!room) throw missing();
      return json({ room: view(room, [room], room.ally_side, true) });
    }

    const id = opponentUuid(body.roomId);
    const series = await sql`select r.*, d.match_id from draft_rooms r left join opponent_drafts d on d.id=r.id and d.team_id=r.team_id
      where (r.id=${id} and r.series_root is null or r.series_root=${id}) and (${guest} or r.team_id=${teamId}::uuid) order by r.game_number`;
    if (!series.length) throw missing();
    const latest = series[series.length - 1];
    if (!['read','list'].includes(action) && latest.series_length > 1 && !Number.isInteger(body.gameNumber)) throw changed();
    const room = body.gameNumber === undefined ? latest : series.find(game => game.game_number === body.gameNumber);
    if (!room) throw missing();
    const result = (data, games = series) => {
      const side = canEdit ? data.ally_side : role === 'captain' ? other(data.ally_side) : null;
      return json({ room: view(data, games, side, canEdit) });
    };
    if (action === 'read') return result(room);
    if (action === 'start') {
      if (role !== 'captain' || !room.turn_seconds) throw missing();
      if (room.turn_started_at) return result(room);
      const [started] = await sql`update draft_rooms set turn_started_at=coalesce(turn_started_at,now()) where id=${room.id} returning *`;
      return result(started);
    }
    if (action === 'next') {
      if (room.moves.length !== 20 || room.game_number >= room.series_length || !validSide(body.side) || !validSide(body.firstPick)) throw changed();
      const existing = series.find(game => game.game_number === room.game_number + 1);
      if (existing) return result(existing);
      const swap = body.side !== room.ally_side;
      const [next] = await sql`insert into draft_rooms(team_id,created_by,creation_key,ally_side,blue_name,red_name,series_root,game_number,series_length,draft_mode,first_pick,turn_seconds)
        select r.team_id,${userId},gen_random_uuid(),${body.side},${swap ? room.red_name : room.blue_name},${swap ? room.blue_name : room.red_name},
          ${id},r.game_number+1,r.series_length,r.draft_mode,${body.firstPick},r.turn_seconds from draft_rooms r join teams t on r.team_id=t.id
        where r.id=${room.id} and t.id=${teamId} and (t.owner_id=${userId} or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=${userId} and m.role=any(${TEAM_STAFF_ROLES})))
        on conflict(series_root,game_number) do update set series_root=excluded.series_root returning *`;
      if (!next) throw missing();
      return result(next, [...series,next]);
    }
    if (action === 'link') {
      const matchId = opponentUuid(body.matchId);
      const rows = await sql`update opponent_drafts d set match_id=m.id from matches m, teams t
        where d.id=${room.id} and d.team_id=${teamId} and m.team_id=d.team_id and m.id=${matchId}
          and (d.match_id is null or d.match_id=m.id) and t.id=d.team_id
          and (t.owner_id=${userId} or exists(select 1 from team_members s where s.team_id=t.id and s.user_id=${userId} and s.role=any(${TEAM_STAFF_ROLES})))
        returning d.id`;
      if (!rows.length) throw fail('Cette salle ne peut pas être associée à cette partie.', 409);
      return result({ ...room, match_id: matchId });
    }

    if (room.turn_seconds && !room.turn_started_at) throw changed();
    const { step, champion } = body;
    const turns = draftTurns(room.first_pick);
    if (!Number.isInteger(step) || step < 0 || step >= turns.length) throw fail('Tour invalide.');
    const [kind, activeSide] = turns[step];
    if (activeSide !== (guest ? other(room.ally_side) : room.ally_side)) throw fail('C’est au camp adverse de jouer.', 403);
    if (!(champion === null && kind === 'ban') && !champions.has(champion)) throw fail('Champion invalide.');
    if (step < room.moves.length && room.moves[step] === champion) return result(room);
    if (step !== room.moves.length || (champion !== null && (room.moves.includes(champion) || lockedChampions(room,series).includes(champion)))) throw changed();
    const moves = [...room.moves, champion];
    const snapshot = moves.length === turns.length ? snapshotFor(room, moves) : null;
    const [saved] = await sql`with advanced as (
      update draft_rooms r set moves=${JSON.stringify(moves)}::jsonb, turn_started_at=case when turn_seconds>0 then now() else null end where r.id=${room.id} and jsonb_array_length(r.moves)=${step}
        and (${guest} or exists(select 1 from teams t where t.id=r.team_id and t.id=${teamId}::uuid and (t.owner_id=${userId}::uuid or exists(
          select 1 from team_members m where m.team_id=t.id and m.user_id=${userId}::uuid and m.role=any(${TEAM_STAFF_ROLES})))))
      returning r.*
    ), published as (
      insert into opponent_drafts(id,team_id,ally_side,source_id,game_number,source_url,snapshot,imported_by)
      select id,team_id,ally_side,${snapshot?.sourceId ?? null},game_number,${snapshot?.sourceUrl ?? null},${JSON.stringify(snapshot)}::jsonb,created_by
      from advanced where jsonb_array_length(moves)=20 returning id
    ) select * from advanced`;
    if (!saved) throw changed();
    return result(saved);
  } catch (error) {
    if ((error as any)?.code === '23505') return handleError(fail('Une draft est déjà associée à cette partie.', 409));
    return handleError(error);
  }
}
