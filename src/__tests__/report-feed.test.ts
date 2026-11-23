import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
import { loadTeamReports, REPORT_FEED_CONTENT_BUDGET_BYTES, REPORT_FEED_LIMIT } from '../../netlify/functions/_lib/report-feed';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = id(1), PLAYER = id(2), COACH = id(3), TEAM = id(10), OTHER_TEAM = id(11);
const statement = (parts: TemplateStringsArray) => parts.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, '');
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  const baseline = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  await db.exec(baseline.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')"));
  // Column added by 20260922_discord_bot_workflows.sql, required by the feed.
  await db.exec("alter table reports add column if not exists discord_status text not null default 'published'");
  query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => (await db.query(statement(parts), values)).rows);
}, 30_000);

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec('truncate users, teams, team_members, reports cascade');
  for (const userId of [OWNER, PLAYER, COACH]) {
    await db.query("insert into users(id, account_name, name, password_hash) values ($1, $2, 'Camille', 'hash')", [userId, `user-${userId}`]);
  }
  await db.query("insert into teams(id, owner_id, name, tag) values ($1, $2, 'Team', 'NXT'), ($3, $2, 'Other', 'OTH')", [TEAM, OWNER, OTHER_TEAM]);
  await db.query("insert into team_members(team_id, user_id, role) values ($1, $2, 'player'), ($1, $3, 'coach')", [TEAM, PLAYER, COACH]);
});

async function report(n: number, content: string, extra: { minutesAgo?: number; draft?: boolean; team?: string; original?: string } = {}) {
  await db.query(`insert into reports(id, team_id, created_by, title, content, created_at, discord_status, original_debrief)
    values ($1, $2, $3, $4, $5, now() - make_interval(mins => $6), $7, $8::jsonb)`,
  [id(100 + n), extra.team || TEAM, OWNER, `Note ${n}`, content, extra.minutesAgo ?? n, extra.draft ? 'draft' : 'published',
    extra.original === undefined ? null : JSON.stringify({ title: 'Débrief', content: extra.original, match_ids: [] })]);
}

describe('bootstrap report feed', () => {
  it('uses a 1000-row limit and a 2 MB content budget by default', () => {
    expect(REPORT_FEED_LIMIT).toBe(1000);
    expect(REPORT_FEED_CONTENT_BUDGET_BYTES).toBe(2_000_000);
  });

  it('inlines the newest contents within the budget and flags the older ones without their text', async () => {
    await report(1, 'a'.repeat(40));
    await report(2, 'é'.repeat(20)); // 40 bytes in UTF-8
    await report(3, 'c'.repeat(40));
    await report(4, '');
    await report(5, 'tiny');
    const rows = await loadTeamReports(TEAM, OWNER, { budgetBytes: 80 });
    expect(rows.map((row) => [row.title, row.content_omitted, row.content])).toEqual([
      ['Note 1', false, 'a'.repeat(40)],
      ['Note 2', false, 'é'.repeat(20)],
      ['Note 3', true, null],
      ['Note 4', false, ''],
      ['Note 5', true, null],
    ]);
    expect(rows[0]).toMatchObject({ author_name: 'Camille', team_id: TEAM, discord_status: 'published' });
  });

  it('counts frozen debrief copies and strips them from omitted rows only', async () => {
    await report(1, 'note', { original: 'x'.repeat(50) });
    await report(2, '', { original: 'y'.repeat(50) });
    const rows = await loadTeamReports(TEAM, OWNER, { budgetBytes: 60 });
    expect(rows[0]).toMatchObject({ content: 'note', content_omitted: false, original_debrief: { content: 'x'.repeat(50) } });
    // An empty human note is always sent, so the client still knows it was removed.
    expect(rows[1]).toMatchObject({ content: '', content_omitted: true, original_debrief: { title: 'Débrief', match_ids: [] } });
    expect(rows[1].original_debrief).not.toHaveProperty('content');
  });

  it('keeps drafts for staff only, scopes to the team and applies the row limit', async () => {
    await report(1, 'public');
    await report(2, 'draft', { draft: true });
    await report(3, 'other team', { team: OTHER_TEAM });
    await report(4, 'older');
    expect((await loadTeamReports(TEAM, PLAYER)).map((row) => row.content)).toEqual(['public', 'older']);
    expect((await loadTeamReports(TEAM, COACH)).map((row) => row.content)).toEqual(['public', 'draft', 'older']);
    expect((await loadTeamReports(TEAM, OWNER, { limit: 2 })).map((row) => row.content)).toEqual(['public', 'draft']);
  });
});
