import { sql } from './db';

export const DEFAULT_MATCH_CATEGORIES = [
  { name: 'Scrim', color: 'cyan' },
  { name: 'Tournoi', color: 'purple' }
];

export async function ensureMatchCategoriesSchema() {
  await sql`
    create table if not exists match_categories (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      created_by uuid references users(id) on delete set null,
      name text not null,
      color text not null default 'cyan',
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table matches add column if not exists category_id uuid references match_categories(id) on delete set null`;
  await sql`alter table matches add column if not exists category_ids jsonb not null default '[]'::jsonb`;
  await sql`update matches set category_ids = jsonb_build_array(category_id) where category_id is not null and (category_ids is null or category_ids = '[]'::jsonb)`;
  await sql`create unique index if not exists idx_match_categories_team_name on match_categories(team_id, lower(name))`;
  await sql`create index if not exists idx_match_categories_team on match_categories(team_id, created_at asc)`;
  await sql`create index if not exists idx_matches_category on matches(category_id)`;
}

export async function seedDefaultMatchCategories(teamIds, userId = null) {
  const ids = Array.isArray(teamIds) ? teamIds.filter(Boolean) : [];
  if (!ids.length) return;
  for (const teamId of ids) {
    for (const category of DEFAULT_MATCH_CATEGORIES) {
      await sql`
        insert into match_categories (team_id, created_by, name, color, is_default)
        values (${teamId}, ${userId}, ${category.name}, ${category.color}, true)
        on conflict do nothing
      `;
    }
  }
}

export function normalizeCategoryColor(value) {
  const allowed = new Set(['cyan', 'purple', 'pink', 'green', 'yellow', 'orange', 'red', 'blue', 'slate']);
  const color = String(value || '').trim().toLowerCase();
  return allowed.has(color) ? color : 'cyan';
}
