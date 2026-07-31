import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureAuditLogsSchema, ensureWorkflowSchema } from './_lib/schema';

function cleanText(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

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
    const canManage = membership && (membership.owner_id === user.id || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(membership.role || '').toLowerCase()));
    if (!canManage) throw Object.assign(new Error('Seul le staff peut gérer les objectifs joueurs.'), { status: 403 });

    if (action === 'delete' || action === 'archive') {
      if (!goalId) throw Object.assign(new Error('Objectif requis.'), { status: 400 });
      const rows = action === 'delete'
        ? await sql`delete from player_goals where id = ${goalId} and team_id = ${teamId} returning *`
        : await sql`update player_goals set status = 'archived', updated_at = now() where id = ${goalId} and team_id = ${teamId} returning *`;
      if (!rows[0]) throw Object.assign(new Error('Objectif introuvable.'), { status: 404 });
      await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${user.id}, ${action === 'delete' ? 'player_goals.delete' : 'player_goals.archive'}, 'player_goal', ${goalId}, ${JSON.stringify({ teamId })}::jsonb)`;
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

    const rows = await sql`
      insert into player_goals (team_id, player_id, created_by, title, metric, operator, target_value, sample_size, required_successes)
      values (${teamId}, ${playerId}, ${user.id}, ${title}, ${metric}, ${operator}, ${targetValue}, ${sampleSize}, ${requiredSuccesses})
      returning *
    `;
    await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${user.id}, 'player_goals.create', 'player_goal', ${rows[0].id}, ${JSON.stringify({ teamId, playerId, metric, targetValue })}::jsonb)`;
    return json({ goal: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
