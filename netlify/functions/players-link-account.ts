import { TEAM_STAFF_ROLES } from './_lib/teams';
import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const userId = String(body.userId || '').trim() || null;

    if (!teamId || !playerId) throw Object.assign(new Error('Team et joueur requis.'), { status: 400 });

    await assertSchemaReady();

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = any(${TEAM_STAFF_ROLES}))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut lier ou délier un compte.'), { status: 403 });

    const player = await sql`
      select id, role
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!player[0]) throw Object.assign(new Error('Joueur introuvable dans cette team.'), { status: 404 });


    if (userId) {
      const member = await sql`
        select users.id from users join teams on teams.id = ${teamId}
        where users.id = ${userId} and (teams.owner_id = users.id or exists (
          select 1 from team_members where team_id = teams.id and user_id = users.id))
        limit 1
      `;
      if (!member[0]) throw Object.assign(new Error('Ce compte ne fait pas partie de la team.'), { status: 400 });
    }

    // All membership checks are repeated after acquiring the same lock as removal.
    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
         where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
           select 1 from team_members where team_id = t.id and user_id = ${user.id} and role = any(${TEAM_STAFF_ROLES})))`,
      tx`select 1 / case when ${userId}::uuid is null or exists (
           select 1 from teams t where t.id = ${teamId} and (t.owner_id = ${userId} or exists (
             select 1 from team_members where team_id = t.id and user_id = ${userId}))) then 1 else 0 end`,
      tx`update players set user_id = ${userId},
           name = coalesce((select name from users where id = ${userId}), name), updated_at = now()
         where id = ${playerId} and team_id = ${teamId} returning *`,
      tx`update team_members set role = (select lower(role) from players where id = ${playerId} and team_id = ${teamId})
         where team_id = ${teamId} and user_id = ${userId} and role = 'player'
           and exists (select 1 from players where id = ${playerId} and team_id = ${teamId}
             and role = any(${[...STAFF_ROLES]}))
           and exists (select 1 from teams t where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
             select 1 from team_members where team_id = t.id and user_id = ${user.id} and role = 'captain')))`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         values (${user.id}, ${userId ? 'player.link_account' : 'player.unlink_account'}, 'player', ${playerId}, ${JSON.stringify({ teamId, linkedUserId: userId })}::jsonb)`
    ]);
    const rows = results[3];
    return json({ player: rows[0] });
  } catch (err: any) {
    if (err?.code === '22012') return json({ error: 'L’adhésion ou les accès ont changé. Recharge l’équipe.' }, 403);
    return handleError(err);
  }
}
