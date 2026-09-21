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
      select team_members.role, teams.owner_id
      from team_members
      join teams on teams.id = team_members.team_id
      where team_members.team_id = ${teamId}
        and team_members.user_id = ${userId}
      limit 1
    `;
    if (!target[0]) throw Object.assign(new Error('Compte introuvable dans cette team.'), { status: 404 });
    if (String(target[0].owner_id) === userId || target[0].role === 'owner') {
      throw Object.assign(new Error('Le statut du propriétaire ne peut pas être modifié.'), { status: 400 });
    }

    const rows = await sql`
      update team_members
      set role = ${role}
      where team_id = ${teamId}
        and user_id = ${userId}
        and role <> 'owner'
        and exists (
          select 1 from teams
          left join team_members actor on actor.team_id = teams.id and actor.user_id = ${user.id}
          where teams.id = ${teamId}
            and teams.owner_id <> ${userId}
            and (teams.owner_id = ${user.id} or actor.role = 'captain')
        )
      returning *
    `;
    if (!rows[0]) throw Object.assign(new Error('Les droits de cette équipe ont changé. Actualise la page.'), { status: 409 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team_member.role_update', 'team', ${teamId}, ${JSON.stringify({ targetUserId: userId, role })}::jsonb)
    `;

    return json({ member: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
