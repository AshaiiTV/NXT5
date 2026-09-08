import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const { query, requireAdmin } = vi.hoisted(() => ({ query: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: requireAdmin }));
import submitRequest from '../../netlify/functions/access-requests';
import administerRequests from '../../netlify/functions/admin-access-requests';
import cleanupRequests, { config as cleanupConfig } from '../../netlify/functions/access-requests-cleanup';

let db: PGlite;
const adminId = '00000000-0000-4000-8000-000000000001';
const context = { ip: '198.51.100.42' } as any;
const valid = {
  contactName: 'Camille Dupont', email: 'camille@example.com', teamName: 'Team NXT', role: 'captain',
  planCode: 'team_monthly', payer: 'team', purchaseIntent: 'yes', message: 'Pour le prochain split.', consent: true, website: ''
};

function request(body: unknown = valid, method = 'POST', suffix = '', headers: Record<string, string> = {}) {
  return new Request(`https://nxt5.org/.netlify/functions/access-requests${suffix}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'https://nxt5.org', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  const client = { query: async (sql: string, params?: unknown[]) => params
    ? db.query(sql, params) : (await db.exec(sql)).at(-1) || { rows: [] } };
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '')
    .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations(client, migrations);
  await db.query('insert into users (id, account_name, name, password_hash) values ($1, $2, $3, $4)', [adminId, 'admin', 'Admin', 'hash']);
  query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await db.query(statement, values)).rows;
  });
});

beforeEach(async () => {
  await db.exec('delete from access_requests; delete from rate_limits;');
  query.mockClear();
  requireAdmin.mockReset().mockResolvedValue({ id: adminId });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => { vi.restoreAllMocks(); await db.close(); });

describe('public access requests', () => {
  it('stores validated commercial interest and versioned consent without changing any team access', async () => {
    const usersBefore = (await db.query('select * from users')).rows;
    const response = await submitRequest(request({ ...valid, email: ' CAMILLE@Example.COM ', teamName: '  Team   NXT  ' }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const rows = (await db.query('select * from access_requests')).rows as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'camille@example.com', team_name: 'Team NXT', team_key: 'team nxt', status: 'new', admin_note: '', consent_version: 'access-request-2026-09-08' });
    expect(rows[0].consented_at).toBeTruthy();
    expect((await db.query('select * from users')).rows).toEqual(usersBefore);
    expect((await db.query('select * from teams')).rows).toEqual([]);
    expect(requireAdmin).not.toHaveBeenCalled();
    const rateRows = (await db.query('select rate_key, ip, endpoint from rate_limits')).rows;
    expect(JSON.stringify(rateRows)).not.toContain(context.ip);
    expect(rateRows[0]).toMatchObject({ ip: 'subject', endpoint: 'access-requests-ip' });
  });

  it('returns the same response for duplicates and cannot overwrite saved consent, details or admin follow-up', async () => {
    const first = await submitRequest(request(), context);
    await db.exec("update access_requests set status = 'confirmed', admin_note = 'Validated with captain', consented_at = '2026-09-01T09:00:00Z'");
    const before = (await db.query('select * from access_requests')).rows;
    const duplicate = await submitRequest(request({ ...valid, email: 'CAMILLE@EXAMPLE.COM', teamName: 'Ｔｅａｍ NXT', contactName: 'Someone else', planCode: 'free', purchaseIntent: 'discover', message: 'overwrite' }), context);
    expect(duplicate.status).toBe(first.status);
    expect(await duplicate.json()).toEqual(await first.json());
    expect((await db.query('select * from access_requests')).rows).toEqual(before);
  });

  it('silently ignores a filled honeypot without storing it', async () => {
    const response = await submitRequest(request({ website: 'https://spam.example' }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await db.query('select * from access_requests')).rows).toEqual([]);
  });

  it.each([
    { consent: false }, { consent: 'true' }, { email: 'invalid' }, { email: ['camille@example.com'] },
    { role: 'owner' }, { planCode: 'team_yearly' }, { planCode: 'arbitrary-price-id' },
    { payer: 'staff' }, { purchaseIntent: 'paid' }, { teamName: 'x' }, { contactName: 'x' },
    { message: 'x'.repeat(2001) }, { contactName: 'A\u0000B' }, { adminNote: 'injected' }, { status: 'confirmed' }
  ])('rejects invalid or privileged input: %j', async (change) => {
    const response = await submitRequest(request({ ...valid, ...change }), context);
    expect(response.status).toBe(400);
    expect((await db.query('select * from access_requests')).rows).toEqual([]);
  });

  it('rejects cross-site submissions and oversized payloads before storing contact data', async () => {
    const crossSite = await submitRequest(request(valid, 'POST', '', { Origin: 'https://evil.example' }), context);
    expect(crossSite.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    const tooLarge = await submitRequest(request({ ...valid, message: 'x'.repeat(13 * 1024) }), context);
    expect(tooLarge.status).toBe(413);
    expect((await db.query('select * from access_requests')).rows).toEqual([]);
  });

  it('enforces the IP budget even when the visitor varies their contact email', async () => {
    for (let index = 0; index < 5; index++) {
      expect((await submitRequest(request({ ...valid, email: `player${index}@example.com` }), context)).status).toBe(200);
    }
    const limited = await submitRequest(request({ ...valid, email: 'another@example.com' }), context);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await db.query('select * from access_requests')).rows).toHaveLength(5);
  });

  it('exposes no public read or edit endpoint', async () => {
    const response = await submitRequest(request(undefined, 'GET'), context);
    expect(response.status).toBe(405);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('administrator access request follow-up', () => {
  it.each(['GET', 'POST', 'DELETE'])('requires platform administrator authorization before %s data access', async method => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status: 403 }));
    const response = await administerRequests(request({ id: adminId }, method), context);
    expect(response.status).toBe(403);
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalled();
  });

  it('pages requests and measures distinct teams, excluding free discovery from confirmed purchase goals', async () => {
    await submitRequest(request(), context);
    await submitRequest(request({ ...valid, email: 'coach@example.com', teamName: 'team nxt' }), context);
    await submitRequest(request({ ...valid, email: 'free@example.com', teamName: 'Discovery', planCode: 'free' }), context);
    await submitRequest(request({ ...valid, email: 'declined@example.com', teamName: 'No thanks' }), context);
    await db.exec("update access_requests set status = case when email = 'declined@example.com' then 'declined' else 'confirmed' end");
    const response = await administerRequests(request(undefined, 'GET', '?page=1&pageSize=2&status=confirmed'), context);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requests).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(body.stats).toEqual({ total: 4, contacted: 0, confirmed: 3, declined: 1, presentedTeams: 3, confirmedTeams: 1 });
    expect(body.requests[0]).toHaveProperty('contactName');
    expect(body.requests[0]).not.toHaveProperty('team_key');
    expect(body.requests[0]).not.toHaveProperty('updated_by');
  });

  it('allows an administrator to track an intention and delete the contact record', async () => {
    await submitRequest(request(), context);
    const id = (await db.query('select id from access_requests')).rows[0].id;
    const updated = await administerRequests(request({ id, status: 'contacted', adminNote: 'Présentation du prix effectuée.' }), context);
    expect(updated.status).toBe(200);
    expect((await updated.json()).request).toMatchObject({ status: 'contacted', adminNote: 'Présentation du prix effectuée.' });
    expect((await db.query('select updated_by from access_requests')).rows[0].updated_by).toBe(adminId);
    const removed = await administerRequests(request({ id }, 'DELETE'), context);
    expect(await removed.json()).toEqual({ ok: true });
    expect((await db.query('select * from access_requests')).rows).toEqual([]);
    expect(await (await administerRequests(request({ id }, 'DELETE'), context)).json()).toEqual({ ok: true });
  });

  it('rejects invalid status, pagination and cross-origin admin edits', async () => {
    expect((await administerRequests(request({ id: adminId, status: 'paid' }), context)).status).toBe(400);
    expect((await administerRequests(request({ id: adminId, status: 'new', adminNote: 'x'.repeat(4001) }), context)).status).toBe(400);
    expect((await administerRequests(request(undefined, 'GET', '?pageSize=10000'), context)).status).toBe(400);
    expect((await administerRequests(request(undefined, 'GET', '?status=paid'), context)).status).toBe(400);
    requireAdmin.mockClear();
    expect((await administerRequests(request({ id: adminId }, 'DELETE', '', { Origin: 'https://evil.example' }), context)).status).toBe(403);
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});

describe('access request data retention', () => {
  it('purges records after six months from creation, even if admin notes were updated recently', async () => {
    await submitRequest(request(), context);
    await submitRequest(request({ ...valid, email: 'recent@example.com' }), context);
    await db.exec("update access_requests set created_at = now() - interval '6 months 1 day', updated_at = now(), admin_note = 'Recent follow-up' where email = 'camille@example.com'");
    const usersBefore = (await db.query('select * from users')).rows;
    const response = await cleanupRequests(request());
    expect(await response.json()).toEqual({ ok: true, deleted: 1 });
    expect((await db.query('select email from access_requests')).rows).toEqual([{ email: 'recent@example.com' }]);
    expect((await db.query('select * from users')).rows).toEqual(usersBefore);
    expect(await (await cleanupRequests(request())).json()).toEqual({ ok: true, deleted: 0 });
    expect(cleanupConfig.schedule).toBe('15 3 * * *');
  });
});
