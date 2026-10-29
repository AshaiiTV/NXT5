import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requests: any[] = [];
let restoreTransport = () => {};

beforeEach(() => { vi.resetModules(); requests.length = 0; });
afterEach(() => { restoreTransport(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function configuredClient() {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@database-client.invalid/nxt5');
  const { neonConfig } = await import('@neondatabase/serverless');
  const original = neonConfig.fetchFunction;
  restoreTransport = () => { neonConfig.fetchFunction = original; };
  neonConfig.fetchFunction = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    requests.push(body);
    const result = {
      fields: [{ name: 'value', dataTypeID: 23 }], rows: [['1']], rowCount: 1,
    };
    return Response.json(body.queries ? { results: body.queries.map(() => result) } : result);
  };
  return (await import('../../netlify/functions/_lib/db')).sql;
}

describe('database client compatibility', () => {
  it('keeps parameterized and tagged queries lazy inside one transaction', async () => {
    const sql = await configuredClient();
    const untrusted = "team'); delete from teams; --";
    const queries = [
      sql.query('select id from teams where id=$1 for update', [untrusted]),
      sql`select ${untrusted}::text as team_id`,
    ];
    expect(requests).toEqual([]);
    await expect(sql.transaction(queries)).resolves.toEqual([[{ value: 1 }], [{ value: 1 }]]);
    expect(requests).toEqual([{ queries: [
      { query: 'select id from teams where id=$1 for update', params: [untrusted] },
      { query: 'select $1::text as team_id', params: [untrusted] },
    ] }]);
  });

  it('preserves the transaction callback and standalone query result shape', async () => {
    const sql = await configuredClient();
    await expect(sql.query('select $1::integer as value', [1])).resolves.toEqual([{ value: 1 }]);
    await expect(sql.transaction(tx => [
      tx`select ${1}::integer as value`,
      tx.query('select $1::integer as value', [1]),
    ])).resolves.toEqual([[{ value: 1 }], [{ value: 1 }]]);
    expect(requests).toHaveLength(2);
    expect(requests[1].queries).toHaveLength(2);
  });

  it('returns the same safe service error for every API when unconfigured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const { sql } = await import('../../netlify/functions/_lib/db');
    for (const call of [() => sql`select 1`, () => sql.query('select 1'), () => sql.transaction([])]) {
      expect(call).toThrow(expect.objectContaining({
        status: 503, code: 'DB_NOT_CONFIGURED', message: 'Service compte temporairement indisponible.',
      }));
    }
  });
});
