import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { cleanText } from './_lib/text';

const COACHING_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];
const MAX_CONTENT_LENGTH = 4000;

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const teamId = cleanText(body.teamId, 80);
    const playerId = cleanText(body.playerId, 80);
    const content = cleanText(body.content, MAX_CONTENT_LENGTH);

    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil requis.'), { status: 400 });

    await assertSchemaReady();

    const membership = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const member = membership[0];
    if (!member) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });

    const canEdit = member.owner_id === user.id || COACHING_ROLES.includes(String(member.role || '').toLowerCase());
    if (!canEdit) throw Object.assign(new Error('Seul le staff, le capitaine ou l’owner peut modifier le bilan coaching.'), { status: 403 });

    const players = await sql`
      select id
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!players[0]) throw Object.assign(new Error('Profil joueur introuvable dans cette équipe.'), { status: 404 });

    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`select id from players where id = ${playerId} and team_id = ${teamId} for share`,
      tx`with changed_note as (
        insert into player_coaching_notes (team_id, player_id, content, updated_by)
        select teams.id, players.id, ${content}, ${user.id}
        from teams join players on players.team_id = teams.id
        where teams.id = ${teamId} and players.id = ${playerId}
          and (teams.owner_id = ${user.id} or exists (select 1 from team_members
            where team_id = teams.id and user_id = ${user.id} and role = any(${COACHING_ROLES})))
        on conflict (team_id, player_id) do update
          set content = excluded.content,
              updated_by = excluded.updated_by,
              updated_at = now()
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'profile.coaching_note.update', 'players', player_id, ${JSON.stringify({ teamId, length: content.length })}::jsonb
        from changed_note
      )
      select * from changed_note`
    ]);
    const rows = results[3];
    if (!rows[0]) throw Object.assign(new Error('Le profil ou les accès ont changé. Recharge l’équipe.'), { status: 403 });

    return json({ note: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
