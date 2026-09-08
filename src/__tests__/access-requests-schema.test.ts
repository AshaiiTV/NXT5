import { afterEach, describe, expect, it, vi } from 'vitest';

const { query, baseReady } = vi.hoisted(() => ({ query: vi.fn(), baseReady: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: baseReady }));
afterEach(() => { vi.resetModules(); query.mockReset(); baseReady.mockReset(); });

describe('access request schema readiness', () => {
  it('requires the feature migration and recovers when it becomes available', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ migration_key: 'pricing-access-requests-20260908-v1' }]);
    const { ensureAccessRequestsSchema } = await import('../../netlify/functions/_lib/schema');
    await expect(ensureAccessRequestsSchema()).rejects.toMatchObject({ status: 503, code: 'SCHEMA_MIGRATION_REQUIRED' });
    await expect(ensureAccessRequestsSchema()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('checks readiness once for concurrent requests without runtime DDL', async () => {
    query.mockResolvedValue([{ migration_key: 'pricing-access-requests-20260908-v1' }]);
    const { ensureAccessRequestsSchema } = await import('../../netlify/functions/_lib/schema');
    await Promise.all([ensureAccessRequestsSchema(), ensureAccessRequestsSchema(), ensureAccessRequestsSchema()]);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0].join('?')).toMatch(/^select migration_key/);
    expect(query.mock.calls[0][1]).toBe('pricing-access-requests-20260908-v1');
  });

  it('keeps existing workspace schema checks independent of the new migration', async () => {
    query.mockResolvedValue([]);
    const { ensureReportsSchema, ensureAccessRequestsSchema } = await import('../../netlify/functions/_lib/schema');
    await expect(ensureReportsSchema()).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
    await expect(ensureAccessRequestsSchema()).rejects.toMatchObject({ status: 503 });
    await expect(ensureReportsSchema()).resolves.toBeUndefined();
  });
});
