import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const state = vi.hoisted(() => ({
  db: null as any, statements: [] as string[], beforeBatch: null as null | (() => Promise<void>),
  admin: vi.fn(), auth: vi.fn()
}));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: state.admin }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth }));
// Preserve Neon's query builders and HTTP transaction protocol; PostgreSQL
// evaluates every real statement, constraint and rollback locally.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      state.statements.push(statement.query);
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value == null) return null;
          if (field.dataTypeID === 114 || field.dataTypeID === 3802) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString().replace('T', ' ');
          return String(value);
        })), rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const beforeBatch = state.beforeBatch;
        state.beforeBatch = null;
        await beforeBatch?.();
        const results = await state.db.transaction(async (tx: any) => {
          const results = [];
          for (const statement of body.queries) results.push(await execute(tx, statement));
          return results;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(state.db, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import administer from '../../netlify/functions/admin-account-subscriptions';
import readOwn from '../../netlify/functions/account-subscription';
import { serializeAccountSubscription, validateSubscriptionMutation } from '../../netlify/functions/_lib/account-subscriptions';

const adminId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const absentId = '00000000-0000-4000-8000-000000000099';
const context = {} as any;
const assignment = { action: 'assign', userId, planCode: 'team_monthly', startsAt: '2000-01-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', note: 'Accord privé', expectedRevision: 0 };
function request(body?: any, query = '', method = body === undefined ? 'GET' : 'POST', headers = {}) {
  return new Request(`https://nxt5.org/.netlify/functions/admin-account-subscriptions${query}`, {
    method, headers: { 'Content-Type': 'application/json', Origin: 'https://nxt5.org', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}
const detail = async (id = userId) => (await administer(request(undefined, `?userId=${id}`), context)).json();
const save = async (change = {}) => administer(request({ ...assignment, ...change }), context);

beforeAll(async () => {
  state.db = new PGlite();
  await state.db.waitReady;
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '')
    .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations({ query: async (sql: string, params?: unknown[]) => params ? state.db.query(sql, params) : (await state.db.exec(sql)).at(-1) || { rows: [] } }, migrations);
  vi.spyOn(console, 'error').mockImplementation(() => {});
}, 30_000);

beforeEach(async () => {
  await state.db.exec('alter table audit_logs drop constraint if exists reject_subscription_audit; truncate users cascade; truncate audit_logs;');
  for (const [id, account, name, email] of [[adminId, 'administrator', 'Admin NXT5', 'admin@example.test'], [userId, 'camille', 'Camille Coach', 'camille@example.test'], [otherId, 'autre', 'Autre Compte', 'other@example.test']]) {
    await state.db.query('insert into users(id, account_name, name, email, password_hash) values ($1, $2, $3, $4, $5)', [id, account, name, email, 'secret-hash']);
  }
  state.admin.mockReset().mockResolvedValue({ id: adminId });
  state.auth.mockReset().mockResolvedValue({ id: userId });
  state.statements.length = 0;
  state.beforeBatch = null;
});
afterAll(async () => { vi.restoreAllMocks(); await state.db.close(); });

describe('manual account subscription authorization', () => {
  it.each([['GET', 401], ['GET', 403], ['POST', 401], ['POST', 403]])('refuses %s with %s before body reads or database access', async (method, status) => {
    state.admin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status }));
    const input = request(assignment, '', method as string);
    const response = await administer(input, context);
    expect(response.status).toBe(status);
    expect(input.bodyUsed).toBe(false);
    expect(state.statements).toEqual([]);
  });

  it('rejects cross-site mutations before authorization and never accepts DELETE', async () => {
    const input = request(assignment, '', 'POST', { Origin: 'https://evil.example' });
    expect((await administer(input, context)).status).toBe(403);
    expect(input.bodyUsed).toBe(false);
    expect(state.admin).not.toHaveBeenCalled();
    expect((await administer(request(assignment, '', 'DELETE'), context)).status).toBe(405);
    expect(state.statements).toEqual([]);
  });

  it('requires a session for personal reads and does not provide a personal mutation API', async () => {
    state.auth.mockRejectedValue(Object.assign(new Error('Session absente'), { status: 401 }));
    expect((await readOwn(request(), context)).status).toBe(401);
    expect((await readOwn(request(assignment), context)).status).toBe(405);
    expect(state.statements).toEqual([]);
  });
});

describe('manual account subscription assignments', () => {
  it.each(['free', 'team_monthly', 'team_season', 'structure'])('assigns %s to the account, audits it, and leaves roles, teams and users unchanged', async planCode => {
    const usersBefore = (await state.db.query('select * from users order by id')).rows;
    const response = await save({ planCode, ...(planCode === 'free' ? { startsAt: null, endsAt: null } : {}) });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.account).toMatchObject({ id: userId, name: 'Camille Coach', accountName: 'camille', email: 'camille@example.test' });
    expect(body.account.subscription).toMatchObject({ planCode, effectivePlanCode: planCode, status: 'active', note: 'Accord privé', revision: 1, revokedAt: null });
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({ action: 'assign', actorName: 'Admin NXT5', planCode, note: 'Accord privé' });
    expect(body.history[0].createdAt).toBeTruthy();
    expect((await state.db.query('select * from users order by id')).rows).toEqual(usersBefore);
    expect((await state.db.query('select * from teams')).rows).toEqual([]);
    expect((await state.db.query('select * from team_members')).rows).toEqual([]);
    expect(state.statements.some(query => /from users where id = \$\d+ for update/.test(query))).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-hash');
  });

  it('defaults a paid start to server time and permits no expiry', async () => {
    const start = Date.now();
    const response = await save({ startsAt: undefined, endsAt: null });
    const { account } = await response.json();
    expect(Date.parse(account.subscription.startsAt)).toBeGreaterThanOrEqual(start);
    expect(Date.parse(account.subscription.startsAt)).toBeLessThanOrEqual(Date.now());
    expect(account.subscription.endsAt).toBeNull();
    expect(account.subscription.status).toBe('active');
  });

  it('returns none for an unassigned account and free outside the assigned validity', async () => {
    expect((await detail()).account.subscription).toMatchObject({ status: 'none', planCode: 'free', effectivePlanCode: 'free', revision: 0, note: '' });
    await save({ startsAt: '2090-01-01T00:00:00Z', endsAt: null });
    expect((await detail()).account.subscription).toMatchObject({ status: 'scheduled', effectivePlanCode: 'free' });
    await save({ expectedRevision: 1, startsAt: '2000-01-01T00:00:00Z', endsAt: '2001-01-01T00:00:00Z' });
    expect((await detail()).account.subscription).toMatchObject({ status: 'expired', effectivePlanCode: 'free' });
  });

  it('revokes immediately, retains history, and allows an explicit later reassignment', async () => {
    await save({ startsAt: '2090-01-01T00:00:00Z', endsAt: null });
    const response = await administer(request({ action: 'revoke', userId, note: 'Retiré par le staff', expectedRevision: 1 }), context);
    const body = await response.json();
    expect(body.account.subscription).toMatchObject({ planCode: 'team_monthly', effectivePlanCode: 'free', status: 'revoked', revision: 2, note: 'Retiré par le staff' });
    expect(body.account.subscription.revokedAt).toBeTruthy();
    expect(body.history[0]).toMatchObject({ action: 'revoke', note: 'Retiré par le staff', planCode: 'team_monthly' });
    expect(body.history[1]).toMatchObject({ action: 'assign', note: 'Accord privé' });
    const reassigned = await (await save({ expectedRevision: 2, planCode: 'structure' })).json();
    expect(reassigned.account.subscription).toMatchObject({ planCode: 'structure', status: 'active', revokedAt: null, revision: 3 });
    expect(reassigned.history).toHaveLength(3);
  });

  it('rejects a stale revision including competing first assignments and does not add audit events', async () => {
    await save();
    const before = await detail();
    const conflict = await save({ planCode: 'structure' });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'SUBSCRIPTION_CONFLICT' });
    expect(await detail()).toEqual(before);
    expect((await save({ expectedRevision: 7 })).status).toBe(409);
    expect((await administer(request({ action: 'revoke', userId, expectedRevision: 0 }), context)).status).toBe(409);
  });

  it('detects a change immediately before the transaction without overwriting it', async () => {
    await save();
    state.beforeBatch = async () => {
      expect((await save({ planCode: 'structure', note: 'Autre onglet', expectedRevision: 1 })).status).toBe(200);
    };
    expect((await save({ planCode: 'team_season', expectedRevision: 1 })).status).toBe(409);
    const current = await detail();
    expect(current.account.subscription).toMatchObject({ planCode: 'structure', note: 'Autre onglet', revision: 2 });
    expect(current.history).toHaveLength(2);
  });

  it('rolls back the subscription if the audit write fails', async () => {
    await state.db.exec("alter table audit_logs add constraint reject_subscription_audit check (entity_type <> 'account_subscription')");
    expect((await save()).status).toBe(500);
    expect((await state.db.query('select * from account_subscriptions')).rows).toEqual([]);
    expect((await state.db.query('select * from audit_logs')).rows).toEqual([]);
  });

  it('returns 404 for absent accounts without storing an assignment or audit', async () => {
    expect((await save({ userId: absentId })).status).toBe(404);
    expect((await administer(request(undefined, `?userId=${absentId}`), context)).status).toBe(404);
    expect((await state.db.query('select * from account_subscriptions')).rows).toEqual([]);
    expect((await state.db.query('select * from audit_logs')).rows).toEqual([]);
  });

  it.each([
    { planCode: 'enterprise' }, { planCode: 'founder_monthly' }, { userId: 'not-a-uuid' },
    { expectedRevision: undefined }, { expectedRevision: -1 }, { expectedRevision: '0' }, { expectedRevision: 0.5 },
    { startsAt: '2026-02-30T12:00:00Z' }, { startsAt: '2026-02-29T12:00:00Z' },
    { startsAt: '2026-09-08T25:00:00Z' }, { startsAt: '2026-09-08T12:00:00' },
    { endsAt: 'bad' }, { endsAt: '2000-01-01T00:00:00Z' }, { endsAt: '1999-01-01T00:00:00Z' },
    { planCode: 'free' }, { note: 'x'.repeat(1001) }, { note: 1 }, { note: 'invalid\0note' },
    { isPlatformAdmin: true }, { teamId: userId }, { status: 'active' }, { action: 'delete' }
  ])('validates assignment fields before business database access: %j', async change => {
    expect((await save(change)).status).toBe(400);
    expect(state.statements).toEqual([]);
  });

  it('rejects oversized bodies and accepts notes by Unicode character count', async () => {
    expect((await save({ note: 'x'.repeat(9000) })).status).toBe(413);
    expect(state.statements).toEqual([]);
    const result = await (await save({ note: '🙂'.repeat(1000), startsAt: '2024-02-29T12:00:00+02:00' })).json();
    expect(result.account.subscription.note).toBe('🙂'.repeat(1000));
    expect(result.account.subscription.startsAt).toBe('2024-02-29T10:00:00.000Z');
  });
});

