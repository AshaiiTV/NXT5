import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    // Serialize against other team mutations, then re-read ownership in a fresh
    // statement. Deletion, cascades and its audit record must commit together.
    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`with deleted_team as (
           delete from teams where id = ${teamId} and owner_id = ${user.id}
           returning id, name, tag
         ), logged as (
           insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           select ${user.id}, 'team.delete', 'team', id, jsonb_build_object('name', name, 'tag', tag)
           from deleted_team
         )
         select id from deleted_team`
    ]);
    if (!results[1][0]) throw Object.assign(new Error('Seul le propriétaire peut supprimer définitivement cette team.'), { status: 403 });

    return json({ ok: true, teamId });
  } catch (err) {
    return handleError(err);
  }
}
