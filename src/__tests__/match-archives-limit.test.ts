import { describe, expect, it, vi } from 'vitest';
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: vi.fn() }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: vi.fn() }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: vi.fn(), requireAuth: async () => ({ id: 'user' }) }));
import handler from '../../netlify/functions/match-archives-manage';
import { sql } from '../../netlify/functions/_lib/db';
describe('NEW-1 explicit archive selection limit', () => {
  it('rejects 81 games with 400 instead of silently dropping one', async () => {
    const response = await handler(new Request('https://nxt5.test/.netlify/functions/match-archives-manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: 'team', name: 'Group', matchIds: Array.from({ length: 81 }, (_, i) => `match${i}`) }) }), {} as never);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('80 parties');
    expect(sql).not.toHaveBeenCalled();
  });
});
