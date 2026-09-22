import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,beforeEach,afterAll,afterEach,describe,it,expect,vi } from 'vitest';
const database=vi.hoisted(()=>({pg:null as any,failQuery:null as any}));
const transport=vi.hoisted(()=>({send:vi.fn(),find:vi.fn(),guild:vi.fn(),connectionTest:vi.fn(),enabled:true}));
vi.mock('../../netlify/functions/_lib/db',async () => {
  const {neon,neonConfig} = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url,options:any) => {
    const body = JSON.parse(options.body);
    async function execute(connection:any,statement:any) {
      if (database.failQuery && statement.query.includes(database.failQuery)) {database.failQuery=null;throw new Error('Simulated database acknowledgement failure');}
      const result = await connection.query(statement.query,statement.params);
      return {fields:result.fields,rows:result.rows.map((row:any) => result.fields.map((field:any) => {
        const value=row[field.name];
        if (value===null || value===undefined) return null;
        if ([114,3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (typeof value==='boolean') return value?'t':'f';
        if (value instanceof Date) return value.toISOString().replace('T',' ').replace('Z','+00');
        return String(value);
      })),rowCount:result.affectedRows ?? result.rows.length};
    }
    try {
      if (body.queries) {
        const results=await database.pg.transaction(async (tx:any) => {
          const rows=[];
          for (const query of body.queries) rows.push(await execute(tx,query));
          return rows;
        });
        return new Response(JSON.stringify({results}));
      }
      return new Response(JSON.stringify(await execute(database.pg,body)));
    } catch(error:any) {return new Response(JSON.stringify({message:error.message,code:error.code}),{status:400});}
  };
  return {sql:neon('postgresql://test:test@local-test.invalid/nxt5')};
});
vi.mock('../../netlify/functions/_lib/discord-client',()=>({discordRequest:transport.send,findDiscordMessage:transport.find,getDiscordGuild:transport.guild,cleanDiscordText:(value:any)=>String(value)}));
vi.mock('../../netlify/functions/_lib/discord-config',()=>({isDiscordEnabled:()=>transport.enabled,isDiscordId:(s:any)=>/^\d{17,20}$/.test(s),getDiscordConfig:()=>({siteUrl:'https://nxt5.test'})}));
vi.mock('../../netlify/functions/_lib/rate-limit',()=>({assertSubjectRateLimit:vi.fn()}));
vi.mock('../../netlify/functions/_lib/discord-test',()=>({sendDiscordConnectionTest:transport.connectionTest}));
vi.mock('../../netlify/functions/_lib/discord-bot-common',()=>({
  botText:(s:any)=>String(s),botLink:(p:string)=>'https://nxt5.test'+p,
  botMessage:(title:string,description:string,fields:any[])=>({title,description,fields}),
  botConfirmation:async(ctx:any,command:string,options:any,description:string)=>({confirmation:true,command,options,description}),
  assertBotStaff:(ctx:any,manage=false)=>{if(manage?!ctx.canManage:!ctx.canStaff)throw new Error('Staff requis');},
}));
import { executeDiscordAction } from '../../netlify/functions/_lib/discord-bot-actions';
import { enqueueScheduledBotMessages,deliverBotOutbox,localDateTime,nextWeeklyRun,queueBotMessage } from '../../netlify/functions/_lib/discord-bot-schedule';
import { withDiscordContext } from '../../netlify/functions/_lib/discord-runtime';
import { loadBotWorkflows } from '../../netlify/functions/_lib/discord-bot-bootstrap';
const user='00000000-0000-4000-8000-000000000001',team='00000000-0000-4000-8000-000000000002',player='00000000-0000-4000-8000-000000000003',other='00000000-0000-4000-8000-000000000004';
const ctx={teamId:team,userId:user,discordUserId:'100000000000000004',guildId:'100000000000000001',teamName:'Team',role:'owner',canStaff:true,canManage:true,playerIds:[player],timezone:'Europe/Paris'};
async function rows(q:string,p:any[]=[]){return(await database.pg.query(q,p)).rows;}
beforeAll(async()=>{
  database.pg=new PGlite();
  const schema=readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','').replaceAll('gen_random_bytes(5)',"decode('0000000000','hex')");
  await database.pg.exec(schema);
  for(const file of ['20260915_discord_publications.sql','20260921_discord_shared_servers.sql','20260922_discord_bot_workflows.sql'])await database.pg.exec(readFileSync(new URL('../../database/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>database.pg?.close());
afterEach(()=>vi.unstubAllEnvs());
beforeEach(async()=>{
  // CI build metadata must not make this isolated local PostgreSQL suite look
  // like an unverified hosted invocation. Explicit preview contexts still win.
  for(const [key,value] of Object.entries({CONTEXT:'production',AWS_LAMBDA_FUNCTION_NAME:'',LAMBDA_TASK_ROOT:'',SITE_ID:''}))vi.stubEnv(key,value);
  await database.pg.exec('truncate users cascade');transport.enabled=true;
  transport.send.mockReset().mockResolvedValue({id:'100000000000000099',channel_id:'100000000000000002'});transport.find.mockReset().mockResolvedValue(null);
  transport.guild.mockReset().mockResolvedValue({channels:[{id:'100000000000000002',canSend:true,name:'équipe'},{id:'100000000000000003',canSend:true,name:'autre salon'}]});
  transport.connectionTest.mockReset().mockResolvedValue({status:'succeeded'});
  await rows("insert into users(id,account_name,name,password_hash) values($1,'user','User','unused')",[user]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$3,'Team','T'),($2,$3,'Other','O')",[team,other,user]);
  await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'Player','MID')",[player,team,user]);
  await rows("insert into discord_connections(team_id,guild_id,status) values($1,'100000000000000001','active')",[team]);
  await rows(`insert into discord_bot_settings(team_id,channels,reminders_enabled) values($1,'{"planning":"100000000000000002","reviews":"100000000000000002","bilans":"100000000000000002"}',true)`,[team]);
});
describe('Discord workflows with real PostgreSQL and fake transport',()=>{
  it('rejects DST nonexistent and ambiguous hours; computes weekly across DST',()=>{
    expect(()=>localDateTime('2026-03-29','02:30','Europe/Paris')).toThrow('n’existe');
    expect(()=>localDateTime('2026-10-25','02:30','Europe/Paris')).toThrow('ambiguë');
    expect(localDateTime('2026-09-22','20:00','Europe/Paris').toISOString()).toBe('2026-09-22T18:00:00.000Z');
    expect(nextWeeklyRun('Europe/Paris',1,'18:00',new Date('2026-10-24T10:00:00Z')).toISOString()).toBe('2026-10-26T17:00:00.000Z');
  });
  it('requires confirmation then creates a team scoped event and rejects stale modifications',async()=>{
    const options={type:'scrim',date:'2030-05-01',heure:'20:00',duree:120};
    expect((await executeDiscordAction(ctx,'evenement creer',options)).confirmation).toBe(true);
    expect(await rows('select * from discord_team_events')).toHaveLength(0);
    await executeDiscordAction(ctx,'evenement creer',options,true);
    const[event]=await rows('select * from discord_team_events');
    await expect(executeDiscordAction({...ctx,teamId:other},'evenement annuler',{evenement:event.id})).rejects.toThrow('introuvable');
    const prep=await executeDiscordAction(ctx,'evenement modifier',{evenement:event.id,titre:'nouveau'});
    await rows('update discord_team_events set revision=revision+1 where id=$1',[event.id]);
    await expect(executeDiscordAction(ctx,'evenement modifier',prep.options,true)).rejects.toThrow('changé');
  });
  it('keeps availability events and other slots when adding an overnight interval',async()=>{
    await rows(`insert into player_availability(team_id,player_id,week_start,slots) values($1,$2,'2030-04-29','{"MON":["17:00"],"WED":["19:00"],"_events":{"WED|19:00":{"label":"Scrim"}}}')`,[team,player]);
    await executeDiscordAction(ctx,'disponibilites definir',{date:'2030-05-01',debut:'23:00',fin:'01:00'});
    const[r]=await rows('select slots from player_availability');
    expect(r.slots.MON).toEqual(['17:00']);expect(r.slots.WED).toEqual(['19:00','23:00']);expect(r.slots.THU).toEqual(['00:00']);expect(r.slots._events).toBeTruthy();
  });
  it('restricts personal goal writes and preserves completion history',async()=>{
    await executeDiscordAction(ctx,'objectifs definir',{objectif:'Objectif collectif'},true);
    const[goal]=await rows('select * from discord_team_goals');
    await executeDiscordAction({...ctx,canStaff:false,canManage:false},'objectifs point',{objectif:goal.id,note:'Point séance'});
    await expect(executeDiscordAction({...ctx,canStaff:false},'objectifs terminer',{objectif:goal.id},true)).rejects.toThrow('Staff');
    await executeDiscordAction(ctx,'objectifs terminer',{objectif:goal.id,commentaire:'Validé'},true);
    expect((await rows('select status from discord_team_goals'))[0].status).toBe('completed');expect(await rows('select * from discord_goal_updates')).toHaveLength(2);
  });
  it('deduplicates scheduled reminders and cancels queued jobs after event cancellation',async()=>{
    const[event]=await rows("insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes) values($1,'Scrim','scrim',now()+interval '15 minutes',120) returning *",[team]);
    await enqueueScheduledBotMessages();await enqueueScheduledBotMessages();expect(await rows('select * from discord_bot_outbox')).toHaveLength(1);
    await rows("update discord_team_events set status='cancelled' where id=$1",[event.id]);
    await deliverBotOutbox();expect(transport.send).not.toHaveBeenCalled();expect((await rows('select state from discord_bot_outbox'))[0].state).toBe('cancelled');
  });
  it('never repeats an ambiguous send and rechecks changed channels before delivery',async()=>{
    await rows("insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes) values($1,'Scrim','scrim',now()+interval '15 minutes',120)",[team]);
    await enqueueScheduledBotMessages();transport.send.mockRejectedValueOnce(Object.assign(new Error('Timeout'),{ambiguous:true}));
    await deliverBotOutbox();await deliverBotOutbox();expect(transport.send).toHaveBeenCalledTimes(1);expect((await rows('select state from discord_bot_outbox'))[0].state).toBe('uncertain');
    await rows("update discord_bot_outbox set state='queued',available_at=now()-interval '1 second'");await rows(`update discord_bot_settings set channels='{}'`);
    await deliverBotOutbox();expect(transport.send).toHaveBeenCalledTimes(1);expect((await rows('select state from discord_bot_outbox'))[0].state).toBe('cancelled');
  });
  it('publishes only validated review summary, versions reads, and hides drafts',async()=>{
    const[report]=await rows("insert into reports(team_id,title,content,discord_status) values($1,'Review','SECRET NOTES','draft') returning *",[team]);
    await expect(executeDiscordAction({...ctx,canStaff:false},'review lire',{review:report.id})).rejects.toThrow('introuvable');
    await executeDiscordAction(ctx,'review partager',{review:report.id,canal:'100000000000000002',resume:'Consigne validée'},true);
    const[job]=await rows('select * from discord_bot_outbox');expect(JSON.stringify(job.payload)).not.toContain('SECRET');
    await executeDiscordAction(ctx,'review lire',{review:report.id,version:2});
    await rows("update reports set content='NEW SECRET' where id=$1",[report.id]);
    await expect(executeDiscordAction(ctx,'review lire',{review:report.id,version:2})).rejects.toThrow('modifiée');
    await deliverBotOutbox();expect(transport.send).not.toHaveBeenCalled();
  });
  it('blocks all mutations and scheduling in preview before database or transport',async()=>{
    await expect(withDiscordContext({deploy:{context:'deploy-preview'}},()=>executeDiscordAction(ctx,'objectifs definir',{objectif:'No'},true))).rejects.toThrow('désactivées');
    await expect(withDiscordContext({deploy:{context:'deploy-preview'}},()=>enqueueScheduledBotMessages())).rejects.toThrow('désactivées');
    expect(await rows('select * from discord_team_goals')).toHaveLength(0);expect(transport.send).not.toHaveBeenCalled();
  });
  it('filters private goals and foreign-team sessions in the website bootstrap',async()=>{
    const member='00000000-0000-4000-8000-000000000009',memberPlayer='00000000-0000-4000-8000-000000000010';
    await rows("insert into users(id,account_name,name,password_hash) values($1,'member','Member','unused')",[member]);
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'player')",[team,member]);
    await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'Member player','TOP')",[memberPlayer,team,member]);
    await rows("insert into discord_team_goals(team_id,player_id,title) values($1,$2,'Private staff target'),($1,$3,'My target'),($1,null,'Collective target')",[team,player,memberPlayer]);
    await rows("insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes) values($1,'Session','scrim',now()+interval '1 day',60)",[team]);
    const result=await loadBotWorkflows(team,member);
    expect(result.botGoals.map(goal=>goal.title).sort()).toEqual(['Collective target','My target']);expect(result.botEvents).toHaveLength(1);
    expect(await loadBotWorkflows(other,member)).toEqual({botEvents:[],botGoals:[]});
  });
});

describe('Workflow delivery regression checks',()=>{
  const channel='100000000000000002', changedChannel='100000000000000003';
  const weeklyNow=new Date('2030-05-01T18:05:00Z');
  async function event(){return(await rows("insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes) values($1,'Scrim','scrim',now()+interval '15 minutes',120) returning *",[team]))[0];}
  async function weekly(){
    await rows("update discord_bot_settings set timezone='UTC',weekly_enabled=true,weekly_day=3,weekly_hour='18:00' where team_id=$1",[team]);
    await enqueueScheduledBotMessages(weeklyNow);
    return(await rows("select * from discord_bot_outbox where kind='weekly'"))[0];
  }
  it('rejects a changed destination after a presence reminder preview',async()=>{
    const e=await event();
    const preview=await executeDiscordAction(ctx,'presence relancer',{evenement:e.id});
    expect(preview.options).toMatchObject({_channelId:channel,_eventRevision:1,_participantIds:[user]});
    await rows("update discord_bot_settings set channels=jsonb_set(channels,'{planning}',$2::jsonb) where team_id=$1",[team,JSON.stringify(changedChannel)]);
    await expect(executeDiscordAction(ctx,'presence relancer',preview.options,true)).rejects.toThrow('destination');
    expect(await rows('select * from discord_bot_outbox')).toHaveLength(0);
  });
  it('never moves a confirmed synthetic test to a different route',async()=>{
    const[first]=await rows('insert into discord_routes(team_id,guild_id,channel_id,channel_name) values($1,$2,$3,$4) returning *',[team,ctx.guildId,channel,'original']);
    const preview=await executeDiscordAction(ctx,'diffusion test',{});
    expect(preview.options).toMatchObject({_routeId:first.id,_channelId:channel});
    await rows('update discord_routes set channel_id=$2 where id=$1',[first.id,changedChannel]);
    await expect(executeDiscordAction(ctx,'diffusion test',preview.options,true)).rejects.toThrow('salon de test a changé');
    expect(transport.connectionTest).not.toHaveBeenCalled();
  });
  it('rejects an event confirmation after the team timezone changes',async()=>{
    const preview=await executeDiscordAction(ctx,'evenement creer',{type:'scrim',date:'2030-05-01',heure:'20:00',duree:60});
    await expect(executeDiscordAction({...ctx,timezone:'America/New_York'},'evenement creer',preview.options,true)).rejects.toThrow('fuseau');
    expect(await rows('select * from discord_team_events')).toHaveLength(0);
  });
  it('does not let already queued reminders starve the next batch',async()=>{
    await rows("insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes) select $1,'Scrim '||i,'scrim',now()+interval '15 minutes',120 from generate_series(1,101) i",[team]);
    expect(await enqueueScheduledBotMessages()).toBe(100);
    expect(await enqueueScheduledBotMessages()).toBe(1);
    expect(await rows("select id from discord_bot_outbox where kind='reminder'")).toHaveLength(101);
    expect(await enqueueScheduledBotMessages()).toBe(0);
  });
  it('filters not-due weekly teams before batching and does not starve team 201',async()=>{
    await rows("insert into teams(id,owner_id,name,tag) select ('00000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,$1,'Schedule team '||i,'SCH' from generate_series(1,401) i",[user]);
    await rows("insert into discord_connections(team_id,guild_id,status) select id,$1,'active' from teams where name like 'Schedule team %'",[ctx.guildId]);
    await rows(`insert into discord_bot_settings(team_id,timezone,channels,weekly_enabled,weekly_day,weekly_hour)
      select id,'UTC',jsonb_build_object('bilans',$1::text),true,3,case when substring(id::text from 25)::bigint<=200 then '12:00' else '18:00' end
      from teams where name like 'Schedule team %'`,[channel]);
    expect(await enqueueScheduledBotMessages(weeklyNow)).toBe(200);
    expect(await enqueueScheduledBotMessages(weeklyNow)).toBe(1);
    expect(await enqueueScheduledBotMessages(weeklyNow)).toBe(0);
    expect(await rows("select id from discord_bot_outbox where kind='weekly'")).toHaveLength(201);
  });
  it('expires delayed weekly messages instead of publishing days later',async()=>{
    const job=await weekly();
    expect(job.schedule_snapshot).toEqual({timezone:'UTC',weekly_day:3,weekly_hour:'18:00'});
    expect(job.expires_at.toISOString()).toBe('2030-05-01T19:00:00.000Z');
    await rows("update discord_bot_outbox set expires_at=now()-interval '1 second' where id=$1",[job.id]);
    await deliverBotOutbox();
    expect(transport.send).not.toHaveBeenCalled();
    expect((await rows('select state from discord_bot_outbox where id=$1',[job.id]))[0].state).toBe('cancelled');
  });
  it('cancels a weekly message after its configured hour changes and safely rebuilds an unsent cancelled job',async()=>{
    const original=await weekly();
    await rows("update discord_bot_settings set weekly_hour='18:30' where team_id=$1",[team]);
    await deliverBotOutbox();
    expect(transport.send).not.toHaveBeenCalled();
    expect((await rows('select state from discord_bot_outbox where id=$1',[original.id]))[0].state).toBe('cancelled');
    expect(await enqueueScheduledBotMessages(new Date('2030-05-01T18:35:00Z'))).toBe(1);
    const refreshed=(await rows('select * from discord_bot_outbox where id=$1',[original.id]))[0];
    expect(refreshed.state).toBe('queued');
    expect(refreshed.schedule_snapshot.weekly_hour).toBe('18:30');
    await deliverBotOutbox();await enqueueScheduledBotMessages(new Date('2030-05-01T18:35:00Z'));await deliverBotOutbox();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('invalidates an early queued reminder when the delay is reduced',async()=>{
    const e=await event();await enqueueScheduledBotMessages();
    await rows('update discord_bot_settings set reminder_minutes=10 where team_id=$1',[team]);
    await deliverBotOutbox();
    expect(transport.send).not.toHaveBeenCalled();
    expect(await enqueueScheduledBotMessages()).toBe(0);
    await rows("update discord_team_events set starts_at=now()+interval '5 minutes' where id=$1",[e.id]);
    expect(await enqueueScheduledBotMessages()).toBe(1);
    expect((await rows('select schedule_snapshot from discord_bot_outbox'))[0].schedule_snapshot).toEqual({reminder_minutes:10});
    await deliverBotOutbox();await enqueueScheduledBotMessages();await deliverBotOutbox();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('counts the played date rather than a late import in the weekly summary',async()=>{
    await rows(`insert into matches(team_id,game_id,opponent,result,created_at,raw) values
      ($1,'OLD-IMPORT','Old game','Victoire','2030-04-30T15:00:00Z',$2::jsonb),
      ($1,'CURRENT-IMPORT','Recent game','Défaite','2030-04-30T15:00:00Z',$3::jsonb)`,
      [team,JSON.stringify({info:{gameStartTimestamp:new Date('2028-01-01').getTime()}}),JSON.stringify({info:{gameStartTimestamp:new Date('2030-04-30').getTime()}})]);
    const job=await weekly();
    expect(job.payload.embeds[0].description).toContain('1 games · 0 victoires · 1 défaites');
    expect(job.payload.embeds[0].url).toBe('https://nxt5.test/games?team='+team);
  });
  it('rotates unresolved receipts so later uncertain messages can reconcile without another POST',async()=>{
    await rows(`insert into discord_bot_outbox(team_id,guild_id,channel_id,channel_kind,kind,dedupe_key,config_version,state,updated_at)
      select $1,$2,$3,'bilans','weekly','uncertain-'||i,1,'uncertain',now()-i*interval '1 minute' from generate_series(1,3) i`,[team,ctx.guildId,channel]);
    transport.find.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({id:'100000000000000098'});
    await deliverBotOutbox(0);await deliverBotOutbox(0);
    expect(transport.find).toHaveBeenCalledTimes(3);
    expect(await rows("select id from discord_bot_outbox where state='sent'")).toHaveLength(1);
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('rejects cross-team report references at the database boundary',async()=>{
    const[report]=await rows("insert into reports(team_id,title,content) values($1,'Other report','PRIVATE') returning *",[other]);
    await expect(queueBotMessage({teamId:team,guildId:ctx.guildId,channelId:channel,channelKind:'reviews',kind:'review',key:'cross-team',payload:{},configVersion:1,reportId:report.id,reportVersion:1})).rejects.toMatchObject({code:'23503'});
    await expect(rows('insert into discord_review_reads(team_id,report_id,user_id,report_version) values($1,$2,$3,1)',[team,report.id,user])).rejects.toMatchObject({code:'23503'});
    expect(await rows('select id from discord_bot_outbox')).toHaveLength(0);
  });
  it('links a shared review to its exact team and report without exposing its staff content',async()=>{
    const[report]=await rows("insert into reports(team_id,title,content,discord_status) values($1,'Review','SECRET','draft') returning *",[team]);
    await executeDiscordAction(ctx,'review partager',{review:report.id,canal:channel,resume:'Résumé public'},true);
    const[job]=await rows('select payload from discord_bot_outbox');
    const url='https://nxt5.test/rapports?team='+team+'&report='+report.id;
    expect(job.payload.embeds[0].url).toBe(url);
    expect(job.payload.components[0].components[1].url).toBe(url);
    expect(JSON.stringify(job.payload)).not.toContain('SECRET');
  });
});

describe('Explicit approval keeps a review summary current',()=>{
  it('requires a new summary validation after source content changes and preserves the old copy for staff',async()=>{
    const[report]=await rows("insert into reports(team_id,title,content,discord_summary,discord_status) values($1,'Review','Original staff notes','Original public instructions','published') returning *",[team]);
    await rows("update reports set content='Changed private notes' where id=$1",[report.id]);
    const[changed]=await rows('select * from reports where id=$1',[report.id]);
    expect(changed.discord_summary_stale).toBe(true);
    expect(changed.discord_version).toBe(2);
    expect(changed.discord_summary).toBe('Original public instructions');
    const form=await executeDiscordAction(ctx,'review partager',{review:report.id,canal:'100000000000000002'});
    expect(form.modal.fields[0]).toMatchObject({id:'resume',value:'Original public instructions'});
    await expect(executeDiscordAction({...ctx,canStaff:false},'review lire',{review:report.id})).rejects.toThrow('doit vérifier');
    const confirmation=await executeDiscordAction(ctx,'review partager',{review:report.id,canal:'100000000000000002',resume:'Original public instructions'});
    expect((await rows('select discord_summary_stale from reports where id=$1',[report.id]))[0].discord_summary_stale).toBe(true);
    await executeDiscordAction(ctx,'review partager',confirmation.options,true);
    expect((await rows('select discord_summary_stale from reports where id=$1',[report.id]))[0].discord_summary_stale).toBe(false);
    await executeDiscordAction({...ctx,canStaff:false},'review lire',{review:report.id,version:2});
    expect(await rows('select * from discord_review_reads')).toHaveLength(1);
    expect(JSON.stringify((await rows('select payload from discord_bot_outbox'))[0].payload)).not.toContain('Changed private notes');
  });
  it('resolves an exact player name and freezes its identity in the goal confirmation',async()=>{
    const preview=await executeDiscordAction(ctx,'objectifs definir',{objectif:'Communiquer davantage',joueur:'player'});
    expect(preview.options.joueur).toBe(player);
    await rows("update players set name='Renamed' where id=$1",[player]);
    await executeDiscordAction(ctx,'objectifs definir',preview.options,true);
    expect((await rows('select player_id from discord_team_goals'))[0].player_id).toBe(player);
    await rows("insert into players(team_id,name,role,roster_status) values($1,'Renamed','SUB','SUB')",[team]);
    await expect(executeDiscordAction(ctx,'objectifs definir',{objectif:'Test',joueur:'renamed'})).rejects.toThrow('Plusieurs joueurs');
    await expect(executeDiscordAction({...ctx,teamId:other},'objectifs definir',{objectif:'Test',joueur:player})).rejects.toThrow('introuvable');
  });
});
