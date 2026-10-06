import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pg: null as any, userId: '', statements: [] as string[],
  beforeStatement: null as null | ((db: any, query: string) => Promise<void>)
}));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: () => {}, requireAuth: async () => ({ id: state.userId }) }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));
vi.mock('../../netlify/functions/_lib/schema', () => ({ ensureWorkflowSchema: async () => {}, ensureAuditLogsSchema: async () => {} }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(db: any, statement: any) {
      state.statements.push(statement.query);
      await state.beforeStatement?.(db, statement.query);
      const result = await db.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          return value instanceof Date ? value.toISOString() : String(value);
        })), rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = [];
        for (const statement of body.queries) results.push(await execute(tx, statement));
        return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nxt5') };
});

import deleteTeam from '../../netlify/functions/teams-delete';
import updateTeam from '../../netlify/functions/teams-update';
import deletePlayer from '../../netlify/functions/players-delete';
import coachingNote from '../../netlify/functions/player-coaching-notes-manage';
import availability from '../../netlify/functions/player-availability-manage';
import playerGoals from '../../netlify/functions/player-goals-manage';

const owner = '00000000-0000-4000-8000-000000000001';
const staff = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const teamId = '00000000-0000-4000-8000-000000000004';
const otherTeamId = '00000000-0000-4000-8000-000000000005';
const playerId = '00000000-0000-4000-8000-000000000006';
const matchId = '00000000-0000-4000-8000-000000000007';
const missingId = '00000000-0000-4000-8000-000000000008';
const goalId = '00000000-0000-4000-8000-000000000009';
const context = { deploy: { context: 'production' } } as any;
function request(body: any) {
  return new Request('https://nxt5.test/.netlify/functions/team-mutation', {
    method: 'POST', headers: { Origin: 'https://nxt5.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}
const removeTeam = () => deleteTeam(request({ teamId }), context);
const editTeam = () => updateTeam(request({ teamId, name: 'Changed team', tag: 'UPD' }), context);
const removePlayer = (id = playerId, targetTeam = teamId) => deletePlayer(request({ teamId: targetTeam, playerId: id }), context);
const updateNote = (targetPlayer = playerId) => coachingNote(request({ teamId, playerId: targetPlayer, content: 'Review coaching notes' }), context);
const updateAvailability = (targetPlayer = playerId) => availability(request({ teamId, playerId: targetPlayer, weekStart: '2026-10-05', slots: { MON: ['19:00'] } }), context);
const createGoal = (targetPlayer = playerId) => playerGoals(request({ teamId, playerId: targetPlayer, title: 'Reduce deaths', metric: 'deaths', operator: 'lte', targetValue: 4 }), context);
const manageGoal = (action: string, targetGoal = goalId) => playerGoals(request({ teamId, goalId: targetGoal, action }), context);
const rows = async (query: string, params: unknown[] = []) => (await state.pg.query(query, params)).rows;
const snapshot = async () => ({
  teams: await rows('select * from teams order by id'),
  members: await rows('select * from team_members order by id'),
  players: await rows('select * from players order by id'),
  matches: await rows('select * from matches order by id'),
  participants: await rows('select * from match_participants order by id'),
  notes: await rows('select * from player_coaching_notes order by id'),
  availability: await rows('select * from player_availability order by id'),
  goals: await rows('select * from player_goals order by id'),
  audit: await rows('select * from audit_logs order by id')
});

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .replaceAll('gen_random_bytes(5)', "decode('0000000000', 'hex')"));
  await state.pg.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql', import.meta.url), 'utf8'));
}, 20_000);
beforeEach(async () => {
  state.beforeStatement = null;
  state.userId = owner;
  await state.pg.exec(`alter table audit_logs drop constraint if exists simulate_audit_failure;
    drop table if exists deletion_blocker;
    truncate users cascade; truncate audit_logs;`);
  for (const id of [owner, staff, outsider]) await state.pg.query("insert into users(id, account_name, name, password_hash) values ($1::uuid, $1::text, 'User', 'unused')", [id]);
  await state.pg.query("insert into teams(id, owner_id, name, tag) values ($1, $2, 'Original team', 'OLD'), ($3, $4, 'Unrelated team', 'OTHER')", [teamId, owner, otherTeamId, outsider]);
  await state.pg.query("insert into team_members(team_id, user_id, role) values ($1, $2, 'manager')", [teamId, staff]);
  await state.pg.query("insert into players(id, team_id, name, riot_id, role) values ($1, $2, 'Player', 'Player#EUW', 'TOP')", [playerId, teamId]);
  await state.pg.query("insert into matches(id, team_id, game_id) values ($1, $2, 'EUW1_123')", [matchId, teamId]);
  await state.pg.query("insert into match_participants(match_id, player_id, team_key, champion) values ($1, $2, 'ALLY', 'Ahri')", [matchId, playerId]);
  state.statements = [];
});
afterAll(async () => { await state.pg?.close(); });

describe('team deletion is owner-only and atomic with its cascades and audit', () => {
  it('deletes exactly the owned team and records its current metadata', async () => {
    expect((await removeTeam()).status).toBe(200);
    expect(await rows('select id from teams')).toEqual([{ id: otherTeamId }]);
    for (const table of ['team_members', 'players', 'matches', 'match_participants']) expect(await rows(`select * from ${table}`)).toHaveLength(0);
    expect(await rows('select action, entity_id, metadata from audit_logs')).toEqual([{ action: 'team.delete', entity_id: teamId, metadata: { name: 'Original team', tag: 'OLD' } }]);
    expect(state.statements[0]).toMatch(/from teams.*for update/s);
  });

  it.each([staff, outsider])('refuses a non-owner without any mutation (%s)', async user => {
    state.userId = user;
    const before = await snapshot();
    expect((await removeTeam()).status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it('rechecks ownership at the deletion statement after authorization can have become stale', async () => {
    state.beforeStatement = async (db, query) => {
      if (!/delete from teams/i.test(query)) return;
      state.beforeStatement = null;
      await db.query('update teams set owner_id = $1 where id = $2', [outsider, teamId]);
    };
    expect((await removeTeam()).status).toBe(403);
    expect(await rows('select owner_id from teams where id=$1', [teamId])).toEqual([{ owner_id: outsider }]);
    expect(await rows('select * from players')).toHaveLength(1);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('rolls back every cascade if recording the deletion fails', async () => {
    const before = await snapshot();
    await state.pg.exec("alter table audit_logs add constraint simulate_audit_failure check (action <> 'team.delete')");
    expect((await removeTeam()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });

  it('does not record a deletion when a database constraint prevents deletion', async () => {
    await state.pg.exec('create table deletion_blocker(team_id uuid references teams(id) on delete restrict)');
    await state.pg.query('insert into deletion_blocker(team_id) values($1)', [teamId]);
    const before = await snapshot();
    expect((await removeTeam()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });
});

describe('team updates recheck permissions and commit their audit together', () => {
  it.each([owner, staff])('accepts the owner or a permitted staff member (%s)', async user => {
    state.userId = user;
    const response = await editTeam();
    expect(response.status).toBe(200);
    expect((await response.json()).team).toMatchObject({ name: 'Changed team', tag: 'UPD' });
    expect(await rows('select action from audit_logs')).toEqual([{ action: 'team.update' }]);
  });

  it('refuses a role revoked before the write', async () => {
    state.userId = staff;
    state.beforeStatement = async (db, query) => {
      if (!/update teams\s+set name/i.test(query)) return;
      state.beforeStatement = null;
      await db.query("update team_members set role='member' where team_id=$1 and user_id=$2", [teamId, staff]);
    };
    expect((await editTeam()).status).toBe(403);
    expect(await rows('select name from teams where id=$1', [teamId])).toEqual([{ name: 'Original team' }]);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('rolls back the update when auditing fails', async () => {
    const before = await snapshot();
    await state.pg.exec("alter table audit_logs add constraint simulate_audit_failure check (action <> 'team.update')");
    expect((await editTeam()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });
});

describe('player deletion is scoped and atomic with participant links', () => {
  it.each([owner, staff])('deletes an authorized player with an audit (%s)', async user => {
    state.userId = user;
    const response = await removePlayer();
    expect(response.status).toBe(200);
    expect((await response.json()).player).toMatchObject({ id: playerId, team_id: teamId });
    expect(await rows('select player_id from match_participants')).toEqual([{ player_id: null }]);
    expect(await rows('select action, metadata from audit_logs')).toEqual([{ action: 'player.delete', metadata: { teamId, riotId: 'Player#EUW' } }]);
  });

  it('refuses membership revoked before the delete', async () => {
    state.userId = staff;
    state.beforeStatement = async (db, query) => {
      if (!/delete from players/i.test(query)) return;
      state.beforeStatement = null;
      await db.query('delete from team_members where team_id=$1 and user_id=$2', [teamId, staff]);
    };
    expect((await removePlayer()).status).toBe(403);
    expect(await rows('select id from players')).toEqual([{ id: playerId }]);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('never lets a foreign player ID bypass team ownership', async () => {
    state.userId = outsider;
    const before = await snapshot();
    expect((await removePlayer(playerId, otherTeamId)).status).toBe(404);
    expect((await removePlayer(playerId, teamId)).status).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it('returns a missing-player response without logging a deletion', async () => {
    expect((await removePlayer(missingId)).status).toBe(404);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('rolls back the deleted player and participant references if auditing fails', async () => {
    const before = await snapshot();
    await state.pg.exec("alter table audit_logs add constraint simulate_audit_failure check (action <> 'player.delete')");
    expect((await removePlayer()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });
});

const playerWrites = [
  { label: 'coaching notes', run: updateNote, table: 'player_coaching_notes', action: 'profile.coaching_note.update' },
  { label: 'availability', run: updateAvailability, table: 'player_availability', action: 'player_availability.upsert' },
  { label: 'player goals', run: createGoal, table: 'player_goals', action: 'player_goals.create' }
];

describe.each(playerWrites)('$label mutations', ({ run, table, action }) => {
  it.each([owner, staff])('accepts current owner or staff permissions (%s)', async user => {
    state.userId = user;
    expect((await run()).status).toBe(200);
    expect(await rows(`select * from ${table}`)).toHaveLength(1);
    expect(await rows('select action from audit_logs')).toEqual([{ action }]);
  });

  it('rejects staff removed after preflight and before acquiring the team lock', async () => {
    state.userId = staff;
    state.beforeStatement = async (db, query) => {
      if (!/select id from teams.*for update/s.test(query)) return;
      state.beforeStatement = null;
      await db.query('delete from team_members where team_id=$1 and user_id=$2', [teamId, staff]);
    };
    expect((await run()).status).toBe(403);
    expect(await rows(`select * from ${table}`)).toHaveLength(0);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('rolls back the write if the audit cannot be recorded', async () => {
    const before = await snapshot();
    await state.pg.exec(`alter table audit_logs add constraint simulate_audit_failure check (action <> '${action}')`);
    expect((await run()).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });

  it('refuses a profile moved to another team after validation', async () => {
    state.beforeStatement = async (db, query) => {
      if (!/select id from teams.*for update/s.test(query)) return;
      state.beforeStatement = null;
      await db.query('update players set team_id=$1 where id=$2', [otherTeamId, playerId]);
    };
    expect((await run()).status).toBe(403);
    expect(await rows(`select * from ${table}`)).toHaveLength(0);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
});

describe('self-service availability uses the current linked profile and membership', () => {
  beforeEach(async () => {
    state.userId = staff;
    await state.pg.query("update team_members set role='member' where team_id=$1 and user_id=$2", [teamId, staff]);
    await state.pg.query('update players set user_id=$1 where id=$2', [staff, playerId]);
  });

  it('lets a linked member edit availability but not coaching notes or goals', async () => {
    expect((await updateAvailability()).status).toBe(200);
    expect((await updateNote()).status).toBe(403);
    expect((await createGoal()).status).toBe(403);
  });

  it('refuses a profile reassigned before the write', async () => {
    state.beforeStatement = async (db, query) => {
      if (!/select id from teams.*for update/s.test(query)) return;
      state.beforeStatement = null;
      await db.query('update players set user_id=$1 where id=$2', [outsider, playerId]);
    };
    expect((await updateAvailability()).status).toBe(403);
    expect(await rows('select * from player_availability')).toHaveLength(0);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
});

describe.each(['delete', 'archive'])('goal %s', action => {
  beforeEach(async () => {
    await state.pg.query(`insert into player_goals(id, team_id, player_id, created_by, title, metric, operator, target_value, sample_size, required_successes)
      values($1, $2, $3, $4, 'Review target', 'deaths', 'lte', 4, 3, 2)`, [goalId, teamId, playerId, owner]);
  });

  it('records the authorized mutation exactly once', async () => {
    expect((await manageGoal(action)).status).toBe(200);
    expect(await rows('select status from player_goals')).toEqual(action === 'delete' ? [] : [{ status: 'archived' }]);
    expect(await rows('select action from audit_logs')).toEqual([{ action: `player_goals.${action}` }]);
  });

  it('refuses an access change between preflight and lock acquisition', async () => {
    state.userId = staff;
    state.beforeStatement = async (db, query) => {
      if (!/select id from teams.*for update/s.test(query)) return;
      state.beforeStatement = null;
      await db.query("update team_members set role='member' where team_id=$1 and user_id=$2", [teamId, staff]);
    };
    expect((await manageGoal(action)).status).toBe(403);
    expect(await rows('select status from player_goals')).toEqual([{ status: 'active' }]);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });

  it('preserves the goal if the audit fails', async () => {
    const before = await snapshot();
    await state.pg.exec(`alter table audit_logs add constraint simulate_audit_failure check (action <> 'player_goals.${action}')`);
    expect((await manageGoal(action)).status).toBe(500);
    expect(await snapshot()).toEqual(before);
  });

  it('does not audit an absent or foreign goal', async () => {
    expect((await manageGoal(action, missingId)).status).toBe(404);
    await state.pg.query('update player_goals set team_id=$1 where id=$2', [otherTeamId, goalId]);
    expect((await manageGoal(action)).status).toBe(404);
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
});
