import {readFileSync} from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';

const state=vi.hoisted(()=>({ db:null as any,admin:vi.fn(),before:null as null | (()=>Promise<void>),calls:0 }));
vi.mock('../../netlify/functions/_lib/platform-admin',()=>({requirePlatformAdmin:state.admin}));
vi.mock('../../netlify/functions/_lib/safe-log',()=>({logFailure:vi.fn()}));
vi.mock('../../netlify/functions/_lib/riot',()=>({getChampionDataMap:async()=>new Map(['Ahri','Jinx','Vi','Ornn','Rakan','Azir','Ashe','Lux','Sona','Zed','Leblanc'].map((id,i)=>[i+1,{id,name:id}]))}));
vi.mock('../../netlify/functions/_lib/db',()=>{
  const statement=(parts:TemplateStringsArray,...values:unknown[])=>({text:parts.reduce((s,p,i)=>s+(i ? '$'+i:'')+p,''),values});
  const query:any=async(parts:TemplateStringsArray,...values:unknown[])=>{
    state.calls++;const before=state.before;state.before=null;await before?.();
    const q=statement(parts,...values);return (await state.db.query(q.text,q.values)).rows;
  };
  query.transaction=async(callback:any)=>{
    state.calls++;const before=state.before;state.before=null;await before?.();
    return state.db.transaction(async(tx:any)=>{
      const rows=[];for(const q of callback(statement))rows.push((await tx.query(q.text,q.values)).rows);return rows;
    });
  };
  return {sql:query};
});

