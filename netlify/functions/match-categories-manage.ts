import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureMatchCategoriesSchema, normalizeCategoryColor, seedDefaultMatchCategories } from './_lib/match-categories';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import { cleanText } from './_lib/text';
import { TEAM_STAFF_ROLES } from './_lib/teams';

const LAST_MATCH_TAG_MESSAGE = 'Ce tag est le dernier tag d’une partie. Ajoute un autre tag à cette partie avant de le supprimer.';

async function requireCategoryManager(teamId, userId) {
  const membership = await sql`
    select teams.owner_id, team_members.role
    from teams
    left join team_members on team_members.team_id = teams.id and team_members.user_id = ${userId}
    where teams.id = ${teamId}
      and (teams.owner_id = ${userId} or team_members.user_id = ${userId})
    limit 1
  `;
  const member = membership[0];
  if (!member) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });
  const role = String(member.role || '').toLowerCase();
  const canManage = member.owner_id === userId || TEAM_STAFF_ROLES.includes(role);
  if (!canManage) throw Object.assign(new Error('Seul le capitaine, le coach ou le staff peut gérer les catégories.'), { status: 403 });
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    await ensureMatchCategoriesSchema();
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const categoryId = cleanText(body.categoryId, 80);
    const name = cleanText(body.name, 80);
    const color = normalizeCategoryColor(body.color);

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });
    await requireCategoryManager(teamId, user.id);
    await seedDefaultMatchCategories([teamId], user.id);

    if (action === 'create') {
      if (!name) throw Object.assign(new Error('Nom de catégorie requis.'), { status: 400 });
      const rows = await sql`
        insert into match_categories (team_id, created_by, name, color, is_default)
        values (${teamId}, ${user.id}, ${name}, ${color}, false)
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_categories.create', 'match_category', ${rows[0].id}, ${JSON.stringify({ teamId, name, color })}::jsonb)
      `;
      return json({ category: rows[0] });
    }

    if (!categoryId) throw Object.assign(new Error('Catégorie requise.'), { status: 400 });
    const current = await sql`select * from match_categories where id = ${categoryId} and team_id = ${teamId} limit 1`;
    const category = current[0];
    if (!category) throw Object.assign(new Error('Catégorie introuvable.'), { status: 404 });

    if (action === 'delete') {
      if (category.is_default) throw Object.assign(new Error('Scrim est une catégorie de base et ne peut pas être supprimée.'), { status: 400 });
      const untaggedMatches = await sql`
        select m.id from matches m
        where m.team_id = ${teamId}
          and (m.category_id = ${categoryId}::uuid or m.category_ids ? ${categoryId})
          and not exists (
            select 1 from match_categories remaining
            where remaining.team_id = m.team_id and remaining.id <> ${categoryId}::uuid
              and coalesce(m.category_ids, '[]'::jsonb) ? remaining.id::text
          ) limit 1
      `;
      if (untaggedMatches.length) throw Object.assign(new Error(LAST_MATCH_TAG_MESSAGE), { status: 400, code: 'NXT5_MATCH_TAG_REQUIRED' });
      // Imports use the same team lock. Cleanup must happen after taking it,
      // otherwise an in-flight import can reintroduce this ID between cleanup
      // and deletion, leaving category_ids pointing to a deleted category.
      await sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
        // Repeat after acquiring the shared mutation lock: another update may
        // have removed the other tags since the friendly validation above.
        tx`select 1 / case when count(*) = 0 then 1 else 0 end from matches m
           where m.team_id = ${teamId}
             and (m.category_id = ${categoryId}::uuid or m.category_ids ? ${categoryId})
             and not exists (
               select 1 from match_categories remaining
               where remaining.team_id = m.team_id and remaining.id <> ${categoryId}::uuid
                 and coalesce(m.category_ids, '[]'::jsonb) ? remaining.id::text
             )`,
        tx`update matches
           set category_ids = coalesce(category_ids, '[]'::jsonb) - ${categoryId}::text,
               category_id = ((coalesce(category_ids, '[]'::jsonb) - ${categoryId}::text) ->> 0)::uuid
           where team_id = ${teamId}
             and (category_id = ${categoryId}::uuid or category_ids ? ${categoryId})`,
        tx`delete from match_categories where id = ${categoryId} and team_id = ${teamId}`
      ]);
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_categories.delete', 'match_category', ${categoryId}, ${JSON.stringify({ teamId, name: category.name })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (action === 'update') {
      if (category.is_default && name && name !== category.name) throw Object.assign(new Error('La catégorie Scrim ne peut pas être renommée.'), { status: 400 });
      const results = await sql.transaction(tx => [
        // Share the lock used by membership changes and category deletion.
        // Authorization and the category may have changed since the first read.
        tx`select id from teams where id = ${teamId} for update`,
        tx`with permission as materialized (
          select t.id from teams t
          where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
            select 1 from team_members tm where tm.team_id = t.id and tm.user_id = ${user.id}
              and tm.role = any(${TEAM_STAFF_ROLES})
          ))
        ), updated as (
          update match_categories
          set name = case when is_default then name else coalesce(nullif(${name}, ''), name) end,
              color = ${color}, updated_at = now()
          where id = ${categoryId} and team_id = ${teamId}
            and exists (select 1 from permission)
          returning *
        ), audited as (
          insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
          select ${user.id}, 'match_categories.update', 'match_category', id,
            jsonb_build_object('teamId', team_id, 'name', name, 'color', color)
          from updated
        )
        select exists (select 1 from permission) as allowed,
          (select row_to_json(updated) from updated) as category`
      ]);
      const result = results[1][0];
      if (!result.allowed) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });
      if (!result.category) throw Object.assign(new Error('Catégorie introuvable.'), { status: 404 });
      return json({ category: result.category });
    }

    throw Object.assign(new Error('Action inconnue.'), { status: 400 });
  } catch (err: any) {
    if (err?.code === '23505' && err?.constraint === 'idx_match_categories_team_name') {
      return json({ error: 'Une catégorie portant ce nom existe déjà dans cette équipe.', code: 'NXT5_CATEGORY_NAME_CONFLICT' }, 409);
    }
    if (err?.code === '22012') return json({ error: LAST_MATCH_TAG_MESSAGE, code: 'NXT5_MATCH_TAG_REQUIRED' }, 409);
    return handleError(err);
  }
}
