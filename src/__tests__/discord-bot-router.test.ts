import { readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
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
const roleA = '200000000000000101', roleB = '200000000000000102';
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
const withRoles = (data: any, roles: string[], permissions = '0') => ({ ...data, member: { ...data.member, roles, permissions } });
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
  state.sql.mockReset().mockImplementation((query: any, ...args: any[]) => Array.isArray(query) && query.raw
    ? rows(query.map((part: string, index: number) => part + (index < args.length ? `$${index + 1}` : '')).join(''), args)
    : rows(query, args[0] || []));
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

describe('Signed Discord HTTP bot routing', () => {
  it('keeps each shared-server team behind its own Discord role across listing, selection, reads, legacy management and autocomplete', async () => {
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'captain')", [otherTeam, member]);
    await rows("update team_members set role='captain' where team_id=$1 and user_id=$2", [team, member]);
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$3,$4),($2,$3,$5)',
      [team, otherTeam, guild, [roleA], [roleB]]);

    const accountWithoutRoles = await dispatch(command('equipe liste'));
    expect(description(accountWithoutRoles)).not.toContain(team);
    expect(description(accountWithoutRoles)).not.toContain(otherTeam);
    const listA = await dispatch(withRoles(command('equipe liste'), [roleA]));
    expect(description(listA)).toContain('Team A');
    expect(description(listA)).not.toContain(otherTeam);
    const listB = await dispatch(withRoles(command('equipe liste'), [roleB]));
    expect(description(listB)).not.toContain(team);
    expect(description(listB)).toContain(otherTeam);

    const chooseB = await dispatch(withRoles(command('equipe choisir', { nom: otherTeam }), [roleA]));
    expect(description(chooseB)).toContain('pas accessible');
    expect(await rows('select team_id from discord_user_team_choices')).toEqual([]);
    const readB = await dispatch(withRoles(command('derniere', { equipe: otherTeam }), [roleA], '32'));
    expect(description(readB)).toContain('pas accessible');
    const readA = await dispatch(withRoles(command('derniere', { equipe: team }), [roleA]));
    expect(readA.message.embeds[0].title).toContain('Known opponent');

    const legacy = (path: string, teamId: string, roles: string[]) => withRoles(command(path, { equipe: teamId }), roles, '32');
    for (const path of ['statut', 'pause', 'reprendre']) {
      const blocked = await dispatch(legacy(path, otherTeam, [roleA]));
      expect(blocked.message.content).toContain('responsable de cette équipe');
    }
    expect((await rows('select status from discord_connections where team_id=$1', [otherTeam]))[0].status).toBe('active');
    const status = await dispatch(legacy('statut', team, [roleA]));
    expect(status.message.content).toContain('Team A');
    const paused = await dispatch(legacy('pause', team, [roleA]));
    expect(paused.message.content).toContain('Team A');
    expect((await rows('select status from discord_connections where team_id=$1', [team]))[0].status).toBe('paused');

    const legacyAutocomplete = (roles: string[]) => withRoles({ type: 4, member: person(), data: { name: 'nxt',
      options: [{ name: 'pause', options: [{ name: 'equipe', value: '', focused: true }] }] } }, roles, '32');
    expect((await dispatch(legacyAutocomplete([roleA]))).ack.data.choices.map((choice: any) => choice.value)).toEqual([team]);
    expect((await dispatch(legacyAutocomplete([]))).ack.data.choices).toEqual([]);
    const memberAutocomplete = (roles: string[]) => withRoles({ type: 4, member: person(), data: { name: 'nxt',
      options: [{ type: 2, name: 'equipe', options: [{ type: 1, name: 'choisir', options: [{ name: 'nom', value: '', focused: true }] }] }] } }, roles);
    expect((await dispatch(memberAutocomplete([roleB]))).ack.data.choices.map((choice: any) => choice.value)).toEqual([otherTeam]);
    expect((await dispatch(memberAutocomplete([]))).ack.data.choices).toEqual([]);

    await dispatch(withRoles(command('equipe choisir', { nom: otherTeam }), [roleB]));
    expect((await rows('select team_id from discord_user_team_choices'))[0].team_id).toBe(otherTeam);
    const noFallback = await dispatch(withRoles(command('stats equipe'), [roleA]));
    expect(description(noFallback)).toContain('Choisis ton équipe');
  });

  it('rejects stale buttons and menus after a configured Discord role is removed', async () => {
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$2,$3)', [team, guild, [roleA]]);
    const list = await dispatch(withRoles(command('game chercher', { periode: 'semaine' }), [roleA]));
    const menu = list.message.components[0].components[0];
    const menuDenied = await dispatch(component(menu.custom_id, memberDiscord, [matchId]));
    expect(description(menuDenied)).toContain('pas accessible');
    expect(JSON.stringify(menuDenied.message)).not.toContain('Known opponent');
    const menuAllowed = await dispatch(withRoles(component(menu.custom_id, memberDiscord, [matchId]), [roleA]));
    expect(menuAllowed.message.embeds[0].title).toContain('Known opponent');

    const preview = await dispatch(withRoles(command('objectifs definir', { objectif: 'Scoped objective' }, coachDiscord), [roleA]));
    const confirm = button(preview.message, 'Confirmer');
    const denied = await dispatch(component(confirm, coachDiscord));
    expect(description(denied)).toContain('pas accessible');
    expect(await rows('select title from discord_team_goals')).toEqual([]);
    const allowed = await dispatch(withRoles(component(confirm, coachDiscord), [roleA]));
    expect(allowed.message.embeds[0].title).toBe('Objectif créé');
    expect(await rows('select title from discord_team_goals')).toEqual([{ title: 'Scoped objective' }]);
  });

  it('rechecks the Discord role at modal opening, submission and final confirmation', async () => {
    await rows('insert into discord_bot_role_access(team_id,guild_id,role_ids) values($1,$2,$3)', [team, guild, [roleA]]);
    const start = new Date(Date.now() + 3 * 86_400_000);
    await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'Original','scrim',$3,60)", [id(40), team, start.toISOString()]);
    const request = await dispatch(withRoles(command('evenement modifier', { evenement: id(40) }, coachDiscord), [roleA]));
    const open = button(request.message, 'Ouvrir le formulaire');
    expect(description(await dispatch(component(open, coachDiscord)))).toContain('pas accessible');
    const opened = await dispatch(withRoles(component(open, coachDiscord), [roleA]));
    expect(opened.ack.type).toBe(9);
    const form = opened.ack.data;
    const values = form.components.map((row: any) => ({ type: 1, components: row.components.map((input: any) => ({ type: 4,
      custom_id: input.custom_id, value: input.custom_id === 'titre' ? 'Authorized change' : input.value || '' })) }));
    const submission = { type: 5, member: person(coachDiscord), data: { custom_id: form.custom_id, components: values } };
    expect(description(await dispatch(submission))).toContain('pas accessible');
    expect((await rows('select title from discord_team_events where id=$1', [id(40)]))[0].title).toBe('Original');
    const preview = await dispatch(withRoles(submission, [roleA]));
    const confirm = button(preview.message, 'Confirmer');
    expect(description(await dispatch(component(confirm, coachDiscord)))).toContain('pas accessible');
    expect((await rows('select title from discord_team_events where id=$1', [id(40)]))[0].title).toBe('Original');
    const done = await dispatch(withRoles(component(confirm, coachDiscord), [roleA]));
    expect(done.message.embeds[0].title).toBe('Événement modifié');
    expect((await rows('select title from discord_team_events where id=$1', [id(40)]))[0].title).toBe('Authorized change');
  });
  it('keeps help immediately accessible and private without any personal account or database query', async () => {
    await rows('delete from discord_user_links');
    state.sql.mockClear();
    const result = await dispatch(command('help'));
    expect(result.ack).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] } } });
    expect(state.sql).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
    const next = button(result.ack.data, 'Suivant');
    const page = await dispatch(component(next));
    expect(page.ack.type).toBe(7); // updates the existing ephemeral help message
    expect(state.sql).not.toHaveBeenCalled();
    expect(page.ack.data.allowed_mentions.parse).toEqual([]);
  });

  it('acknowledges type 2 before database work and sends the read result to the original private webhook', async () => {
    const result = await dispatch(command('stats equipe', { periode: 'semaine' }));
    expect(result.ack).toEqual({ type: 5, data: { flags: 64 } });
    expect(result.message.allowed_mentions.parse).toEqual([]);
    expect(result.message.embeds[0].title).toBe('Statistiques d’équipe');
    const [url, options] = state.fetch.mock.calls[0];
    expect(url).toBe(`https://discord.com/api/v10/webhooks/${app}/test-interaction-token/messages/@original`);
    expect(options).toMatchObject({ method: 'PATCH', redirect: 'error' });
    expect(await rows('select status from discord_interaction_receipts')).toEqual([{ status: 'completed' }]);
  });

  it('rejects missing signatures and preview invocations before exposing any read data', async () => {
    const request = signed(command('stats equipe'));
    const unsigned = new Request(request.url, { method: 'POST', body: await request.text() });
    expect((await interactions(unsigned, { deploy: { context: 'production' } } as any)).status).toBe(401);
    expect((await interactions(signed(command('stats equipe')), { deploy: { context: 'deploy-preview' } } as any)).status).toBe(401);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it('rechecks membership and guild when a previously valid game menu is clicked', async () => {
    const list = await dispatch(command('game chercher', { periode: 'semaine' }));
    const menu = list.message.components[0].components[0];
    const opened = await dispatch(component(menu.custom_id, memberDiscord, [matchId]));
    expect(opened.message.embeds[0].title).toContain('Known opponent');
    const wrongGuild = await dispatch(component(menu.custom_id, memberDiscord, [matchId]), { guild_id: otherGuild });
    expect(description(wrongGuild)).toContain('pas accessible');
    await rows('delete from team_members where team_id=$1 and user_id=$2', [team, member]);
    const removed = await dispatch(component(menu.custom_id, memberDiscord, [matchId]));
    expect(description(removed)).toContain('pas accessible');
    expect(JSON.stringify(removed.message)).not.toContain('Known opponent');
    expect(removed.ack.data.flags).toBe(64);
  });

  it('rechecks staff privileges at confirmation and binds confirmation tokens to their creator', async () => {
    const preview = await dispatch(command('objectifs definir', { objectif: 'Préparer le prochain bloc' }, coachDiscord));
    const confirm = button(preview.message, 'Confirmer');
    expect(confirm).toMatch(/^nxt:confirm:[a-f0-9]{48}$/);
    const intruder = await dispatch(component(confirm, memberDiscord));
    expect(description(intruder)).toContain('expiré');
    expect(await rows('select id from discord_team_goals')).toEqual([]);
    await rows("update team_members set role='player' where team_id=$1 and user_id=$2", [team, coach]);
    const downgraded = await dispatch(component(confirm, coachDiscord));
    expect(description(downgraded)).toContain('staff');
    expect(await rows('select id from discord_team_goals')).toEqual([]);
    await rows("update team_members set role='coach' where team_id=$1 and user_id=$2", [team, coach]);
    const saved = await dispatch(component(confirm, coachDiscord));
    expect(saved.message.embeds[0].title).toBe('Objectif créé');
    expect(await rows('select title from discord_team_goals')).toEqual([{ title: 'Préparer le prochain bloc' }]);
    const replay = await dispatch(component(confirm, coachDiscord));
    expect(description(replay)).toContain('déjà été utilisé');
    expect(await rows('select title from discord_team_goals')).toHaveLength(1);
    const commands = await rows('select command_name from discord_interaction_receipts');
    expect(commands.some((entry: any) => entry.command_name === 'confirmation')).toBe(true);
    expect(JSON.stringify(commands)).not.toContain(confirm.split(':')[2]);
  });

  it('opens a scoped type 9 modal, validates type 5 values, and changes an event only after confirmation', async () => {
    const start = new Date(Date.now() + 3 * 86_400_000);
    await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'Initial title','scrim',$3,60)", [id(40), team, start.toISOString()]);
    const request = await dispatch(command('evenement modifier', { evenement: id(40) }, coachDiscord));
    const opened = await dispatch(component(button(request.message, 'Ouvrir le formulaire'), coachDiscord));
    expect(opened.ack.type).toBe(9);
    expect(opened.message).toBeNull();
    const form = opened.ack.data;
    const values = form.components.map((row: any) => ({ type: 1, components: row.components.map((input: any) => ({ type: 4,
      custom_id: input.custom_id, value: input.custom_id === 'titre' ? 'Reviewed title' : input.value || '' })) }));
    const preview = await dispatch({ type: 5, member: person(coachDiscord), data: { custom_id: form.custom_id, components: values } });
    expect(preview.ack).toEqual({ type: 5, data: { flags: 64 } });
    expect(description(preview)).toContain('Reviewed title');
    expect((await rows('select title from discord_team_events where id=$1', [id(40)]))[0].title).toBe('Initial title');
    const confirmed = await dispatch(component(button(preview.message, 'Confirmer'), coachDiscord));
    expect(confirmed.message.embeds[0].title).toBe('Événement modifié');
    expect((await rows('select title,revision from discord_team_events where id=$1', [id(40)]))[0]).toMatchObject({ title: 'Reviewed title', revision: 2 });
  });

  it('rejects modal submissions after staff access is removed and never consumes another user’s form', async () => {
    const start = new Date(Date.now() + 3 * 86_400_000);
    await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'Unchanged','scrim',$3,60)", [id(40), team, start.toISOString()]);
    const request = await dispatch(command('evenement modifier', { evenement: id(40) }, coachDiscord));
    const open = button(request.message, 'Ouvrir le formulaire');
    expect(description(await dispatch(component(open, memberDiscord)))).toContain('expiré');
    const opened = await dispatch(component(open, coachDiscord));
    const form = opened.ack.data;
    const values = form.components.map((row: any) => ({ type: 1, components: row.components.map((input: any) => ({ type: 4, custom_id: input.custom_id, value: input.value || '' })) }));
    await rows("update team_members set role='player' where team_id=$1 and user_id=$2", [team, coach]);
    const refused = await dispatch({ type: 5, member: person(coachDiscord), data: { custom_id: form.custom_id, components: values } });
    expect(description(refused)).toContain('staff');
    expect((await rows('select title,revision from discord_team_events where id=$1', [id(40)]))[0]).toMatchObject({ title: 'Unchanged', revision: 1 });
  });

  it('records review read buttons only for the current version and for the authenticated user', async () => {
    await rows("insert into reports(id,team_id,title,content,discord_summary,discord_version) values($1,$2,'Public review','Notes','Validated summary',2)", [id(50), team]);
    for (const version of ['0', 'NaN', '-1']) {
      const invalid = await dispatch(component(`nxt:review:read:${id(50)}:${version}`));
      expect(invalid.message.embeds[0].title).toBe('Commande indisponible');
      expect(await rows('select * from discord_review_reads')).toEqual([]);
    }
    const stale = await dispatch(component(`nxt:review:read:${id(50)}:1`));
    expect(description(stale)).toContain('modifiée');
    expect(await rows('select * from discord_review_reads')).toEqual([]);
    const result = await dispatch(component(`nxt:review:read:${id(50)}:2`));
    expect(result.message.embeds[0].title).toBe('Lecture enregistrée');
    expect(await rows('select user_id,report_version from discord_review_reads')).toEqual([{ user_id: member, report_version: 2 }]);
    expect(result.ack.data.flags).toBe(64);
  });

  it('refuses legacy team commands and a foreign link code to a manager of the shared Discord server', async () => {
    const serverManager = (path: string, options: any) => ({ ...command(path, options), member: { ...person(), permissions: '32' } });
    for (const path of ['statut', 'pause', 'reprendre']) {
      const result = await dispatch(serverManager(path, { equipe: otherTeam }));
      expect(JSON.stringify(result.message)).toContain('responsable de cette équipe');
      expect(JSON.stringify(result.message)).not.toContain('PRIVATE_TEAM');
    }
    const suggestions = () => dispatch({ type: 4, member: { ...person(), permissions: '32' },
      data: { name: 'nxt', options: [{ name: 'pause', options: [{ name: 'equipe', value: '', focused: true }] }] } });
    expect((await suggestions()).ack).toEqual({ type: 8, data: { choices: [] } });
    const playerStatus = await dispatch(serverManager('statut', { equipe: team }));
    expect(playerStatus.message.content).toContain('responsable de cette équipe');
    expect((await rows('select status from discord_connections where team_id=$1', [otherTeam]))[0].status).toBe('active');
    const code = 'A1B2C3D4E5F60708';
    await rows("insert into discord_link_codes(code_hash,team_id,created_by,expires_at) values($1,$2,$3,now()+interval '10 minutes')",
      [createHash('sha256').update(code).digest('hex'), otherTeam, owner]);
    const refused = await dispatch(serverManager('connecter', { code }));
    expect(refused.message.content).toContain('responsable de cette équipe');
    expect((await rows('select consumed_at from discord_link_codes where team_id=$1', [otherTeam]))[0].consumed_at).toBeNull();
    expect((await rows('select status from discord_connections where team_id=$1', [otherTeam]))[0].status).toBe('active');

    await rows("update team_members set role='captain' where team_id=$1 and user_id=$2", [team, member]);
    expect((await suggestions()).ack).toEqual({ type: 8, data: { choices: [{ name: 'Team A [AAA] · 00000010', value: team }] } });
    const implicitTeam = await dispatch(serverManager('statut', {}));
    expect(implicitTeam.message.content).toContain('Team A');
    expect(implicitTeam.message.content).not.toContain('PRIVATE_TEAM');
    const allowed = await dispatch(serverManager('pause', { equipe: team }));
    expect(allowed.message.content).toContain('Team A');
    expect((await rows('select status from discord_connections where team_id=$1', [team]))[0].status).toBe('paused');
    expect((await rows('select status from discord_connections where team_id=$1', [otherTeam]))[0].status).toBe('active');
  });
});
