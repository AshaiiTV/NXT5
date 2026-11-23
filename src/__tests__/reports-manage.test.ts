import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  sql: Object.assign(vi.fn(), { transaction: async (queries: any) => Promise.all(typeof queries === 'function' ? queries(database.sql) : queries) }),
  report: { id: 'review', team_id: 'team', created_by: 'user', title: 'Review', content: 'Notes initiales' } as Record<string, unknown>
}));

const limiter = vi.hoisted(() => ({ subject: vi.fn(async (..._args: unknown[]) => {}) }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: database.sql }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: limiter.subject }));
vi.mock('../../netlify/functions/_lib/auth', async original => ({ ...await original<any>(), assertSessionSecret: vi.fn(), requireAuth: async () => ({ id: 'user' }) }));
vi.mock('../../netlify/functions/_lib/schema', () => ({ ensureReportsSchema: vi.fn(), ensureAuditLogsSchema: vi.fn() }));
vi.mock('../../netlify/functions/_lib/team-member-emails', () => ({ getTeamMemberEmails: async () => [] }));
vi.mock('../../netlify/functions/_lib/email', async (importOriginal) => ({ ...(await importOriginal<object>()), sendNotification: vi.fn() }));

import manageReport from '../../netlify/functions/reports-manage';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  database.report = { id: 'review', team_id: 'team', created_by: 'user', title: 'Review', content: 'Notes initiales' };
  database.sql.mockReset();
  limiter.subject.mockReset();
  limiter.subject.mockImplementation(async () => {});
  database.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    if (query.startsWith('update teams set first_review_at')) return [{ id: 'team' }];
    if (query.startsWith('select 1 / case') || query.startsWith('select user_id from team_members') || query.startsWith('select id from reports')) return [];
    if (query.includes('from teams')) return [{ owner_id: 'user', role: 'captain' }];
    if (query.startsWith('select id from matches')) return (values[1] as string[]).map((id) => ({ id }));
    if (query.startsWith('select * from reports')) return [{ ...database.report }];
    if (query.startsWith('insert into reports')) {
      database.report = { id: 'review', team_id: values[0], match_id: values[1], match_ids: JSON.parse(String(values[2])), created_by: values[3], title: values[4], content: values[5], is_team_note: values[7] };
      return [{ ...database.report }];
    }
    if (query.startsWith('update reports set original_debrief')) {
      if (!database.report.is_team_note && !database.report.original_debrief) database.report.original_debrief = { content: database.report.content, title: database.report.title, match_ids: database.report.match_ids };
      return [];
    }
    if (query.startsWith('update reports set content')) {
      database.report.content = '';
      return [];
    }
    if (query.startsWith('update reports')) {
      database.report = { ...database.report, match_id: values[0], match_ids: JSON.parse(String(values[1])), title: values[2], content: values[3] };
      return [{ ...database.report }];
    }
    if (query.startsWith('insert into audit_logs')) return [];
    throw new Error(`Unexpected SQL: ${query}`);
  });
});

afterEach(() => vi.restoreAllMocks());

async function save(overrides: Record<string, unknown> = {}) {
  return manageReport(new Request('https://nxt5.test/.netlify/functions/reports-manage', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'create', teamId: 'team', reportId: 'review', title: 'Review', content: 'Notes staff', matchIds: ['game'], ...overrides })
  }), {} as never);
}

function reportWrites() {
  return database.sql.mock.calls.filter(([parts]) => /^\s*(insert into|update) reports\b/.test(parts.join('')));
}

