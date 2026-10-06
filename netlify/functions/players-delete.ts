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
    const playerId = String(body.playerId || '').trim();
    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil Riot requis.'), { status: 400 });

    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`with authorized_team as materialized (
        select id from teams where id = ${teamId}
          and (owner_id = ${user.id} or exists (select 1 from team_members
            where team_id = teams.id and user_id = ${user.id}
              and role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board')))
      ), deleted_player as (
        delete from players where id = ${playerId} and team_id in (select id from authorized_team)
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'player.delete', 'player', id, jsonb_build_object('teamId', team_id, 'riotId', riot_id)
        from deleted_player
      )
      select exists(select 1 from authorized_team) as allowed,
        (select to_jsonb(deleted_player) from deleted_player) as player`
    ]);
    const result = results[2][0];
    if (!result?.allowed) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut supprimer un profil.'), { status: 403 });
    if (!result.player) throw Object.assign(new Error('Profil Riot introuvable dans cette team.'), { status: 404 });

    return json({ ok: true, player: result.player });
  } catch (err) {
    return handleError(err);
  }
}
