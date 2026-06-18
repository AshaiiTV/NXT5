import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureMatchCategoriesSchema } from './_lib/match-categories';

function cleanText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

async function ensureMatchManagementColumns() {
  await sql`alter table matches add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`create index if not exists idx_matches_created_by on matches(created_by)`;
  await ensureMatchCategoriesSchema();
}

function removeIdFromJsonArray(value, id) {
  const items = Array.isArray(value) ? value : [];
  return items.filter((item) => String(item) !== String(id));
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
      const archives = await sql`select * from match_archives where team_id = ${teamId}`;
      for (const archive of archives) {
        const nextIds = removeIdFromJsonArray(archive.match_ids, matchId);
        if (!nextIds.length) {
          await sql`delete from match_archives where id = ${archive.id} and team_id = ${teamId}`;
        } else if (nextIds.length !== archive.match_ids.length) {
          await sql`
            update match_archives
            set match_ids = ${JSON.stringify(nextIds)}::jsonb,
                updated_at = now()
            where id = ${archive.id}
              and team_id = ${teamId}
          `;
        }
      }

      await sql`delete from reports where team_id = ${teamId} and match_id = ${matchId}`;
      const reports = await sql`select * from reports where team_id = ${teamId}`;
      for (const report of reports) {
        const nextIds = removeIdFromJsonArray(report.match_ids, matchId);
        if (nextIds.length !== report.match_ids.length) {
          await sql`
            update reports
            set match_ids = ${JSON.stringify(nextIds)}::jsonb,
                updated_at = now()
            where id = ${report.id}
              and team_id = ${teamId}
          `;
        }
      }

      await sql`delete from match_raw_archives where team_id = ${teamId} and match_id = ${matchId}`;
      await sql`delete from matches where id = ${matchId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'matches.delete', 'match', ${matchId}, ${JSON.stringify({ teamId, gameId: match.game_id })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (action === 'roles') {
      const roles = body.roles && typeof body.roles === 'object' ? body.roles : {};
      const allowedRoles = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);
      for (const [participantId, roleRaw] of Object.entries(roles)) {
        const role = cleanText(roleRaw, 12).toUpperCase();
        if (!allowedRoles.has(role)) continue;
        await sql`
          update match_participants
          set role = ${role}
          where id = ${participantId}
            and match_id = ${matchId}
        `;
      }
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'matches.roles', 'match', ${matchId}, ${JSON.stringify({ teamId, roles })}::jsonb)
      `;
      return json({ ok: true });
    }

    const validCategoryIds = [];
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
