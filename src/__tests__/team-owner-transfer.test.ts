import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';

const state=vi.hoisted(()=>({ db:null as any,admin:vi.fn(),before:null as null | (()=>Promise<void>),calls:0 }));
vi.mock('../../netlify/functions/_lib/platform-admin',()=>({requirePlatformAdmin:state.admin}));
vi.mock('../../netlify/functions/_lib/safe-log',()=>({logFailure:vi.fn()}));

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
import tools from '../../netlify/functions/admin-team-tools';
import transfer from '../../netlify/functions/admin-team-transfer';
import lifecycle from '../../netlify/functions/admin-account-lifecycle';
const adminId='00000000-0000-4000-8000-000000000001',ownerId='00000000-0000-4000-8000-000000000002',memberId='00000000-0000-4000-8000-000000000003';
const teamId='00000000-0000-4000-8000-000000000004',otherTeam='00000000-0000-4000-8000-000000000005',profileId='00000000-0000-4000-8000-000000000006',sessionId='00000000-0000-4000-8000-000000000007';
const rows=async(query:string,values:any[]=[]) => (await state.db.query(query,values)).rows;
const request=(query='',body?:any)=>new Request('https://nxt5.org/.netlify/functions/admin-team-tools'+query,{method:body ? 'POST':'GET',headers:{Origin:'https://nxt5.org','Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)}:{})});
const invoke=(query='',body?:any,context:any={deploy:{context:'production'}})=>tools(request(query,body),context);
const detail=async()=>await (await invoke('?teamId='+teamId)).json();
const profile=async()=>await (await invoke('?profileId='+profileId)).json();
async function body(action:string,extra:any={}) {const d=await detail();return {action,teamId,expectedTeamRevision:d.team.revision,...extra};}
async function memberBody(action:string,extra:any={}) {const member=(await (await invoke('?teamId='+teamId+'&view=members')).json()).rows.find((r:any)=>r.id===memberId);return body(action,{userId:memberId,expectedRevision:member.revision,...extra});}
async function profileBody(action:string,extra:any={}) {const d=await profile();return body(action,{profileId,expectedRevision:d.profile.revision,...extra});}
beforeAll(async()=>{
  state.db=new PGlite();
  await state.db.exec(readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','').replaceAll('gen_random_bytes(5)',"decode('0000000000','hex')"));
  await state.db.exec(readFileSync(new URL('../../database/migrations/20260906_runtime_schema.sql',import.meta.url),'utf8'));
  await state.db.exec(`create table discord_team_events(id uuid default gen_random_uuid(),team_id uuid references teams on delete cascade,title text,event_type text,starts_at timestamptz,duration_minutes int,details text,status text);
    create table opponent_drafts(id uuid default gen_random_uuid(),team_id uuid references teams on delete cascade,source_id text,game_number int,snapshot jsonb,imported_at timestamptz default now());`);
},20000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
  state.before=null;state.admin.mockReset().mockResolvedValue({id:adminId,email:'admin@test.example',session_id:sessionId});state.calls=0;
  await state.db.exec('truncate users cascade; truncate audit_logs;');
  for(const [id,name] of [[adminId,'Admin'],[ownerId,'Owner'],[memberId,'Member']])await rows('insert into users(id,name,account_name,password_hash,email) values($1,$2,$2,\'PRIVATE_HASH\',$3)',[id,name,name.toLowerCase()+'@test.example']);
  await rows("insert into sessions(id,user_id,token_hash,expires_at) values($1,$2,'PRIVATE_TOKEN',now()+interval '1 day')",[sessionId,adminId]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$2,'Alpha','ALP'),($3,$2,'Other','OTH')",[teamId,ownerId,otherTeam]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'player'),($3,$2,'coach')",[teamId,memberId,otherTeam]);
  await rows("insert into players(id,team_id,user_id,name,role,riot_id) values($1,$2,$3,'Player','MID','Player#TEST')",[profileId,teamId,memberId]);
  await rows("insert into champion_pool(team_id,player_id,player_name,champion,games,wins) values($1,$2,'Player','Ahri',3,2)",[teamId,profileId]);
  await rows("insert into player_goals(team_id,player_id,title,metric,target_value) values($1,$2,'Farm','cs',8)",[teamId,profileId]);
  await rows("insert into matches(team_id,game_id,opponent) values($1,'EUW1_123','Orion')",[teamId]);
  await rows("insert into match_participants(match_id,player_id,team_key,champion) select id,$1,'ALLY','Ahri' from matches where team_id=$2",[profileId,teamId]);
});
beforeEach(async()=>{await rows('update users set email_verified=true');});
const transferRequest=(data:any)=>new Request('https://nxt5.org/.netlify/functions/admin-team-transfer',{method:'POST',headers:{Origin:'https://nxt5.org','Content-Type':'application/json'},body:JSON.stringify(data)});
async function transferBody(){return {teamId,expectedOwnerId:ownerId,newOwnerId:memberId,confirmName:'Alpha',expectedTeamRevision:(await detail()).team.revision,expectedNewOwnerRevision:(await rows('select xmin::text as revision from users where id=$1',[memberId]))[0].revision};}
const change=(data:any)=>transfer(transferRequest(data),{} as any);
const accountRequest=(data?:any)=>new Request('https://nxt5.org/?userId='+ownerId,{method:data?'POST':'GET',headers:{Origin:'https://nxt5.org','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
const oldAccount=async()=>await(await lifecycle(accountRequest(),{} as any)).json();
it('transfers ownership and memberships without changing any team content',async()=>{
 const before=await rows('select * from matches');const profiles=await rows('select * from players');
 expect((await change(await transferBody())).status).toBe(200);
 expect((await detail()).team.owner_id).toBe(memberId);expect(await rows('select * from matches')).toEqual(before);expect(await rows('select * from players')).toEqual(profiles);
 expect((await rows('select role from team_members where team_id=$1 and user_id=$2',[teamId,memberId]))[0].role).toBe('captain');
 expect((await rows('select role from team_members where team_id=$1 and user_id=$2',[teamId,ownerId]))[0].role).toBe('player');
 expect(await rows("select * from audit_logs where action='admin.team.transfer'")).toHaveLength(1);
});
it('keeps a transferred team and its content when deleting its previous owner, and rejects an old deletion inventory',async()=>{
 await rows('update players set user_id=$1 where id=$2',[ownerId,profileId]);
 const old=await oldAccount();expect((await change(await transferBody())).status).toBe(200);
 const deletion={action:'delete',userId:ownerId,confirmAccount:'Owner',expectedRevision:old.account.revision,expectedOwnedTeams:old.ownedTeams};
 expect((await lifecycle(accountRequest(deletion),{deploy:{context:'production'}} as any)).status).toBe(409);
 const fresh=await oldAccount();expect(fresh.ownedTeams.map((t:any)=>t.id)).toEqual([otherTeam]);
 expect((await lifecycle(accountRequest({...deletion,expectedRevision:fresh.account.revision,expectedOwnedTeams:fresh.ownedTeams}),{deploy:{context:'production'}} as any)).status).toBe(200);
 expect((await detail()).team.owner_id).toBe(memberId);expect(await rows('select * from matches')).toHaveLength(1);expect(await rows('select * from player_goals')).toHaveLength(1);expect(await rows('select * from champion_pool')).toHaveLength(1);
 expect((await rows('select user_id from players where id=$1',[profileId]))[0].user_id).toBeNull();
});
it('supports a recipient who is not already a member and rejects repeated or concurrent transfers',async()=>{
 await rows('delete from team_members where user_id=$1',[memberId]);const data=await transferBody();
 const results=await Promise.all([change(data),change(data)]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
 expect((await rows('select role from team_members where team_id=$1 and user_id=$2',[teamId,memberId]))[0].role).toBe('captain');
});
it.each(['suspended','unverified','deleted'])('rejects a recipient changed during confirmation: %s',async condition=>{
 const data=await transferBody();
 if(condition==='suspended')await rows('update users set suspended_at=now() where id=$1',[memberId]);
 if(condition==='unverified')await rows('update users set email_verified=false where id=$1',[memberId]);
 if(condition==='deleted')await rows('delete from users where id=$1',[memberId]);
 expect((await change(data)).status).toBe(409);expect((await detail()).team.owner_id).toBe(ownerId);
});
it('rolls back a naming conflict and an audit failure',async()=>{
 await rows("insert into teams(owner_id,name,tag) values($1,'Alpha','DUP')",[memberId]);expect((await change(await transferBody())).status).toBe(409);
 await rows('delete from teams where owner_id=$1',[memberId]);
 await state.db.exec("alter table audit_logs add constraint block_transfer check(action<>'admin.team.transfer')");
 try{expect((await change(await transferBody())).status).toBe(500);expect((await detail()).team.owner_id).toBe(ownerId);}finally{await state.db.exec('alter table audit_logs drop constraint block_transfer');}
});
it('refuses a wrong name, stale ownership, non-admin and revoked session',async()=>{
 expect((await change({...await transferBody(),confirmName:'Wrong'})).status).toBe(409);
 const data=await transferBody();state.before=()=>rows('update sessions set revoked_at=now() where id=$1',[sessionId]);expect((await change(data)).status).toBe(403);
 state.admin.mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));expect((await change(data)).status).toBe(403);
});
it('searches only eligible recipients and escapes wildcard searches',async()=>{
 const search=(q:string)=>transfer(new Request('https://nxt5.org/?teamId='+teamId+'&q='+encodeURIComponent(q)),{} as any);
 expect((await(await search('Member')).json()).rows.map((u:any)=>u.id)).toEqual([memberId]);
 expect((await(await search('Owner')).json()).rows).toEqual([]);expect((await(await search('%')).json()).rows).toEqual([]);
 await rows('update users set suspended_at=now() where id=$1',[memberId]);expect((await(await search('Member')).json()).rows).toEqual([]);
});
