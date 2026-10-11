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
