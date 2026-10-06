import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  // The audited endpoint now commits its authorization check, write and audit
  // together. Exercise that real Neon transaction against local PostgreSQL.
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return { fields: result.fields, rows: result.rows.map((row: any) => result.fields.map((field: any) => {
        const value = row[field.name];
        if (value === null || value === undefined) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (typeof value === 'boolean') return value ? 't' : 'f';
        if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '+00');
        return String(value);
      })), rowCount: result.affectedRows ?? result.rows.length };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) { return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 }); }
  };
  return { sql: neon('postgresql://test:test@planning-tests.invalid/nxt5') };
});
// Authentication is supplied per account. Authorization, validation and all SQL
// execute in the real handler against the production PostgreSQL schema.
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth, assertSessionSecret: () => {} }));

import availability from '../../netlify/functions/player-availability-manage';

const id = (value: number) => `50000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = id(1), outsider = id(2), team = id(3), otherTeam = id(4);
const roster = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map((role, index) => ({ role, userId: id(10 + index), playerId: id(20 + index) }));
const rows = async (statement: string, params: unknown[] = []) => (await state.pg.query(statement, params)).rows as any[];
const context = {} as any;
function post(playerId: string, overrides: Record<string, unknown> = {}) {
  return new Request('https://nxt5.example/.netlify/functions/player-availability-manage', {
    method: 'POST', headers: { origin: 'https://nxt5.example', 'content-type': 'application/json' },
    body: JSON.stringify({ teamId: team, playerId, weekStart: '2026-10-05', slots: { MON: ['19:00'], SUN: ['00:00'] }, notes: 'Disponible', ...overrides }),
  });
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await state.pg.exec("create table app_schema_migrations(migration_key text primary key); insert into app_schema_migrations values('audit-runtime-20260906-v1')");
}, 30_000);

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.auth.mockReset();
  await state.pg.exec('truncate users cascade');
  for (const userId of [owner, outsider, ...roster.map(player => player.userId)]) {
    await rows("insert into users(id,account_name,name,password_hash) values($1,$2,$2,'unused')", [userId, `audit-${userId}`]);
  }
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Planning audit','PLAN'),($3,$4,'Other team','OTHR')", [team, owner, otherTeam, outsider]);
  for (const player of roster) {
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'player')", [team, player.userId]);
    await rows('insert into players(id,team_id,user_id,name,riot_id,role) values($1,$2,$3,$4,$5,$6)',
      [player.playerId, team, player.userId, player.role, `${player.role}#EUW`, player.role]);
  }
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('planning API for all five gameplay roles', () => {
  it.each(roster)('$role saves and updates its own slots, notes and session without duplicating rows', async player => {
    state.auth.mockResolvedValue({ id: player.userId });
    expect((await availability(post(player.playerId), context)).status).toBe(200);
    const response = await availability(post(player.playerId, {
      slots: { TUE: ['20:00', '20:00', '09:00'], _events: { 'TUE|20:00': { label: ' Scrim ', type: 'scrim' } } }, notes: 'Mis à jour',
    }), context);
    expect(response.status).toBe(200);
    expect(await rows('select player_id, slots, notes, updated_by from player_availability')).toEqual([{
      player_id: player.playerId, slots: { MON: [], TUE: ['20:00'], WED: [], THU: [], FRI: [], SAT: [], SUN: [], _events: { 'TUE|20:00': { label: 'Scrim', type: 'scrim' } } },
      notes: 'Mis à jour', updated_by: player.userId,
    }]);
    expect(await rows("select user_id from audit_logs where action='player_availability.upsert'")).toEqual([{ user_id: player.userId }, { user_id: player.userId }]);
  });

  it.each(roster)('$role cannot alter another player or save its profile into a different team', async player => {
    const other = roster.find(candidate => candidate.playerId !== player.playerId)!;
    state.auth.mockResolvedValue({ id: player.userId });
    expect((await availability(post(other.playerId), context)).status).toBe(403);
    expect((await availability(post(player.playerId, { teamId: otherTeam }), context)).status).toBe(404);
    expect(await rows('select * from player_availability')).toEqual([]);
  });

  it.each(roster)('$role retains independent weeks and can clear one without altering the other', async player => {
    state.auth.mockResolvedValue({ id: player.userId });
    expect((await availability(post(player.playerId), context)).status).toBe(200);
    expect((await availability(post(player.playerId, { weekStart: '2026-10-12', slots: { FRI: ['22:00'] }, notes: 'Semaine suivante' }), context)).status).toBe(200);
    expect((await availability(post(player.playerId, { slots: {}, notes: '' }), context)).status).toBe(200);
    expect(await rows('select week_start::text, slots, notes from player_availability order by week_start')).toEqual([
      { week_start: '2026-10-05', slots: { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] }, notes: null },
      { week_start: '2026-10-12', slots: { MON: [], TUE: [], WED: [], THU: [], FRI: ['22:00'], SAT: [], SUN: [] }, notes: 'Semaine suivante' },
    ]);
  });

  it.each(roster)('$role cannot save after membership is removed despite a remaining profile link', async player => {
    state.auth.mockResolvedValue({ id: player.userId });
    await rows('delete from team_members where team_id=$1 and user_id=$2', [team, player.userId]);
    expect((await availability(post(player.playerId), context)).status).toBe(403);
    expect(await rows('select * from player_availability')).toEqual([]);
  });

  it('keeps all five players separate when they save the same weekly slot', async () => {
    for (const player of roster) {
      state.auth.mockResolvedValue({ id: player.userId });
      expect((await availability(post(player.playerId), context)).status).toBe(200);
    }
    expect(await rows("select player_id, slots->'MON' as monday from player_availability order by player_id"))
      .toEqual(roster.map(player => ({ player_id: player.playerId, monday: ['19:00'] })));
    state.auth.mockResolvedValue({ id: outsider });
    expect((await availability(post(roster[0].playerId), context)).status).toBe(403);
    expect(await rows('select * from player_availability')).toHaveLength(5);
  });
});
