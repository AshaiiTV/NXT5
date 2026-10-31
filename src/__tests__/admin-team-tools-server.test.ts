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
describe('platform team and profile administration',()=>{
  it('refuses non-admins before reading any data and rejects cross-site mutations',async()=>{
    for(const query of ['', '?teamId='+teamId]) {
      state.admin.mockRejectedValueOnce(Object.assign(new Error('Forbidden'),{status:403}));state.calls=0;
      expect((await invoke(query)).status).toBe(403);expect(state.calls).toBe(0);
    }
    const req=new Request(request('',{action:'team-delete'}),{headers:{Origin:'https://evil.example','Content-Type':'application/json'}});
    expect((await tools(req,{} as any)).status).toBe(403);
  });
  it('searches all teams and applies operational filters without credentials or invitations',async()=>{
    const d=await (await invoke('?q=Alpha')).json();expect(d.rows.map((r:any)=>r.id)).toEqual([teamId]);
    expect((await (await invoke('?filter=never')).json()).rows.map((r:any)=>r.id)).toEqual([otherTeam]);
    expect((await (await invoke('?q=100%25')).json()).rows).toEqual([]);
    expect(JSON.stringify(await detail())).not.toMatch(/PRIVATE|invite_code|password_hash|token_hash/);
  });
  it('reads actual members, profiles, match participants and bounded profile data',async()=>{
    const members=await (await invoke('?teamId='+teamId+'&view=members')).json();
    expect(members.rows.find((r:any)=>r.id===ownerId).role).toBe('owner');
    const matches=await (await invoke('?teamId='+teamId+'&view=matches')).json();expect(matches.rows[0].participants[0].champion).toBe('Ahri');
    const d=await profile();expect(d.profile).toMatchObject({user_id:memberId,team_id:teamId});expect(d.pool).toHaveLength(1);expect(d.goals).toHaveLength(1);expect(d.matches).toHaveLength(1);
    for(const view of ['reports','compositions','planning','goals','drafts'])expect((await invoke('?teamId='+teamId+'&view='+view)).status).toBe(200);
  });
  it('returns the ordered starting roster independently of profile searches, pages and sections',async()=>{
    for(const role of ['SUP','ADC','TOP','JGL'])await rows("insert into players(team_id,name,role,riot_id,opgg_url) values($1,$2,$3,$4,$5)",[teamId,role,role,role+'#TEST','https://www.op.gg/lol/summoners/euw/'+role+'-TEST']);
    for(const [name,role,status] of [['Substitute','TOP','SUB'],['Inactive','MID','INACTIVE'],['Staff','COACH','MAIN'],['Legacy sub','SUB','MAIN']])await rows("insert into players(team_id,name,role,roster_status,riot_id) values($1,$2,$3,$4,$5)",[teamId,name,role,status,name+'#TEST']);
    await rows("insert into players(team_id,name,role,riot_id) values($1,'Other team player','TOP','Other#TEST')",[otherTeam]);
    const list=await (await invoke('?q=Alpha')).json(),roster=list.rows[0].mainRoster;
    expect(roster.map((p:any)=>p.role)).toEqual(['TOP','JGL','MID','ADC','SUP']);
    expect(roster.find((p:any)=>p.id===profileId)).toEqual({id:profileId,name:'Player',role:'MID',riot_id:'Player#TEST',opgg_url:null,roster_status:'MAIN'});
    expect(roster[0].opgg_url).toBe('https://www.op.gg/lol/summoners/euw/TOP-TEST');
    for(const view of ['profiles','members','matches']) {
      const dossier=await (await invoke('?teamId='+teamId+'&view='+view+'&q=no-match&page=2')).json();
      expect(dossier.rows).toEqual([]);
      expect(dossier.team.mainRoster).toEqual(roster);
    }
    const other=await (await invoke('?teamId='+otherTeam)).json();
    expect(other.team.mainRoster.map((p:any)=>p.riot_id)).toEqual(['Other#TEST']);
  });
  it('returns an empty roster for teams without starters and retains missing Riot IDs',async()=>{
    const list=await (await invoke('?q=Other')).json();
    expect(list.rows[0].mainRoster).toEqual([]);
    expect((await (await invoke('?teamId='+otherTeam)).json()).team.mainRoster).toEqual([]);
    await rows('update players set riot_id=null where id=$1',[profileId]);
    expect((await detail()).team.mainRoster).toEqual([{id:profileId,name:'Player',role:'MID',riot_id:null,opgg_url:null,roster_status:'MAIN'}]);
  });
  it('edits team identity exactly once and rejects stale and concurrent edits',async()=>{
    const edit=await body('team-update',{name:'Updated',tag:'UPD',region:'EUW'});
    const results=await Promise.all([invoke('',edit),invoke('',{...edit,name:'Other update'})]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(await rows('select * from audit_logs')).toHaveLength(1);
  });
  it('edits a profile, updates pool labels and rejects cross-team or stale requests',async()=>{
    const edit=await profileBody('profile-update',{name:'Renamed',role:'MID',rosterStatus:'SUB',riotId:'New#TEST'});
    expect((await invoke('',{...edit,teamId:otherTeam,expectedTeamRevision:(await rows('select xmin::text as revision from teams where id=$1',[otherTeam]))[0].revision})).status).toBe(409);
    expect((await invoke('',edit)).status).toBe(200);expect((await invoke('',edit)).status).toBe(409);
    expect((await rows('select player_name from champion_pool'))[0].player_name).toBe('Renamed');
    expect((await profile()).profile).toMatchObject({name:'Renamed',roster_status:'SUB',riot_id:'New#TEST'});
  });
  it('never demotes a different main profile implicitly',async()=>{
    await rows("insert into players(team_id,name,role,riot_id) values($1,'Top','TOP','Top#TEST')",[teamId]);
    const edit=await profileBody('profile-update',{name:'Player',role:'TOP',rosterStatus:'MAIN',riotId:'Player#TEST'});
    expect((await invoke('',edit)).status).toBe(409);expect((await profile()).profile.role).toBe('MID');expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
  it('unlinks a profile without removing team membership',async()=>{
    expect((await invoke('',await profileBody('profile-unlink'))).status).toBe(200);
    expect((await profile()).profile.user_id).toBeNull();expect(await rows('select * from team_members')).toHaveLength(2);
  });
  it('changes a member role and removes only that team access and its profile links',async()=>{
    expect((await invoke('',await memberBody('member-role',{role:'analyst'}))).status).toBe(200);
    expect((await invoke('',await memberBody('member-remove'))).status).toBe(200);
    expect((await profile()).profile.user_id).toBeNull();expect(await rows('select team_id,role from team_members')).toEqual([{team_id:otherTeam,role:'coach'}]);
  });
  it('protects the owner and the acting administrator access',async()=>{
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'captain'),($1,$3,'captain')",[teamId,ownerId,adminId]);
    for(const userId of [ownerId,adminId]){const rev=(await rows('select xmin::text as revision from team_members where team_id=$1 and user_id=$2',[teamId,userId]))[0].revision;
      expect([400,409]).toContain((await invoke('',await body('member-remove',{userId,expectedRevision:rev}))).status);}
  });
  it('requires an exact deletion name and a current inventory, then cascades atomically without deleting accounts',async()=>{
    const d=await detail(),remove=await body('team-delete',{confirmName:'Alpha',expectedCounts:d.counts});
    expect((await invoke('',{...remove,confirmName:'Wrong'})).status).toBe(409);
    await rows("insert into reports(team_id,title,content) values($1,'New report','Private content')",[teamId]);
    expect((await invoke('',remove)).status).toBe(409);
    expect((await invoke('',{...remove,expectedCounts:(await detail()).counts})).status).toBe(200);
    expect(await rows('select id from teams')).toEqual([{id:otherTeam}]);expect(await rows('select id from users')).toHaveLength(3);
    for(const table of ['players','matches','match_participants','reports','champion_pool','player_goals'])expect(await rows('select * from '+table)).toHaveLength(0);
    expect((await invoke('',remove)).status).toBe(409);expect(await rows("select * from audit_logs where action='admin.team.delete'")).toHaveLength(1);
  });
  it('deletes a profile while keeping matches, participants and accounts',async()=>{
    expect((await invoke('',await profileBody('profile-delete',{confirmName:'Player'}))).status).toBe(200);
    expect(await rows('select * from players')).toHaveLength(0);expect(await rows('select * from matches')).toHaveLength(1);
    expect((await rows('select player_id from match_participants'))[0].player_id).toBeNull();expect(await rows('select * from users')).toHaveLength(3);
  });
  it('blocks cascading deletes in previews',async()=>{
    const remove=await body('team-delete',{confirmName:'Alpha',expectedCounts:(await detail()).counts});
    expect((await invoke('',remove,{deploy:{context:'deploy-preview'}})).status).toBe(409);expect((await detail()).team.id).toBe(teamId);
  });
  it.each(['session','email'])('rechecks live administrator rights before writing (%s)',async condition=>{
    const edit=await body('team-update',{name:'Blocked',tag:'NO',region:'EUW'});
    state.before=()=>condition==='session' ? rows('update sessions set revoked_at=now() where id=$1',[sessionId]):rows("update users set email='changed@test.example' where id=$1",[adminId]);
    expect((await invoke('',edit)).status).toBe(403);expect((await detail()).team.name).toBe('Alpha');expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
  it('rolls back destructive cascades when the audit fails',async()=>{
    const remove=await body('team-delete',{confirmName:'Alpha',expectedCounts:(await detail()).counts});
    await state.db.exec("alter table audit_logs add constraint fail_admin_audit check(action<>'admin.team.delete')");
    try {expect((await invoke('',remove)).status).toBe(500);expect((await detail()).counts).toMatchObject({matches:1,profiles:1});}
    finally{await state.db.exec('alter table audit_logs drop constraint fail_admin_audit');}
  });
});
