import { TEAM_STAFF_ROLES } from './_lib/teams';
import { canonicalChampion } from '../../shared/champions.js';
import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { cleanText } from './_lib/text';

const STATUSES = new Set(['lock', 'pocket', 'work', 'danger']);
const GAMEPLAY_ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB']);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    await assertSchemaReady();

    const action = cleanText(body.action || 'upsert', 20);
    const teamId = cleanText(body.teamId, 80);
    const playerId = cleanText(body.playerId, 80);
    const champion = canonicalChampion(cleanText(body.champion, 80));
    const status = cleanText(body.status || 'work', 20);
    const notes = cleanText(body.notes, 240) || null;
    const poolId = cleanText(body.poolId, 80);

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const member = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!member[0]) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });
    const canManageTeamPool = member[0]?.owner_id === user.id || TEAM_STAFF_ROLES.includes(String(member[0]?.role || '').toLowerCase());
    const lockedTeamQueries = tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t where t.id = ${teamId}
        and (t.owner_id = ${user.id} or exists (select 1 from team_members where team_id = t.id and user_id = ${user.id}))`
    ];

    if (action === 'delete') {
      if (!poolId) throw Object.assign(new Error('Pick requis.'), { status: 400 });
      if (!isUuid(poolId)) throw Object.assign(new Error('Pick temporaire non synchronisé. Recharge la page puis réessaie.'), { status: 400 });
      const target = await sql`
        select champion_pool.*, players.user_id as player_user_id
        from champion_pool
        left join players on players.id = champion_pool.player_id
        where champion_pool.id = ${poolId}
          and champion_pool.team_id = ${teamId}
        limit 1
      `;
      if (!target[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
      if (!canManageTeamPool && String(target[0].player_user_id || '') !== String(user.id)) {
        throw Object.assign(new Error('Seul le staff autorisé ou le joueur lié à ce profil peut modifier ce champion pool.'), { status: 403 });
      }
      const results = await sql.transaction(tx => [
        ...lockedTeamQueries(tx),
        tx`select id from champion_pool where id = ${poolId} and team_id = ${teamId} for update`,
        tx`with changed as (
        delete from champion_pool
        where id = ${poolId}
          and team_id = ${teamId}
          and source in ('manual', 'riot_manual')
          and (exists (select 1 from teams t where t.id = ${teamId} and (t.owner_id = ${user.id}
            or exists (select 1 from team_members tm where tm.team_id = t.id and tm.user_id = ${user.id} and tm.role = any(${TEAM_STAFF_ROLES}))))
            or exists (select 1 from players p where p.id = champion_pool.player_id and p.team_id = ${teamId} and p.user_id = ${user.id}))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'champion_pool.manual_delete', 'champion_pool', id,
          jsonb_build_object('teamId', ${teamId}::text, 'champion', champion) from changed
      ) select * from changed`
      ]);
      const deleted = results[results.length - 1];
      if (!deleted[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
      return json({ ok: true, pick: deleted[0] });
    }

    if (!playerId || !champion) throw Object.assign(new Error('Joueur et champion requis.'), { status: 400 });
    if (!STATUSES.has(status)) throw Object.assign(new Error('Statut de pick invalide.'), { status: 400 });

    const players = await sql`
      select id, name, role, user_id
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    const player = players[0];
    if (!player) throw Object.assign(new Error('Joueur introuvable dans cette team.'), { status: 404 });
    if (!GAMEPLAY_ROLES.has(String(player.role || '').toUpperCase())) {
      throw Object.assign(new Error('Ce profil staff ne peut pas avoir de Champion Pool.'), { status: 400 });
    }
    if (!canManageTeamPool && String(player.user_id || '') !== String(user.id)) {
      throw Object.assign(new Error('Seul le staff autorisé ou le joueur lié à ce profil peut modifier ce champion pool.'), { status: 403 });
    }
    const lockedPlayerQueries = tx => [
      ...lockedTeamQueries(tx),
      tx`select id from players where id = ${playerId} and team_id = ${teamId} for share`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from players p join teams t on t.id = p.team_id
        where p.id = ${playerId} and p.team_id = ${teamId} and p.name = ${player.name} and p.role = ${player.role}
          and (p.user_id = ${user.id} or t.owner_id = ${user.id} or exists (select 1 from team_members tm
            where tm.team_id = t.id and tm.user_id = ${user.id} and tm.role = any(${TEAM_STAFF_ROLES})))`
    ];

    const verdict = status === 'lock'
      ? 'Pick prioritaire.'
      : status === 'pocket'
        ? 'Pocket pick.'
        : status === 'danger'
          ? 'Volume élevé, WR faible.'
          : 'Pick à valider.';

    if (poolId) {
      if (!canManageTeamPool) {
        const existing = await sql`
          select player_id
          from champion_pool
          where id = ${poolId}
            and team_id = ${teamId}
          limit 1
        `;
        if (!existing[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
        if (String(existing[0].player_id || '') !== String(player.id)) {
          throw Object.assign(new Error('Tu ne peux modifier que ton propre Champion Pool.'), { status: 403 });
        }
      }
      const results = await sql.transaction(tx => [
        ...lockedPlayerQueries(tx),
        tx`select id from champion_pool where id = ${poolId} and team_id = ${teamId} for update`,
        tx`with changed as (
        update champion_pool
        set player_id = ${playerId},
            player_name = ${player.name},
            role = ${player.role},
            games = 0,
            wins = 0,
            losses = 0,
            winrate = 0,
            kda = 0,
            cs_per_min = 0,
            status = ${status},
            notes = ${notes},
            source = 'manual',
            impact_grade = 'POOL',
            verdict = ${verdict},
            updated_at = now()
        where id = ${poolId}
          and team_id = ${teamId}
          and (player_id = ${playerId} or exists (select 1 from teams t where t.id = ${teamId}
            and (t.owner_id = ${user.id} or exists (select 1 from team_members tm where tm.team_id = t.id
              and tm.user_id = ${user.id} and tm.role = any(${TEAM_STAFF_ROLES})))))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'champion_pool.manual_update', 'champion_pool', id,
          jsonb_build_object('teamId', ${teamId}::text, 'playerId', ${playerId}::text, 'champion', champion, 'status', ${status}::text) from changed
      ) select * from changed`
      ]);
      const rows = results[results.length - 1];
      if (!rows[0]) throw Object.assign(new Error('Pick introuvable.'), { status: 404 });
      return json({ pick: rows[0] });
    }

    const results = await sql.transaction(tx => [
      ...lockedPlayerQueries(tx),
      tx`with changed as (
      insert into champion_pool (team_id, player_id, player_name, champion, games, wins, losses, winrate, kda, cs_per_min, impact_grade, verdict, role, status, notes, source, updated_at)
      values (${teamId}, ${playerId}, ${player.name}, ${champion}, 0, 0, 0, 0, 0, 0, 'POOL', ${verdict}, ${player.role}, ${status}, ${notes}, 'manual', now())
      on conflict (team_id, player_id, champion)
      do update set
        player_name = excluded.player_name,
        role = excluded.role,
        games = 0,
        wins = 0,
        losses = 0,
        winrate = 0,
        kda = 0,
        cs_per_min = 0,
        status = excluded.status,
        notes = excluded.notes,
        source = 'manual',
        impact_grade = 'POOL',
        verdict = excluded.verdict,
        updated_at = now()
      returning *
    ), logged as (
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      select ${user.id}, 'champion_pool.manual_upsert', 'champion_pool', id, ${JSON.stringify({ teamId, playerId, champion, status })}::jsonb from changed
    ) select * from changed`
    ]);
    const rows = results[results.length - 1];

    return json({ pick: rows[0] });
  } catch (err) {
    if (err?.code === '22012' || err?.code === '23503') return json({ error: 'Le profil, l’équipe ou les accès ont changé. Recharge l’équipe puis réessaie.' }, 409);
    return handleError(err);
  }
}
