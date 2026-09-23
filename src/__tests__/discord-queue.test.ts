import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest';

const database = vi.hoisted(() => ({pg:null as any,failQuery:null as null|string}));
const transport = vi.hoisted(() => ({send:vi.fn(),find:vi.fn(),render:vi.fn(),asset:vi.fn(),getAsset:vi.fn(),deleteAsset:vi.fn(),assetCreatedAt:vi.fn(),blobs:[] as {key:string}[],enabled:true}));
// Real Neon parameter encoding and transaction protocol; real local PostgreSQL
// constraints, deferred triggers and state transitions. No hosted DB is touched.
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
        if (value instanceof Date) return value.toISOString();
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
vi.mock('../../netlify/functions/_lib/discord-client',async original => ({...await original<any>(),discordRequest:transport.send,findDiscordMessage:transport.find,getDiscordBotUserId:async ()=>'100000000000000088',
  getDiscordGuild:async (id:string)=>({guild:{id,name:'Test'},channels:[{id:'100000000000000002',name:'Scrims',canSend:true}],roles:[]})}));
vi.mock('../../netlify/functions/_lib/rate-limit',()=>({assertSubjectRateLimit:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../../netlify/functions/_lib/discord-config',async original => {
  const actual=await original<any>();
  return {...actual,isDiscordEnabled:()=>transport.enabled,getDiscordConfig:()=>({...actual.getDiscordConfig(),siteUrl:'https://nxt5.test'}),signDiscordInternalRequest:()=>({'x-nxt5-discord-signature':'signed-test'})};
});
vi.mock('../../netlify/functions/_lib/publication-render',()=>({renderGamePublicationPng:transport.render}));
vi.mock('../../netlify/functions/_lib/publication-assets',()=>({putPublicationAsset:transport.asset,getPublicationAsset:transport.getAsset,
  deletePublicationAsset:transport.deleteAsset,publicationAssetCreatedAt:transport.assetCreatedAt,
  listPublicationAssets:async function* () { for (const blob of transport.blobs) yield blob; }}));

import { claimPublicationJob,enqueueManualPublication,recoverPublicationJobs,retryPublicationJob,classifyPublicationFailure,retryDelaySeconds } from '../../netlify/functions/_lib/discord-queue';
import { processPublicationJob,reconcilePublications,resolvePublicationJob,publicationReference,publicationContentHash,dispatchPublicationBatch } from '../../netlify/functions/_lib/discord-worker';
import { wakeDiscordPublications } from '../../netlify/functions/_lib/discord-wake';
import { discordTeamChoices, executeDiscordCommand } from '../../netlify/functions/discord-interactions';
import { maintainDiscordPublications } from '../../netlify/functions/_lib/discord-maintenance';

const teamId='00000000-0000-4000-8000-000000000002';
const routeId='00000000-0000-4000-8000-000000000003';
const matchId='00000000-0000-4000-8000-000000000004';
const categoryId='00000000-0000-4000-8000-000000000005';
const userId='00000000-0000-4000-8000-000000000001';

async function rows(query:string,params:any[]=[]):Promise<any[]> {return (await database.pg.query(query,params)).rows;}
async function insertMatch(tx=database.pg,extra='') {
  await tx.query(`insert into matches(id,team_id,game_id,side,result,opponent,created_at,category_ids)
    values ($1,$2,'EUW1_TEST','Blue Side','Victoire','Scrim',now()${extra},$3::jsonb)`,[matchId,teamId,JSON.stringify([categoryId])]);
}
async function insertParticipants(tx=database.pg,kills=1) {
  await tx.query(`insert into match_participants(match_id,team_key,champion,role,summoner_name,kills)
    select $1,case when i<5 then 'ALLY' else 'ENEMY' end,'Champion'||i,
      (array['TOP','JGL','MID','ADC','SUP'])[i%5+1],'Player'||i,$2 from generate_series(0,9) i`,[matchId,kills]);
}
async function importGame() {
  await database.pg.transaction(async (tx:any) => {await insertMatch(tx);await insertParticipants(tx);});
}
async function due() {await database.pg.exec("update publication_jobs set available_at=now()-interval '1 second'");}

beforeAll(async () => {
  database.pg=new PGlite();
  const schema=readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8')
    .replace('create extension if not exists pgcrypto;','').replaceAll('gen_random_bytes(5)',"decode('0000000000','hex')");
  await database.pg.exec(schema);
  for (const filename of ['20260915_discord_publications.sql','20260921_discord_shared_servers.sql','20260922_discord_bot_identity.sql','20260922_discord_bot_workflows.sql']) {
    await database.pg.exec(readFileSync(new URL('../../database/migrations/'+filename,import.meta.url),'utf8'));
  }
  await database.pg.exec("create table app_schema_migrations(migration_key text primary key);insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-bot-identity-20260922-v1'),('discord-bot-workflows-20260922-v1')");
},30_000);
beforeEach(async () => {
  database.failQuery=null;transport.enabled=true;
  transport.send.mockReset().mockImplementation(async (_path,options) => ({id:'100000000000000099',embeds:options?.body?.embeds || []}));
  transport.find.mockReset().mockResolvedValue(null);
  transport.render.mockReset().mockResolvedValue({bytes:Buffer.from('png'),mimeType:'image/png',width:100,height:100,filename:'game.png'});
  transport.asset.mockReset().mockResolvedValue({key:'test/asset.png'});
  transport.getAsset.mockReset().mockResolvedValue(null);
  transport.deleteAsset.mockReset().mockResolvedValue(undefined);
  transport.assetCreatedAt.mockReset().mockResolvedValue(Date.now()-2*86_400_000);
  transport.blobs=[];
  await database.pg.exec('truncate users cascade');
  await database.pg.exec('truncate discord_interaction_receipts');
  await database.pg.query("insert into users(id,account_name,name,password_hash) values($1,'tester','Test','unused')",[userId]);
  await database.pg.query("insert into teams(id,owner_id,name,tag) values($1,$2,'NXT5 test','NXT')",[teamId,userId]);
  await database.pg.query("insert into match_categories(id,team_id,name) values($1,$2,'Scrims')",[categoryId,teamId]);
  await database.pg.query("insert into discord_connections(team_id,guild_id,status,enabled_at,created_by) values($1,'100000000000000001','active',now()-interval '1 hour',$2)",[teamId,userId]);
  await database.pg.query("insert into discord_routes(id,team_id,guild_id,channel_id,channel_name,automatic) values($1,$2,'100000000000000001','100000000000000002','scrims',true)",[routeId,teamId]);
});
afterAll(async () => {await database.pg?.close();});
afterEach(()=>vi.unstubAllGlobals());

describe('Discord durable queue against PostgreSQL',() => {
  it('waits for final participants and atomically creates one revision and one job per transaction',async () => {
    await database.pg.transaction(async (tx:any) => {
      await insertMatch(tx);
      expect((await tx.query('select * from publication_jobs')).rows).toEqual([]);
      await insertParticipants(tx);
      expect((await tx.query('select * from publication_jobs')).rows).toEqual([]);
    });
    expect(await rows('select publication_revision from matches')).toEqual([{publication_revision:1}]);
    expect(await rows('select source_revision,status from publication_jobs')).toEqual([{source_revision:1,status:'queued'}]);
    expect(await rows('select desired_revision from discord_publications')).toEqual([{desired_revision:1}]);
  });
  it('rolls back generated jobs even when the deferred trigger ran before the import failed',async () => {
    await expect(database.pg.transaction(async (tx:any) => {
      await insertMatch(tx);await insertParticipants(tx);
      await tx.exec('set constraints all immediate');
      expect((await tx.query('select * from publication_jobs')).rows).toHaveLength(1);
      throw new Error('Failed import');
    })).rejects.toThrow('Failed import');
    expect(await rows('select * from matches')).toEqual([]);
    expect(await rows('select * from publication_jobs')).toEqual([]);
    expect(await rows('select * from discord_publications')).toEqual([]);
  });
  it('ignores identical reimports despite fresh participant UUIDs and bumps once for a side/participant correction',async () => {
    await importGame();
    await database.pg.transaction(async (tx:any) => {
      await tx.query('delete from match_participants where match_id=$1',[matchId]);await insertParticipants(tx);
      await tx.query("update matches set raw='{}'::jsonb where id=$1",[matchId]);
    });
    expect(await rows('select publication_revision from matches')).toEqual([{publication_revision:1}]);
    expect(await rows('select * from publication_jobs')).toHaveLength(1);
    await database.pg.transaction(async (tx:any) => {
      await tx.query("update matches set side='Red Side' where id=$1",[matchId]);
      await tx.query("update match_participants set kills=4,role='JGL' where match_id=$1 and team_key='ALLY'",[matchId]);
    });
    expect(await rows('select publication_revision from matches')).toEqual([{publication_revision:2}]);
    expect(await rows('select source_revision from publication_jobs order by source_revision')).toEqual([{source_revision:1},{source_revision:2}]);
  });
  it('never backfills historical matches on activation or later correction; manual sharing is explicit',async () => {
    await database.pg.transaction(async (tx:any) => {await insertMatch(tx,"-interval '2 days'");await insertParticipants(tx);});
    expect(await rows('select * from publication_jobs')).toEqual([]);
    await database.pg.query("update matches set opponent='Corrected old game' where id=$1",[matchId]);
    expect(await rows('select * from publication_jobs')).toEqual([]);
    const revision=(await rows('select publication_revision from matches'))[0].publication_revision;
    expect(await enqueueManualPublication({teamId,matchId,routeId,expectedRevision:revision})).toHaveLength(1);
    expect(await rows('select trigger_kind from publication_jobs')).toEqual([{trigger_kind:'manual'}]);
  });
  it('permits manual-only routes and automatically keeps that explicit publication current',async () => {
    await database.pg.exec('update discord_routes set automatic=false');
    await importGame();
    expect(await rows('select * from publication_jobs')).toEqual([]);
    await enqueueManualPublication({teamId,matchId,routeId,expectedRevision:1});
    await database.pg.query("update matches set opponent='Corrected' where id=$1",[matchId]);
    expect(await rows('select source_revision from publication_jobs order by source_revision')).toEqual([{source_revision:1},{source_revision:2}]);
  });
  it('checks the expected preview revision inside the same DB operation and rejects foreign teams',async () => {
    await importGame();
    await expect(enqueueManualPublication({teamId,matchId,routeId,expectedRevision:0})).rejects.toMatchObject({status:409,code:'DISCORD_PREVIEW_OUTDATED'});
    await expect(enqueueManualPublication({teamId:userId,matchId,routeId})).rejects.toMatchObject({status:404});
    expect(await rows('select * from publication_jobs')).toHaveLength(1);
  });
  it('respects category filters, supports several configured destinations and does not transfer after recategorization',async () => {
    await database.pg.query("insert into discord_routes(team_id,guild_id,channel_id,automatic) values($1,'100000000000000001','100000000000000003',true)",[teamId]);
    await importGame();
    expect(await rows('select * from publication_jobs')).toHaveLength(2);
    await database.pg.query("insert into discord_routes(team_id,guild_id,channel_id,automatic) values($1,'100000000000000001','100000000000000004',true)",[teamId]);
    await database.pg.query("update matches set opponent='Updated' where id=$1",[matchId]);
    expect(await rows('select * from discord_publications')).toHaveLength(2);
    await expect(database.pg.query("insert into discord_routes(team_id,guild_id,channel_id) values($1,'100000000000000001','100000000000000002')",[teamId])).rejects.toMatchObject({code:'23505'});
  });
  it('claims one logical publication across simultaneous callers and supersedes stale queued versions',async () => {
    await importGame();
    await database.pg.query("update matches set opponent='New version' where id=$1",[matchId]);
    await due();await recoverPublicationJobs();
    const claims=await Promise.all([claimPublicationJob(),claimPublicationJob()]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(Number(claims.find(Boolean).source_revision)).toBe(2);
    expect(await rows('select status from publication_jobs order by source_revision')).toEqual([{status:'superseded'},{status:'preparing'}]);
  });
  it('retries an expired preparation but fences an expired sending lease before any later revision',async () => {
    await importGame();await due();
    const job=await claimPublicationJob();
    await database.pg.exec("update publication_jobs set lease_expires_at=now()-interval '1 second'; update discord_publications set lease_expires_at=now()-interval '1 second'");
    await recoverPublicationJobs();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'retry_wait'}]);
    await claimPublicationJob();
    await database.pg.exec("update publication_jobs set status='sending',lease_expires_at=now()-interval '1 second'; update discord_publications set state='sending',lease_expires_at=now()-interval '1 second'");
    await database.pg.query("update matches set opponent='Newer while sending' where id=$1",[matchId]);
    await due();await recoverPublicationJobs();
    expect(await rows('select state from discord_publications')).toEqual([{state:'uncertain'}]);
    expect(await rows('select status from publication_jobs order by source_revision')).toEqual([{status:'uncertain'},{status:'queued'}]);
    expect(await claimPublicationJob()).toBeNull();
    await expect(retryPublicationJob({teamId,jobId:job.id})).rejects.toMatchObject({status:409});
  });
  it('cancels removed matches and retains the known message reference for explicit withdrawal',async () => {
    await importGame();
    await database.pg.exec("update discord_publications set message_id='100000000000000099',state='published'");
    await database.pg.query('delete from matches where id=$1',[matchId]);
    expect(await rows('select status,last_error_code from publication_jobs')).toEqual([{status:'cancelled',last_error_code:'MATCH_DELETED'}]);
    expect(await rows('select state,message_id from discord_publications')).toEqual([{state:'deleted',message_id:'100000000000000099'}]);
    expect(await claimPublicationJob()).toBeNull();
  });
  it('pauses without sending, cancels obsolete configurations and versions a fresh manual request',async () => {
    await importGame();await due();
    await database.pg.exec("update discord_connections set status='paused'");
    expect(await claimPublicationJob()).toBeNull();
    await database.pg.exec("update discord_connections set status='active',config_version=config_version+1");
    await recoverPublicationJobs();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'cancelled'}]);
    const jobs=await enqueueManualPublication({teamId,matchId,routeId,expectedRevision:1});
    expect(Number(jobs[0].source_revision)).toBe(2);
    expect(Number(jobs[0].config_version)).toBe(2);
  });
});

