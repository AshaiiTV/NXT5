import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const ROLES = new Set(['captain', 'coach', 'player']);

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const userId = String(body.userId || '').trim();
    const role = String(body.role || '').trim().toLowerCase();

    if (!teamId || !userId || !ROLES.has(role)) throw Object.assign(new Error('Team, compte et statut requis.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = 'captain')
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un capitaine peut modifier les statuts.'), { status: 403 });

    const target = await sql`
      select role
      from team_members
      where team_id = ${teamId}
        and user_id = ${userId}
      limit 1
    `;
    if (!target[0]) throw Object.assign(new Error('Compte introuvable dans cette team.'), { status: 404 });
    if (target[0].role === 'owner') throw Object.assign(new Error('Le statut owner ne peut pas être modifié.'), { status: 400 });

    const rows = await sql`
      update team_members
      set role = ${role}
      where team_id = ${teamId}
        and user_id = ${userId}
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team_member.role_update', 'team', ${teamId}, ${JSON.stringify({ targetUserId: userId, role })}::jsonb)
    `;

    return json({ member: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
