import { afterEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
afterEach(() => { vi.resetModules(); query.mockReset(); });

describe('runtime schema readiness', () => {
  it('blocks requests with no migration marker and retries after deployment', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ migration_key: 'audit-runtime-20260906-v1' }]);
    const { assertSchemaReady } = await import('../../netlify/functions/_lib/migrations');
    await expect(assertSchemaReady()).rejects.toMatchObject({ status: 503, code: 'SCHEMA_MIGRATION_REQUIRED' });
    await expect(assertSchemaReady()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('shares one read for concurrent requests without executing DDL', async () => {
    query.mockResolvedValue([{ migration_key: 'audit-runtime-20260906-v1' }]);
    const { assertSchemaReady } = await import('../../netlify/functions/_lib/migrations');
    await Promise.all([assertSchemaReady(), assertSchemaReady(), assertSchemaReady()]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].join('?')).toMatch(/^select migration_key/);
  });
});
