import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, it, expect, vi } from 'vitest';
const state=vi.hoisted(()=>({pg:null as any,beforeQuery:null as any,send:vi.fn()}));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      await state.beforeQuery?.(statement.query);
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value === null || value === undefined) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          return value instanceof Date ? value.toISOString().replace('T',' ').replace('Z','+00') : String(value);
        })), rowCount: result.affectedRows ?? result.rows.length,
      };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, constraint: error.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@social-flows.invalid/nxt5') };
});

vi.mock('../../netlify/functions/_lib/auth',()=>({ensureEmailVerificationColumns:async()=>{}}));
vi.mock('../../netlify/functions/_lib/platform-admin',()=>({requirePlatformAdmin:async()=>({id:'admin'})}));
vi.mock('../../netlify/functions/_lib/email',()=>({sendInactivityReminderEmail:state.send}));
import reminders from '../../netlify/functions/inactivity-reminders';
import dashboard from '../../netlify/functions/admin-dashboard';
const user='91000000-0000-4000-8000-000000000001';
const rows=async(q:string,p:unknown[]=[]) => (await state.pg.query(q,p)).rows;
const run=()=>reminders(new Request('https://nxt5.org/reminders'));
beforeAll(async()=>{
  state.pg=new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','').replaceAll('gen_random_bytes(5)',"decode('0000000000','hex')"));
  for(const name of ['20260906_runtime_schema.sql','20260929_server_reminders.sql']) await state.pg.exec(readFileSync(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
},30000);
afterAll(async()=>state.pg?.close());
beforeEach(async()=>{
  state.beforeQuery=null;state.send.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade');
  await rows("insert into users(id,account_name,name,email,password_hash,email_verified,last_active_at,created_at) values($1,'inactive','Inactive','inactive@example.test','unused',true,now()-interval '100 days',now()-interval '120 days')",[user]);
});
it('counts recently active accounts after logout, expiry and session purge, with the same funnel',async()=>{
  await rows("update users set last_active_at=now()-interval '2 days' where id=$1",[user]);
  await rows("insert into sessions(user_id,token_hash,expires_at,revoked_at,last_seen_at) values($1,'expired',now()-interval '1 day',now()-interval '1 day',now()-interval '2 days')",[user]);
  for(const purge of [false,true]){
    if(purge)await rows('delete from sessions');
    const response=await dashboard(new Request('https://nxt5.org/admin-dashboard'),{} as any);
    expect(response.status).toBe(200);
    const data=await response.json();
    expect(data.activity).toMatchObject({activeUsers7d:1,activeUsers30d:1});
    expect(data.accountFunnel).toMatchObject({seen30d:1,returning30d:1});
    expect(data.weeklyActivityNote).toContain('ce n’est pas un historique complet des présences');
  }
  await rows("update users set last_active_at=now()-interval '20 days'");
  const data=await (await dashboard(new Request('https://nxt5.org/admin-dashboard'),{} as any)).json();
  expect(data.activity).toMatchObject({activeUsers7d:0,activeUsers30d:1});
});
it('reconciles a sent reminder after accounting fails without resending, even beyond one hour',async()=>{
  state.beforeQuery=async(q:string)=>{if(q.includes('insert into inactivity_reminder_deliveries')){state.beforeQuery=null;throw new Error('Accounting unavailable');}};
  expect((await run()).status).toBe(200);
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(await rows('select state from inactivity_reminder_pending')).toEqual([{state:'sent_pending'}]);
  expect(await rows('select * from inactivity_reminder_deliveries')).toHaveLength(0);
  await rows("update users set inactivity_email_claimed_at=now()-interval '2 days'");
  await run();await run();
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(await rows('select * from inactivity_reminder_deliveries')).toHaveLength(1);
  expect(await rows('select * from inactivity_reminder_pending')).toHaveLength(0);
  expect((await rows('select inactivity_notice_pending from users'))[0].inactivity_notice_pending).toBe(true);
});
it('retains ambiguous sending state if persisting the send receipt itself fails',async()=>{
  state.beforeQuery=async(q:string)=>{if(q.includes("set state='sent_pending'")){state.beforeQuery=null;throw new Error('Database down');}};
  await run();
  await rows("update users set inactivity_email_claimed_at=now()-interval '2 days'");
  await run();
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(await rows('select state from inactivity_reminder_pending')).toEqual([{state:'sending'}]);
});
it('retries explicit send rejection but never retries a network-ambiguous send',async()=>{
  state.send.mockRejectedValueOnce(Object.assign(new Error('Rejected'),{code:'EMAIL_DELIVERY_FAILED'}));
  expect((await run()).status).toBe(503);
  expect(await rows('select * from inactivity_reminder_pending')).toHaveLength(0);
  state.send.mockRejectedValueOnce(new Error('Connection reset'));
  await run();
  await rows("update users set inactivity_email_claimed_at=now()-interval '2 days'");
  await run();
  expect(state.send).toHaveBeenCalledTimes(2);
  expect(await rows('select state from inactivity_reminder_pending')).toEqual([{state:'sending'}]);
});
