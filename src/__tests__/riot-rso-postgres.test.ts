import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const state = vi.hoisted(() => ({ client: null as any }));
vi.mock('../../netlify/functions/_lib/db', () => ({
  sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : '') + part, '');
    return (await state.client.query(text, values)).rows;
  },
}));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: async () => {} }));

import { createSession, sha256 } from '../../netlify/functions/_lib/auth';
import { consumeRiotFlow, linkRiotIdentity, type RiotFlow } from '../../netlify/functions/_lib/riot-rso';

const socket = process.env.NXT5_RIOT_POSTGRES_SOCKET;
const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const hash = (character: string) => character.repeat(64);
const identity = { puuid: 'verified-riot-puuid', gameName: 'Verified', tagLine: 'EUW' };
const pending = (user = USER): RiotFlow => ({
  flow: 'link', user_id: user, session_hash: hash(user === USER ? 'a' : 'b'), link_revision: 0,
  nonce: 'N'.repeat(43), code_verifier: 'V'.repeat(43), remember: false,
});
const context = () => ({ cookies: { set: vi.fn() } }) as any;
const request = new Request('https://nxt5.org/.netlify/functions/auth-riot-callback');
const settle = <T>(promise: Promise<T>) => promise.then(value => ({ value }), error => ({ error }));

