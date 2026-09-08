import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const databases: PGlite[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.close())); });

async function fixture() {
  const db = new PGlite(); databases.push(db);
  await db.waitReady;
  const client = { query: vi.fn(async (sql: string, params?: unknown[]) => {
    if (params) return db.query(sql, params);
    return (await db.exec(sql)).at(-1) || { rows: [] };
  }) };
  const migrations = (await loadMigrations()).map(m => ({ ...m,
    // PGlite includes UUID generation but not the optional pgcrypto extension.
    sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '')
      .replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')")
  }));
  return { db, client, migrations };
}

describe('controlled database migrations', () => {
  // The first fixture also compiles/starts PostgreSQL WASM. Concurrent SQL suites
  // can take more than the default 5 seconds on a cold runtime.
  it('prepares a fresh database and checks the lock before applying DDL', async () => {
    const { db, client, migrations } = await fixture();
    expect(await applyMigrations(client, migrations)).toEqual(migrations.map(m => m.key));
    const calls = client.query.mock.calls.map(([sql]) => sql);
    expect(calls.findIndex(sql => sql.includes('pg_advisory_xact_lock')))
      .toBeLessThan(calls.findIndex(sql => sql.startsWith('create table')));
    expect((await db.query('select migration_key from app_schema_migrations')).rows).toHaveLength(migrations.length);
    await db.query('select notif_inactivity, legal_version, email_verify_token from users');
    await db.query('select attempts, rate_key, updated_at from rate_limits');
    await db.query('select team_id, player_id from player_coaching_notes');
    await db.query(`insert into access_requests (contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version)
      values ('Camille', 'fresh@example.test', 'Structure', 'structure', 'manager', 'structure', 'association', 'maybe', 'test')`);
    expect((await db.query('select plan_code from access_requests')).rows).toEqual([{ plan_code: 'structure' }]);
  }, 30_000);

  it('upgrades the published three-plan schema without changing requests and rejects unknown plans', async () => {
    const { db, client, migrations } = await fixture();
    const structureKey = 'pricing-access-requests-structure-20260908-v1';
    await applyMigrations(client, migrations.filter(migration => migration.key !== structureKey));
    const insert = `insert into access_requests (contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version)
      values ('Camille', $1, 'Team NXT', 'team nxt', 'manager', $2, 'association', 'maybe', 'test')`;
    await db.query(insert, ['existing@example.test', 'team_season']);
    const before = (await db.query('select * from access_requests')).rows;
    await expect(db.query(insert, ['structure@example.test', 'structure'])).rejects.toMatchObject({ code: '23514' });
    expect(await applyMigrations(client, migrations)).toEqual([structureKey]);
    expect((await db.query('select * from access_requests')).rows).toEqual(before);
    for (const plan of ['free', 'team_monthly', 'structure']) await db.query(insert, [`${plan}@example.test`, plan]);
    await expect(db.query(insert, ['invalid@example.test', 'arbitrary-price-id'])).rejects.toMatchObject({ code: '23514' });
    const after = (await db.query('select * from access_requests order by email')).rows;
    expect(await applyMigrations(client, migrations)).toEqual([]);
    expect((await db.query('select * from access_requests order by email')).rows).toEqual(after);
  });

  it('upgrades an existing schema without deleting user data and is idempotent', async () => {
    const { db, client, migrations } = await fixture();
    await db.exec(migrations[0].sql);
    await db.exec(`insert into users (id, account_name, name, password_hash) values ('00000000-0000-4000-8000-000000000001','audit','Audit','hash');
      insert into teams (id, owner_id, name, tag) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Team','T');
      insert into match_categories (team_id, name) values ('00000000-0000-4000-8000-000000000002','Match officiel');`);
    await applyMigrations(client, migrations);
    const before = await db.query('select * from users');
    expect(await applyMigrations(client, migrations)).toEqual([]);
    expect(await db.query('select * from users')).toEqual(before);
    expect((await db.query('select name from match_categories')).rows).toEqual([{ name: 'Match officiel' }]);
  });

  it('rolls back DDL and ledger entries when any migration fails', async () => {
    const { db, client } = await fixture();
    const failing = [
      { key: 'one', checksum: 'a', sql: 'create table transaction_probe (id integer primary key); insert into transaction_probe values (1);' },
      { key: 'two', checksum: 'b', sql: 'insert into transaction_probe values (1);' },
    ];
    await expect(applyMigrations(client, failing)).rejects.toMatchObject({ code: '23505' });
    expect((await db.query("select to_regclass('transaction_probe') as probe, to_regclass('app_schema_migrations') as ledger")).rows)
      .toEqual([{ probe: null, ledger: null }]);
  });

  it('upgrades legacy planning rows and permits separate weeks without losing the original slots', async () => {
    const { db, client, migrations } = await fixture();
    await db.exec(migrations[0].sql);
    // Before weekly planning, uniqueness covered only team/player and there
    // was no week_start column. Keep a real saved row through the upgrade.
    await db.exec(`
      alter table player_availability drop column week_start cascade;
      alter table player_availability add constraint player_availability_team_id_player_id_key unique(team_id, player_id);
      insert into users(id, account_name, name, password_hash) values ('00000000-0000-4000-8000-000000000001', 'legacy', 'Legacy', 'hash');
      insert into teams(id, owner_id, name, tag) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Legacy team', 'OLD');
      insert into players(id, team_id, name, role) values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Player', 'TOP');
      insert into player_availability(team_id, player_id, slots, notes) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '{"MON":["20:00"]}', 'Keep my availability');
    `);
    await applyMigrations(client, migrations);
    expect((await db.query("select slots, notes, week_start = date_trunc('week', current_date)::date as current_week from player_availability")).rows)
      .toEqual([{ slots: { MON: ['20:00'] }, notes: 'Keep my availability', current_week: true }]);
    await db.exec(`
      insert into player_availability(team_id, player_id, week_start, slots)
      values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', date_trunc('week', current_date)::date + 7, '{"TUE":["21:00"]}')
      on conflict(team_id, player_id, week_start) do update set slots = excluded.slots;
    `);
    expect((await db.query('select slots from player_availability order by week_start')).rows)
      .toEqual([{ slots: { MON: ['20:00'] } }, { slots: { TUE: ['21:00'] } }]);
  });

  it('rejects editing an already applied migration', async () => {
    const { client } = await fixture();
    const original = { key: 'one', checksum: 'a', sql: 'create table immutable_probe (id integer);' };
    await applyMigrations(client, [original]);
    await expect(applyMigrations(client, [{ ...original, checksum: 'b' }])).rejects.toThrow('different checksum');
  });
});
