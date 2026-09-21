import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

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
    assertSessionSecret();
    assertMethod(request, 'POST');
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
    const elevated = member.owner_id === user.id || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(member.role || '').toLowerCase());

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

    if (action === 'delete') {
      // Use the canonical UUID for JSON references, even if the request used
      // uppercase. Keep reviews: the schema does not identify auto/manual ones.
      const deletedMatchId = String(match.id);
      await sql.transaction(tx => [
        // Same lock order as imports: one team's match mutations serialize.
        tx`select id from teams where id = ${teamId} for update`,
        tx`select id from matches where id = ${deletedMatchId} and team_id = ${teamId} for update`,
        tx`select id from reports where team_id = ${teamId}
           and (match_id = ${deletedMatchId} or match_ids ? ${deletedMatchId}) for update`,
        tx`select id from match_archives where team_id = ${teamId}
           and match_ids ? ${deletedMatchId} for update`,
        tx`update reports
           set match_ids = coalesce((
                 select jsonb_agg(value order by position)
                 from jsonb_array_elements(case when jsonb_typeof(reports.match_ids) = 'array'
                   then reports.match_ids else '[]'::jsonb end) with ordinality as links(value, position)
                 where value <> to_jsonb(${deletedMatchId}::text)
               ), '[]'::jsonb),
               match_id = case when reports.match_id = ${deletedMatchId} or reports.match_id is null then (
                 select remaining.id
                 from jsonb_array_elements_text(case when jsonb_typeof(reports.match_ids) = 'array'
                   then reports.match_ids else '[]'::jsonb end) with ordinality as links(id, position)
                 join matches remaining on remaining.id::text = links.id and remaining.team_id = ${teamId}
                 where remaining.id <> ${deletedMatchId}
                 order by position limit 1
               ) else reports.match_id end,
               updated_at = now()
           where team_id = ${teamId}
             and (match_id = ${deletedMatchId} or match_ids ? ${deletedMatchId})`,
        tx`delete from match_archives
           where team_id = ${teamId} and match_ids ? ${deletedMatchId}
             and not exists (select 1 from jsonb_array_elements_text(match_archives.match_ids) as links(id)
                             where id <> ${deletedMatchId})`,
        tx`update match_archives
           set match_ids = (select jsonb_agg(value order by position)
                 from jsonb_array_elements(match_archives.match_ids) with ordinality as links(value, position)
                 where value <> to_jsonb(${deletedMatchId}::text)),
               updated_at = now()
           where team_id = ${teamId} and match_ids ? ${deletedMatchId}`,
        tx`delete from match_raw_archives where team_id = ${teamId} and match_id = ${deletedMatchId}`,
        tx`delete from matches where id = ${deletedMatchId} and team_id = ${teamId}`,
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           values (${user.id}, 'matches.delete', 'match', ${deletedMatchId}, ${JSON.stringify({ teamId, gameId: match.game_id })}::jsonb)`
      ]);
      return json({ ok: true });
    }

    if (action === 'roles') {
      const roles = body.roles && typeof body.roles === 'object' ? body.roles : {};
      const allowedRoles = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);
      const players = await sql`select id from players where team_id = ${teamId}`;
      const validPlayerIds = new Set(players.map((player) => String(player.id)));
      for (const [participantId, roleRaw] of Object.entries(roles)) {
        const assignment = roleRaw && typeof roleRaw === 'object' ? roleRaw as Record<string, any> : { role: roleRaw };
        const role = cleanText(assignment.role, 12).toUpperCase();
        const playerId = cleanText(assignment.playerId, 80);
        if (!allowedRoles.has(role)) continue;
        if (playerId && !validPlayerIds.has(playerId)) throw Object.assign(new Error('Profil joueur invalide pour cette team.'), { status: 400 });
        if (playerId) {
          await sql`
            update match_participants
            set role = ${role},
                player_id = ${playerId}
            where id = ${participantId}
              and match_id = ${matchId}
              and team_key = 'ALLY'
          `;
        } else {
          await sql`
            update match_participants
            set role = ${role}
            where id = ${participantId}
              and match_id = ${matchId}
          `;
        }
      }
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'matches.roles', 'match', ${matchId}, ${JSON.stringify({ teamId, roles })}::jsonb)
      `;
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
    const rows = await sql`
      update matches
      set opponent = ${displayName},
          category_id = ${validCategoryIds[0] || null},
          category_ids = ${JSON.stringify(validCategoryIds)}::jsonb,
          raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{nxt5Label}', to_jsonb(${displayName}::text), true)
      where id = ${matchId}
        and team_id = ${teamId}
      returning *
    `;
    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'matches.update', 'match', ${matchId}, ${JSON.stringify({ teamId, label: displayName, categoryIds: validCategoryIds })}::jsonb)
    `;

    return json({ match: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