describe('Discord retry decisions',() => {
  it('honors Discord backoff and fences ambiguous sends instead of blind retry',() => {
    expect(retryDelaySeconds(1,2.6,()=>0)).toBe(4);
    expect(retryDelaySeconds(4,undefined,()=>0)).toBe(120);
    expect(classifyPublicationFailure({status:429},true,1)).toBe('retry_wait');
    expect(classifyPublicationFailure({status:403},true,1)).toBe('blocked');
    expect(classifyPublicationFailure({status:503},true,1)).toBe('uncertain');
    expect(classifyPublicationFailure(new Error('network lost'),true,1)).toBe('uncertain');
    expect(classifyPublicationFailure(new Error('render failed'),false,1)).toBe('retry_wait');
    expect(classifyPublicationFailure(new Error('render failed'),false,8)).toBe('blocked');
  });
});

describe('Discord delivery state machine with real PostgreSQL',() => {
  async function processNext() {await due();const job=await claimPublicationJob();expect(job).toBeTruthy();return {job,outcome:await processPublicationJob(job)};}
  it('reuses the same PNG for two destinations with identical visible options',async () => {
    await database.pg.query("insert into discord_routes(team_id,guild_id,channel_id,automatic) values($1,'100000000000000001','100000000000000003',true)",[teamId]);
    transport.getAsset.mockResolvedValue(Buffer.from('png'));
    await importGame();
    expect((await processNext()).outcome).toBe('succeeded');
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.render).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.render.mock.calls[0][1]).toEqual({includeHints:false});
    expect(await rows('select count(distinct asset_key)::int as assets from publication_snapshots')).toEqual([{assets:1}]);
  });
  it('falls back to factual text and the authenticated NXT5 link for an oversized PNG',async () => {
    transport.render.mockResolvedValue({bytes:Buffer.alloc(3*1024*1024+1),mimeType:'image/png',filename:'game.png'});
    await importGame();
    expect((await processNext()).outcome).toBe('succeeded');
    const options=transport.send.mock.calls[0][1];
    expect(options.files).toEqual([]);
    expect(options.body.embeds[0].fields).toContainEqual(expect.objectContaining({name:'Visuel'}));
    expect(options.body.embeds[0].image).toBeUndefined();
    expect(transport.asset).not.toHaveBeenCalled();
  });
  it('purges expired images and old orphan uploads while preserving unresolved shared assets',async () => {
    await database.pg.query("insert into discord_routes(team_id,guild_id,channel_id,automatic) values($1,'100000000000000001','100000000000000003',true)",[teamId]);
    transport.getAsset.mockResolvedValue(Buffer.from('png'));
    await importGame();await processNext();await processNext();
    await database.pg.exec("update publication_snapshots set created_at=now()-interval '40 days';update publication_jobs set status='uncertain' where publication_id=(select id from discord_publications order by id limit 1);update discord_publications set state='uncertain' where id=(select id from discord_publications order by id limit 1)");
    transport.blobs=[{key:'test/orphan.png'}];
    const result=await maintainDiscordPublications();
    expect(result.removed).toBe(1);
    expect(transport.deleteAsset).toHaveBeenCalledWith('test/orphan.png');
    expect(transport.deleteAsset).not.toHaveBeenCalledWith('test/asset.png');
    expect((await rows('select asset_key from publication_snapshots where asset_key is not null'))).toHaveLength(1);
    await database.pg.exec("update publication_jobs set status='succeeded';update discord_publications set state='published'");
    transport.blobs=[];
    await maintainDiscordPublications();
    expect(transport.deleteAsset).toHaveBeenCalledWith('test/asset.png');
    expect(await rows('select count(*)::int as snapshots from publication_snapshots')).toEqual([{snapshots:2}]);
  });
  it('creates once and patches the same message after correction, from one immutable snapshot per revision',async () => {
    await database.pg.exec("update discord_routes set mention_role_id='100000000000000077'");
    await importGame();
    const first=await processNext();expect(first.outcome).toBe('succeeded');
    const firstBody=transport.send.mock.calls[0][1].body;
    expect(firstBody.embeds[0].footer.text).toContain(publicationReference(first.job.publication_id,1));
    expect(transport.render.mock.calls[0][0].context.opponentName).toBe('Scrim');
    await database.pg.query("update matches set opponent='Corrected opponent' where id=$1",[matchId]);
    const second=await processNext();expect(second.outcome).toBe('succeeded');
    expect(transport.send.mock.calls.map(([,options])=>options.method)).toEqual(['POST','PATCH']);
    expect(transport.send.mock.calls[1][0]).toBe('/channels/100000000000000002/messages/100000000000000099');
    expect(transport.send.mock.calls[0][1].body.allowed_mentions.roles).toEqual(['100000000000000077']);
    expect(transport.send.mock.calls[1][1].body.allowed_mentions.roles).toEqual([]);
    expect(transport.send.mock.calls[1][1].body).not.toHaveProperty('nonce');
    expect(transport.send.mock.calls[1][1].body).not.toHaveProperty('enforce_nonce');
    expect(await rows('select state,message_id,published_revision from discord_publications')).toEqual([{state:'published',message_id:'100000000000000099',published_revision:2}]);
    expect((await rows('select body from publication_snapshots order by source_revision')).map(row=>row.body.context.opponentName)).toEqual(['Scrim','Corrected opponent']);
    expect(await rows('select status from discord_deliveries order by created_at')).toEqual([{status:'succeeded'},{status:'succeeded'}]);
  });
  it('keeps visible content quiet when only import metadata changes',async () => {
    await importGame();await processNext();
    await database.pg.query(`update matches set raw='{"metadata":{"source":"new-import-tool"}}'::jsonb where id=$1`,[matchId]);
    expect((await processNext()).outcome).toBe('unchanged');
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.render).toHaveBeenCalledTimes(1);
    expect(await rows('select published_revision from discord_publications')).toEqual([{published_revision:2}]);
  });
  it('rechecks the revision after rendering and cannot send a snapshot superseded during preparation',async () => {
    await importGame();
    transport.render.mockImplementationOnce(async () => {
      await database.pg.query("update matches set opponent='Changed during render' where id=$1",[matchId]);
      return {bytes:Buffer.from('png'),mimeType:'image/png',filename:'game.png'};
    });
    expect((await processNext()).outcome).toBe('superseded');
    expect(transport.send).not.toHaveBeenCalled();
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send.mock.calls[0][1].body.embeds[0].title).toContain('Changed during render');
  });
  it('keeps a preparation retryable when the connection is paused during render and sends after resume',async () => {
    await importGame();
    transport.render.mockImplementationOnce(async () => {
      await database.pg.exec("update discord_connections set status='paused'");
      return {bytes:Buffer.from('png'),mimeType:'image/png',filename:'game.png'};
    });
    expect((await processNext()).outcome).toBe('retry_wait');
    expect(transport.send).not.toHaveBeenCalled();
    expect(await rows('select status,attempts,retry_base_attempts from publication_jobs')).toEqual([{status:'retry_wait',attempts:1,retry_base_attempts:1}]);
    expect(await rows('select state,lease_token from discord_publications')).toEqual([{state:'pending',lease_token:null}]);
    expect(await claimPublicationJob()).toBeNull();
    await database.pg.exec("update discord_connections set status='active'");
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send).toHaveBeenCalledOnce();
  });
  it('keeps a previously claimed job when paused before preparation begins',async () => {
    await importGame();await due();const job=await claimPublicationJob();
    await database.pg.exec("update discord_connections set status='paused'");
    expect(await processPublicationJob(job)).toBe('retry_wait');
    expect(transport.render).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
    await database.pg.exec("update discord_connections set status='active'");
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send).toHaveBeenCalledOnce();
  });
  it('keeps a preparation retryable if the global publishing switch closes during rendering',async () => {
    await importGame();
    transport.render.mockImplementationOnce(async () => {
      transport.enabled=false;
      return {bytes:Buffer.from('png'),mimeType:'image/png',filename:'game.png'};
    });
    expect((await processNext()).outcome).toBe('retry_wait');
    expect(transport.send).not.toHaveBeenCalled();
    expect(await rows('select status,last_error_code from publication_jobs')).toEqual([{status:'retry_wait',last_error_code:'DISCORD_DISABLED'}]);
    transport.enabled=true;
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send).toHaveBeenCalledOnce();
  });
  it('still cancels a preparation if the connection is disconnected during rendering',async () => {
    await importGame();
    transport.render.mockImplementationOnce(async () => {
      await database.pg.exec("update discord_connections set status='disconnected'");
      return {bytes:Buffer.from('png'),mimeType:'image/png',filename:'game.png'};
    });
    expect((await processNext()).outcome).toBe('cancelled');
    expect(transport.send).not.toHaveBeenCalled();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'cancelled'}]);
  });
  it('handles a rate limit without declaring an uncertain send and retries using the same nonce',async () => {
    await importGame();
    transport.send.mockRejectedValueOnce({status:429,retryAfter:12,code:'DISCORD_RATE_LIMITED'});
    expect((await processNext()).outcome).toBe('retry_wait');
    expect(await rows("select available_at>now()+interval '10 seconds' as delayed from publication_jobs")).toEqual([{delayed:true}]);
    expect(await rows('select state from discord_publications')).toEqual([{state:'pending'}]);
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send.mock.calls[0][1].body.nonce).toBe(transport.send.mock.calls[1][1].body.nonce);
  });
  it('fences a lost creation acknowledgement, reconciles the bot reference, then patches the correction',async () => {
    await importGame();
    let delivered:any;
    transport.send.mockImplementationOnce(async (_path,options) => {
      delivered={id:'100000000000000099',embeds:options.body.embeds};
      throw {status:503,ambiguous:true,code:'DISCORD_UNAVAILABLE'};
    });
    expect((await processNext()).outcome).toBe('uncertain');
    await database.pg.query("update matches set opponent='Correction while uncertain' where id=$1",[matchId]);
    await due();expect(await claimPublicationJob()).toBeNull();
    transport.find.mockResolvedValueOnce(delivered);
    expect(await reconcilePublications()).toMatchObject({reconciled:1});
    expect((await processNext()).outcome).toBe('succeeded');
    expect(transport.send.mock.calls.map(([,options])=>options.method)).toEqual(['POST','PATCH']);
    expect(await rows('select published_revision from discord_publications')).toEqual([{published_revision:2}]);
  });
  it('keeps ambiguous creation fenced when a bounded history search finds nothing',async () => {
    await importGame();transport.send.mockRejectedValueOnce({status:503,ambiguous:true});
    await processNext();
    expect(await reconcilePublications()).toMatchObject({reconciled:0});
    expect(await rows('select state from discord_publications')).toEqual([{state:'uncertain'}]);
    expect(await claimPublicationJob()).toBeNull();
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('lets an operator reconcile only the exact bot message in the configured channel',async () => {
    await importGame();transport.send.mockRejectedValueOnce({status:503,ambiguous:true});
    const {job}=await processNext();
    const original=transport.send.mock.calls[0][1].body;
    const message={id:'100000000000000099',channel_id:'100000000000000002',author:{id:'100000000000000088'},embeds:original.embeds};
    transport.send.mockResolvedValueOnce({...message,author:{id:'100000000000000999'}});
    await expect(resolvePublicationJob({teamId,jobId:job.id,messageId:message.id})).rejects.toMatchObject({status:409,code:'DISCORD_MESSAGE_MISMATCH'});
    expect(await rows('select state from discord_publications')).toEqual([{state:'uncertain'}]);
    transport.send.mockResolvedValueOnce(message);
    await expect(resolvePublicationJob({teamId,jobId:job.id,messageId:message.id})).resolves.toMatchObject({ok:true});
    expect(await rows('select state,message_id from discord_publications')).toEqual([{state:'published',message_id:message.id}]);
  });
  it('keeps attempts monotonic across a manual retry so delivery history cannot collide',async () => {
    await importGame();transport.send.mockRejectedValueOnce({status:403,code:'DISCORD_FORBIDDEN'});
    const {job}=await processNext();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'blocked'}]);
    await retryPublicationJob({teamId,jobId:job.id});
    expect(await rows('select attempts,retry_base_attempts from publication_jobs')).toEqual([{attempts:1,retry_base_attempts:1}]);
    expect((await processNext()).outcome).toBe('succeeded');
    expect(await rows('select attempt,status from discord_deliveries order by attempt')).toEqual([{attempt:1,status:'blocked'},{attempt:2,status:'succeeded'}]);
  });
  it('rolls back both publication and job when the second half of a manual retry fails',async () => {
    await importGame();transport.send.mockRejectedValueOnce({status:403,code:'DISCORD_FORBIDDEN'});
    const {job}=await processNext();
    const publicationBefore=await rows('select state,lease_token,lease_expires_at,updated_at from discord_publications');
    const jobBefore=await rows('select status,attempts,retry_base_attempts,available_at,last_error_code,updated_at from publication_jobs');
    await database.pg.exec("alter table publication_jobs add constraint reject_retry_fixture check(status<>'queued')");
    try {
      await expect(retryPublicationJob({teamId,jobId:job.id})).rejects.toMatchObject({code:'23514'});
      expect(await rows('select state,lease_token,lease_expires_at,updated_at from discord_publications')).toEqual(publicationBefore);
      expect(await rows('select status,attempts,retry_base_attempts,available_at,last_error_code,updated_at from publication_jobs')).toEqual(jobBefore);
    } finally {await database.pg.exec('alter table publication_jobs drop constraint reject_retry_fixture');}
    await retryPublicationJob({teamId,jobId:job.id});
    expect((await processNext()).outcome).toBe('succeeded');
  });
  it('lets a fresh explicit share recover a blocked publication after its route configuration is fixed',async () => {
    await importGame();transport.send.mockRejectedValueOnce({status:403});await processNext();
    await database.pg.exec('update discord_connections set config_version=config_version+1');
    const [job]=await enqueueManualPublication({teamId,matchId,routeId,expectedRevision:1});
    expect(job.status).toBe('queued');
    expect((await processNext()).outcome).toBe('succeeded');
    expect(await rows('select state from discord_publications')).toEqual([{state:'published'}]);
  });
  it('reuses the logical message when a destination is removed and explicitly configured again',async () => {
    await importGame();await processNext();
    await database.pg.query('delete from discord_routes where id=$1',[routeId]);
    await database.pg.exec('update discord_connections set config_version=config_version+1');
    const [route]=await rows("insert into discord_routes(team_id,guild_id,channel_id) values($1,'100000000000000001','100000000000000002') returning id",[teamId]);
    await enqueueManualPublication({teamId,matchId,routeId:route.id,expectedRevision:1});
    expect((await processNext()).outcome).toBe('unchanged');
    expect(await rows('select route_id,message_id from discord_publications')).toEqual([{route_id:route.id,message_id:'100000000000000099'}]);
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('versions and renders new route policy even when the source game is unchanged',async () => {
    await importGame();await processNext();
    await database.pg.exec("update discord_routes set include_hints=true,mention_role_id='100000000000000077';update discord_connections set config_version=config_version+1");
    const [job]=await enqueueManualPublication({teamId,matchId,routeId,expectedRevision:1});
    expect(Number(job.source_revision)).toBe(2);
    expect((await processNext()).outcome).toBe('succeeded');
    const snapshots=await rows('select source_revision,content_hash,body from publication_snapshots order by source_revision');
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].body.context).toEqual(snapshots[1].body.context);
    expect(snapshots[0].content_hash).not.toBe(snapshots[1].content_hash);
    expect(transport.render).toHaveBeenCalledTimes(2);
    expect(transport.send.mock.calls[1][1].body.embeds[0].fields.some((field:any)=>field.name==='Piste de review NXT5')).toBe(true);
    expect(transport.send.mock.calls[1][1].body.allowed_mentions.roles).toEqual([]);
  });
  it('requires an explicit retry after a known Discord message disappears and never creates a replacement',async () => {
    await importGame();await processNext();
    await database.pg.query("update matches set opponent='Correction' where id=$1",[matchId]);
    transport.send.mockRejectedValueOnce({status:404});
    expect((await processNext()).outcome).toBe('blocked');
    expect(transport.send.mock.calls.map(([,options])=>options.method)).toEqual(['POST','PATCH']);
    expect(await rows('select state,message_id from discord_publications')).toEqual([{state:'blocked',message_id:'100000000000000099'}]);
  });
  it('retains a Discord acknowledgement through match deletion during the request without resurrecting the job',async () => {
    await importGame();
    transport.send.mockImplementationOnce(async (_path,options) => {
      await database.pg.query('delete from matches where id=$1',[matchId]);
      return {id:'100000000000000099',embeds:options.body.embeds};
    });
    await processNext();
    expect(await rows('select state,message_id from discord_publications')).toEqual([{state:'deleted',message_id:'100000000000000099'}]);
    expect(await rows('select status from publication_jobs')).toEqual([{status:'cancelled'}]);
  });
  it('retains an uncertain send after source deletion and resolves it to a withdrawable deleted publication',async () => {
    await importGame();
    let delivered:any;
    transport.send.mockImplementationOnce(async (_path,options) => {
      delivered={id:'100000000000000099',channel_id:'100000000000000002',author:{id:'100000000000000088'},embeds:options.body.embeds};
      await database.pg.query('delete from matches where id=$1',[matchId]);
      throw {status:503,ambiguous:true,code:'DISCORD_UNAVAILABLE'};
    });
    const {job,outcome}=await processNext();
    expect(outcome).toBe('uncertain');
    expect(await rows('select state,message_id,source_deleted_at is not null as deleted from discord_publications'))
      .toEqual([{state:'uncertain',message_id:null,deleted:true}]);
    expect(await rows('select status from publication_jobs')).toEqual([{status:'uncertain'}]);
    expect(await rows('select status from discord_deliveries')).toEqual([{status:'uncertain'}]);
    expect(await rows('select id from matches')).toEqual([]);
    expect(await claimPublicationJob()).toBeNull();
    transport.send.mockResolvedValueOnce(delivered);
    await expect(resolvePublicationJob({teamId,jobId:job.id,messageId:delivered.id})).resolves.toMatchObject({ok:true});
    expect(await rows('select state,message_id,source_deleted_at is not null as deleted from discord_publications'))
      .toEqual([{state:'deleted',message_id:delivered.id,deleted:true}]);
    expect(await rows('select status,last_error_code from publication_jobs')).toEqual([{status:'cancelled',last_error_code:'MATCH_DELETED'}]);
    expect(await rows('select status,message_id from discord_deliveries')).toEqual([{status:'succeeded',message_id:delivered.id}]);
    expect(transport.send.mock.calls.map(([,options])=>options.method)).toEqual(['POST','GET']);
  });
  it.each(['sending','cancelled'])('recovers a crash after deletion using the durable send receipt, even if the job was %s',async status => {
    await importGame();await due();const job=await claimPublicationJob();
    const [snapshot]=await rows("insert into publication_snapshots(publication_id,source_revision,content_hash,body) values($1,1,'crash-fixture','{}') returning id",[job.publication_id]);
    await database.pg.transaction(async (tx:any) => {
      await tx.query("update discord_publications set state='sending' where id=$1",[job.publication_id]);
      await tx.query("update publication_jobs set status='sending' where id=$1",[job.id]);
      await tx.query("insert into discord_deliveries(publication_id,job_id,snapshot_id,source_revision,attempt,status) values($1,$2,$3,1,$4,'sending')",
        [job.publication_id,job.id,snapshot.id,Number(job.attempts)]);
    });
    // The process dies after Discord may receive this operation: no catch or
    // acknowledgement handler runs. Deleting the source cannot erase the proof.
    await database.pg.query('delete from matches where id=$1',[matchId]);
    expect(await rows('select state,source_deleted_at is not null as deleted from discord_publications')).toEqual([{state:'sending',deleted:true}]);
    if (status==='cancelled') {
      await database.pg.exec("update publication_jobs set status='cancelled';update discord_publications set state='deleted'");
    }
    await database.pg.exec("update publication_jobs set lease_expires_at=now()-interval '1 second';update discord_publications set lease_expires_at=now()-interval '1 second'");
    await recoverPublicationJobs();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'uncertain'}]);
    expect(await rows('select state,source_deleted_at is not null as deleted from discord_publications')).toEqual([{state:'uncertain',deleted:true}]);
    expect(await rows('select status from discord_deliveries')).toEqual([{status:'uncertain'}]);
    expect(await claimPublicationJob()).toBeNull();
    const message={id:'100000000000000099',embeds:[{footer:{text:'NXT5 · '+publicationReference(job.publication_id,1)}}]};
    transport.find.mockResolvedValueOnce(message);
    expect(await reconcilePublications()).toMatchObject({reconciled:1});
    expect(await rows('select state,message_id,source_deleted_at is not null as deleted from discord_publications')).toEqual([{state:'deleted',message_id:message.id,deleted:true}]);
    expect(await rows('select status from publication_jobs')).toEqual([{status:'cancelled'}]);
    expect(transport.send).not.toHaveBeenCalled();
  });
  it('recovers when Discord accepted the send but persisting its acknowledgement fails',async () => {
    await importGame();database.failQuery='with completed_publication';
    expect((await processNext()).outcome).toBe('uncertain');
    const delivered={id:'100000000000000099',embeds:transport.send.mock.calls[0][1].body.embeds};
    transport.find.mockResolvedValueOnce(delivered);
    expect(await reconcilePublications()).toMatchObject({reconciled:1});
    expect(await rows('select state,message_id from discord_publications')).toEqual([{state:'published',message_id:delivered.id}]);
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it('makes hashes independent of generated time, source revision and object key order',() => {
    expect(publicationContentHash({sourceRevision:1,generatedAt:'yesterday',facts:{a:1,b:2}},{}))
      .toBe(publicationContentHash({facts:{b:2,a:1},generatedAt:'today',sourceRevision:9},{}));
    expect(publicationContentHash({facts:{a:1}},{})).not.toBe(publicationContentHash({facts:{a:1}},{include_hints:true}));
  });
});

