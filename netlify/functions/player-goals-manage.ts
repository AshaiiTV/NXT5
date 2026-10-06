import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureAuditLogsSchema, ensureWorkflowSchema } from './_lib/schema';
import { cleanText } from './_lib/text';
import { TEAM_STAFF_ROLES } from './_lib/teams';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureWorkflowSchema();
    await ensureAuditLogsSchema();
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const playerId = cleanText(body.playerId, 80);
    const goalId = cleanText(body.goalId, 80);
    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const memberships = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const membership = memberships[0];
    const canManage = membership && (membership.owner_id === user.id || TEAM_STAFF_ROLES.includes(String(membership.role || '').toLowerCase()));
    if (!canManage) throw Object.assign(new Error('Seul le staff peut gérer les objectifs joueurs.'), { status: 403 });

    if (action === 'delete' || action === 'archive') {
      if (!goalId) throw Object.assign(new Error('Objectif requis.'), { status: 400 });
      const results = await sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
        tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams
           where id = ${teamId} and (owner_id = ${user.id} or exists (select 1 from team_members
             where team_id = teams.id and user_id = ${user.id} and role = any(${TEAM_STAFF_ROLES})))`,
        action === 'delete'
          ? tx`with changed_goal as (
              delete from player_goals where id = ${goalId} and team_id = ${teamId} returning *
            ), logged as (
              insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
              select ${user.id}, 'player_goals.delete', 'player_goal', id, ${JSON.stringify({ teamId })}::jsonb from changed_goal
            ) select * from changed_goal`
          : tx`with changed_goal as (
              update player_goals set status = 'archived', updated_at = now() where id = ${goalId} and team_id = ${teamId} returning *
            ), logged as (
              insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
              select ${user.id}, 'player_goals.archive', 'player_goal', id, ${JSON.stringify({ teamId })}::jsonb from changed_goal
            ) select * from changed_goal`
      ]);
      const rows = results[3];
      if (!rows[0]) throw Object.assign(new Error('Objectif introuvable.'), { status: 404 });
      return json({ ok: true });
    }

    const title = cleanText(body.title, 140);
    const metric = cleanText(body.metric, 24).toLowerCase();
    const operator = cleanText(body.operator || 'gte', 8).toLowerCase();
    const targetValue = Number(body.targetValue);
    const sampleSize = Math.max(1, Math.min(10, Number(body.sampleSize || 3)));
    const requiredSuccesses = Math.max(1, Math.min(sampleSize, Number(body.requiredSuccesses || 2)));
    if (!playerId || !title) throw Object.assign(new Error('Joueur et objectif requis.'), { status: 400 });
    if (!['deaths', 'kp', 'kda', 'vision', 'cs10'].includes(metric)) throw Object.assign(new Error('Métrique invalide.'), { status: 400 });
    if (!['gte', 'lte'].includes(operator) || !Number.isFinite(targetValue)) throw Object.assign(new Error('Cible invalide.'), { status: 400 });
    const players = await sql`select id from players where id = ${playerId} and team_id = ${teamId} limit 1`;
    if (!players[0]) throw Object.assign(new Error('Profil joueur introuvable.'), { status: 404 });

    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`select id from players where id = ${playerId} and team_id = ${teamId} for share`,
      tx`with changed_goal as (
        insert into player_goals (team_id, player_id, created_by, title, metric, operator, target_value, sample_size, required_successes)
        select teams.id, players.id, ${user.id}, ${title}, ${metric}, ${operator}, ${targetValue}, ${sampleSize}, ${requiredSuccesses}
        from teams join players on players.team_id = teams.id
        where teams.id = ${teamId} and players.id = ${playerId}
          and (teams.owner_id = ${user.id} or exists (select 1 from team_members
            where team_id = teams.id and user_id = ${user.id} and role = any(${TEAM_STAFF_ROLES})))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'player_goals.create', 'player_goal', id, ${JSON.stringify({ teamId, playerId, metric, targetValue })}::jsonb from changed_goal
      )
      select * from changed_goal`
    ]);
    const rows = results[3];
    if (!rows[0]) throw Object.assign(new Error('Le profil ou les accès ont changé. Recharge l’équipe.'), { status: 403 });
    return json({ goal: rows[0] });
  } catch (err) {
    if (err?.code === '22012') return json({ error: 'Les accès ont changé. Recharge l’équipe.' }, 403);
    return handleError(err);
  }
}
