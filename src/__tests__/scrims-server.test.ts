import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const db = vi.hoisted(() => ({ pg: null as any }));
const identity = vi.hoisted(() => ({ userId: '' }));
const discord = vi.hoisted(() => ({ enabled: false, settings: {} as any, queued: [] as any[] }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: () => {}, requireAuth: async () => ({ id: identity.userId }) }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_lib/schema', () => ({ ensureAuditLogsSchema: async () => {} }));
vi.mock('../../netlify/functions/_lib/safe-log', () => ({ logFailure: vi.fn() }));
vi.mock('../../netlify/functions/_lib/discord-config', () => ({ isDiscordEnabled: () => discord.enabled }));
vi.mock('../../netlify/functions/_lib/discord-bot-common', () => ({ botText: (value: unknown) => String(value), botLink: (path: string) => `https://nxt5.org${path}` }));
vi.mock('../../netlify/functions/_lib/discord-bot-schedule', () => ({
  botSettings: async (teamId: string) => discord.settings[teamId] || { channels: {}, timezone: 'Europe/Paris' },
  queueBotMessage: async (input: any) => { discord.queued.push(input); return randomUUID(); },
}));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value == null) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', field.dataTypeID === 1184 ? '+00' : '');
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const results = await db.pg.transaction(async (tx: any) => {
          const results = [];
          for (const query of body.queries) results.push(await execute(tx, query));
          return results;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(db.pg, body)));
    } catch (err: any) {
      return new Response(JSON.stringify({ message: err.message, code: err.code, constraint: err.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/scrims') };
});

import handler from '../../netlify/functions/scrims-manage';

const users = { hostOwner: randomUUID(), hostCoach: randomUUID(), hostPlayer: randomUUID(), guestOwner: randomUUID(), thirdOwner: randomUUID(), stranger: randomUUID() };
const teams = { host: randomUUID(), guest: randomUUID(), third: randomUUID() };
const rows = async (query: string, values: any[] = []) => (await db.pg.query(query, values)).rows;
const context = { deploy: { context: 'production' } } as any;
async function call(userId: string, body?: any, teamId = teams.host) {
  identity.userId = userId;
  const url = `https://nxt5.org/.netlify/functions/scrims-manage${body ? '' : `?teamId=${teamId}`}`;
  const response = await handler(new Request(url, body ? { method: 'POST', headers: { Origin: 'https://nxt5.org', 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, ...body }) } : {}), context);
  return { status: response.status, body: await response.json() };
}
const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
const offerBody = (extra: any = {}) => ({ action: 'create', startsAt: inHours(48), durationMinutes: 120, games: 3, levelMin: 'emerald', levelMax: 'diamond', note: 'Draft classique, pas de dodge.', ...extra });

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.waitReady;
  const client = { query: async (sql: string, params?: unknown[]) => params ? db.pg.query(sql, params) : ((await db.pg.exec(sql)).at(-1) || { rows: [] }) };
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  await applyMigrations(client, migrations);
}, 60_000);
afterAll(async () => { await db.pg?.close(); });
beforeEach(async () => {
  discord.enabled = false; discord.settings = {}; discord.queued = [];
  await db.pg.exec('truncate users cascade; truncate audit_logs;');
  for (const [key, id] of Object.entries(users)) await rows("insert into users(id, account_name, name, password_hash) values ($1, $2, $2, 'hash')", [id, key]);
  await rows("insert into teams(id, owner_id, name, tag) values ($1, $2, 'Host Team', 'HST'), ($3, $4, 'Guest Team', 'GST'), ($5, $6, 'Third Team', 'TRD')", [teams.host, users.hostOwner, teams.guest, users.guestOwner, teams.third, users.thirdOwner]);
  await rows("insert into team_members(team_id, user_id, role) values ($1, $2, 'coach'), ($1, $3, 'player')", [teams.host, users.hostCoach, users.hostPlayer]);
});

