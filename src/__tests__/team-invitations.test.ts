import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, failRateLimit: false }));

// Run the handlers and their real shared rate limiter against PostgreSQL.
// Authentication is a fixture; no production database or outbound request is used.
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const statement = JSON.parse(options.body);
    try {
      if (state.failRateLimit && /rate_limits/.test(statement.query)) throw new Error('Simulated limiter storage outage');
      const result = await state.pg.query(statement.query, statement.params);
      return new Response(JSON.stringify({
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          // Match PostgreSQL's wire timestamp text, which Neon's timestamptz
          // parser expects (a space separator and an explicit UTC offset).
          return typeof value?.toISOString === 'function'
            ? value.toISOString().replace('T', ' ').replace('Z', '+00')
            : String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      }));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/auth', () => ({
  assertSessionSecret: () => {},
  requireAuth: async (_request: Request, context: any) => ({ id: context.testUserId })
}));

import createInvite from '../../netlify/functions/teams-invite-code';
import joinTeam from '../../netlify/functions/teams-join';

const ownerId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const teamId = '00000000-0000-4000-8000-000000000003';
const legacyCode = 'NXT5-ABC123';
const longCode = 'NXT5-0123456789ABCDEF0123456789ABCDEF';
const context = (id = userId, ip = '192.0.2.1') => ({ testUserId: id, ip }) as any;
function request(route: string, body: any, headers: Record<string, string> = {}) {
  return new Request(`https://nxt5.test/${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
function join(invite: unknown = legacyCode, actor = context(), field = 'invite', headers = {}) {
  return joinTeam(request('teams-join', { [field]: invite }, headers), actor);
}
function generate(targetTeam = teamId, actor = context(ownerId)) {
  return createInvite(request('teams-invite-code', { teamId: targetTeam }), actor);
}
async function seedUser(id: string) {
  await state.pg.query('insert into users(id, account_name, name, email, password_hash) values ($1, $2, $3, $4, $5)', [id, id, id, `${id}@example.test`, 'unused-test-hash']);
}
async function seedTeam(id = teamId, owner = ownerId) {
  await state.pg.query('insert into teams(id, owner_id, name, tag) values ($1, $2, $3, $4)', [id, owner, id, 'TEST']);
}
async function seedInvite(code = legacyCode, expiration = '1 hour') {
  await state.pg.query('insert into team_invite_codes(team_id, created_by, code, expires_at) values ($1, $2, $3, now() + $4::interval)', [teamId, ownerId, code, expiration]);
}
async function membershipCount() {
  return Number((await state.pg.query('select count(*) as count from team_members where user_id = $1', [userId])).rows[0].count);
}
async function inviteCount() {
  return Number((await state.pg.query('select count(*) as count from team_invite_codes')).rows[0].count);
}
function fixtureId(number: number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 20_000);

beforeEach(async () => {
  state.failRateLimit = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await state.pg.exec('truncate users cascade; truncate rate_limits');
  await seedUser(ownerId);
  await seedUser(userId);
  await seedTeam();
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('complete invitation credentials', () => {
  it('creates a 128-bit code and accepts the full code or URL without exposing it in team responses', async () => {
    const generated = await generate();
    expect(generated.status).toBe(200);
    const payload = await generated.json();
    expect(payload.code).toMatch(/^NXT5-[0-9A-F]{32}$/);
    expect(new Date(payload.expiresAt).getTime() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
    for (const invite of [payload.code, `https://nxt5.test/equipes?invite=${payload.code.toLowerCase()}`]) {
      const response = await join(invite);
      expect(response.status).toBe(200);
      expect((await response.json()).team).not.toHaveProperty('invite_code');
    }
    expect(await membershipCount()).toBe(1);
  });

  it.each(['invite', 'inviteCode', 'link', 'code'])('preserves the %s input alias for an active legacy code', async field => {
    await seedInvite();
    expect((await join('  nxt5-abc123  ', context(), field)).status).toBe(200);
    expect(await membershipCount()).toBe(1);
  });

  it.each(['NXT5-ABCD', 'NXT5-ABCDEF123456', 'RIFT-ABC123'])('accepts the complete active legacy format %s', async code => {
    await seedInvite(code);
    expect((await join(`https://nxt5.test/equipes?code=${code}`)).status).toBe(200);
  });

  it.each([
    'prefix NXT5-ABC123 suffix', 'NXT5-ABC123!', 'NXT5-ABC123-extra', 'NXT5-ABC1234567890',
    'NXT5-' + 'A'.repeat(33), 'NXT5-' + 'G'.repeat(32), 'RIFT-' + 'A'.repeat(32),
    'https://nxt5.test/?invite=NXT5-ABC123&invite=NXT5-ABC123',
    'https://nxt5.test/?invite=NXT5-ABC123&code=NXT5-ABC123',
    'https://user:password@nxt5.test/?invite=NXT5-ABC123',
    'javascript:ignored?invite=NXT5-ABC123',
    'https://nxt5.test/?invite=NXT5-ABC123%21',
    'https://nxt5.test/?invite=NXT5-ABC123&padding=' + 'x'.repeat(2048),
    { invite: 'NXT5-ABC123' }
  ])('rejects malformed or ambiguous input without partial matching: %j', async invite => {
    await seedInvite();
    const response = await join(invite);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVITE_CODE_INVALID');
    expect(await membershipCount()).toBe(0);
  });

  it('does not truncate a new code to an active twelve-character legacy suffix', async () => {
    const prefix = 'NXT5-0123456789AB';
    await seedInvite(prefix);
    expect((await join(longCode)).status).toBe(404);
    expect(await membershipCount()).toBe(0);
  });

  it.each([legacyCode, longCode])('rejects expired invitations: %s', async code => {
    await seedInvite(code, '-1 second');
    expect((await join(code)).status).toBe(404);
    expect(await membershipCount()).toBe(0);
  });
});