describe('subscription reads and privacy', () => {
  it('searches all accounts by name, account name or email and paginates deterministically', async () => {
    const byName = await (await administer(request(undefined, '?q=camille%20coach&page=1&pageSize=1'), context)).json();
    expect(byName.accounts.map((account: any) => account.id)).toEqual([userId]);
    expect(byName.pagination).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    const byEmail = await (await administer(request(undefined, '?q=OTHER%40EXAMPLE.TEST'), context)).json();
    expect(byEmail.accounts[0].id).toBe(otherId);
    const byAccount = await (await administer(request(undefined, '?q=administrator'), context)).json();
    expect(byAccount.accounts[0].id).toBe(adminId);
    const first = await (await administer(request(undefined, '?pageSize=2'), context)).json();
    const second = await (await administer(request(undefined, '?page=2&pageSize=2'), context)).json();
    expect(first.accounts).toHaveLength(2);
    expect(second.accounts).toHaveLength(1);
    expect(new Set([...first.accounts, ...second.accounts].map(account => account.id)).size).toBe(3);
    expect(first.pagination.total).toBe(3);
    const literal = await (await administer(request(undefined, '?q=%25'), context)).json();
    expect(literal.accounts).toEqual([]);
  });

  it.each(['?page=0', '?pageSize=101', '?page=1.5', '?pageSize=0', '?q=' + 'x'.repeat(101), '?userId=invalid', '?sort=paid'])('rejects invalid list parameters: %s', async query => {
    expect((await administer(request(undefined, query), context)).status).toBe(400);
    expect(state.statements).toEqual([]);
  });

  it('bounds detailed history to the ten most recent actions', async () => {
    for (let revision = 0; revision < 12; revision++) expect((await save({ expectedRevision: revision, note: `Version ${revision + 1}` })).status).toBe(200);
    const body = await detail();
    expect(body.history).toHaveLength(10);
    expect(body.history[0].note).toBe('Version 12');
    expect(body.history[9].note).toBe('Version 3');
  });

  it('projects only the authenticated account and never exposes private notes, history or actors', async () => {
    await save();
    await save({ userId: otherId, planCode: 'structure', note: 'Autre note secrète' });
    const response = await readOwn(request(undefined, `?userId=${otherId}`), context);
    const body = await response.json();
    expect(body.subscription).toMatchObject({ planCode: 'team_monthly', status: 'active', revision: 1 });
    expect(body.subscription).not.toHaveProperty('note');
    expect(body.subscription).not.toHaveProperty('updatedBy');
    expect(body).not.toHaveProperty('history');
    expect(JSON.stringify(body)).not.toContain('privé');
    expect(JSON.stringify(body)).not.toContain('Admin NXT5');
    state.auth.mockResolvedValue({ id: adminId });
    expect((await (await readOwn(request(), context)).json()).subscription).toMatchObject({ status: 'none', effectivePlanCode: 'free', revision: 0 });
  });
});

