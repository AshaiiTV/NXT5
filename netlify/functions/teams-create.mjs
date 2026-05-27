import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const name = String(body.name || '').trim();
    const tag = String(body.tag || '').trim().toUpperCase();
    const region = String(body.region || 'EUW').trim().toUpperCase();

    if (!name || !tag) throw Object.assign(new Error('Nom et tag requis.'), { status: 400 });

    const rows = await sql`
      insert into teams (owner_id, name, tag, region)
      values (${user.id}, ${name}, ${tag}, ${region})
      returning *
    `;
    const team = rows[0];

    await sql`
      insert into team_members (team_id, user_id, role)
      values (${team.id}, ${user.id}, 'captain')
      on conflict (team_id, user_id) do nothing
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.create', 'team', ${team.id}, ${JSON.stringify({ name, tag, region })}::jsonb)
    `;

    return json({ team });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Cette team existe déjà sur ton compte.';
    return handleError(err);
  }
}