describe('complete review persistence', () => {
  it('distinguishes new team notes from legacy reviews without rewriting a stored report', async () => {
    expect((await (await save({ kind: 'note' })).json()).report.is_team_note).toBe(true);
    expect((await (await save({})).json()).report.is_team_note).toBe(false);
    expect((await (await save({ kind: 'note', action: 'update' })).json()).report.is_team_note).toBe(false);
  });
  it('keeps the saved generated text when editing or removing the human note', async () => {
    const analysis = 'Verdict historique\n[NXT5_REPORT_V3]\nNotes staff\n';
    database.report.content = analysis + 'Avant';
    expect((await save({ kind: 'note', action: 'update', content: 'Après' })).status).toBe(200);
    expect(database.report.content).toBe('Après');
    expect(database.report.original_debrief).toMatchObject({ content: analysis + 'Avant' });
    expect((await save({ kind: 'note', action: 'delete' })).status).toBe(200);
    expect(database.report.content).toBe('');
    expect(database.report.original_debrief).toMatchObject({ content: analysis + 'Avant' });
  });
  it.each(['create', 'update'])('preserves long coaching and exact staff notes on %s', async (action) => {
    const notes = '\n  Notes staff :\n  Conserver l’espace initial, les accents et la fin.\n\n';
    const content = `  ${'Analyse complète de la game.\n'.repeat(600)}[NXT5_REPORT_V2]\n${notes}`;
    expect(content.length).toBeGreaterThan(12000);
    const response = await save({ action, content });
    expect(response.status).toBe(200);
    expect((await response.json()).report.content).toBe(content);
    expect(database.report.content).toBe(content);
    expect(reportWrites()).toHaveLength(1);
  });

  it.each(['create', 'update'])('accepts the content and linked-game limits on %s', async (action) => {
    const content = 'c'.repeat(256000);
    const matchIds = Array.from({ length: 20 }, (_, index) => `game-${index}`);
    const response = await save({ action, content, matchIds });
    expect(response.status).toBe(200);
    expect((await response.json()).report).toMatchObject({ content, match_ids: matchIds });
  });

  it.each(['create', 'update'])('rejects oversized content without changing the stored review on %s', async (action) => {
    const before = { ...database.report };
    const response = await save({ action, content: 'c'.repeat(256001) });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'REPORT_CONTENT_TOO_LONG', error: expect.stringContaining('256 000') });
    expect(database.report).toEqual(before);
    expect(reportWrites()).toHaveLength(0);
  });

  it.each(['create', 'update'])('rejects excess linked games instead of silently dropping them on %s', async (action) => {
    const before = { ...database.report };
    const response = await save({ action, matchIds: Array.from({ length: 21 }, (_, index) => `game-${index}`) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'REPORT_TOO_MANY_MATCHES', error: expect.stringContaining('20 games') });
    expect(database.report).toEqual(before);
    expect(reportWrites()).toHaveLength(0);
  });

  it('still rejects whitespace-only content', async () => {
    const response = await save({ content: ' \n\t ' });
    expect(response.status).toBe(400);
    expect(reportWrites()).toHaveLength(0);
  });

  it.each(['create', 'update'])('throttles %s per user before writing anything', async (action) => {
    expect((await save({ action })).status).toBe(200);
    expect(limiter.subject).toHaveBeenCalledWith('reports-manage-write', 'user', { limit: 30, windowSeconds: 600 });
    database.sql.mockClear();
    limiter.subject.mockImplementation(async (endpoint) => {
      if (endpoint === 'reports-manage-write') throw Object.assign(new Error('Trop de tentatives. Réessaie dans quelques instants.'), { status: 429, retryAfter: 60 });
    });
    const before = { ...database.report };
    const response = await save({ action, content: 'Autre version' });
    expect(response.status).toBe(429);
    expect(database.report).toEqual(before);
    expect(reportWrites()).toHaveLength(0);
  });

  it('does not throttle deletions', async () => {
    expect((await save({ kind: 'note', action: 'delete' })).status).toBe(200);
    expect(limiter.subject).not.toHaveBeenCalledWith('reports-manage-write', expect.anything(), expect.anything());
  });
});

describe('full content of an omitted report', () => {
  const TEAM = '00000000-0000-4000-8000-000000000010';
  const REVIEW = '00000000-0000-4000-8000-000000000100';
  let membership: Record<string, unknown>;

  beforeEach(() => {
    membership = { owner_id: 'owner', role: 'player' };
    database.report = { id: REVIEW, team_id: TEAM, created_by: 'other', title: 'Ancienne note', content: 'x'.repeat(300000), discord_status: 'published' };
    const base = database.sql.getMockImplementation()!;
    database.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join('?').replace(/\s+/g, ' ').trim();
      if (query.startsWith('select teams.owner_id')) return [membership];
      if (query.startsWith('select reports.*, users.name as author_name')) {
        return values[0] === database.report.id && values[1] === database.report.team_id ? [{ ...database.report, author_name: 'Camille' }] : [];
      }
      return base(parts, ...values);
    });
  });

  const get = (overrides: Record<string, unknown> = {}) => save({ action: 'get', teamId: TEAM, reportId: REVIEW, title: undefined, content: undefined, matchIds: undefined, ...overrides });

  it('returns the full content to a team member without the write rate limit', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).report).toMatchObject({ id: REVIEW, content: 'x'.repeat(300000), author_name: 'Camille', content_omitted: false });
    expect(limiter.subject).not.toHaveBeenCalled();
    expect(reportWrites()).toHaveLength(0);
  });

  it('hides drafts from non-staff members and shows them to staff', async () => {
    database.report.discord_status = 'draft';
    expect((await get()).status).toBe(404);
    membership = { owner_id: 'owner', role: 'coach' };
    expect((await get()).status).toBe(200);
    membership = { owner_id: 'user', role: null };
    expect((await get()).status).toBe(200);
  });

  it('refuses non-members', async () => {
    database.sql.mockImplementation(async () => []);
    expect((await get()).status).toBe(403);
  });

  it.each([{ reportId: 'review' }, { teamId: 'team' }, { reportId: `${REVIEW}' or 1=1` }])('rejects invalid identifiers %o before any query', async (ids) => {
    const response = await get(ids);
    expect(response.status).toBe(400);
    expect(database.sql).not.toHaveBeenCalled();
  });

  it('returns 404 for a report of another team', async () => {
    expect((await get({ reportId: '00000000-0000-4000-8000-000000000999' })).status).toBe(404);
  });
});