describe('subscription validity boundaries', () => {
  it('uses an inclusive start, exclusive end and gives withdrawal priority', () => {
    const starts = '2026-09-01T00:00:00Z', ends = '2026-10-01T00:00:00Z';
    const row = { plan_code: 'team_season', starts_at: starts, ends_at: ends, revision: 1 };
    expect(serializeAccountSubscription(row, false, Date.parse(starts) - 1).status).toBe('scheduled');
    expect(serializeAccountSubscription(row, false, Date.parse(starts)).status).toBe('active');
    expect(serializeAccountSubscription(row, false, Date.parse(ends) - 1).effectivePlanCode).toBe('team_season');
    expect(serializeAccountSubscription(row, false, Date.parse(ends))).toMatchObject({ status: 'expired', effectivePlanCode: 'free' });
    expect(serializeAccountSubscription({ ...row, revoked_at: starts }, false, Date.parse(starts) - 1).status).toBe('revoked');
  });

  it('preserves a revocation note when no replacement was supplied', async () => {
    await save();
    const result = await (await administer(request({ action: 'revoke', userId, expectedRevision: 1 }), context)).json();
    expect(result.account.subscription.note).toBe('Accord privé');
    expect(() => validateSubscriptionMutation({ action: 'revoke', userId, expectedRevision: 1, planCode: 'free' })).toThrow('Champ');
  });
});
