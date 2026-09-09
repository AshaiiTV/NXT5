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
    await db.query('select user_id, plan_code, starts_at, ends_at, revoked_at, note, revision from account_subscriptions');
    await db.query(`insert into access_requests (contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version)
      values ('Camille', 'fresh@example.test', 'Structure', 'structure', 'manager', 'structure', 'association', 'maybe', 'test')`);
    expect((await db.query('select plan_code from access_requests')).rows).toEqual([{ plan_code: 'structure' }]);
  }, 30_000);

  it('adds manual account subscriptions without changing existing accounts or teams and is idempotent', async () => {
    const { db, client, migrations } = await fixture();
    const key = 'account-subscriptions-20260908-v1';
    const throughManualSubscriptions = migrations.slice(0, migrations.findIndex(migration => migration.key === key) + 1);
    await applyMigrations(client, throughManualSubscriptions.slice(0, -1));
    const userId = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into users(id, account_name, name, password_hash) values ($1, 'manual', 'Manual account', 'hash')", [userId]);
    await db.query("insert into teams(owner_id, name, tag) values ($1, 'Team intacte', 'NXT')", [userId]);
    const users = (await db.query('select * from users')).rows;
    const teams = (await db.query('select * from teams')).rows;
    expect(await applyMigrations(client, throughManualSubscriptions)).toEqual([key]);
    expect((await db.query('select * from users')).rows).toEqual(users);
    expect((await db.query('select * from teams')).rows).toEqual(teams);
    await db.query("insert into account_subscriptions(user_id, plan_code, starts_at, note, updated_by) values ($1, 'structure', '2026-09-01', 'Manuel', $1)", [userId]);
    const subscription = (await db.query('select * from account_subscriptions')).rows;
    expect(await applyMigrations(client, throughManualSubscriptions)).toEqual([]);
    expect((await db.query('select * from account_subscriptions')).rows).toEqual(subscription);
    await db.query('delete from users where id = $1', [userId]);
    expect((await db.query('select * from account_subscriptions')).rows).toEqual([]);
  });

  it('enforces manual subscription plans, dates, note lengths, revisions and account references in PostgreSQL', async () => {
    const { db, client, migrations } = await fixture();
    await applyMigrations(client, migrations);
    const userId = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into users(id, account_name, name, password_hash) values ($1, 'constraints', 'Constraints', 'hash')", [userId]);
    // Remove the default only in this constraint fixture so inserts exercise
    // validity constraints without colliding with the user's subscription.
    await db.query('delete from account_subscriptions where user_id = $1', [userId]);
    const insert = 'insert into account_subscriptions(user_id, plan_code, starts_at, ends_at, note, revision) values ($1,$2,$3,$4,$5,$6)';
    for (const values of [
      ['unknown', null, null, '', 1], ['team_monthly', null, null, '', 1],
      ['free', '2026-09-01', null, '', 1], ['free', null, '2026-09-15', '', 1],
      ['free', '2026-09-01', '2026-09-16', '', 1],
      ['team_season', '2026-09-01', '2026-10-01', '', 1],
      ['structure', '2026-09-01', null, '', 1], ['free', null, null, 'x'.repeat(1001), 1],
      ['free', null, null, '', 0]
    ]) await expect(db.query(insert, [userId, ...values])).rejects.toMatchObject({ code: '23514' });
    await expect(db.query(insert, ['00000000-0000-4000-8000-000000000099', 'free', null, null, '', 1])).rejects.toMatchObject({ code: '23503' });
    await db.query(insert, [userId, 'free', null, null, '🙂'.repeat(1000), 1]);
    expect((await db.query('select plan_code, char_length(note) as length from account_subscriptions')).rows).toEqual([{ plan_code: 'free', length: 1000 }]);
    await db.exec("set time zone 'Europe/Paris'");
    await db.query("update account_subscriptions set starts_at = '2026-03-20T12:00:00+01:00', ends_at = '2026-04-03T13:00:00+02:00' where user_id = $1", [userId]);
    await expect(db.query("update account_subscriptions set ends_at = '2026-04-03T12:00:00+02:00' where user_id = $1", [userId])).rejects.toMatchObject({ code: '23514' });
  });

  it('migrates retired account plans with exact validity and attribution preservation, a new audit and no automatic trial start', async () => {
    const { db, client, migrations } = await fixture();
    const key = 'account-subscriptions-catalog-20260909-v1';
    const throughCatalog = migrations.slice(0, migrations.findIndex(migration => migration.key === key) + 1);
    await applyMigrations(client, throughCatalog.slice(0, -1));
    const adminId = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into users(id, account_name, name, password_hash) values ($1, 'catalog-admin', 'Admin', 'hash')", [adminId]);
    let sequence = 10;
    const convertedIds: string[] = [];
    for (const plan of ['team_monthly', 'team_season', 'structure']) {
      for (const status of ['active', 'scheduled', 'expired', 'revoked']) {
        const id = `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
        await db.query('insert into users(id, account_name, name, password_hash) values ($1, $2, $2, $3)', [id, `${plan}-${status}`, 'hash']);
        await db.query(`update account_subscriptions set plan_code = $2, starts_at = $3, ends_at = $4, revoked_at = $5,
          note = $6, updated_by = $7, revision = 17, updated_at = '2026-08-31T12:34:56.123456Z' where user_id = $1`, [
          id, plan, status === 'scheduled' ? '2090-09-01T09:15:30.123456Z' : '2000-09-01T09:15:30.123456Z',
          status === 'expired' ? '2001-09-01T10:15:30.654321Z' : status === 'active' ? null : '2099-09-01T10:15:30.654321Z',
          status === 'revoked' ? '2026-09-07T11:22:33.123456Z' : null, `Conserver ${plan} / ${status} 🙂`, adminId
        ]);
        await db.query(`insert into audit_logs(user_id, action, entity_type, entity_id, metadata, created_at)
          values ($1, 'account_subscription.assign', 'account_subscription', $2, jsonb_build_object('planCode', $3::text), '2026-08-31T12:34:56.123456Z')`, [adminId, id, plan]);
        if (plan !== 'team_monthly') convertedIds.push(id);
      }
    }
    await db.query("insert into teams(owner_id, name, tag) values ($1, 'Équipe préservée', 'NXT')", [adminId]);
    const exactStateQuery = `select user_id, plan_code, revision, (to_jsonb(s) - 'plan_code' - 'revision' - 'updated_at')::text as state
      from account_subscriptions s order by user_id`;
    const before = (await db.query(exactStateQuery)).rows as any[];
    const untouchedQuery = 'select row_to_json(s)::text as exact_row from account_subscriptions s where user_id <> all($1::uuid[]) order by user_id';
    const untouchedBefore = (await db.query(untouchedQuery, [convertedIds])).rows;
    const auditBefore = (await db.query('select row_to_json(a)::text as exact_row from audit_logs a order by id')).rows;
    const usersBefore = (await db.query('select * from users order by id')).rows;
    const teamsBefore = (await db.query('select * from teams order by id')).rows;

    expect(await applyMigrations(client, throughCatalog)).toEqual([key]);
    expect((await db.query(exactStateQuery)).rows).toEqual(before.map(row => convertedIds.includes(row.user_id)
      ? { ...row, plan_code: 'team_monthly', revision: row.revision + 1 } : row));
    expect((await db.query(untouchedQuery, [convertedIds])).rows).toEqual(untouchedBefore);
    expect((await db.query("select row_to_json(a)::text as exact_row from audit_logs a where action <> 'account_subscription.migrate' order by id")).rows).toEqual(auditBefore);
    expect((await db.query('select * from users order by id')).rows).toEqual(usersBefore);
    expect((await db.query('select * from teams order by id')).rows).toEqual(teamsBefore);
    const audit = (await db.query("select * from audit_logs where action = 'account_subscription.migrate' order by entity_id")).rows as any[];
    expect(audit).toHaveLength(convertedIds.length);
    for (const event of audit) {
      const original = before.find(row => row.user_id === event.entity_id);
      expect(event).toMatchObject({ user_id: null, entity_type: 'account_subscription', metadata: {
        previousPlanCode: original.plan_code, planCode: 'team_monthly', previousRevision: 17, revision: 18, migrationKey: key
      } });
      expect(event.metadata.startsAt).toContain('.123456');
    }
    expect((await db.query('select plan_code, starts_at, ends_at from account_subscriptions where user_id = $1', [adminId])).rows)
      .toEqual([{ plan_code: 'free', starts_at: null, ends_at: null }]);

    const allBeforeRetry = (await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s order by user_id')).rows;
    expect(await applyMigrations(client, throughCatalog)).toEqual([]);
    await db.exec(throughCatalog.at(-1)!.sql);
    expect((await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s order by user_id')).rows).toEqual(allBeforeRetry);
    expect((await db.query("select * from audit_logs where action = 'account_subscription.migrate' order by entity_id")).rows).toEqual(audit);
  });

  it('rolls back catalogue changes and its marker if the migration audit cannot be written', async () => {
    const { db, client, migrations } = await fixture();
    const key = 'account-subscriptions-catalog-20260909-v1';
    const throughCatalog = migrations.slice(0, migrations.findIndex(migration => migration.key === key) + 1);
    await applyMigrations(client, throughCatalog.slice(0, -1));
    const userId = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into users(id, account_name, name, password_hash) values ($1, 'rollback-catalog', 'Rollback', 'hash')", [userId]);
    await db.query("update account_subscriptions set plan_code = 'structure', starts_at = '2026-09-01T12:34:56.123456Z', note = 'Conserver' where user_id = $1", [userId]);
    const before = (await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s')).rows;
    await db.exec("alter table audit_logs add constraint reject_catalog_audit check (action <> 'account_subscription.migrate')");
    await expect(applyMigrations(client, throughCatalog)).rejects.toMatchObject({ code: '23514' });
    expect((await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s')).rows).toEqual(before);
    expect((await db.query('select migration_key from app_schema_migrations where migration_key = $1', [key])).rows).toEqual([]);
    expect((await db.query('select * from audit_logs')).rows).toEqual([]);
    await db.exec('alter table audit_logs drop constraint reject_catalog_audit');
    expect(await applyMigrations(client, throughCatalog)).toEqual([key]);
    expect((await db.query('select plan_code, revision from account_subscriptions')).rows).toEqual([{ plan_code: 'team_monthly', revision: 2 }]);
  });

  it('backfills Discovery only for missing subscriptions and preserves every existing plan and state exactly', async () => {
    const { db, client, migrations } = await fixture();
    const key = 'account-subscriptions-discovery-default-20260908-v1';
    const throughDefault = migrations.slice(0, migrations.findIndex(migration => migration.key === key) + 1);
    await applyMigrations(client, throughDefault.slice(0, -1));
    const missingIds = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
    for (const [index, id] of missingIds.entries()) {
      await db.query('insert into users(id, account_name, name, password_hash) values ($1, $2, $2, $3)', [id, `missing-${index}`, 'hash']);
    }
    let sequence = 10;
    for (const plan of ['free', 'team_monthly', 'team_season', 'structure']) {
      const states = plan === 'free' ? ['active', 'revoked'] : ['active', 'scheduled', 'expired', 'revoked'];
      for (const status of states) {
        const id = `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
        await db.query('insert into users(id, account_name, name, password_hash) values ($1, $2, $2, $3)', [id, `${plan}-${status}`, 'hash']);
        await db.query(`insert into account_subscriptions
          (user_id, plan_code, starts_at, ends_at, revoked_at, note, updated_by, revision, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, '2026-08-31T12:34:56.123456Z')`, [
          id, plan,
          plan === 'free' ? null : status === 'scheduled' ? '2090-09-01T09:15:30.123456Z' : '2000-09-01T09:15:30.123456Z',
          plan === 'free' ? null : status === 'expired' ? '2001-09-01T10:15:30.654321Z' : '2099-09-01T10:15:30.654321Z',
          status === 'revoked' ? '2026-09-07T11:22:33.123456Z' : null,
          `Conserver exactement ${plan} / ${status} — note privée 🙂`, missingIds[0], sequence
        ]);
      }
    }
    await db.query("insert into teams(owner_id, name, tag) values ($1, 'Équipe existante', 'NXT')", [missingIds[0]]);
    const existingQuery = 'select row_to_json(subscription)::text as exact_row from account_subscriptions subscription where user_id <> all($1::uuid[]) order by user_id';
    const existingBefore = (await db.query(existingQuery, [missingIds])).rows;
    const usersBefore = (await db.query('select * from users order by id')).rows;
    const teamsBefore = (await db.query('select * from teams order by id')).rows;
    const auditBefore = (await db.query('select * from audit_logs order by id')).rows;

    expect(await applyMigrations(client, throughDefault)).toEqual([key]);
    expect((await db.query(existingQuery, [missingIds])).rows).toEqual(existingBefore);
    expect((await db.query('select user_id, plan_code, starts_at, ends_at, revoked_at, note, updated_by, revision from account_subscriptions where user_id = any($1::uuid[]) order by user_id', [missingIds])).rows)
      .toEqual(missingIds.map(user_id => ({ user_id, plan_code: 'free', starts_at: null, ends_at: null, revoked_at: null, note: '', updated_by: null, revision: 1 })));
    expect((await db.query('select count(*)::int as missing from users u left join account_subscriptions s on s.user_id = u.id where s.user_id is null')).rows)
      .toEqual([{ missing: 0 }]);
    expect((await db.query('select * from users order by id')).rows).toEqual(usersBefore);
    expect((await db.query('select * from teams order by id')).rows).toEqual(teamsBefore);
    expect((await db.query('select * from audit_logs order by id')).rows).toEqual(auditBefore);

    const allBefore = (await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s order by user_id')).rows;
    expect(await applyMigrations(client, throughDefault)).toEqual([]);
    // The SQL itself can also be safely retried without resetting any row,
    // including microsecond timestamps that JavaScript Date would truncate.
    await db.exec(throughDefault.at(-1)!.sql);
    expect((await db.query('select row_to_json(s)::text as exact_row from account_subscriptions s order by user_id')).rows).toEqual(allBefore);
  });

  it('gives each newly inserted account pending Discovery without validity dates or an administrator actor', async () => {
    const { db, client, migrations } = await fixture();
    await applyMigrations(client, migrations);
    await db.exec(`insert into users(id, account_name, name, password_hash) values
      ('00000000-0000-4000-8000-000000000001', 'new-one', 'One', 'hash'),
      ('00000000-0000-4000-8000-000000000002', 'new-two', 'Two', 'hash');`);
    expect((await db.query(`select plan_code, starts_at, ends_at, revoked_at, note, updated_by, revision,
      updated_at between now() - interval '1 minute' and now() as recently_created
      from account_subscriptions order by user_id`)).rows).toEqual(Array.from({ length: 2 }, () => ({
      plan_code: 'free', starts_at: null, ends_at: null, revoked_at: null, note: '', updated_by: null, revision: 1, recently_created: true
    })));
    expect((await db.query('select * from audit_logs')).rows).toEqual([]);
  });

  it('rolls back the default subscription with a failed account creation transaction', async () => {
    const { db, client, migrations } = await fixture();
    await applyMigrations(client, migrations);
    const id = '00000000-0000-4000-8000-000000000001';
    await expect(db.transaction(async tx => {
      await tx.query("insert into users(id, account_name, name, password_hash) values ($1, 'rolled-back', 'Rollback', 'hash')", [id]);
      expect((await tx.query('select plan_code from account_subscriptions where user_id = $1', [id])).rows).toEqual([{ plan_code: 'free' }]);
      throw new Error('Account registration failed');
    })).rejects.toThrow('Account registration failed');
    expect((await db.query('select id from users')).rows).toEqual([]);
    expect((await db.query('select user_id from account_subscriptions')).rows).toEqual([]);
  });

  it('upgrades the published three-plan schema without changing requests and rejects unknown plans', async () => {
    const { db, client, migrations } = await fixture();
    const structureKey = 'pricing-access-requests-structure-20260908-v1';
    const throughStructure = migrations.slice(0, migrations.findIndex(migration => migration.key === structureKey) + 1);
    await applyMigrations(client, throughStructure.slice(0, -1));
    const insert = `insert into access_requests (contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, consent_version)
      values ('Camille', $1, 'Team NXT', 'team nxt', 'manager', $2, 'association', 'maybe', 'test')`;
    await db.query(insert, ['existing@example.test', 'team_season']);
    const before = (await db.query('select * from access_requests')).rows;
    await expect(db.query(insert, ['structure@example.test', 'structure'])).rejects.toMatchObject({ code: '23514' });
    expect(await applyMigrations(client, throughStructure)).toEqual([structureKey]);
    expect((await db.query('select * from access_requests')).rows).toEqual(before);
    for (const plan of ['free', 'team_monthly', 'structure']) await db.query(insert, [`${plan}@example.test`, plan]);
    await expect(db.query(insert, ['invalid@example.test', 'arbitrary-price-id'])).rejects.toMatchObject({ code: '23514' });
    const after = (await db.query('select * from access_requests order by email')).rows;
    expect(await applyMigrations(client, throughStructure)).toEqual([]);
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
