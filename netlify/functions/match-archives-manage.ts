import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { cleanText } from './_lib/text';
import { TEAM_STAFF_ROLES } from './_lib/teams';
import { randomUUID } from 'node:crypto';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertSchemaReady();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const archiveId = cleanText(body.archiveId, 80);
    const name = cleanText(body.name, 140);
    const description = cleanText(body.description, 1000);
    const matchIds = Array.isArray(body.matchIds) ? body.matchIds.map((id) => cleanText(id, 80)).filter(Boolean) : [];

    if (matchIds.length > 80) throw Object.assign(new Error('Un groupe peut contenir au maximum 80 parties. Réduis la sélection.'), { status: 400 });

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

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
    const isCaptain = member.owner_id === user.id || TEAM_STAFF_ROLES.includes(String(member.role || '').toLowerCase());
    // All archive and match mutations serialize on the team row. Recheck the
    // membership/creator after acquiring it so a revoked request cannot commit.
    const lockedArchiveQueries = (tx, existingArchiveId: string | null) => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
         where t.id = ${teamId}
           and (t.owner_id = ${user.id} or exists (
             select 1 from team_members tm where tm.team_id = t.id and tm.user_id = ${user.id}
               and (${existingArchiveId === null} or tm.role = any(${TEAM_STAFF_ROLES}) or exists (
                 select 1 from match_archives a where a.id = ${existingArchiveId} and a.team_id = t.id and a.created_by = ${user.id}))))
           and (${existingArchiveId === null} or exists (
             select 1 from match_archives a where a.id = ${existingArchiveId} and a.team_id = t.id))`
    ];

    if (action === 'delete') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut supprimer cette archive.'), { status: 403 });
      }
      await sql.transaction(tx => [
        ...lockedArchiveQueries(tx, archiveId),
        tx`delete from match_archives where id = ${archiveId} and team_id = ${teamId}`,
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.delete', 'match_archives', ${archiveId}, ${JSON.stringify({ teamId, name: archive.name })}::jsonb)
        `
      ]);
      return json({ ok: true });
    }

    if (!name) throw Object.assign(new Error('Nom d’archive requis.'), { status: 400 });
    if (!matchIds.length) throw Object.assign(new Error('Sélectionne au moins une game.'), { status: 400 });

    const validMatches = await sql`
      select id
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    `;
    const validMatchIds = validMatches.map((match) => match.id);
    if (!validMatchIds.length) throw Object.assign(new Error('Aucune game valide pour cette team.'), { status: 400 });
    const lockedMatchesQuery = (tx) => tx`select 1 / case when count(*) = ${validMatchIds.length} then 1 else 0 end from (
      select id from matches where team_id = ${teamId} and id = any(${validMatchIds}::uuid[]) for key share) locked_matches`;

    if (action === 'update') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut modifier cette archive.'), { status: 403 });
      }
      const results = await sql.transaction(tx => [
        ...lockedArchiveQueries(tx, archiveId), lockedMatchesQuery(tx),
        tx`update match_archives
        set name = ${name},
            description = ${description || null},
            match_ids = ${JSON.stringify(validMatchIds)}::jsonb,
            updated_at = now()
        where id = ${archiveId}
          and team_id = ${teamId}
        returning *`,
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.update', 'match_archives', ${archiveId}, ${JSON.stringify({ teamId, name, matchIds: validMatchIds })}::jsonb)
        `
      ]);
      return json({ archive: results[3][0] });
    }

    const createdId = randomUUID();
    const results = await sql.transaction(tx => [
      ...lockedArchiveQueries(tx, null), lockedMatchesQuery(tx),
      tx`insert into match_archives (id, team_id, created_by, name, description, match_ids)
        values (${createdId}, ${teamId}, ${user.id}, ${name}, ${description || null}, ${JSON.stringify(validMatchIds)}::jsonb)
        returning *`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.create', 'match_archives', ${createdId}, ${JSON.stringify({ teamId, name, matchIds: validMatchIds })}::jsonb)`
    ]);

    return json({ archive: results[3][0] });
  } catch (err) {
    if (err?.code === '22012' || err?.code === '23503') return json({ error: 'Les accès, le groupe ou ses parties ont changé. Recharge l’équipe puis réessaie.' }, 409);
    return handleError(err);
  }
}