describe('Discord command replay and server linkage against PostgreSQL',() => {
  const interaction=(id:string,name:string,code?:string)=>({id,guild_id:'100000000000000001',member:{user:{id:'100000000000000050'},permissions:'32'},data:{options:[{name,options:code ? [{name:'code',value:code}]:[]}]}});
  const otherTeam='a0000000-0000-4000-8000-000000000006';
  const accessDenied='Lie ton compte Discord à NXT5 et vérifie que tu es responsable de cette équipe.';
  beforeEach(async () => {
    await database.pg.query("insert into discord_user_links(discord_user_id,user_id,discord_label) values('100000000000000050',$1,'Test owner')",[userId]);
  });
  async function addSharedTeam(name='Academy',guild='100000000000000001',role:'captain'|'player'|null='captain') {
    const otherOwner='a0000000-0000-4000-8000-000000000001';
    await database.pg.query("insert into users(id,account_name,name,password_hash) values($1,'other-owner','Other owner','unused')",[otherOwner]);
    await database.pg.query("insert into teams(id,owner_id,name,tag) values($1,$2,$3,'OTH')",[otherTeam,otherOwner,name]);
    await database.pg.query("insert into discord_connections(team_id,guild_id,status,enabled_at) values($1,$2,'active',now()-interval '1 hour')",[otherTeam,guild]);
    if(role) await database.pg.query('insert into team_members(team_id,user_id,role) values($1,$2,$3)',[otherTeam,userId,role]);
  }
  function teamInteraction(id:string,name:string,team:string) {
    const command=interaction(id,name);
    command.data.options[0].options=[{name:'equipe',value:team}];
    return command;
  }
  it('deduplicates a signed interaction ID and never re-executes a replayed pause',async () => {
    const command=interaction('100000000000000101','pause');
    const result=await executeDiscordCommand(command);
    expect(result).toContain('pause');
    await database.pg.exec("update discord_connections set status='active'");
    expect(await executeDiscordCommand(command)).toBe(result);
    expect(await rows('select status from discord_connections')).toEqual([{status:'active'}]);
    expect(await rows("select action,metadata from audit_logs where action='discord.pause'")).toEqual([{action:'discord.pause',metadata:{guildId:command.guild_id,discordUserId:command.member.user.id,interactionId:command.id,source:'discord'}}]);
    expect(await rows('select status from discord_interaction_receipts')).toEqual([{status:'completed'}]);
  });
  it('claims concurrent duplicate commands only once',async () => {
    const command=interaction('100000000000000102','pause');
    await Promise.all([executeDiscordCommand(command),executeDiscordCommand(command)]);
    expect(await rows("select action from audit_logs where action='discord.pause'")).toHaveLength(1);
    expect(await rows('select interaction_id from discord_interaction_receipts')).toHaveLength(1);
  });
  it('links two teams concurrently to the same server and consumes their own codes once',async () => {
    await database.pg.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Other','OTH')",[otherTeam,userId]);
    await database.pg.exec("update discord_connections set guild_id=null,status='pending',enabled_at=null");
    await database.pg.query("insert into discord_connections(team_id,status) values($1,'pending')",[otherTeam]);
    const codes=['0123456789ABCDEF','FEDCBA9876543210'];
    for (const [index,team] of [teamId,otherTeam].entries()) {
      await database.pg.query("insert into discord_link_codes(team_id,created_by,code_hash,expires_at) values($1,$2,$3,now()+interval '10 minutes')",[team,userId,createHash('sha256').update(codes[index]).digest('hex')]);
    }
    const responses=await Promise.all(codes.map((code,index)=>executeDiscordCommand(interaction(`10000000000000011${index}`,'connecter',code))));
    expect(responses.filter(response=>response.startsWith('Serveur relié'))).toHaveLength(2);
    expect(await rows("select team_id from discord_connections where guild_id='100000000000000001' and status='paused'")).toHaveLength(2);
    expect(await rows('select id from discord_link_codes where consumed_at is not null')).toHaveLength(2);
    expect(await rows("select action from audit_logs where action='discord.connected'")).toHaveLength(2);
    expect(await executeDiscordCommand(interaction('100000000000000119','connecter',codes[0]))).toContain('déjà utilisé');
    expect(await rows("select config_version from discord_connections order by team_id")).toEqual([{config_version:2},{config_version:2}]);
  });
  it.each(['pause','reprendre','statut'])('requires a selected team for %s when the actor manages two teams on the server',async name => {
    await addSharedTeam();
    const before=await rows('select team_id,status,config_version from discord_connections order by team_id');
    expect(await executeDiscordCommand(interaction('100000000000000120',name))).toBe(accessDenied);
    expect(await rows('select team_id,status,config_version from discord_connections order by team_id')).toEqual(before);
    expect(await rows("select action from audit_logs where action in ('discord.pause','discord.resume')")).toEqual([]);
  });
  it('pauses and resumes only the selected team and names it in the response',async () => {
    await addSharedTeam();
    expect(await executeDiscordCommand(teamInteraction('100000000000000121','pause',teamId))).toContain('NXT5 test');
    expect(await rows('select team_id,status from discord_connections order by team_id')).toEqual([{team_id:teamId,status:'paused'},{team_id:otherTeam,status:'active'}]);
    await database.pg.query("update discord_connections set status='paused' where team_id=$1",[otherTeam]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000122','reprendre',teamId))).toContain('Connexion active pour NXT5 test');
    expect(await rows('select team_id,status from discord_connections order by team_id')).toEqual([{team_id:teamId,status:'active'},{team_id:otherTeam,status:'paused'}]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000123','statut',otherTeam))).toContain('Academy : en pause');
    expect((await rows("select entity_id from audit_logs where action in ('discord.pause','discord.resume')")).every(row=>row.entity_id===teamId)).toBe(true);
  });
  it('rejects foreign and disconnected teams, including explicit IDs',async () => {
    await addSharedTeam('Foreign','100000000000000099');
    expect(await executeDiscordCommand(teamInteraction('100000000000000124','pause',otherTeam))).toBe(accessDenied);
    await database.pg.query("update discord_connections set guild_id='100000000000000001',status='disconnected' where team_id=$1",[otherTeam]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000125','reprendre',otherTeam))).toBe(accessDenied);
    expect(await rows('select status from discord_connections where team_id=$1',[teamId])).toEqual([{status:'active'}]);
    expect(await rows("select action from audit_logs where action in ('discord.pause','discord.resume')")).toEqual([]);
  });
  it('accepts an unambiguous exact name but requires a stable ID for duplicate names',async () => {
    await addSharedTeam('NXT5 test');
    expect(await executeDiscordCommand(teamInteraction('100000000000000126','pause','nxt5 TEST'))).toBe(accessDenied);
    expect(await rows("select team_id from discord_connections where status='paused'")).toEqual([]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000127','pause',otherTeam))).toContain('NXT5 test');
    await database.pg.query("update teams set name='Academy' where id=$1",[otherTeam]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000128','statut','ACADEMY'))).toContain('Academy : en pause');
  });
  it('prioritizes stable IDs over lookalike names, normalizes UUID case and escapes response labels',async () => {
    await addSharedTeam('[Academy](https://example.test)');
    await database.pg.query('update teams set name=$2 where id=$1',[teamId,otherTeam.toUpperCase()]);
    const result=await executeDiscordCommand(teamInteraction('100000000000000130','pause',otherTeam.toUpperCase()));
    expect(result).toContain('\\[Academy\\]\\(https://example.test\\)');
    expect(await rows('select team_id,status from discord_connections order by team_id')).toEqual([{team_id:teamId,status:'active'},{team_id:otherTeam,status:'paused'}]);
  });
  it('suggests only teams managed by the linked account on this server with stable IDs and literal search',async () => {
    await addSharedTeam('NXT5 test');
    const autocomplete=(search:string,guild='100000000000000001',permissions='32')=>({...interaction('100000000000000129','pause'),guild_id:guild,member:{user:{id:'100000000000000050'},permissions},data:{options:[{name:'pause',options:[{name:'equipe',value:search,focused:true}]}]}});
    const choices=await discordTeamChoices(autocomplete('nxt5'));
    expect(choices.map(choice=>choice.value)).toEqual([teamId,otherTeam]);
    expect(new Set(choices.map(choice=>choice.name)).size).toBe(2);
    expect(await discordTeamChoices(autocomplete('%'))).toEqual([]);
    expect(await discordTeamChoices(autocomplete('','100000000000000099'))).toEqual([]);
    expect(await discordTeamChoices(autocomplete('','100000000000000001','0'))).toEqual([]);
    await database.pg.query("update discord_connections set status='disconnected' where team_id=$1",[otherTeam]);
    expect((await discordTeamChoices(autocomplete(''))).map(choice=>choice.value)).toEqual([teamId]);
    expect(await rows('select * from discord_interaction_receipts')).toEqual([]);
  });
  it('keeps another shared team invisible and rejects its IDs even for a Discord server manager',async () => {
    await addSharedTeam('Private academy','100000000000000001',null);
    const autocomplete={...interaction('100000000000000132','statut'),data:{options:[{name:'statut',options:[{name:'equipe',value:'',focused:true}]}]}};
    expect((await discordTeamChoices(autocomplete)).map(choice=>choice.value)).toEqual([teamId]);
    expect(await executeDiscordCommand(interaction('100000000000000133','statut'))).toContain('NXT5 test : active');
    for(const [index,name] of ['statut','pause','reprendre'].entries()) {
      expect(await executeDiscordCommand(teamInteraction(`10000000000000014${index}`,name,otherTeam))).toBe(accessDenied);
    }
    expect(await rows('select status from discord_connections where team_id=$1',[otherTeam])).toEqual([{status:'active'}]);
    expect(await rows("select action from audit_logs where action in ('discord.pause','discord.resume')")).toEqual([]);
    await database.pg.query("insert into team_members(team_id,user_id,role) values($1,$2,'player')",[otherTeam,userId]);
    expect((await discordTeamChoices(autocomplete)).map(choice=>choice.value)).toEqual([teamId]);
    expect(await executeDiscordCommand(teamInteraction('100000000000000145','pause',otherTeam))).toBe(accessDenied);
  });
  it('caps autocomplete at 25 teams while search finds teams beyond the first page',async () => {
    for(let i=0;i<30;i++) {
      const id=`b0000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
      await database.pg.query("insert into teams(id,owner_id,name,tag) values($1,$2,$3,'NXT')",[id,userId,`Academy ${String(i).padStart(2,'0')}`]);
      await database.pg.query("insert into discord_connections(team_id,guild_id,status) values($1,'100000000000000001','paused')",[id]);
    }
    const query=(value:string)=>({...interaction('100000000000000131','statut'),data:{options:[{name:'statut',options:[{name:'equipe',value,focused:true}]}]}});
    expect(await discordTeamChoices(query(''))).toHaveLength(25);
    expect(await discordTeamChoices(query('Academy 29'))).toEqual([{name:'Academy 29 [NXT] · 00000029',value:'b0000000-0000-4000-8000-000000000029'}]);
  });
});

describe('Discord wakeup without delaying imports',() => {
  it('skips empty queues and lets only the fast path dispatch a future eight-second debounce',async () => {
    const fetch=vi.fn().mockResolvedValue(new Response('',{status:202}));vi.stubGlobal('fetch',fetch);
    expect(await dispatchPublicationBatch({allowSoon:true})).toMatchObject({dispatched:false});
    await importGame();
    expect(await dispatchPublicationBatch()).toMatchObject({dispatched:false});
    expect(await dispatchPublicationBatch({allowSoon:true})).toMatchObject({dispatched:true});
    expect(fetch).toHaveBeenCalledOnce();
    const [url,request]=fetch.mock.calls[0];
    expect(String(url)).toBe('https://nxt5.test/.netlify/functions/discord-publish-background');
    expect(request.headers['x-nxt5-discord-signature']).toBe('signed-test');
    const payload=JSON.parse(request.body);
    expect(payload.notBefore).toBeGreaterThan(Date.now());
    expect(payload.notBefore).toBeLessThanOrEqual(Date.now()+8000);
  });
  it('hands dispatch to waitUntil and preserves the scheduled fallback when HTTP fails',async () => {
    await importGame();
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Dispatcher unreachable')));
    const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
    let pending:Promise<void>|undefined;
    const result=wakeDiscordPublications({waitUntil:(work:Promise<void>)=>{pending=work;}});
    expect(result).toBeUndefined();expect(pending).toBeInstanceOf(Promise);
    await expect(pending).resolves.toBeUndefined();
    expect(await rows('select status from publication_jobs')).toEqual([{status:'queued'}]);
    expect(logger).toHaveBeenCalledWith('[discord-dispatch]',{code:'FAST_WAKE_FAILED',fallback:'scheduled-dispatch'});
    logger.mockRestore();
  });
});
