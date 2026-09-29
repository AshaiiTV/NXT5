import { TEAM_STAFF_ROLES } from './_lib/teams';
import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { championPoolRefreshQueries } from './_lib/analytics';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { changeMatchSide } from './_lib/match-side';
import { wakeDiscordPublications } from './_lib/discord-wake';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';

function cleanText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

async function ensureMatchManagementColumns() {
  await assertSchemaReady();
}

function cleanIdList(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((id) => cleanText(id, 80)).filter(Boolean))];
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    await ensureMatchManagementColumns();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'update', 20);
    const teamId = cleanText(body.teamId, 80);
    const matchId = cleanText(body.matchId, 80);
    const label = cleanText(body.label, 140);
    const categoryIds = cleanIdList(body.categoryIds ?? body.categoryId ?? []);

    if (!teamId || !matchId) throw Object.assign(new Error('Team et game requises.'), { status: 400 });

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
    const elevated = member.owner_id === user.id || TEAM_STAFF_ROLES.includes(String(member.role || '').toLowerCase());

    const existing = await sql`
      select *
      from matches
      where id = ${matchId}
        and team_id = ${teamId}
      limit 1
    `;
    const match = existing[0];
    if (!match) throw Object.assign(new Error('Game introuvable.'), { status: 404 });
    const isCreator = String(match.created_by || '') === String(user.id);
    if (!elevated && !isCreator) {
      throw Object.assign(new Error('Seul l’intégrateur, le capitaine ou le coach peut modifier cet import.'), { status: 403 });
    }

    const lockedMatchQueries = (tx) => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select id from matches where id = ${matchId} and team_id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from matches m join teams t on t.id = m.team_id
         where m.id = ${matchId} and m.team_id = ${teamId}
           and (t.owner_id = ${user.id} or exists (select 1 from team_members tm
             where tm.team_id = t.id and tm.user_id = ${user.id}
               and (m.created_by = ${user.id} or tm.role = any(${TEAM_STAFF_ROLES}))))`
    ];

    if (action === 'delete') {
      await sql.transaction(tx => [
        ...lockedMatchQueries(tx),
        tx`update match_archives set match_ids = match_ids - ${matchId}, updated_at = now()
           where team_id = ${teamId} and match_ids @> ${JSON.stringify([matchId])}::jsonb`,
        tx`delete from match_archives where team_id = ${teamId} and match_ids = '[]'::jsonb`,
        tx`delete from reports where team_id = ${teamId} and match_id = ${matchId} and source = 'auto'`,
        tx`update reports set match_ids = match_ids - ${matchId},
             match_id = ((match_ids - ${matchId})->>0)::uuid, updated_at = now()
           where team_id = ${teamId} and (match_id = ${matchId} or match_ids @> ${JSON.stringify([matchId])}::jsonb)`,
        tx`delete from match_raw_archives where team_id = ${teamId} and match_id = ${matchId}`,
        tx`delete from matches where id = ${matchId} and team_id = ${teamId}`,
        ...championPoolRefreshQueries(tx, teamId),
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           values (${user.id}, 'matches.delete', 'match', ${matchId}, ${JSON.stringify({ teamId, gameId: match.game_id })}::jsonb)`
      ]);
      return json({ ok: true });
    }

    if (action === 'side') {
      const result = await changeMatchSide({ teamId, match, userId: user.id, allyTeamSide: body.allyTeamSide, playerAssignments: body.playerAssignments });
      wakeDiscordPublications(context);
      return json(result);
    }

    if (action === 'roles') {
      const roles = body.roles && typeof body.roles === 'object' && !Array.isArray(body.roles) ? body.roles : {};
      const allowedRoles = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);
      const players = await sql`select id from players where team_id = ${teamId} and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB')`;
      const validPlayerIds = new Set(players.map((player) => String(player.id)));
      const participants = await sql`select id, team_key, role, player_id from match_participants where match_id = ${matchId} order by id`;
      const final = participants.map(p => ({ ...p }));
      const invalid = (message: string): never => { throw Object.assign(new Error(message), { status: 400 }); };
      for (const [participantId, roleRaw] of Object.entries(roles)) {
        const participant = final.find(p => p.id === participantId);
        if (!participant) return invalid('Ce participant n’appartient pas à cette partie.');
        const assignment = roleRaw && typeof roleRaw === 'object' ? roleRaw as Record<string, any> : { role: roleRaw };
        const role = cleanText(assignment.role, 12).toUpperCase();
        if (!allowedRoles.has(role)) invalid('Rôle invalide : choisis TOP, JGL, MID, ADC ou SUP.');
        participant.role = role;
        if ('playerId' in assignment) {
          const playerId = cleanText(assignment.playerId, 80) || null;
          if (participant.team_key !== 'ALLY' && playerId) invalid('Un adversaire ne peut pas être lié à un profil de l’équipe.');
          participant.player_id = playerId;
        }
      }
      for (const side of ['ALLY', 'ENEMY']) {
        const members = final.filter(p => p.team_key === side);
        if (members.some(p => !allowedRoles.has(p.role)) || new Set(members.map(p => p.role)).size !== members.length) {
          invalid('Les rôles doivent être distincts pour chaque côté de la partie.');
        }
      }
      const allies = final.filter(p => p.team_key === 'ALLY');
      if (allies.some(p => !p.player_id || !validPlayerIds.has(p.player_id))) invalid('Chaque allié doit être lié à un profil de jeu de l’équipe, hors staff.');
      const playerIds = allies.map(p => p.player_id);
      if (new Set(playerIds).size !== allies.length) invalid('Chaque allié doit être lié à un profil de jeu distinct.');
      await sql.transaction(tx => [
        ...lockedMatchQueries(tx),
        tx`select id from match_participants where match_id = ${matchId} for update`,
        tx`select 1 / case when coalesce(jsonb_agg(jsonb_build_object('id', id, 'team_key', team_key, 'role', role, 'player_id', player_id) order by id), '[]'::jsonb)
             = ${JSON.stringify(participants)}::jsonb then 1 else 0 end from match_participants where match_id = ${matchId}`,
        tx`select 1 / case when count(*) = ${playerIds.length} then 1 else 0 end from (
             select id from players where team_id = ${teamId} and id = any(${playerIds}::uuid[])
               and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB') for share) locked_players`,
        tx`update match_participants p set role = assignment.role, player_id = assignment.player_id
           from jsonb_to_recordset(${JSON.stringify(final)}::jsonb) as assignment(id uuid, role text, player_id uuid)
           where p.id = assignment.id and p.match_id = ${matchId}`,
        ...championPoolRefreshQueries(tx, teamId),
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           values (${user.id}, 'matches.roles', 'match', ${matchId}, ${JSON.stringify({ teamId, roles })}::jsonb)`
      ]);
      wakeDiscordPublications(context);
      return json({ ok: true });
    }

    if (action === 'review-status') {
      const reviewStatus = cleanText(body.status, 20).toLowerCase();
      if (!['todo', 'done'].includes(reviewStatus)) throw Object.assign(new Error('Statut de review invalide.'), { status: 400 });
      const rows = await sql`
        update matches
        set review_status = ${reviewStatus},
            reviewed_at = case when ${reviewStatus} = 'done' then now() else null end,
            reviewed_by = case when ${reviewStatus} = 'done' then ${user.id} else null end
        where id = ${matchId}
          and team_id = ${teamId}
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'matches.review_status', 'match', ${matchId}, ${JSON.stringify({ teamId, reviewStatus })}::jsonb)
      `;
      return json({ match: rows[0] });
    }

    const validCategoryIds: string[] = [];
    if (categoryIds.length) {
      const categories = await sql`
        select id
        from match_categories
        where team_id = ${teamId}
          and id = any(${categoryIds})
      `;
      const validSet = new Set(categories.map((category) => String(category.id)));
      validCategoryIds.push(...categoryIds.filter((id) => validSet.has(String(id))));
      if (validCategoryIds.length !== categoryIds.length) throw Object.assign(new Error('Catégorie introuvable pour cette team.'), { status: 404 });
    }

    const currentCategoryIds = cleanIdList(match.category_ids?.length ? match.category_ids : match.category_id ? [match.category_id] : []);
    if (!label && JSON.stringify(validCategoryIds) === JSON.stringify(currentCategoryIds)) throw Object.assign(new Error('Nom ou catégorie requis.'), { status: 400 });
    const displayName = label || match.opponent || match.game_id;
    const results = await sql.transaction(tx => [
      ...lockedMatchQueries(tx),
      tx`select 1 / case when count(*) = ${validCategoryIds.length} then 1 else 0 end from (
           select id from match_categories where team_id = ${teamId} and id = any(${validCategoryIds}::uuid[]) for key share) locked_categories`,
      tx`update matches set opponent = ${displayName}, category_id = ${validCategoryIds[0] || null},
           category_ids = ${JSON.stringify(validCategoryIds)}::jsonb,
           raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{nxt5Label}', to_jsonb(${displayName}::text), true)
         where id = ${matchId} and team_id = ${teamId} returning *`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         values (${user.id}, 'matches.update', 'match', ${matchId}, ${JSON.stringify({ teamId, label: displayName, categoryIds: validCategoryIds })}::jsonb)`
    ]);
    const rows = results[4];

    wakeDiscordPublications(context);
    return json({ match: rows[0] });
  } catch (err: any) {
    if (err?.code === '22012' || err?.code === '23503') return json({ error: 'La partie, les accès, les profils ou les catégories ont changé. Recharge l’équipe puis réessaie.' }, 409);
    return handleError(err);
  }
}
