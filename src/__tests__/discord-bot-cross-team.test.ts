import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, sql: vi.fn(), rate: vi.fn(), fetch: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: Object.assign(state.sql, { transaction: async (queries: Promise<any>[]) => Promise.all(queries) }) }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));
import interactions from '../../netlify/functions/discord-interactions';

const id = (n: number) => `72000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), coach = id(2), member = id(3), team = id(10), otherTeam = id(11), matchId = id(20);
const app = '200000000000000001', guild = '200000000000000002', otherGuild = '200000000000000003';
const coachDiscord = '200000000000000004', memberDiscord = '200000000000000005';
const keys = generateKeyPairSync('ed25519');
const publicKey = (keys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(-32).toString('hex');
let interactionSequence = 0;
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows;
const person = (discordId = memberDiscord) => ({ permissions: '0', user: { id: discordId, username: 'Discord user' } });
const option = (name: string, value: any) => ({ name, value, type: typeof value === 'boolean' ? 5 : typeof value === 'number' ? 4 : 3 });
function command(path: string, options: any = {}, discordId = memberDiscord) {
  const [root, child] = path.split(' ');
  const leaf = { type: 1, name: child || root, options: Object.entries(options).map(([name, value]) => option(name, value)) };
  return { type: 2, member: person(discordId), data: { name: 'nxt', options: child ? [{ type: 2, name: root, options: [leaf] }] : [leaf] } };
}
function component(customId: string, discordId = memberDiscord, values?: string[]) {
  return { type: 3, member: person(discordId), data: { custom_id: customId, component_type: values ? 3 : 2, ...(values ? { values } : {}) } };
}
function signed(data: any, changes: any = {}) {
  const payload = { id: String(210000000000000000n + BigInt(++interactionSequence)), application_id: app, guild_id: guild,
    token: 'test-interaction-token', ...data, ...changes };
  const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now() / 1000));
  return new Request('https://nxt5.example/.netlify/functions/discord-interactions', { method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-signature-timestamp': timestamp,
      'x-signature-ed25519': sign(null, Buffer.from(timestamp + body), keys.privateKey).toString('hex') } });
}
async function dispatch(data: any, changes: any = {}) {
  state.fetch.mockClear();
  const pending: Promise<any>[] = [];
  const response = await interactions(signed(data, changes), { deploy: { context: 'production' }, waitUntil: (task: Promise<any>) => pending.push(task) } as any);
  const ack = await response.json();
  await Promise.all(pending);
  const calls = state.fetch.mock.calls;
  const message = calls.length ? JSON.parse(calls[calls.length - 1][1].body) : null;
  return { response, ack, message };
}
function button(payload: any, label: string) {
  return payload.components.flatMap((row: any) => row.components).find((item: any) => item.label === label)?.custom_id;
}
const description = (result: any) => result.message?.embeds?.[0]?.description || result.ack?.data?.embeds?.[0]?.description || '';

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const file of ['20260915_discord_publications.sql', '20260921_discord_shared_servers.sql', '20260922_discord_bot_identity.sql', '20260922_discord_bot_workflows.sql', '20260923_discord_bot_role_access.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  await state.pg.exec(`create table app_schema_migrations(migration_key text primary key);
    insert into app_schema_migrations values('discord-publications-20260915-v1'),('discord-bot-identity-20260922-v1'),('discord-bot-workflows-20260922-v1'),('discord-bot-role-access-20260923-v1')`);
}, 30_000);
beforeEach(async () => {
  for (const [key, value] of Object.entries({ PUBLIC_SITE_URL: 'https://nxt5.example', CONTEXT: 'production', DISCORD_APPLICATION_ID: app,
    DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_TOKEN: 'test-only', DISCORD_WORKER_SECRET: 'test-worker-secret-long-enough-for-config',
    DISCORD_ENVIRONMENT: 'production', DISCORD_PUBLISHING_ENABLED: 'true', AWS_LAMBDA_FUNCTION_NAME: '', LAMBDA_TASK_ROOT: '', SITE_ID: '' })) vi.stubEnv(key, value);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.sql.mockReset().mockImplementation(rows);
  state.rate.mockReset().mockResolvedValue(undefined);
  state.fetch.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', state.fetch);
  await state.pg.exec('truncate users cascade; truncate discord_interaction_receipts');
  await rows(`insert into users(id,account_name,name,password_hash) values($1,'owner','Owner','unused'),($2,'coach','Coach','unused'),($3,'member','Member','unused')`, [owner, coach, member]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$3,'Team A','AAA'),($2,$3,'PRIVATE_TEAM','BBB')", [team, otherTeam, owner]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$2,'coach'),($1,$3,'player')", [team, coach, member]);
  await rows("insert into discord_connections(team_id,guild_id,status) values($1,$3,'active'),($2,$3,'active')", [team, otherTeam, guild]);
  await rows('insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,\'Coach\'),($3,$4,\'Member\')', [coachDiscord, coach, memberDiscord, member]);
  await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'Member','MID')", [id(30), team, member]);
  await rows("insert into matches(id,team_id,game_id,opponent,result) values($1,$2,'TEST_GAME','Known opponent','Victoire')", [matchId, team]);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('New bot workflows deny foreign-team access on a shared server', () => {
  async function foreignData() {
    await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'PRIVATE_PLAYER','MID')", [id(31),otherTeam,owner]);
    await rows("insert into matches(id,team_id,game_id,opponent,result) values($1,$2,'PRIVATE_GAME','PRIVATE_OPPONENT','Victoire')", [id(21),otherTeam]);
    await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'PRIVATE_EVENT','scrim',now()+interval '2 days',90)", [id(41),otherTeam]);
    await rows("insert into discord_team_goals(id,team_id,player_id,title) values($1,$2,$3,'PRIVATE_GOAL')", [id(61),otherTeam,id(31)]);
    await rows("insert into reports(id,team_id,title,content,discord_summary) values($1,$2,'PRIVATE_REVIEW','PRIVATE_CONTENT','PRIVATE_SUMMARY')", [id(51),otherTeam]);
  }
  it('does not turn staff status on Team A into mutation rights on Team B via a foreign object ID', async () => {
    await foreignData();
    const attempts: [string, any][] = [
      ['objectifs definir',{objectif:'Attempt',joueur:id(31)}],
      ['objectifs terminer',{objectif:id(61)}],
      ['objectifs point',{objectif:id(61),note:'Attempt'}],
      ['draft notes',{evenement:id(41),texte:'Attempt'}],
      ['evenement modifier',{evenement:id(41),titre:'Attempt'}],
      ['evenement annuler',{evenement:id(41)}],
      ['presence repondre',{evenement:id(41),statut:'present'}],
      ['presence liste',{evenement:id(41)}],
      ['presence relancer',{evenement:id(41)}],
      ['review creer',{game:id(21),titre:'Attempt',resume:'Attempt'}],
      ['review partager',{review:id(51),canal:'200000000000000006'}],
      ['review lire',{review:id(51)}],
    ];
    for(const [path,options] of attempts){
      const result=await dispatch(command(path,options,coachDiscord));
      expect(result.message.embeds[0].title,path).toBe('Commande indisponible');
      expect(JSON.stringify(result.message),path).not.toContain('PRIVATE_');
      expect(result.message.components,path).toBeUndefined();
    }
    expect(await rows('select token_hash from discord_bot_pending')).toEqual([]);
    expect(await rows('select * from discord_event_responses')).toEqual([]);
    expect(await rows('select * from discord_review_reads')).toEqual([]);
    expect(await rows('select * from discord_draft_notes')).toEqual([]);
    expect(await rows('select * from discord_goal_updates')).toEqual([]);
    expect(await rows('select * from discord_bot_outbox')).toEqual([]);
    expect((await rows('select title,status,revision from discord_team_events where id=$1',[id(41)]))[0]).toMatchObject({title:'PRIVATE_EVENT',status:'scheduled',revision:1});
  });
  it('rejects forged team options and callbacks targeting foreign-team events and reviews', async () => {
    await foreignData();
    const attempts=[
      command('reglages fuseau',{fuseau:'UTC',equipe:otherTeam},coachDiscord),
      command('derniere',{equipe:otherTeam},memberDiscord),
      component(`nxt:presence:${id(41)}:present`),
      component(`nxt:review:read:${id(51)}:1`),
      component(`nxt:read:review:${team}`,memberDiscord,[id(51)]),
      component(`nxt:read:game:${team}`,memberDiscord,[id(21)]),
      component(`nxt:read:review:${otherTeam}`,memberDiscord,[id(51)]),
    ];
    for(const attempt of attempts){
      const result=await dispatch(attempt);
      expect(result.message.embeds[0].title).toBe('Commande indisponible');
      expect(JSON.stringify(result.message)).not.toContain('PRIVATE_');
    }
    expect(await rows('select * from discord_event_responses')).toEqual([]);
    expect(await rows('select * from discord_review_reads')).toEqual([]);
    expect(await rows('select * from discord_bot_settings')).toEqual([]);
  });
  it('pins confirmations to their original team and invalidates them after membership loss or relinking', async () => {
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'coach')",[otherTeam,coach]);
    await dispatch(command('equipe choisir',{nom:team},coachDiscord));
    const original=await dispatch(command('objectifs definir',{objectif:'Only Team A'},coachDiscord));
    const token=button(original.message,'Confirmer');
    await dispatch(command('equipe choisir',{nom:otherTeam},coachDiscord));
    await dispatch(component(token,coachDiscord));
    expect(await rows('select team_id,title from discord_team_goals')).toEqual([{team_id:team,title:'Only Team A'}]);
    const pending=await dispatch(command('objectifs definir',{objectif:'Must not execute'},coachDiscord));
    const obsolete=button(pending.message,'Confirmer');
    await rows('delete from team_members where team_id=$1 and user_id=$2',[otherTeam,coach]);
    expect(description(await dispatch(component(obsolete,coachDiscord)))).toContain('pas accessible');
    await rows('delete from discord_user_links where discord_user_id in ($1,$2)',[coachDiscord,memberDiscord]);
    await rows("insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,'Relinked')",[coachDiscord,member]);
    expect(description(await dispatch(component(obsolete,coachDiscord)))).toContain('expiré');
    expect(await rows('select title from discord_team_goals')).toEqual([{title:'Only Team A'}]);
  });
  it('uses PostgreSQL composite keys to reject a mismatched team in queued event and review messages', async () => {
    await foreignData();
    for(const [column,value] of [['event_id',id(41)],['report_id',id(51)]]){
      await expect(rows(`insert into discord_bot_outbox(team_id,guild_id,channel_id,channel_kind,kind,dedupe_key,config_version,${column}) values($1,$2,'200000000000000006','reviews','review',$3,1,$4)`,[team,guild,column,value])).rejects.toThrow('foreign key');
    }
    await expect(rows('insert into discord_review_reads(team_id,report_id,user_id,report_version) values($1,$2,$3,1)',[team,id(51),member])).rejects.toThrow('foreign key');
    expect(await rows('select * from discord_bot_outbox')).toEqual([]);
  });
});
