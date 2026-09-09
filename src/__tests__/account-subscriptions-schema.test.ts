import { afterEach, describe, expect, it, vi } from 'vitest';

const { query, baseReady } = vi.hoisted(() => ({ query: vi.fn(), baseReady: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: baseReady }));
afterEach(() => { vi.resetModules(); query.mockReset(); baseReady.mockReset(); });

describe('manual subscription schema readiness', () => {
  it('requires its migration before reads or writes and retries after deployment', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ migration_key: 'account-subscriptions-catalog-20260909-v1' }]);
    const { ensureAccountSubscriptionsSchema } = await import('../../netlify/functions/_lib/schema');
    await expect(ensureAccountSubscriptionsSchema()).rejects.toMatchObject({ status: 503, code: 'SCHEMA_MIGRATION_REQUIRED' });
    await expect(ensureAccountSubscriptionsSchema()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toBe('account-subscriptions-catalog-20260909-v1');
  });

  it('shares a read-only readiness check across concurrent requests', async () => {
    query.mockResolvedValue([{ migration_key: 'account-subscriptions-catalog-20260909-v1' }]);
    const { ensureAccountSubscriptionsSchema } = await import('../../netlify/functions/_lib/schema');
    await Promise.all([ensureAccountSubscriptionsSchema(), ensureAccountSubscriptionsSchema(), ensureAccountSubscriptionsSchema()]);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0].join('?')).toMatch(/^select migration_key/);
  });

  it('does not make existing workspace or access-request features wait for this migration', async () => {
    query.mockImplementation(async (_parts, version) => version === 'pricing-access-requests-structure-20260908-v1' ? [{ migration_key: version }] : []);
    const { ensureReportsSchema, ensureAccessRequestsSchema, ensureAccountSubscriptionsSchema } = await import('../../netlify/functions/_lib/schema');
    await expect(ensureAccountSubscriptionsSchema()).rejects.toMatchObject({ status: 503 });
    await expect(ensureReportsSchema()).resolves.toBeUndefined();
    await expect(ensureAccessRequestsSchema()).resolves.toBeUndefined();
  });
});
