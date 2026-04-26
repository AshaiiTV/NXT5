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
      select *
      from teams
      where id = ${teamId}
        and owner_id = ${user.id}
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Seul le propriétaire peut supprimer cette team.'), { status: 403 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.delete', 'team', ${teamId}, ${JSON.stringify({ name: team.name, tag: team.tag })}::jsonb)
    `;

    await sql`
      delete from teams
      where id = ${teamId}
        and owner_id = ${user.id}
    `;

    return json({ ok: true, teamId });
  } catch (err) {
    return handleError(err);
  }
}