vi.mock('../../netlify/functions/_lib/migrations',()=>({assertSchemaReady:async()=>{}}));
import handler from '../../netlify/functions/admin-account-lifecycle';
import {createSession,requireAuth,sha256} from '../../netlify/functions/_lib/auth';
const admin='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003';
const rows=async(q:string,v:any[]=[]) => (await state.db.query(q,v)).rows;
const context={deploy:{context:'production'},cookies:{get:()=> 'token',set:vi.fn()}} as any;
const req=(body?:any)=>new Request('https://nxt5.org/.netlify/functions/admin-account-lifecycle?userId='+user,{method:body?'POST':'GET',headers:{Origin:'https://nxt5.org','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const snapshot=async()=>await(await handler(req(),context)).json();
const act=async(action:string,extra:any={})=>{const d=await snapshot();return handler(req({action,userId:user,confirmAccount:'player',expectedRevision:d.account.revision,expectedOwnedTeams:d.ownedTeams,...(action==='resume' ? {}:{reason:'Motif de test'}),...extra}),context);};
beforeAll(async()=>{state.db=new PGlite();await state.db.exec(readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','').replaceAll('gen_random_bytes(5)',"decode('0000000000','hex')"));await state.db.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql',import.meta.url),'utf8'));},20000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{state.admin.mockReset().mockResolvedValue({id:admin,email:'admin@example.test',session_id:session});state.before=null;
 await state.db.exec('truncate users cascade; truncate audit_logs;');
 await rows("insert into users(id,name,account_name,password_hash,email,email_verified) values($1,'Admin','admin','hash','admin@example.test',true),($2,'Player','player','hash','player@example.test',true)",[admin,user]);
 await rows("insert into sessions(id,user_id,token_hash,expires_at) values($1,$2,'admin-token',now()+interval '1 day'),(gen_random_uuid(),$3,$4,now()+interval '1 day')",[session,admin,user,sha256('token')]);
 await rows("insert into teams(owner_id,name,tag) values($1,'Owned team','OWN'),($2,'Shared team','SHR')",[user,admin]);
 await rows("insert into players(team_id,user_id,name,role) select id,$1,'Linked player','COACH' from teams",[user]);
});
it('suspends, revokes sessions, refuses replay and resumes without restoring sessions',async()=>{
 const d=await snapshot();const body={action:'suspend',userId:user,confirmAccount:'player',expectedRevision:d.account.revision,reason:'Abus signalé'};
 expect((await handler(req(body),context)).status).toBe(200);expect((await handler(req(body),context)).status).toBe(409);
 expect((await snapshot()).account.suspended_at).not.toBeNull();expect(await rows('select id from sessions where user_id=$1 and revoked_at is null',[user])).toHaveLength(0);
 expect((await act('resume')).status).toBe(200);expect((await snapshot()).account.suspended_at).toBeNull();expect(await rows('select id from sessions where user_id=$1 and revoked_at is null',[user])).toHaveLength(0);
});
it('blocks new sessions at the database boundary and rejects existing cookies',async()=>{
 await act('suspend');
 await expect(createSession({userId:user,request:req(),context,expectedPasswordHash:'hash'})).rejects.toMatchObject({status:403,code:'ACCOUNT_SUSPENDED'});
 await expect(createSession({userId:user,request:req(),context})).rejects.toMatchObject({status:403});
 await rows('update sessions set revoked_at=null where user_id=$1',[user]);
 await expect(requireAuth(req(),context)).rejects.toMatchObject({status:401});
});
it('deletes the login, owned teams and sessions but preserves shared teams with unlinked profiles',async()=>{
 expect((await act('delete')).status).toBe(200);
 expect(await rows('select id from users where id=$1',[user])).toHaveLength(0);
 expect(await rows('select id from sessions where user_id=$1',[user])).toHaveLength(0);
 expect(await rows('select name from teams')).toEqual([{name:'Shared team'}]);
 expect(await rows('select user_id from players')).toEqual([{user_id:null}]);
 expect(await rows("select id from audit_logs where action='admin.account.delete'")).toHaveLength(1);
});
it('refuses clearly to suspend or resume a self-deleted account, still allows deleting its row',async()=>{
 await rows("delete from teams where owner_id=$1",[user]);
 await rows("update users set deleted_at=now(),name='Compte supprimé' where id=$1",[user]);
 for(const action of ['suspend','resume']){const response=await act(action);expect(response.status).toBe(409);expect((await response.json()).error).toContain('supprimé');}
 expect((await act('delete')).status).toBe(200);
});
it('requires the exact account identifier and current inventory',async()=>{
 expect((await act('delete',{confirmAccount:'wrong'})).status).toBe(409);
 const d=await snapshot();await rows("insert into teams(owner_id,name,tag) values($1,'New team','NEW')",[user]);
 expect((await act('delete',{expectedOwnedTeams:d.ownedTeams})).status).toBe(409);
});
it('rolls back deletion and cascades when audit fails',async()=>{
 await state.db.exec("alter table audit_logs add constraint fail_audit check(action<>'admin.account.delete')");
 try{expect((await act('delete')).status).toBe(500);expect((await snapshot()).ownedTeams).toHaveLength(1);}finally{await state.db.exec('alter table audit_logs drop constraint fail_audit');}
});
it('protects the acting admin and rechecks revoked administrator rights',async()=>{
 expect((await handler(new Request('https://nxt5.org/?userId='+admin.toUpperCase()),context)).status).toBe(403);
 const d=await snapshot();state.before=()=>rows('update sessions set revoked_at=now() where id=$1',[session]);
 expect((await handler(req({userId:user,action:'suspend',confirmAccount:'player',expectedRevision:d.account.revision,reason:'Motif de test'}),context)).status).toBe(403);
});
it('blocks cross-site writes and cascading deletes in previews',async()=>{
 expect((await handler(new Request(req({}),{headers:{Origin:'https://evil.example','Content-Type':'application/json'}}),context)).status).toBe(403);
 const d=await snapshot();expect((await handler(req({userId:user,action:'delete',confirmAccount:'player',expectedRevision:d.account.revision,expectedOwnedTeams:d.ownedTeams,reason:'Motif de test'}),{deploy:{context:'deploy-preview'}} as any)).status).toBe(409);
});

it('protects administrator UUIDs regardless of letter case',async()=>{
 const id='abcdefab-abcd-abcd-abcd-abcdefabcdef';
 state.admin.mockResolvedValue({id,email:'admin@example.test',session_id:session});
 expect((await handler(new Request('https://nxt5.org/?userId='+id.toUpperCase()),context)).status).toBe(403);
});

it('requires a bounded reason to suspend or delete and writes nothing without it',async()=>{
 for(const action of ['suspend','delete'])for(const reason of [undefined,'','  abc ','x'.repeat(501),'Motif\u0000caché']){
  expect((await act(action,{reason})).status).toBe(400);
 }
 expect((await snapshot()).account.suspended_at).toBeNull();expect(await rows('select id from audit_logs')).toHaveLength(0);
});
it('records the account, masked e-mail, reason and validated inventory in the audit trail',async()=>{
 expect((await act('suspend',{reason:'  Abus répété  '})).status).toBe(200);
 expect((await act('resume')).status).toBe(200);
 const d=await snapshot();
 expect((await act('delete',{reason:'Demande RGPD',expectedOwnedTeams:d.ownedTeams.map((team:any)=>({...team,extra:'ignored'}))})).status).toBe(409);
 expect((await act('delete',{reason:'Demande RGPD'})).status).toBe(200);
 const logs=await rows('select action,metadata from audit_logs order by created_at,action');
 expect(logs.map((row:any)=>row.action)).toEqual(['admin.account.suspend','admin.account.resume','admin.account.delete']);
 expect(logs[0].metadata).toEqual({accountName:'player',accountEmailMasked:'p***@example.test',reason:'Abus répété'});
 expect(logs[1].metadata).toEqual({accountName:'player',accountEmailMasked:'p***@example.test',reason:null});
 expect(logs[2].metadata).toEqual({accountName:'player',accountEmailMasked:'p***@example.test',reason:'Demande RGPD',ownedTeams:[{id:d.ownedTeams[0].id,name:'Owned team',profiles:1,matches:0}]});
 expect(JSON.stringify(logs)).not.toContain('player@example.test');
});

it('reports a Nexus registration created during the account deletion with the Nexus reason',async()=>{
 const d=await snapshot();
 const team=(await rows('select id from teams where owner_id=$1',[user]))[0].id;
 // Hooks run before the pre-check, the account read, then the transaction.
 state.before=async()=>{state.before=async()=>{state.before=async()=>{
  await rows("insert into nexus_seasons(id,name,status) values('00000000-0000-4000-8000-000000000009','S','running')");
  await rows("insert into nexus_registrations(season_id,team_id,status) values('00000000-0000-4000-8000-000000000009',$1,'approved')",[team]);
 };};};
 const response=await handler(req({action:'delete',userId:user,confirmAccount:'player',expectedRevision:d.account.revision,expectedOwnedTeams:d.ownedTeams,reason:'Demande RGPD'}),context);
 expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'NEXUS_TEAM_ENGAGED'});
 expect(await rows('select id from users where id=$1',[user])).toHaveLength(1);
 await state.db.exec('truncate nexus_seasons cascade');
});
