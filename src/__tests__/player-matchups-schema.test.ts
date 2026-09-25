import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMigrations } from '../../tools/migration-runner.mjs';

const { query, baseReady } = vi.hoisted(() => ({ query: vi.fn(), baseReady: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: baseReady }));
afterEach(() => { vi.resetModules(); query.mockReset(); baseReady.mockReset(); });

describe('matchup notebook schema readiness', () => {
  it('registers its migration after the existing checksummed baseline', async () => {
    const migrations = await loadMigrations();
    const notebookMigrations = migrations.filter(migration => migration.key === 'player-matchups-20260915-v1');
    expect(notebookMigrations).toHaveLength(1);
    expect(notebookMigrations[0].sql).toContain('create table player_matchup_notebooks');
    expect(migrations[0].key).toBe('baseline-20260906-v1');
  });

  it('requires its own migration and retries after deployment without running DDL', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ migration_key: 'player-matchups-20260915-v1' }]);
    const { ensurePlayerMatchupsSchema } = await import('../../netlify/functions/_lib/player-matchups');
    await expect(ensurePlayerMatchupsSchema()).rejects.toMatchObject({ status: 503, code: 'SCHEMA_MIGRATION_REQUIRED' });
    await expect(ensurePlayerMatchupsSchema()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([parts]) => parts.join('?').startsWith('select migration_key'))).toBe(true);
  });

  it('shares one readiness check for concurrent requests and keeps base-schema failures unavailable', async () => {
    baseReady.mockRejectedValueOnce(new Error('Missing base migration'));
    const { ensurePlayerMatchupsSchema } = await import('../../netlify/functions/_lib/player-matchups');
    await expect(ensurePlayerMatchupsSchema()).rejects.toMatchObject({ status: 503 });
    expect(query).not.toHaveBeenCalled();
    query.mockResolvedValue([{ migration_key: 'player-matchups-20260915-v1' }]);
    await Promise.all([ensurePlayerMatchupsSchema(), ensurePlayerMatchupsSchema(), ensurePlayerMatchupsSchema()]);
    expect(query).toHaveBeenCalledOnce();
  });
});