describe('shared join budgets', () => {
  it('keeps the account budget when the caller changes IP, and reopens after the window', async () => {
    await seedInvite();
    for (let index = 0; index < 10; index++) {
      expect((await join('NXT5-FFFFFF', context(userId, `192.0.2.${index + 1}`))).status).toBe(404);
    }
    const blocked = await join(legacyCode, context(userId, '198.51.100.1'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await membershipCount()).toBe(0);
    await state.pg.exec("update rate_limits set window_start = now() - interval '901 seconds'");
    expect((await join()).status).toBe(200);
  });

  it('keeps the trusted client IP budget across accounts and spoofed request headers', async () => {
    await seedInvite();
    for (let index = 0; index < 30; index++) {
      const id = fixtureId(index + 100);
      await seedUser(id);
      expect((await join('NXT5-FFFFFF', context(id), 'invite', { 'x-nf-client-connection-ip': `198.51.100.${index + 1}` })).status).toBe(404);
    }
    expect((await join(legacyCode, context(), 'invite', { 'x-nf-client-connection-ip': '203.0.113.1' })).status).toBe(429);
    expect(await membershipCount()).toBe(0);
  });

  it('atomically limits simultaneous attempts against an account', async () => {
    const responses = await Promise.all(Array.from({ length: 25 }, (_, index) => join('NXT5-FFFFFF', context(userId, `192.0.2.${index + 1}`))));
    expect(responses.filter(response => response.status === 404)).toHaveLength(10);
    expect(responses.filter(response => response.status === 429)).toHaveLength(15);
  });

  it('counts malformed submissions against the same budget', async () => {
    for (let index = 0; index < 10; index++) expect((await join('not a code')).status).toBe(400);
    expect((await join()).status).toBe(429);
  });
});

describe('bounded invitation creation', () => {
  it.each(['captain', 'manager'])('retains creation access for %s', async role => {
    await state.pg.query('insert into team_members(team_id, user_id, role) values ($1, $2, $3)', [teamId, userId, role]);
    expect((await generate(teamId, context())).status).toBe(200);
  });

  it('does not let an outsider consume a team creation budget', async () => {
    expect((await generate(teamId, context())).status).toBe(403);
    expect(await inviteCount()).toBe(0);
    expect((await state.pg.query("select * from rate_limits where endpoint = 'team-invite-create-team'")).rows).toHaveLength(0);
  });

  it('shares the account budget across teams and IPs', async () => {
    for (let index = 0; index < 10; index++) {
      const id = fixtureId(index + 200);
      await seedTeam(id);
      expect((await generate(id, context(ownerId, `192.0.2.${index + 1}`))).status).toBe(200);
    }
    expect((await generate(teamId, context(ownerId, '198.51.100.1'))).status).toBe(429);
    expect(await inviteCount()).toBe(10);
  });

  it('shares the team budget across authorized staff accounts and IPs', async () => {
    for (let index = 0; index < 10; index++) {
      const id = fixtureId(index + 300);
      await seedUser(id);
      await state.pg.query("insert into team_members(team_id, user_id, role) values ($1, $2, 'manager')", [teamId, id]);
      expect((await generate(teamId, context(id, `192.0.2.${index + 1}`))).status).toBe(200);
    }
    expect((await generate()).status).toBe(429);
    expect(await inviteCount()).toBe(10);
  });

  it('shares the IP creation budget across accounts and teams', async () => {
    for (let index = 0; index < 30; index++) {
      const id = fixtureId(index + 400);
      const targetTeam = fixtureId(index + 500);
      await seedUser(id);
      await seedTeam(targetTeam, id);
      expect((await generate(targetTeam, context(id))).status).toBe(200);
    }
    expect((await generate()).status).toBe(429);
    expect(await inviteCount()).toBe(30);
  });

  it.each(['join', 'create'])('fails closed if rate-limit storage is unavailable for %s', async action => {
    await seedInvite();
    state.failRateLimit = true;
    const response = action === 'join' ? await join() : await generate();
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(await membershipCount()).toBe(0);
    expect(await inviteCount()).toBe(1);
  });
});
