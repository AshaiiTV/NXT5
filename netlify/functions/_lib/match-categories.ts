import { assertSchemaReady } from './migrations';
import { sql } from './db';

export const DEFAULT_MATCH_CATEGORIES = [
  { name: 'Scrim', color: 'cyan' }
];

export function assertMatchHasCategory(categoryIds: readonly string[]): void {
  if (!categoryIds.length) {
    throw Object.assign(new Error('Ajoute au moins un tag à la partie.'), { status: 400, code: 'NXT5_MATCH_TAG_REQUIRED' });
  }
}

export async function ensureMatchCategoriesSchema({ migrateLegacy = true }: { migrateLegacy?: boolean } = {}) {
  await assertSchemaReady();
}

export async function seedDefaultMatchCategories(teamIds: string[], userId: string | null = null): Promise<void> {
  const ids = Array.isArray(teamIds) ? [...new Set(teamIds.filter(Boolean))] : [];
  if (!ids.length) return;
  for (const teamId of ids) {
    for (const category of DEFAULT_MATCH_CATEGORIES) {
      await sql.transaction(tx => [
        // Use the same lock as category edits: a renamed default already fills
        // this role, including when initialization races with its rename.
        tx`select id from teams where id = ${teamId} for update`,
        tx`insert into match_categories (team_id, created_by, name, color, is_default)
           select ${teamId}, ${userId}, ${category.name}, ${category.color}, true
           where not exists (
             select 1 from match_categories where team_id = ${teamId} and is_default
           )
           on conflict do nothing`
      ]);
    }
  }
}

export function normalizeCategoryColor(value) {
  const allowed = new Set(['cyan', 'purple', 'pink', 'green', 'yellow', 'orange', 'red', 'blue', 'slate']);
  const color = String(value || '').trim().toLowerCase();
  return allowed.has(color) ? color : 'cyan';
}
