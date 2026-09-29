import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as any, error: null as any }));
vi.mock('../../netlify/functions/_lib/db', () => ({
  sql: async (parts: TemplateStringsArray) => {
    if (state.error) throw state.error;
    return (await state.db.query(parts.join(''))).rows;
  },
}));
import cleanup from '../../netlify/functions/review-backfill-cleanup';

beforeAll(async () => { state.db = new PGlite(); await state.db.waitReady; });
afterAll(async () => { await state.db.close(); });

describe('temporary review backup cleanup', () => {
  it('succeeds when the optional backfill table does not exist', async () => {
    expect((await cleanup()).status).toBe(204);
  });

  it('deletes only expired copies and can safely run again', async () => {
    await state.db.exec(`create table nxt5_review_backfill_backups (id integer, backed_up_at timestamptz);
      create table reports (content text);
      insert into reports values ('current notes');
      begin;
      insert into nxt5_review_backfill_backups values
        (1, now() - interval '31 days'), (2, now() - interval '30 days'),
        (3, now() - interval '30 days' + interval '1 second'), (4, now());`);
    try {
      expect((await cleanup()).status).toBe(204);
      expect((await cleanup()).status).toBe(204);
      expect((await state.db.query('select id from nxt5_review_backfill_backups order by id')).rows).toEqual([{ id: 3 }, { id: 4 }]);
      expect((await state.db.query('select content from reports')).rows).toEqual([{ content: 'current notes' }]);
    } finally { await state.db.exec('commit'); }
  });

  it('does not hide permission or database failures', async () => {
    state.error = Object.assign(new Error('permission denied'), { code: '42501' });
    try { await expect(cleanup()).rejects.toThrow('permission denied'); }
    finally { state.error = null; }
  });
});
