import { assertSchemaReady } from './_lib/migrations';
import { randomUUID } from 'node:crypto';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

async function ensureArchiveTable() {
  await assertSchemaReady();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await ensureArchiveTable();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const archiveId = cleanText(body.archiveId, 80);
    const name = cleanText(body.name, 140);
    const description = cleanText(body.description, 1000);
    const matchIds = Array.isArray(body.matchIds) ? [...new Set(body.matchIds.map((id) => cleanText(id, 80).toLowerCase()).filter(Boolean))].slice(0, 80) : [];

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
    const isCaptain = member.owner_id === user.id || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(member.role || '').toLowerCase());

    if (action === 'delete') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut supprimer cette archive.'), { status: 403 });
      }
      await sql`delete from match_archives where id = ${archiveId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_archives.delete', 'match_archives', ${archiveId}, ${JSON.stringify({ teamId, name: archive.name })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!name) throw Object.assign(new Error('Nom d’archive requis.'), { status: 400 });
    if (!matchIds.length) throw Object.assign(new Error('Sélectionne au moins une game.'), { status: 400 });

    if (action === 'update') {
      if (!archiveId) throw Object.assign(new Error('Archive requise.'), { status: 400 });
      const existing = await sql`select * from match_archives where id = ${archiveId} and team_id = ${teamId} limit 1`;
      const archive = existing[0];
      if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });
      if (String(archive.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul le créateur ou le capitaine peut modifier cette archive.'), { status: 403 });
      }
    }

    const savedArchiveId = action === 'update' ? archiveId : randomUUID();
    let archive;
    try {
      const results = await sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
        tx`select 1 / case when count(*) = ${matchIds.length} then 1 else 0 end as matches_valid
           from (select id from matches where team_id = ${teamId}
                 and id = any(${matchIds}::uuid[]) for key share) locked_matches`,
        action === 'update'
          ? tx`update match_archives set name = ${name}, description = ${description || null},
                 match_ids = ${JSON.stringify(matchIds)}::jsonb, updated_at = now()
               where id = ${savedArchiveId} and team_id = ${teamId} returning *`
          : tx`insert into match_archives (id, team_id, created_by, name, description, match_ids)
               values (${savedArchiveId}, ${teamId}, ${user.id}, ${name}, ${description || null},
                 ${JSON.stringify(matchIds)}::jsonb) returning *`,
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           values (${user.id}, ${action === 'update' ? 'match_archives.update' : 'match_archives.create'},
             'match_archives', ${savedArchiveId}, ${JSON.stringify({ teamId, name, matchIds })}::jsonb)`
      ]);
      archive = results[2][0];
    } catch (error: any) {
      if (error?.code === '22012' || error?.code === '23503') {
        throw Object.assign(new Error('Les games liées ont changé. Recharge les données avant de sauvegarder le groupe.'), {
          status: 409, code: 'MATCH_REFERENCES_CHANGED'
        });
      }
      throw error;
    }
    if (!archive) throw Object.assign(new Error('Archive introuvable.'), { status: 404 });

    return json({ archive });
  } catch (err) {
    return handleError(err);
  }
}
