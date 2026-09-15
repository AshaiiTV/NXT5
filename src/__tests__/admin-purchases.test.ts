import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { loadMigrations } from '../../tools/migration-runner.mjs';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn() }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: mocks.sql }));
import handler from '../../netlify/functions/admin-purchases';

let db: PGlite;
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const context = {} as Parameters<typeof handler>[1];
const get = (query = '') => handler(new Request('https://nxt5.test/.netlify/functions/admin-purchases' + query), context);

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  const migration = (await loadMigrations()).find(m => m.key === 'administration-purchases-20260914-v1');
  await db.exec(migration!.sql);
  await db.exec("create table app_schema_migrations (migration_key text primary key); insert into app_schema_migrations values ('administration-purchases-20260914-v1')");
  for (let i = 1; i <= 25; i++) {
    await db.query(`insert into purchases(order_reference, customer_name, plan_code, plan_label, unit_amount_cents, amount_cents, status, ordered_at, paid_at)
      values ($1, 'Equipe test', 'team_monthly', 'Ancien tarif', 1900, 1900, 'paid', $2, $2)`, ['ORDER-' + String(i).padStart(3, '0'), ago(i)]);
  }
  for (const [reference, status, amount, days] of [['OLDER', 'paid', 2900, 45], ['ARCHIVE', 'paid', 16900, 500], ['WAITING', 'pending', 2900, 5], ['CANCELLED', 'cancelled', 2900, 4], ['REFUNDED-100%', 'refunded', 16900, 3]] as const) {
    // Use one instant: a second Date.now() call could move ordered_at after paid_at.
    const orderedAt = ago(days);
    const paidAt = ['paid', 'refunded'].includes(status) ? orderedAt : null;
    await db.query(`insert into purchases(order_reference, customer_name, plan_code, plan_label, unit_amount_cents, amount_cents, status, ordered_at, paid_at, refunded_at)
      values ($1, 'Client historique', 'season', 'Saison', $2, $2, $3, $4, $5, $6)`, [reference, amount, status, orderedAt, paidAt, status === 'refunded' ? ago(1) : null]);
  }
}, 15_000);

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ id: 'admin' });
  mocks.sql.mockReset().mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.reduce((text, part, index) => text + part + (index < values.length ? '$' + (index + 1) : ''), '');
    return (await db.query(query, values)).rows;
  });
});
afterAll(async () => { await db?.close(); });

describe('administration purchase history', () => {
  it('checks administrator access before reading any purchase data', async () => {
    mocks.auth.mockRejectedValueOnce(Object.assign(new Error('Accès refusé'), { status: 403 }));
    expect((await get()).status).toBe(403);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('provides every page including old purchases and their historical tariff', async () => {
    const pages = await Promise.all([1, 2, 3].map(async page => (await get('?page=' + page)).json()));
    const orders = pages.flatMap(page => page.purchases);
    expect(orders).toHaveLength(30);
    expect(new Set(orders.map(order => order.id)).size).toBe(30);
    expect(orders.at(-1).reference).toBe('ARCHIVE');
    expect(orders.find(order => order.reference === 'ORDER-001')).toMatchObject({ unitAmountCents: 1900, amountCents: 1900, planLabel: 'Ancien tarif' });
    expect(pages[0].pagination).toMatchObject({ total: 30, totalPages: 3 });
    expect((await (await get('?page=999')).json()).pagination.page).toBe(3);
  });

  it('filters the entire history with literal search characters', async () => {
    const result = await (await get('?q=%25&status=refunded')).json();
    expect(result.pagination.total).toBe(1);
    expect(result.purchases[0].reference).toBe('REFUNDED-100%');
    expect((await (await get('?q=missing')).json()).pagination.total).toBe(0);
  });

  it('consolidates all paid purchases independently of history filters and paging', async () => {
    const response = await get('?view=overview&page=3&status=pending');
    const result = await response.json();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(result.totals).toMatchObject({ orders: 30, paid: 27, pending: 1, refunded: 1, cancelled: 1, paidCents: 67300, paid30d: 25, paidPrevious30d: 1 });
    expect(result.totals.averageCents).toBeCloseTo(67300 / 27);
    expect(result.totals.frequency30d).toBeCloseTo(25 / 30);
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly.reduce((sum: number, month: any) => sum + month.count, 0)).toBe(26);
    expect(result.monthly.reduce((sum: number, month: any) => sum + month.amountCents, 0)).toBe(50400);
    expect(result.monthly.some((month: any) => month.count === 0)).toBe(true);
  });

  it.each(['?status=confirmed', '?page=0', '?page=1.5', '?pageSize=101', '?view=unknown'])('rejects invalid parameters: %s', async query => {
    expect((await get(query)).status).toBe(400);
  });

  it('distinguishes an unprepared database from an empty purchase history', async () => {
    mocks.sql.mockResolvedValueOnce([]);
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'SCHEMA_MIGRATION_REQUIRED' });
  });

  it('does not expose purchase writes', async () => {
    const response = await handler(new Request('https://nxt5.test/.netlify/functions/admin-purchases', { method: 'POST' }), context);
    expect(response.status).toBe(405);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