// Normal npm test never needs PostgreSQL. The companion runner provides a
// private local socket and creates/deletes the entire test cluster itself.
describe.skipIf(!socket)('real PostgreSQL RSO lock contention', () => {
  let controller: Client;
  let worker: Client;
  let observer: Client;
  let workerPid: number;

  beforeAll(async () => {
    if (!socket || !isAbsolute(socket) || basename(socket) !== 'socket'
      || !basename(dirname(socket)).startsWith('nxt5-riot-pg-')
      || (await readFile(join(dirname(socket), 'nxt5-test-only'), 'utf8')) !== 'ephemeral-riot-concurrency\n') {
      throw new Error('Use tools/verify-riot-concurrency.mjs to create an isolated local PostgreSQL cluster.');
    }
    const connection = { host: socket, port: 5432, user: 'nxt5_test', database: 'postgres', connectionTimeoutMillis: 5000 };
    controller = new Client({ ...connection, application_name: 'nxt5-riot-controller' });
    worker = new Client({ ...connection, application_name: 'nxt5-riot-worker' });
    observer = new Client({ ...connection, application_name: 'nxt5-riot-observer' });
    await Promise.all([controller.connect(), worker.connect(), observer.connect()]);
    expect((await observer.query('show listen_addresses')).rows[0].listen_addresses).toBe('');
    workerPid = (await worker.query('select pg_backend_pid() as pid')).rows[0].pid;
    await applyMigrations(controller, await loadMigrations());
  }, 30_000);

  beforeEach(async () => {
    await Promise.all([controller.query('rollback'), worker.query('rollback')]);
    await controller.query('truncate users cascade; truncate riot_auth_flows');
    await controller.query(`insert into users(id, account_name, name, password_hash)
      values ($1,'original','Original','password-hash'),($2,'other','Other','other-hash')`, [USER, OTHER]);
    await controller.query(`insert into sessions(user_id,token_hash,expires_at)
      values ($1,$3,now()+interval '1 day'),($2,$4,now()+interval '1 day')`, [USER, OTHER, hash('a'), hash('b')]);
    state.client = worker;
  });

  afterAll(async () => {
    await Promise.allSettled([controller?.query('rollback'), worker?.query('rollback')]);
    await Promise.allSettled([controller?.end(), worker?.end(), observer?.end()]);
  });

  async function blocked() {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const result = await observer.query(`select wait_event_type = 'Lock' and cardinality(pg_blocking_pids(pid)) > 0 as blocked
        from pg_stat_activity where pid = $1`, [workerPid]);
      if (result.rows[0]?.blocked) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected a real PostgreSQL row/index-lock wait between independent connections.');
  }

  async function unlink(client: Client = worker) {
    return (await client.query('select unlink_riot_identity($1,$2,$3) as unlinked', [USER, 'password-hash', hash('a')])).rows[0].unlinked;
  }

  async function linked() {
    await controller.query('insert into riot_identities(user_id,puuid) values($1,$2)', [USER, identity.puuid]);
  }

  async function riotSession() {
    return createSession({ userId: USER, context: context(), request, riotIdentity: { puuid: identity.puuid, revision: 0 } });
  }

  it('rejects a login already waiting when unlink advances the revision', async () => {
    await linked();
    await controller.query('begin');
    expect(await unlink(controller)).toBe(true);
    const login = settle(riotSession());
    await blocked();
    await controller.query('commit');
    expect(await login).toMatchObject({ error: { code: 'RIOT_ACCOUNT_CHANGED' } });
    expect((await observer.query('select count(*)::integer as count from sessions where user_id=$1', [USER])).rows[0].count).toBe(1);
  });

  it('revokes a newly committed Riot session when unlink was waiting behind its user lock', async () => {
    await linked();
    await controller.query('begin');
    state.client = controller;
    await riotSession();
    const removal = settle(unlink());
    await blocked();
    await controller.query('commit');
    expect(await removal).toEqual({ value: true });
    expect((await observer.query(`select token_hash=$2 as current, revoked_at is not null as revoked
      from sessions where user_id=$1 order by current desc`, [USER, hash('a')])).rows)
      .toEqual([{ current: true, revoked: false }, { current: false, revoked: true }]);
  });

  it('rejects a pending link after unlink wins the user lock', async () => {
    await controller.query('begin');
    expect(await unlink(controller)).toBe(true);
    const link = settle(linkRiotIdentity(pending(), identity));
    await blocked();
    await controller.query('commit');
    expect(await link).toEqual({ value: false });
    expect((await observer.query('select * from riot_identities')).rows).toEqual([]);
  });

  it('removes a link committed while unlink was waiting', async () => {
    await controller.query('begin');
    state.client = controller;
    expect(await linkRiotIdentity(pending(), identity)).toBe(true);
    const removal = settle(unlink());
    await blocked();
    await controller.query('commit');
    expect(await removal).toEqual({ value: true });
    expect((await observer.query('select * from riot_identities')).rows).toEqual([]);
  });

  it('revalidates the link session after waiting on a user lock instead of trusting an old statement snapshot', async () => {
    await controller.query('begin');
    await controller.query('select id from users where id=$1 for update', [USER]);
    await controller.query('update sessions set revoked_at=now() where token_hash=$1', [hash('a')]);
    const link = settle(linkRiotIdentity(pending(), identity));
    await blocked();
    await controller.query('commit');
    expect(await link).toEqual({ value: false });
    expect((await observer.query('select * from riot_identities')).rows).toEqual([]);
  });

  it('revalidates the unlink session after a concurrent logout holding its session lock commits', async () => {
    await linked();
    await controller.query('begin');
    await controller.query('update sessions set revoked_at=now() where token_hash=$1', [hash('a')]);
    const removal = settle(unlink());
    await blocked();
    await controller.query('commit');
    expect(await removal).toEqual({ value: false });
    expect((await observer.query('select riot_link_revision from users where id=$1', [USER])).rows[0].riot_link_revision).toBe('0');
    expect((await observer.query('select puuid from riot_identities')).rows).toEqual([{ puuid: identity.puuid }]);
  });

  it('rejects link when its session expires while waiting for a session locker that rolls back', async () => {
    await controller.query("update sessions set expires_at=now()+interval '250 milliseconds' where token_hash=$1", [hash('a')]);
    await controller.query('begin');
    await controller.query('select token_hash from sessions where token_hash=$1 for update', [hash('a')]);
    const link = settle(linkRiotIdentity(pending(), identity));
    await blocked();
    await observer.query('select pg_sleep(0.35)');
    await controller.query('rollback');
    expect(await link).toEqual({ value: false });
    expect((await observer.query('select * from riot_identities')).rows).toEqual([]);
  });

  it('rejects unlink when its session expires while waiting for a session locker that rolls back', async () => {
    await linked();
    await controller.query("update sessions set expires_at=now()+interval '250 milliseconds' where token_hash=$1", [hash('a')]);
    await controller.query('begin');
    await controller.query('select token_hash from sessions where token_hash=$1 for update', [hash('a')]);
    const removal = settle(unlink());
    await blocked();
    await observer.query('select pg_sleep(0.35)');
    await controller.query('rollback');
    expect(await removal).toEqual({ value: false });
    expect((await observer.query('select riot_link_revision from users where id=$1', [USER])).rows[0].riot_link_revision).toBe('0');
    expect((await observer.query('select puuid from riot_identities')).rows).toEqual([{ puuid: identity.puuid }]);
  });

  it('lets only one NXT5 account claim a PUUID even while the winning insertion is uncommitted', async () => {
    await controller.query('begin');
    state.client = controller;
    expect(await linkRiotIdentity(pending(), identity)).toBe(true);
    state.client = worker;
    const second = settle(linkRiotIdentity(pending(OTHER), identity));
    await blocked();
    await controller.query('commit');
    expect(await second).toMatchObject({ error: { code: '23505' } });
    expect((await observer.query('select user_id,puuid from riot_identities')).rows).toEqual([{ user_id: USER, puuid: identity.puuid }]);
  });

  it('does not replace another PUUID linked to the same user during lock contention', async () => {
    await controller.query('begin');
    state.client = controller;
    expect(await linkRiotIdentity(pending(), identity)).toBe(true);
    state.client = worker;
    const second = settle(linkRiotIdentity(pending(), { ...identity, puuid: 'different-riot-puuid' }));
    await blocked();
    await controller.query('commit');
    expect(await second).toEqual({ value: false });
    expect((await observer.query('select puuid from riot_identities')).rows).toEqual([{ puuid: identity.puuid }]);
  });

  it('gives the nonce and verifier to only one callback across two database connections', async () => {
    const rawState = 's'.repeat(43); const browser = 'b'.repeat(43);
    await controller.query(`insert into riot_auth_flows(state_hash,browser_hash,flow,nonce,code_verifier,expires_at)
      values ($1,$2,'login',$3,$4,now()+interval '5 minutes')`, [sha256(rawState), sha256(browser), 'N'.repeat(43), 'V'.repeat(43)]);
    await controller.query('begin');
    state.client = controller;
    expect(await consumeRiotFlow(rawState, browser)).toMatchObject({ flow: 'login' });
    state.client = worker;
    const replay = settle(consumeRiotFlow(rawState, browser));
    await blocked();
    await controller.query('commit');
    expect(await replay).toEqual({ value: null });
  });

  it('rejects state expiring during a row-lock wait even when the locker rolls back without changing the row', async () => {
    const rawState = 's'.repeat(43); const browser = 'b'.repeat(43);
    await controller.query(`insert into riot_auth_flows(state_hash,browser_hash,flow,nonce,code_verifier,expires_at)
      values ($1,$2,'login',$3,$4,now()+interval '250 milliseconds')`, [sha256(rawState), sha256(browser), 'N'.repeat(43), 'V'.repeat(43)]);
    await controller.query('begin');
    await controller.query('select state_hash from riot_auth_flows where state_hash=$1 for update', [sha256(rawState)]);
    const callback = settle(consumeRiotFlow(rawState, browser));
    await blocked();
    await observer.query('select pg_sleep(0.35)');
    await controller.query('rollback');
    expect(await callback).toEqual({ value: null });
    expect((await observer.query('select * from riot_auth_flows')).rows).toEqual([]);
  });
});
