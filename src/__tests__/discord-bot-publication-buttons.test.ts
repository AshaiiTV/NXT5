import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, sql: vi.fn(), rate: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({
  sql: Object.assign(state.sql, { transaction: async (queries: Promise<any>[]) => Promise.all(queries) }),
}));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));

import { executeDiscordBot, openDiscordBotModal } from '../../netlify/functions/_lib/discord-bot';

const id = (value: number) => `73000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = id(1), player = id(2), teamA = id(10), teamB = id(11);
const eventA = id(20), eventB = id(21), reviewA = id(30);
const guild = '300000000000000001', otherGuild = '300000000000000002';
const commandA = '300000000000000003', commandB = '300000000000000004', publication = '300000000000000005';
const unassignedChannel = '300000000000000008';
const actor = '300000000000000006', roleA = '300000000000000007';
const eventMessage = '300000000000000101', otherEventMessage = '300000000000000102';
const reviewMessage = '300000000000000103', forgedMessage = '300000000000000199';
let interactionSequence = 0;

const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows as any[];
function button(customId: string, messageId: string, changes: Record<string, unknown> = {}) {
  return {
    id: String(300000000000001000n + BigInt(++interactionSequence)),
    type: 3, guild_id: guild, channel_id: publication,
    member: { user: { id: actor, username: 'Player' }, roles: [] },
    data: { custom_id: customId, component_type: 2 },
    message: { id: messageId }, ...changes,
  };
}
async function sent(kind: string, entityId: string, messageId: string, teamId = teamA, version?: number,
  stateName = 'sent') {
  await rows(`insert into discord_bot_outbox(team_id,guild_id,channel_id,channel_kind,kind,dedupe_key,config_version,state,message_id,event_id,report_id,report_version)
    values($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11)`, [
    teamId, guild, publication, kind === 'review' ? 'reviews' : 'planning', kind,
    `${kind}:${entityId}:${messageId}`, stateName, messageId,
    kind === 'review' ? null : entityId, kind === 'review' ? entityId : null, version || null,
  ]);
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const file of ['20260915_discord_publications.sql', '20260921_discord_shared_servers.sql',
    '20260922_discord_bot_identity.sql', '20260922_discord_bot_workflows.sql',
    '20260923_discord_bot_role_access.sql', '20260924_discord_command_channel.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  await state.pg.exec(`create table app_schema_migrations(migration_key text primary key);
    insert into app_schema_migrations values('discord-bot-identity-20260922-v1'),
      ('discord-bot-workflows-20260922-v1'),('discord-bot-role-access-20260923-v1'),
      ('discord-command-channel-20260924-v1')`);
}, 30_000);

beforeEach(async () => {
  for (const [key, value] of Object.entries({
    CONTEXT: 'production', PUBLIC_SITE_URL: 'https://nxt5.example',
    DISCORD_APPLICATION_ID: '300000000000000010', DISCORD_BOT_TOKEN: 'test-only',
    DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'test-worker-secret-long-enough-for-config',
    DISCORD_ENVIRONMENT: 'production', AWS_LAMBDA_FUNCTION_NAME: '', LAMBDA_TASK_ROOT: '', SITE_ID: '',
  })) vi.stubEnv(key, value);
  state.sql.mockReset().mockImplementation(rows);
  state.rate.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade');
  await rows("insert into users(id,account_name,name,password_hash) values($1,'owner','Owner','unused'),($2,'player','Player','unused')", [owner, player]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$3,'Team A','AAA'),($2,$3,'Team B','BBB')", [teamA, teamB, owner]);
  await rows("insert into team_members(team_id,user_id,role) values($1,$3,'player'),($2,$3,'player')", [teamA, teamB, player]);
  await rows("insert into discord_connections(team_id,guild_id,command_channel_id,status) values($1,$3,$4,'active'),($2,$3,$5,'active')",
    [teamA, teamB, guild, commandA, commandB]);
  await rows("insert into discord_bot_settings(team_id,channels) values($1,$3::jsonb),($2,$3::jsonb)",
    [teamA, teamB, JSON.stringify({ planning: publication, reviews: publication })]);
  await rows("insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,'Player')", [actor, player]);
  await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'Event A','scrim',now()+interval '2 days',60),($3,$4,'Event B','scrim',now()+interval '2 days',60)",
    [eventA, teamA, eventB, teamB]);
  await rows("insert into reports(id,team_id,title,content,discord_summary,discord_version) values($1,$2,'Review A','Notes','Shared summary',2)", [reviewA, teamA]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Buttons on previously published Discord messages', () => {
  it('accepts a presence button only on its exact sent bot message', async () => {
    await sent('reminder', eventA, eventMessage);
    const valid = await executeDiscordBot(button(`nxt:presence:${eventA}:present`, eventMessage));
    expect(valid.embeds[0].title).toBe('Présence enregistrée');
    expect(await rows('select event_id,user_id,status from discord_event_responses')).toEqual([
      { event_id: eventA, user_id: player, status: 'present' },
    ]);
    await rows('delete from discord_event_responses');
    for (const interaction of [
      button(`nxt:presence:${eventA}:present`, forgedMessage),
      button(`nxt:presence:${eventA}:present`, eventMessage, { channel_id: unassignedChannel }),
      button(`nxt:presence:${eventA}:present`, eventMessage, { guild_id: otherGuild }),
      button(`nxt:presence:${eventA}:present`, eventMessage, { message: undefined }),
    ]) await expect(executeDiscordBot(interaction)).rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
    await rows("update discord_bot_settings set channels=jsonb_set(channels,'{planning}',to_jsonb($2::text)) where team_id=$1",
      [teamA, unassignedChannel]);
    await expect(executeDiscordBot(button(`nxt:presence:${eventA}:present`, eventMessage)))
      .rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
    expect(await rows('select * from discord_event_responses')).toEqual([]);
  });

  it('keeps teams separate in a shared publication salon and rechecks the Discord role', async () => {
    await sent('presence', eventB, otherEventMessage, teamB);
    await expect(executeDiscordBot(button(`nxt:presence:${eventB}:present`, eventMessage)))
      .rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$2,$3)', [teamB, guild, [roleA]]);
    await expect(executeDiscordBot(button(`nxt:presence:${eventB}:present`, otherEventMessage)))
      .rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    const allowed = await executeDiscordBot(button(`nxt:presence:${eventB}:absent`, otherEventMessage,
      { member: { user: { id: actor, username: 'Player' }, roles: [roleA] } }));
    expect(allowed.embeds[0].title).toBe('Présence enregistrée');
    expect(await rows('select event_id,status from discord_event_responses')).toEqual([
      { event_id: eventB, status: 'absent' },
    ]);
    await rows('delete from team_members where team_id=$1 and user_id=$2', [teamB, player]);
    await expect(executeDiscordBot(button(`nxt:presence:${eventB}:present`, otherEventMessage,
      { member: { user: { id: actor, username: 'Player' }, roles: [roleA] } })))
      .rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    expect(await rows('select event_id,status from discord_event_responses')).toEqual([
      { event_id: eventB, status: 'absent' },
    ]);
  });

  it('keeps the original published message bound through the late-arrival modal', async () => {
    await sent('reminder', eventA, eventMessage);
    const prompt = await executeDiscordBot(button(`nxt:presence:${eventA}:retard`, eventMessage));
    const openId = prompt.components[0].components.find((item: any) => item.label === 'Ouvrir le formulaire').custom_id;
    await expect(openDiscordBotModal(button(openId, eventMessage, { channel_id: unassignedChannel })))
      .rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
    const modal = await openDiscordBotModal(button(openId, forgedMessage));
    expect(modal.type).toBe(9);
    const submission = {
      ...button(modal.data.custom_id, forgedMessage), type: 5,
      data: { custom_id: modal.data.custom_id, components: [{
        type: 1, components: [{ type: 4, custom_id: 'retard', value: '15' }],
      }] },
    };
    const saved = await executeDiscordBot(submission);
    expect(saved.embeds[0].title).toBe('Présence enregistrée');
    expect(await rows('select event_id,status,delay_minutes from discord_event_responses')).toEqual([
      { event_id: eventA, status: 'retard', delay_minutes: 15 },
    ]);
  });

  it('requires the sent review message and matching version before recording a read', async () => {
    await sent('review', reviewA, reviewMessage, teamA, 2);
    await sent('review', reviewA, forgedMessage, teamA, 1, 'queued');
    for (const interaction of [
      button(`nxt:review:read:${reviewA}:1`, reviewMessage),
      button(`nxt:review:read:${reviewA}:1`, forgedMessage),
      button(`nxt:review:read:${reviewA}:2`, forgedMessage),
    ]) await expect(executeDiscordBot(interaction)).rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
    expect(await rows('select * from discord_review_reads')).toEqual([]);
    const valid = await executeDiscordBot(button(`nxt:review:read:${reviewA}:2`, reviewMessage));
    expect(valid.embeds[0].title).toBe('Lecture enregistrée');
    expect(await rows('select user_id,report_version from discord_review_reads')).toEqual([
      { user_id: player, report_version: 2 },
    ]);
    await rows("update discord_bot_settings set channels=jsonb_set(channels,'{reviews}',to_jsonb($2::text)) where team_id=$1",
      [teamA, unassignedChannel]);
    await expect(executeDiscordBot(button(`nxt:review:read:${reviewA}:2`, reviewMessage)))
      .rejects.toMatchObject({ code: 'DISCORD_CHANNEL_FORBIDDEN' });
  });
});