describe('publishing scrim offers', () => {
  it('lets the staff publish, refuses players and strangers, validates the slot', async () => {
    expect((await call(users.hostCoach, offerBody())).status).toBe(201);
    expect((await call(users.hostPlayer, offerBody())).status).toBe(403);
    expect((await call(users.stranger, offerBody())).status).toBe(403);
    expect((await call(users.hostOwner, offerBody({ levelMin: 'diamond', levelMax: 'gold' }))).status).toBe(400);
    expect((await call(users.hostOwner, offerBody({ startsAt: inHours(-1) }))).status).toBe(400);
    expect((await call(users.hostOwner, offerBody({ games: 11 }))).status).toBe(400);
    expect((await call(users.hostOwner, { action: 'unknown' })).status).toBe(400);
    expect(await rows("select action from audit_logs where action = 'scrim.offer.create'")).toHaveLength(1);
  });

  it('caps open offers per team and shows them to other teams only', async () => {
    for (let index = 0; index < 10; index++) expect((await call(users.hostOwner, offerBody({ startsAt: inHours(24 + index) }))).status).toBe(201);
    expect(await call(users.hostOwner, offerBody())).toMatchObject({ status: 409, body: { code: 'SCRIM_LIMIT' } });
    const host = await call(users.hostPlayer);
    expect(host.status).toBe(200);
    expect(host.body.canManage).toBe(false);
    expect(host.body.offers).toHaveLength(0);
    expect(host.body.mine).toHaveLength(10);
    const guest = await call(users.guestOwner, undefined, teams.guest);
    expect(guest.body.offers).toHaveLength(10);
    expect(guest.body.offers[0]).toMatchObject({ teamName: 'Host Team', teamTag: 'HST', levelMin: 'emerald', mine: false, myRequest: null });
    expect(await call(users.stranger, undefined, teams.guest)).toMatchObject({ status: 403 });
  });
});

