import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { loadMigrations } from '../../tools/migration-runner.mjs';

describe('team review milestone migration', () => {
  it('backfills existing reviews conservatively, preserves empty teams, and is repeatable', async () => {
    const db = new PGlite();
    try {
      await db.exec(`create table teams (id text primary key);
        create table reports (team_id text references teams(id) on delete cascade);
        create table matches (team_id text references teams(id) on delete cascade);
        insert into teams values ('historical'), ('empty');
        insert into reports values ('historical');
        insert into matches values ('historical');`);
      const migration = readFileSync(new URL('../../database/migrations/20260928_team_activation_milestones.sql', import.meta.url), 'utf8');
      expect((await loadMigrations()).find(item => item.key === 'team-activation-milestones-20260928-v1')?.sql).toBe(migration);
      await db.exec(migration);
      const rows = (await db.query('select id, first_review_at, first_import_at from teams order by id')).rows;
      expect(rows[0]).toEqual({ id: 'empty', first_review_at: null, first_import_at: null });
      expect(rows[1].first_review_at).not.toBeNull();
      expect(rows[1].first_import_at).not.toBeNull();
      await db.exec(migration);
      expect((await db.query('select id, first_review_at, first_import_at from teams order by id')).rows).toEqual(rows);
      await db.exec("delete from teams where id='historical'");
      expect((await db.query('select * from reports')).rows).toEqual([]);
    } finally { await db.close(); }
  }, 20_000);
});
