import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import { nexusEngagementError, nexusEngagementGuard } from './_lib/nexus-team-lifecycle';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) throw Object.assign(new Error('Team ID invalide.'), { status: 400 });
    const scope = { ownerId: user.id, teamId };

    // Serialize against other team mutations, then re-read ownership in a fresh
    // statement. Deletion, cascades and its audit record must commit together.
    let results: any[];
    try {
      results = await sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
        nexusEngagementGuard(tx, scope),
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
    } catch (err: any) {
      if (err?.code === '22012') throw nexusEngagementError(scope);
      throw err;
    }
    if (!results[2][0]) throw Object.assign(new Error('Seul le propriétaire peut supprimer définitivement cette team.'), { status: 403 });

    return json({ ok: true, teamId });
  } catch (err) {
    return handleError(err);
  }
}