describe('answering and confirming a scrim', () => {
  async function publishAndAnswer() {
    const offer = (await call(users.hostOwner, offerBody())).body.offer;
    const guest = (await call(users.guestOwner, { action: 'respond', offerId: offer.id, message: 'On est chauds.' }, teams.guest)).body.request;
    const third = (await call(users.thirdOwner, { action: 'respond', offerId: offer.id, message: 'Dispo aussi.' }, teams.third)).body.request;
    return { offer, guest, third };
  }

  it('records one pending answer per team, never on its own offer, and lets a team withdraw then answer again', async () => {
    const { offer, guest } = await publishAndAnswer();
    expect(guest).toMatchObject({ status: 'pending', teamName: 'Guest Team' });
    expect((await call(users.guestOwner, { action: 'respond', offerId: offer.id, message: 'Encore' }, teams.guest)).status).toBe(409);
    expect((await call(users.hostCoach, { action: 'respond', offerId: offer.id })).status).toBe(409);
    expect((await call(users.hostOwner, { action: 'withdraw', requestId: guest.id })).status).toBe(409);
    expect((await call(users.guestOwner, { action: 'withdraw', requestId: guest.id }, teams.guest)).status).toBe(200);
    expect((await call(users.guestOwner, { action: 'respond', offerId: offer.id, message: 'Finalement oui.' }, teams.guest)).status).toBe(201);
    const listing = await call(users.hostOwner);
    expect(listing.body.mine[0].requests.map((row: any) => [row.teamName, row.status, row.message])).toEqual([['Guest Team', 'pending', 'Finalement oui.'], ['Third Team', 'pending', 'Dispo aussi.']]);
    expect((await call(users.guestOwner, undefined, teams.guest)).body.offers[0].myRequest).toMatchObject({ status: 'pending', message: 'Finalement oui.' });
  });

  it('confirms one answer, declines the others and creates a planning session for both teams', async () => {
    const { offer, guest, third } = await publishAndAnswer();
    expect((await call(users.guestOwner, { action: 'accept', requestId: guest.id }, teams.guest)).status).toBe(404);
    expect(await call(users.hostCoach, { action: 'accept', requestId: guest.id, expectedRevision: 99 })).toMatchObject({ status: 409, body: { code: 'SCRIM_STATE' } });
    const accepted = await call(users.hostCoach, { action: 'accept', requestId: guest.id, expectedRevision: offer.revision });
    expect(accepted.status).toBe(200);
    expect(accepted.body.events.map((event: any) => [event.teamId, event.title]).sort()).toEqual([[teams.host, 'Scrim vs Guest Team · 3 games'], [teams.guest, 'Scrim vs Host Team · 3 games']].sort());
    expect(await rows('select status, matched_team_id from scrim_offers')).toEqual([{ status: 'matched', matched_team_id: teams.guest }]);
    expect(await rows('select team_id, status from scrim_requests order by created_at')).toEqual([{ team_id: teams.guest, status: 'accepted' }, { team_id: teams.third, status: 'declined' }]);
    expect(await rows("select team_id, event_type, duration_minutes, status from discord_team_events order by team_id")).toEqual(expect.arrayContaining([
      expect.objectContaining({ team_id: teams.host, event_type: 'scrim', duration_minutes: 120, status: 'scheduled' }),
      expect.objectContaining({ team_id: teams.guest, event_type: 'scrim', duration_minutes: 120, status: 'scheduled' }),
    ]));
    expect((await call(users.hostCoach, { action: 'accept', requestId: third.id })).status).toBe(409);
    expect((await call(users.hostCoach, { action: 'decline', requestId: third.id })).status).toBe(409);
    const guestView = await call(users.guestOwner, undefined, teams.guest);
    expect(guestView.body.offers).toHaveLength(0);
    expect(guestView.body.matched[0]).toMatchObject({ status: 'matched', teamName: 'Host Team' });
    expect(guestView.body.matched[0].requests[0]).toMatchObject({ status: 'accepted', message: 'On est chauds.' });
    expect((await call(users.thirdOwner, undefined, teams.third)).body.requests[0]).toMatchObject({ status: 'declined' });
    expect(await rows("select action from audit_logs where action = 'scrim.offer.accept'")).toHaveLength(1);
  });

  it('announces the confirmed session to each team that has a planning channel', async () => {
    discord.enabled = true;
    await rows("insert into discord_connections(team_id, guild_id, status, config_version) values ($1, 'guild-host', 'active', 7)", [teams.host]);
    discord.settings[teams.host] = { channels: { planning: '123456789012345678' }, timezone: 'Europe/Paris' };
    const { offer, guest } = await publishAndAnswer();
    expect((await call(users.hostOwner, { action: 'accept', requestId: guest.id, expectedRevision: offer.revision })).status).toBe(200);
    expect(discord.queued).toHaveLength(1);
    expect(discord.queued[0]).toMatchObject({ teamId: teams.host, guildId: 'guild-host', channelKind: 'planning', kind: 'event_update', configVersion: 7 });
    expect(discord.queued[0].payload.embeds[0].description).toContain('Guest Team');
  });

  it('cancelling an open offer declines its pending answers and hides it', async () => {
    const { offer } = await publishAndAnswer();
    expect((await call(users.guestOwner, { action: 'cancel', offerId: offer.id }, teams.guest)).status).toBe(409);
    expect((await call(users.hostOwner, { action: 'cancel', offerId: offer.id })).status).toBe(200);
    expect((await call(users.hostOwner, { action: 'cancel', offerId: offer.id })).status).toBe(409);
    expect(await rows("select count(*)::int as n from scrim_requests where status = 'declined'")).toEqual([{ n: 2 }]);
    expect((await call(users.guestOwner, undefined, teams.guest)).body.offers).toHaveLength(0);
    expect((await call(users.hostOwner)).body.mine[0]).toMatchObject({ status: 'cancelled' });
  });
});
