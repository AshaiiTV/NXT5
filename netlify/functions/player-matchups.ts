import type { Context } from '@netlify/functions';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { canEditMatchup, ensurePlayerMatchupsSchema, isLinkedMatchup, serializeMatchup, STAFF_ROLES, validateMatchupRequest } from './_lib/player-matchups';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = validateMatchupRequest(await readJson(request, 256 * 1024));
    await ensurePlayerMatchupsSchema();

    const memberships = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${body.teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!memberships[0]) throw Object.assign(new Error('Accès à cette équipe refusé.'), { status: 403 });
    const players = await sql`select id, user_id from players where team_id = ${body.teamId} and id = ${body.playerId} limit 1`;
    if (!players[0]) throw Object.assign(new Error('Profil joueur introuvable dans cette équipe.'), { status: 404 });
    const canEdit = canEditMatchup(user.id, memberships[0], players[0]);

    if (body.action === 'list') {
      const notebooks = await sql`
        select n.*, coalesce(nullif(u.name, ''), u.account_name) as updated_by_name
        from player_matchup_notebooks n left join users u on u.id = n.updated_by
        where n.team_id = ${body.teamId} and n.player_id = ${body.playerId} and n.champion = ${body.champion}
        order by n.updated_at desc, n.id
      `;
      return json({ notebooks: notebooks.map(serializeMatchup), canEdit });
    }
    if (!canEdit) throw Object.assign(new Error('Seuls le joueur lié à ce profil, le staff et l’owner peuvent modifier ce carnet.'), { status: 403 });

    const matchIds = [...new Set(body.experiments.flatMap(exp => exp.matchIds))];
    let participants: Record<string, any>[] = [];
    if (matchIds.length) {
      participants = await sql`
        select p.id, m.team_id, p.match_id, p.player_id, p.team_key, p.champion, p.role
        from matches m join match_participants p on p.match_id = m.id
        where m.team_id = ${body.teamId} and m.id = any(${matchIds}::uuid[])
        order by p.id
      `;
      if (matchIds.some(id => !isLinkedMatchup(participants.filter(row => row.match_id === id), body))) {
        throw Object.assign(new Error('Chaque partie associée doit appartenir à ce joueur et à ce matchup dans cette équipe, avec un adversaire au même poste identifié sans ambiguïté.'), { status: 400, code: 'INVALID_MATCHUP_GAMES' });
      }
    }

    let results;
    try {
      results = await sql.transaction(tx => [
        // Imports and side corrections also lock the team first. Lock the exact
        // references before rechecking them so role edits, deletes or a revoked
        // membership cannot slip between the evidence check and the save.
        tx`select id from teams where id = ${body.teamId} for update`,
        tx`select user_id from team_members where team_id = ${body.teamId} and user_id = ${user.id} for share`,
        tx`select id from players where team_id = ${body.teamId} and id = ${body.playerId} for share`,
        tx`select id from matches where team_id = ${body.teamId} and id = any(${matchIds}::uuid[]) order by id for update`,
        tx`select id from match_participants where match_id = any(${matchIds}::uuid[]) order by id for share`,
        // Neon batches cannot branch: a failed guard aborts the whole transaction.
        tx`select 1 / case when count(*) = 1 then 1 else 0 end as permission_valid
           from players p join teams t on t.id = p.team_id
           where p.id = ${body.playerId} and p.team_id = ${body.teamId}
             and (t.owner_id = ${user.id} or exists (
               select 1 from team_members tm where tm.team_id = t.id and tm.user_id = ${user.id}
                 and (p.user_id = ${user.id} or lower(tm.role) = any(${STAFF_ROLES}::text[]))
             ))`,
        tx`select 1 / case when count(*) = ${matchIds.length} then 1 else 0 end as matches_valid
           from matches where team_id = ${body.teamId} and id = any(${matchIds}::uuid[])`,
        tx`select 1 / case when coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'team_id', m.team_id, 'match_id', p.match_id, 'player_id', p.player_id,
             'team_key', p.team_key, 'champion', p.champion, 'role', p.role
           ) order by p.id), '[]'::jsonb) = ${JSON.stringify(participants)}::jsonb then 1 else 0 end as evidence_valid
           from matches m join match_participants p on p.match_id = m.id
           where m.team_id = ${body.teamId} and m.id = any(${matchIds}::uuid[])`,
        // Unique scope protects first saves; compare-and-swap protects updates.
        body.expectedRevision === 0 ? tx`
          insert into player_matchup_notebooks (team_id, player_id, champion, opponent_champion, role, plan, experiments, updated_by)
          values (${body.teamId}, ${body.playerId}, ${body.champion}, ${body.opponentChampion}, ${body.role}, ${JSON.stringify(body.plan)}::jsonb, ${JSON.stringify(body.experiments)}::jsonb, ${user.id})
          on conflict (team_id, player_id, champion, opponent_champion, role) do nothing
          returning *
        ` : tx`
          update player_matchup_notebooks
          set plan = ${JSON.stringify(body.plan)}::jsonb, experiments = ${JSON.stringify(body.experiments)}::jsonb,
              revision = revision + 1, updated_by = ${user.id}, updated_at = now()
          where team_id = ${body.teamId} and player_id = ${body.playerId} and champion = ${body.champion}
            and opponent_champion = ${body.opponentChampion} and role = ${body.role} and revision = ${body.expectedRevision}
          returning *
        `
      ]);
    } catch (err: any) {
      if (err?.code === '22012' || err?.code === '23503') {
        throw Object.assign(new Error('Les parties, le profil ou les accès ont changé. Recharge le carnet avant de réessayer.'), { status: 409, code: 'NOTEBOOK_REFERENCE_CHANGED' });
      }
      throw err;
    }
    const rows = results[results.length - 1];
    if (!rows[0]) throw Object.assign(new Error('Ce carnet a été modifié ailleurs. Recharge sa dernière version avant d’enregistrer à nouveau.'), { status: 409, code: 'NOTEBOOK_REVISION_CONFLICT' });
    return json({ notebook: serializeMatchup({ ...rows[0], updated_by_name: user.name || user.account_name }), canEdit: true });
  } catch (err: any) {
    // Database errors can include parameter values. Do not send note content or
    // SQL diagnostics to shared logging through handleError.
    const status = err?.status || 500;
    return handleError(Object.assign(new Error(status >= 500 ? 'Player matchup request failed.' : (err?.message || 'Requête de carnet invalide.')), {
      status, code: err?.code, publicMessage: err?.publicMessage
    }));
  }
}
