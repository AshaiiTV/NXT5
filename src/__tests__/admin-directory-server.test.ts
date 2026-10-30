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
import directory from '../../netlify/functions/admin-directory';
import globalStats from '../../netlify/functions/admin-global-stats';

const adminId='00000000-0000-4000-8000-000000000001',userId='00000000-0000-4000-8000-000000000002';
const sessionId='00000000-0000-4000-8000-000000000003',teamId='00000000-0000-4000-8000-000000000004';
const gameId='00000000-0000-4000-8000-000000000005';
const request=(query='',body?:any)=>new Request('https://nxt5.org/.netlify/functions/admin-directory'+query,{method:body ? 'POST':'GET',headers:{Origin:'https://nxt5.org','Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)}:{})});
const rows=async(query:string,values:any[]=[]) => (await state.db.query(query,values)).rows;
const invoke=(query='',body?:any)=>directory(request(query,body),{} as any);
const revision=async()=>String((await rows('select xmin::text as revision from users where id=$1',[userId]))[0].revision);
beforeAll(async()=>{
  state.db=new PGlite();
  await state.db.exec(`
    create table users(id uuid primary key,name text,account_name text,email text,email_verified boolean,created_at timestamptz default now(),updated_at timestamptz default now(),last_active_at timestamptz);
    create table sessions(id uuid primary key,user_id uuid,token_hash text,expires_at timestamptz,revoked_at timestamptz);
    create table teams(id uuid primary key,name text,tag text,owner_id uuid);
    create table team_members(team_id uuid,user_id uuid,role text);
    create table players(id uuid primary key,team_id uuid,user_id uuid,name text,role text,riot_id text);
    create table audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb,created_at timestamptz default now());
    create table matches(id uuid primary key,team_id uuid,game_id text,region text,result text,patch text,raw jsonb,created_at timestamptz default (now()-interval '1 minute'));
    create table match_participants(id uuid primary key default gen_random_uuid(),match_id uuid,champion text,role text,team_key text,raw jsonb);
    create table opponent_drafts(id uuid primary key default gen_random_uuid(),team_id uuid,source_id text,game_number int,snapshot jsonb,imported_at timestamptz default (now()-interval '1 minute'));
  `);
});
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
  state.admin.mockReset().mockResolvedValue({id:adminId,email:"admin@test.example",session_id:sessionId});state.before=null;state.calls=0;
  await state.db.exec('truncate users,sessions,teams,team_members,players,audit_logs,matches,match_participants,opponent_drafts');
  await rows("insert into users(id,name,account_name,email,email_verified) values($1,'Admin','admin','admin@test.example',true),($2,'Player 100%','player','private@test.example',false)",[adminId,userId]);
  await rows("insert into sessions(id,user_id,expires_at,token_hash) values($1,$2,now()+interval '1 day','PRIVATE_TOKEN'),(gen_random_uuid(),$3,now()+interval '1 day','OTHER_PRIVATE_TOKEN')",[sessionId,adminId,userId]);
  await rows("insert into teams(id,name,tag,owner_id) values($1,'Private team','PVT',$2)",[teamId,userId]);
  await rows("insert into players(id,team_id,user_id,name,role,riot_id) values(gen_random_uuid(),$1,$2,'Private player','MID','Private#EUW')",[teamId,userId]);
});

describe('platform account administration',()=>{
  it('rejects non-admins before looking up any personal data',async()=>{
    state.admin.mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
    expect((await invoke('?q=private')).status).toBe(403);expect(state.calls).toBe(0);
  });
  it('searches exact wildcard characters and returns a private account dossier without credentials',async()=>{
    const listing=await (await invoke('?q=100%25')).json();expect(listing.rows).toHaveLength(1);
    const detail=await (await invoke('?userId='+userId)).json();
    expect(detail.account.active_sessions).toBe(1);expect(detail.teams[0].role).toBe('owner');expect(detail.profiles).toHaveLength(1);
    expect(JSON.stringify(detail)).not.toContain('PRIVATE_TOKEN');expect(detail.account).not.toHaveProperty('password_hash');
  });
  it('renames once and refuses replay of a stale account revision',async()=>{
    const body={action:'rename',userId,name:'Updated player',expectedRevision:await revision()};
    expect((await invoke('',body)).status).toBe(200);expect((await invoke('',body)).status).toBe(409);
    expect((await rows('select name from users where id=$1',[userId]))[0].name).toBe('Updated player');
    expect(await rows('select * from audit_logs')).toHaveLength(1);
  });
  it('revokes only the selected account sessions and makes duplicate retries harmless',async()=>{
    const body={action:'revoke-sessions',userId,expectedRevision:await revision()};
    expect(await (await invoke('',body)).json()).toMatchObject({revoked:1});
    expect((await invoke('',body)).status).toBe(409);
    expect((await rows('select revoked_at from sessions where id=$1',[sessionId]))[0].revoked_at).toBeNull();
    expect(await rows("select * from audit_logs where action='admin.sessions.revoke'")).toHaveLength(1);
  });
  it('fails closed if the administrator session is revoked after preflight',async()=>{
    const body={action:'rename',userId,name:'Must not persist',expectedRevision:await revision()};
    state.before=async()=>{await rows('update sessions set revoked_at=now() where id=$1',[sessionId]);};
    expect((await invoke('',body)).status).toBe(403);
    expect((await rows('select name from users where id=$1',[userId]))[0].name).toBe('Player 100%');
    expect(await rows('select * from audit_logs')).toHaveLength(0);
  });
  it('rolls back the edit when auditing fails',async()=>{
    await state.db.exec("alter table audit_logs add constraint test_audit_failure check(action<>'admin.account.rename')");
    try {
      expect((await invoke('',{action:'rename',userId,name:'Not saved',expectedRevision:await revision()})).status).toBe(500);
      expect((await rows('select name from users where id=$1',[userId]))[0].name).toBe('Player 100%');
    } finally {await state.db.exec('alter table audit_logs drop constraint test_audit_failure');}
  });
  it('blocks cross-site writes and attempts to revoke its own administrator session',async()=>{
    const body={action:'revoke-sessions',userId:adminId,expectedRevision:'1'};
    expect((await invoke('',body)).status).toBe(400);
    const cross=new Request(request('',body),{headers:{Origin:'https://evil.example','Content-Type':'application/json'}});
    expect((await directory(cross,{} as any)).status).toBe(403);
  });
  it('keeps an edit concurrent with another edit from overwriting it',async()=>{
    const version=await revision();
    const responses=await Promise.all(['First','Second'].map(name=>invoke('',{action:'rename',userId,name,expectedRevision:version})));
    expect(responses.map(response=>response.status).sort()).toEqual([200,409]);
    expect(await rows('select * from audit_logs')).toHaveLength(1);
  });
});

describe('global aggregate statistics',()=>{
  const stats=(query='')=>globalStats(new Request('https://nxt5.org/.netlify/functions/admin-global-stats'+query),{} as any);
  const snapshot=()=>({source:'drafter.lol',status:'completed',patch:'16.15',bluePicks:['Ahri','Jinx','Vi','Ornn','Rakan'],redPicks:['Azir','Ashe','Lux','Sona','Zed'],blueBans:['Leblanc','Jinx','Vi',null,null],redBans:['Leblanc','Ashe','Lux',null,null],banStates:{blue:['selected','selected','selected','skipped','skipped'],red:['selected','selected','selected','skipped','skipped']}});
  it('deduplicates imports across teams and exposes only champion aggregates',async()=>{
    const duplicate='00000000-0000-4000-8000-000000000009';
    await rows("insert into matches(id,team_id,game_id,region,result,patch,raw) values($1,$2,'EUW1_123','EUROPE','Victoire','16.15','{}'),($3,$4,'EUW1_123','EUW1','Défaite','16.15','{}')",[gameId,teamId,duplicate,userId]);
    await rows("insert into match_participants(match_id,champion,role,team_key,raw) values($1,'Ahri','MID','ALLY','{\"win\":true,\"name\":\"Private\"}'),($2,'Ahri','MID','ENEMY','{\"win\":true}')",[gameId,duplicate]);
    const data=await (await stats()).json();expect(data.coverage).toMatchObject({games:1,imports:2,selections:1});
    expect(data.played[0]).toMatchObject({champion:'Ahri',picks:1,winRate:100});
    expect(JSON.stringify(data)).not.toMatch(/private|user_id|team_id|token_hash/i);
  });
  it('counts each source draft once and distinguishes skipped from unknown bans',async()=>{
    const draft=snapshot();
    await rows('insert into opponent_drafts(team_id,source_id,game_number,snapshot) values($1,\'same-source\',1,$2),($3,\'same-source\',1,$2)',[teamId,JSON.stringify(draft),userId]);
    const data=await (await stats('?patch=16.15')).json();expect(data.coverage).toMatchObject({totalDrafts:1,pickDrafts:1,banDrafts:1});
    expect(data.bans.find((row:any)=>row.champion==='Leblanc')).toMatchObject({count:1,rate:100});
    draft.banStates.blue[3]='unknown';
    await rows('update opponent_drafts set snapshot=$1',[JSON.stringify(draft)]);
    const incomplete=await (await stats()).json();expect(incomplete.coverage).toMatchObject({pickDrafts:1,banDrafts:0});expect(incomplete.bans).toEqual([]);
  });
  it('excludes arbitrary strings instead of exporting private text as a champion',async()=>{
    await rows("insert into matches(id,team_id,game_id,region,patch,raw) values($1,$2,'EUW1_456','EUROPE','16.15','{}')",[gameId,teamId]);
    await rows("insert into match_participants(match_id,champion,role,team_key,raw) values($1,'PrivatePersonName','MID','ALLY','{}')",[gameId]);
    const data=await (await stats()).json();expect(data.coverage.unknownSelections).toBe(1);expect(data.played).toEqual([]);expect(JSON.stringify(data)).not.toContain('PrivatePersonName');
  });
  it('counts recorded game bans once and excludes unknown slots',async()=>{
    const teams=[{teamId:100,bans:[1,2,-1,-1,-1].map(championId=>({championId}))},{teamId:200,bans:[1,3,-1,-1,-1].map(championId=>({championId}))}];
    await rows("insert into matches(id,team_id,game_id,region,patch,raw) values($1,$2,'EUW1_999','EUROPE','16.15',$3)",[gameId,teamId,JSON.stringify({info:{teams}})]);
    const data=await (await stats()).json();expect(data.coverage.banGames).toBe(1);
    expect(data.gameBans.find((row:any)=>row.champion==='Ahri')).toMatchObject({count:1,rate:100});
    teams[0].bans[0].championId=0;
    await rows('update matches set raw=$1',[JSON.stringify({info:{teams}})]);
    const missing=await (await stats()).json();expect(missing.coverage.banGames).toBe(0);expect(missing.gameBans).toEqual([]);
  });
  it('validates filters and requires the administrator for global data',async()=>{
    expect((await stats('?days=bogus')).status).toBe(400);
    state.admin.mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
    expect((await stats()).status).toBe(403);
  });
});
