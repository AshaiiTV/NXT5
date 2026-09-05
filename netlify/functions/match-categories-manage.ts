import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureMatchCategoriesSchema, normalizeCategoryColor, seedDefaultMatchCategories } from './_lib/match-categories';

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

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
  const canManage = member.owner_id === userId || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(role);
  if (!canManage) throw Object.assign(new Error('Seul le capitaine, le coach ou le staff peut gérer les catégories.'), { status: 403 });
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
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
      // Imports use the same team lock. Cleanup must happen after taking it,
      // otherwise an in-flight import can reintroduce this ID between cleanup
      // and deletion, leaving category_ids pointing to a deleted category.
      await sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
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
      const rows = await sql`
        update match_categories
        set name = ${name || category.name},
            color = ${color},
            updated_at = now()
        where id = ${categoryId}
          and team_id = ${teamId}
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match_categories.update', 'match_category', ${categoryId}, ${JSON.stringify({ teamId, name: rows[0].name, color: rows[0].color })}::jsonb)
      `;
      return json({ category: rows[0] });
    }

    throw Object.assign(new Error('Action inconnue.'), { status: 400 });
  } catch (err) {
    return handleError(err);
  }
}
