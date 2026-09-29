import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

const ROLES = new Set(['captain', 'coach', 'assistant', 'analyst', 'manager', 'board', 'player']);
const ROLE_MANAGEMENT_ROLES = ['captain'];

async function ensureTeamMemberRoleConstraint() {
  await assertSchemaReady();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const userId = String(body.userId || '').trim();
    const role = String(body.role || '').trim().toLowerCase();

    if (!teamId || !userId || !ROLES.has(role)) throw Object.assign(new Error('Team, compte et statut requis.'), { status: 400 });
    await ensureTeamMemberRoleConstraint();

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = any(${ROLE_MANAGEMENT_ROLES}))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul le propriétaire ou un capitaine peut modifier les statuts.'), { status: 403 });

    const target = await sql`
      select role
      from team_members
      where team_id = ${teamId}
        and user_id = ${userId}
      limit 1
    `;
    if (!target[0]) throw Object.assign(new Error('Compte introuvable dans cette team.'), { status: 404 });
    if (target[0].role === 'owner') throw Object.assign(new Error('Le statut owner ne peut pas être modifié.'), { status: 400 });

    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
         where t.id = ${teamId} and t.owner_id <> ${userId}
           and (t.owner_id = ${user.id} or exists (select 1 from team_members
             where team_id = t.id and user_id = ${user.id} and role = any(${ROLE_MANAGEMENT_ROLES})))
           and not exists (select 1 from team_members where team_id = t.id and user_id = ${userId} and role = 'owner')`,
      tx`update team_members set role = ${role}
         where team_id = ${teamId} and user_id = ${userId} returning *`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         select ${user.id}, 'team_member.role_update', 'team', ${teamId}, ${JSON.stringify({ targetUserId: userId, role })}::jsonb
         where exists (select 1 from team_members where team_id = ${teamId} and user_id = ${userId})`
    ]);
    const rows = results[2];
    if (!rows[0]) throw Object.assign(new Error('Compte introuvable dans cette team.'), { status: 404 });

    return json({ member: rows[0] });
  } catch (err) {
    if (err?.code === '22012') return json({ error: 'L’adhésion ou les accès ont changé. Recharge l’équipe.' }, 403);
    return handleError(err);
  }
}
