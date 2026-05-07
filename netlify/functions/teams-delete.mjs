import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    const teams = await sql`
      select teams.*
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = 'captain')
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Seul l’owner ou un capitaine peut supprimer cette team.'), { status: 403 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.delete', 'team', ${teamId}, ${JSON.stringify({ name: team.name, tag: team.tag })}::jsonb)
    `;

    await sql`
      delete from teams
      where id = ${teamId}
    `;

    return json({ ok: true, teamId });
  } catch (err) {
    return handleError(err);
  }
}
