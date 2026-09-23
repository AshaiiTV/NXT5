import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, auth: vi.fn(), rate: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  // Preserve Neon transaction semantics and real PostgreSQL constraints while
  // keeping the security suite isolated from the network and production data.
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return { fields: result.fields, rows: result.rows.map((row: any) => result.fields.map((field: any) => {
        const value = row[field.name];
        if (value === null || value === undefined) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (typeof value === 'boolean') return value ? 't' : 'f';
        if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '+00');
        return String(value);
      })), rowCount: result.affectedRows ?? result.rows.length };
    }
    try {
      if (body.queries) return new Response(JSON.stringify({ results: await state.pg.transaction(async (tx: any) => {
        const results = []; for (const query of body.queries) results.push(await execute(tx, query)); return results;
      }) }));
      return new Response(JSON.stringify(await execute(state.pg, body)));
    } catch (error: any) {
      return new Response(JSON.stringify({ message: error.message, code: error.code }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@identity-tests.invalid/nxt5') };
});
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAuth: state.auth }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: state.rate }));

import accountEndpoint from '../../netlify/functions/discord-account';
import { beginDiscordAccountLink, executeDiscordAccount, finishDiscordAccountLink, reviewDiscordAccountLink, unlinkDiscordAccount } from '../../netlify/functions/_lib/discord-bot-account';
import { assertBotStaff, BOT_SCHEMA_VERSIONS, botIdentity, botTeams, botTokenHash, loadBotPending, resolveBotContext, saveBotPending } from '../../netlify/functions/_lib/discord-bot-common';
import { withDiscordContext } from '../../netlify/functions/_lib/discord-runtime';
import { pruneDiscordBotArtifacts } from '../../netlify/functions/_lib/discord-bot-schedule';

const uuid = (value: number) => `90000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const owner = uuid(1), member = uuid(2), otherMember = uuid(3);
const teamA = uuid(10), teamB = uuid(11), outsideGuild = uuid(12), privateTeam = uuid(13), disconnectedTeam = uuid(14);
const playerA = uuid(20), playerB = uuid(21);
const actor = '100000000000000101', otherActor = '100000000000000102';
const guild = '100000000000000201', otherGuild = '100000000000000202';
const context = { deploy: { context: 'production' } } as any;
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows as any[];
const interaction = (discordUserId = actor, guildId = guild) => ({ guild_id: guildId, member: { user: { id: discordUserId, username: 'Discord player' } } });
const website = (method: string, token?: string, headers: Record<string, string> = {}, env = context) => accountEndpoint(new Request('https://nxt5.example/.netlify/functions/discord-account' + (method === 'GET' && token ? '?token=' + token : ''), {
  method, headers: { origin: 'https://nxt5.example', 'content-type': 'application/json', ...headers },
  ...(method === 'POST' ? { body: JSON.stringify({ token }) } : {}),
}), env);
async function begin(discordUserId = actor, guildId = guild) {
  const response: any = await beginDiscordAccountLink(interaction(discordUserId, guildId));
  const token = new URL(response.components[0].components[0].url).searchParams.get('lier')!;
  return { response, token };
}
async function link(discordUserId = actor, userId = member) {
  const [identity] = await rows('insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,$3) returning *', [discordUserId, userId, 'Discord player']);
  return identity;
}

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const filename of ['20260915_discord_publications.sql', '20260921_discord_shared_servers.sql', '20260922_discord_bot_identity.sql', '20260922_discord_bot_workflows.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + filename, import.meta.url), 'utf8'));
  }
  await state.pg.exec('create table app_schema_migrations(migration_key text primary key)');
}, 30_000);
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const [key, value] of Object.entries({ CONTEXT: 'production', AWS_LAMBDA_FUNCTION_NAME: '', LAMBDA_TASK_ROOT: '', SITE_ID: '', PUBLIC_SITE_URL: 'https://nxt5.example', DISCORD_APPLICATION_ID: '100000000000000010', DISCORD_BOT_TOKEN: 'test-only', DISCORD_PUBLIC_KEY: 'a'.repeat(64), DISCORD_WORKER_SECRET: 'test-only-worker-secret-longer-than-32', DISCORD_ENVIRONMENT: 'production' })) vi.stubEnv(key, value);
  state.auth.mockReset().mockResolvedValue({ id: member, account_name: 'member-account' });
  state.rate.mockReset().mockResolvedValue(undefined);
  await state.pg.exec('truncate users cascade; truncate app_schema_migrations');
  for (const key of BOT_SCHEMA_VERSIONS) await rows('insert into app_schema_migrations(migration_key) values($1)', [key]);
  await rows("insert into users(id,account_name,name,password_hash) values($1,'owner-account','Owner','unused'),($2,'member-account','Member','unused'),($3,'other-account','Other','unused')", [owner, member, otherMember]);
  for (const [team, name] of [[teamA, 'Alpha team'], [teamB, 'Beta team'], [outsideGuild, 'Other guild team'], [privateTeam, 'Private staff team'], [disconnectedTeam, 'Disconnected team']]) {
    await rows('insert into teams(id,owner_id,name,tag) values($1,$2,$3,$4)', [team, owner, name, team.slice(-3)]);
    await rows('insert into discord_connections(team_id,guild_id,status,created_by) values($1,$2,$3,$4)', [team, team === outsideGuild ? otherGuild : guild, team === disconnectedTeam ? 'disconnected' : 'paused', owner]);
    if (team !== privateTeam) await rows('insert into team_members(team_id,user_id,role) values($1,$2,$3)', [team, member, team === teamA ? 'captain' : 'player']);
  }
  await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'Player A','MID'),($4,$5,$3,'Player B','MID')", [playerA, teamA, member, playerB, teamB]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await state.pg?.close(); });

describe('Personal identity linking requires both accounts', () => {
  it('stores a hash, stages web consent without linking, then requires the original Discord actor and server', async () => {
    const { response, token } = await begin();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    expect(response.allowed_mentions).toEqual({ parse: [] });
    expect((await rows('select token_hash,user_id from discord_account_link_requests'))[0]).toEqual({ token_hash: botTokenHash(token), user_id: null });
    expect(JSON.stringify(await rows('select * from discord_account_link_requests'))).not.toContain(token);
    const viewed = await website('GET', token);
    expect(viewed.status).toBe(200);
    expect(await viewed.json()).toMatchObject({ request: { prepared: false, discordUserId: actor } });
    expect((await rows('select user_id from discord_account_link_requests'))[0].user_id).toBeNull();
    const waiting = await reviewDiscordAccountLink(token, actor, guild);
    expect(waiting.embeds[0].title).toBe('Confirmation NXT5 attendue');
    await expect(finishDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ status: 400 });
    expect((await website('POST', token)).status).toBe(200);
    expect(await rows('select * from discord_user_links')).toHaveLength(0);
    const review: any = await reviewDiscordAccountLink(token, actor, guild);
    expect(review.embeds[0].description).toContain('member-account');
    expect(review.components[0].components[0]).toMatchObject({ label: 'Confirmer la liaison', custom_id: 'nxt:link:confirm:' + token });
    await expect(finishDiscordAccountLink(token, otherActor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
    await expect(finishDiscordAccountLink(token, actor, otherGuild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
    await finishDiscordAccountLink(token, actor, guild);
    expect(await botIdentity(actor)).toMatchObject({ user_id: member });
    expect(await (await website('GET', token)).json()).toMatchObject({ link: { discord_user_id: actor } });
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
  });

  it('prevents another logged-in user from inspecting or claiming a prepared request', async () => {
    const { token } = await begin();
    await website('POST', token);
    state.auth.mockResolvedValue({ id: otherMember, account_name: 'other-account' });
    for (const method of ['GET', 'POST']) {
      const response = await website(method, token);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
    }
    expect((await rows('select user_id from discord_account_link_requests'))[0].user_id).toBe(member);
    expect(await rows('select * from discord_user_links')).toHaveLength(0);
  });

  it('never links a forwarded website token until the initiating Discord user confirms it', async () => {
    const { token } = await begin();
    state.auth.mockResolvedValue({ id: otherMember, account_name: 'other-account' });
    expect((await website('POST', token)).status).toBe(200);
    const review: any = await reviewDiscordAccountLink(token, actor, guild);
    expect(review.embeds[0].description).toContain('other-account');
    expect(await rows('select * from discord_user_links')).toHaveLength(0);
    await finishDiscordAccountLink(token, actor, guild, true);
    expect(await rows('select * from discord_user_links')).toHaveLength(0);
    await expect(finishDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
  });

  it('rejects expired tokens at both confirmation steps', async () => {
    const { token } = await begin();
    await website('POST', token);
    await rows("update discord_account_link_requests set expires_at=now()-interval '1 second'");
    expect((await website('GET', token)).status).toBe(409);
    expect((await website('POST', token)).status).toBe(409);
    await expect(reviewDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
    await expect(finishDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
    expect(await rows('select * from discord_user_links')).toHaveLength(0);
  });

  it('consumes the token and sibling requests so replay cannot create a second identity', async () => {
    const first = await begin();
    const second = await begin();
    await website('POST', first.token);
    await finishDiscordAccountLink(first.token, actor, guild);
    for (const token of [first.token, second.token]) {
      await expect(finishDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_EXPIRED' });
      expect((await website('POST', token)).status).toBe(409);
    }
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
    expect((await rows('select * from discord_account_link_requests')).every(row => row.used_at)).toBe(true);
  });

  it('enforces one-to-one identities and rolls back a conflicting confirmation', async () => {
    const { token } = await begin();
    await website('POST', token);
    await link(otherActor, member);
    await expect(finishDiscordAccountLink(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_LINK_CONFLICT' });
    expect(await rows('select discord_user_id,user_id from discord_user_links')).toEqual([{ discord_user_id: otherActor, user_id: member }]);
    expect((await rows('select used_at from discord_account_link_requests'))[0].used_at).toBeNull();
    await expect(rows('insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,$3)', [otherActor, otherMember, 'duplicate discord'])).rejects.toMatchObject({ code: '23505' });
    expect((await website('POST', token)).status).toBe(409);
  });

  it('allows only one winner when the same confirmation is clicked concurrently', async () => {
    const { token } = await begin();
    await website('POST', token);
    const results = await Promise.allSettled([finishDiscordAccountLink(token, actor, guild), finishDiscordAccountLink(token, actor, guild)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
  });

  it('authenticates website status and deletion independently of client-supplied Discord IDs', async () => {
    await link(); await link(otherActor, otherMember);
    const status = await website('GET');
    expect(await status.json()).toMatchObject({ link: { discord_user_id: actor } });
    expect((await website('DELETE')).status).toBe(200);
    expect(await rows('select discord_user_id from discord_user_links')).toEqual([{ discord_user_id: otherActor }]);
    state.auth.mockRejectedValue(Object.assign(new Error('Authentification requise.'), { status: 401 }));
    expect((await website('GET')).status).toBe(401);
  });

  it('rejects hostile origins, preview mutations, unsupported methods and an incomplete schema', async () => {
    const { token } = await begin();
    expect((await website('POST', token, { origin: 'https://hostile.example' })).status).toBe(403);
    expect((await website('POST', token, {}, { deploy: { context: 'deploy-preview' } } as any)).status).toBe(409);
    expect((await website('PUT')).status).toBe(405);
    await rows('delete from app_schema_migrations where migration_key=$1', [BOT_SCHEMA_VERSIONS[1]]);
    const unavailable = await website('GET');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ code: 'DISCORD_BOT_SCHEMA_REQUIRED' });
    expect((await rows('select user_id from discord_account_link_requests'))[0].user_id).toBeNull();
  });
});

describe('Team context is the intersection of membership and server configuration', () => {
  beforeEach(async () => { await link(); });

  it('excludes another server, disconnected teams and inaccessible memberships', async () => {
    expect((await botTeams(actor, guild)).teams.map(team => team.id).sort()).toEqual([teamA, teamB].sort());
    for (const team of [outsideGuild, privateTeam, disconnectedTeam]) {
      await expect(resolveBotContext(actor, guild, team)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    }
    await expect(botTeams(otherActor, guild)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_REQUIRED' });
  });

  it('persists an explicit context per actor and server, including its own player IDs', async () => {
    await expect(resolveBotContext(actor, guild)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    const list: any = await executeDiscordAccount(interaction(), 'equipe choisir', {});
    expect(list.embeds[0].description).toContain('Alpha team');
    expect(list.embeds[0].description).not.toContain('Private staff team');
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamB });
    expect(await resolveBotContext(actor, guild)).toMatchObject({ teamId: teamB, role: 'player', canStaff: false, canManage: false, playerIds: [playerB] });
    expect(await resolveBotContext(actor, otherGuild)).toMatchObject({ teamId: outsideGuild });
    await executeDiscordAccount(interaction(actor, otherGuild), 'equipe choisir', { nom: outsideGuild });
    expect(await rows('select guild_id,team_id from discord_user_team_choices order by guild_id')).toEqual([{ guild_id: guild, team_id: teamB }, { guild_id: otherGuild, team_id: outsideGuild }]);
    const profile: any = await executeDiscordAccount(interaction(), 'compte profil', {});
    expect(profile.embeds[0].description).toContain('Beta team');
    expect(profile.embeds[0].description).not.toContain('Other guild team');
  });

  it('rejects forced team choices by ID or name without replacing the legitimate selection', async () => {
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamA });
    const original = await rows('select * from discord_user_team_choices');
    for (const target of [privateTeam, 'PRIVATE STAFF TEAM', outsideGuild, 'Other guild team', disconnectedTeam, 'Disconnected team']) {
      await expect(executeDiscordAccount(interaction(), 'equipe choisir', { nom: target })).rejects.toMatchObject({
        status: 403, code: 'DISCORD_TEAM_FORBIDDEN', message: 'Cette équipe n’est pas accessible à ton compte sur ce serveur.',
      });
      expect(await rows('select * from discord_user_team_choices')).toEqual(original);
    }
    expect(await resolveBotContext(actor, guild)).toMatchObject({ teamId: teamA, playerIds: [playerA] });
  });

  it('does not treat an inaccessible persisted choice as an authorization grant', async () => {
    const identity = await botIdentity(actor);
    // Choices can outlive membership or server changes; the stored team ID is
    // deliberately untrusted even when the database row itself is valid.
    for (const target of [privateTeam, outsideGuild, disconnectedTeam]) {
      await rows(`insert into discord_user_team_choices(link_id,guild_id,team_id) values($1,$2,$3)
        on conflict(link_id,guild_id) do update set team_id=excluded.team_id`, [identity.id, guild, target]);
      const { teams } = await botTeams(actor, guild);
      expect(teams.map(team => team.id).sort()).toEqual([teamA, teamB].sort());
      expect(teams.every(team => !team.selected)).toBe(true);
      await expect(resolveBotContext(actor, guild)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
      await expect(resolveBotContext(actor, guild, target)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
      for (const command of ['equipe liste', 'compte profil']) {
        const message = JSON.stringify(await executeDiscordAccount(interaction(), command, {}));
        for (const name of ['Private staff team', 'Other guild team', 'Disconnected team']) expect(message).not.toContain(name);
        expect(message).not.toContain(target);
      }
    }
    await rows('delete from team_members where team_id=$1 and user_id=$2', [teamB, member]);
    expect(await resolveBotContext(actor, guild)).toMatchObject({ teamId: teamA, playerIds: [playerA] });
  });

  it('requires team membership even when the same account appears in its player roster or administers Discord', async () => {
    await rows("insert into players(id,team_id,user_id,name,role) values($1,$2,$3,'Private roster entry','MID')", [uuid(22), privateTeam, member]);
    const discordAdministrator = { ...interaction(), member: { ...interaction().member, permissions: '8' } };
    expect((await botTeams(actor, guild)).teams.map(team => team.id).sort()).toEqual([teamA, teamB].sort());
    await expect(resolveBotContext(actor, guild, privateTeam)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    await expect(executeDiscordAccount(discordAdministrator, 'equipe choisir', { nom: privateTeam })).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    expect(await rows('select * from discord_user_team_choices')).toHaveLength(0);
    expect(await resolveBotContext(actor, guild, teamA)).toMatchObject({ playerIds: [playerA] });
  });

  it('keeps another actor’s selection and privileges separate on a shared server', async () => {
    await link(otherActor, otherMember);
    await rows("insert into team_members(team_id,user_id,role) values($1,$2,'captain')", [privateTeam, otherMember]);
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamB });
    await executeDiscordAccount(interaction(otherActor), 'equipe choisir', { nom: privateTeam });
    expect(await resolveBotContext(otherActor, guild)).toMatchObject({ teamId: privateTeam, role: 'captain', canManage: true });
    expect(await resolveBotContext(actor, guild)).toMatchObject({ teamId: teamB, role: 'player', canManage: false, canStaff: false, playerIds: [playerB] });
    expect((await botTeams(actor, guild)).teams.filter(team => team.selected).map(team => team.id)).toEqual([teamB]);
    await expect(resolveBotContext(actor, guild, privateTeam)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    await expect(resolveBotContext(otherActor, guild, teamB)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
  });

  it('does not let an inaccessible namesake make a legitimate team ambiguous or reveal itself', async () => {
    await rows('update teams set name=$1 where id=$2', ['ALPHA TEAM', privateTeam]);
    const selected = await executeDiscordAccount(interaction(), 'equipe choisir', { nom: 'alpha team' });
    expect(JSON.stringify(selected)).not.toContain(privateTeam);
    expect(await resolveBotContext(actor, guild, 'ALPHA TEAM')).toMatchObject({ teamId: teamA, playerIds: [playerA] });
    const list = JSON.stringify(await executeDiscordAccount(interaction(), 'equipe liste', {}));
    expect(list).not.toContain(privateTeam);
    expect(list).not.toContain('ALPHA TEAM');
  });

  it('rechecks role and membership instead of trusting the saved selection', async () => {
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamA });
    const captain = await resolveBotContext(actor, guild);
    expect(captain).toMatchObject({ role: 'captain', canManage: true, canStaff: true, playerIds: [playerA] });
    await rows("update team_members set role='player' where team_id=$1 and user_id=$2", [teamA, member]);
    const player = await resolveBotContext(actor, guild);
    expect(player.canStaff).toBe(false);
    expect(() => assertBotStaff(player)).toThrowError(expect.objectContaining({ code: 'DISCORD_ROLE_FORBIDDEN' }));
    expect(() => assertBotStaff(player, true)).toThrowError(expect.objectContaining({ code: 'DISCORD_ROLE_FORBIDDEN' }));
    await rows('delete from team_members where team_id=$1 and user_id=$2', [teamA, member]);
    await expect(resolveBotContext(actor, guild, teamA)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    expect((await botTeams(actor, guild)).teams.map(team => team.id)).toEqual([teamB]);
    expect(await resolveBotContext(actor, guild)).toMatchObject({ teamId: teamB, role: 'player', canManage: false, canStaff: false, playerIds: [playerB] });
    const profile = JSON.stringify(await executeDiscordAccount(interaction(), 'compte profil', {}));
    expect(profile).toContain('Beta team');
    expect(profile).not.toContain('Alpha team');
  });

  it('grants the actual owner access without needing a team_members row', async () => {
    await link(otherActor, owner);
    const ctx = await resolveBotContext(otherActor, guild, privateTeam);
    expect(ctx).toMatchObject({ userId: owner, role: 'owner', canStaff: true, canManage: true });
  });

  it('rejects ambiguous names and does not silently switch the selected team', async () => {
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamA });
    await rows('update teams set name=$1,owner_id=$3 where id=$2', ['Alpha team', teamB, otherMember]);
    await expect(executeDiscordAccount(interaction(), 'equipe choisir', { nom: 'alpha team' })).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
    expect((await resolveBotContext(actor, guild)).teamId).toBe(teamA);
  });
});

describe('Pending actions remain bound to identity, actor and server', () => {
  beforeEach(async () => { await link(); });

  it('rejects another actor or server without consuming the rightful action', async () => {
    const ctx = await resolveBotContext(actor, guild, teamA);
    const token = await saveBotPending(ctx, 'evenement annuler', { evenement: uuid(80) }, 'confirm');
    const persisted = (await rows('select * from discord_bot_pending'))[0];
    expect(persisted.token_hash).toBe(botTokenHash(token));
    expect(persisted.link_id).toBe(ctx.identityId);
    expect(persisted.team_id).toBe(teamA);
    expect(JSON.stringify(persisted)).not.toContain(token);
    await expect(loadBotPending(token, otherActor, guild, true)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
    await expect(loadBotPending(token, actor, otherGuild, true)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
    expect((await rows('select consumed_at from discord_bot_pending'))[0].consumed_at).toBeNull();
    expect(await loadBotPending(token, actor, guild)).toMatchObject({ command: 'evenement annuler', options: { evenement: uuid(80) }, team_id: teamA });
  });

  it('atomically consumes at most once and rejects replays', async () => {
    const ctx = await resolveBotContext(actor, guild, teamA);
    const token = await saveBotPending(ctx, 'review partager', { review: uuid(90) }, 'confirm');
    const results = await Promise.allSettled([loadBotPending(token, actor, guild, true), loadBotPending(token, actor, guild, true)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    await expect(loadBotPending(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
  });

  it('rejects malformed and expired confirmation tokens', async () => {
    const ctx = await resolveBotContext(actor, guild, teamA);
    const token = await saveBotPending(ctx, 'draft notes', {}, 'modal', { title: 'Note' });
    await rows("update discord_bot_pending set expires_at=now()-interval '1 second'");
    await expect(loadBotPending(token, actor, guild, true)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
    await expect(loadBotPending('not-a-token', actor, guild)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_INVALID' });
    expect((await rows('select consumed_at from discord_bot_pending'))[0].consumed_at).toBeNull();
  });

  it('cascades old buttons and selections on unlink, including after relinking the same NXT5 account', async () => {
    await executeDiscordAccount(interaction(), 'equipe choisir', { nom: teamA });
    const old = await resolveBotContext(actor, guild);
    const token = await saveBotPending(old, 'review partager', {}, 'confirm');
    await unlinkDiscordAccount(actor);
    expect(await rows('select * from discord_bot_pending')).toHaveLength(0);
    expect(await rows('select * from discord_user_team_choices')).toHaveLength(0);
    await expect(botIdentity(actor)).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_REQUIRED' });
    const next = await link();
    expect(next.id).not.toBe(old.identityId);
    await expect(loadBotPending(token, actor, guild)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
    await expect(saveBotPending(old, 'review partager', {}, 'confirm')).rejects.toMatchObject({ code: 'DISCORD_ACCOUNT_CHANGED' });
  });

  it('does not let a still-valid confirmation preserve a revoked staff role', async () => {
    const original = await resolveBotContext(actor, guild, teamA);
    const token = await saveBotPending(original, 'evenement annuler', {}, 'confirm');
    await rows("update team_members set role='player' where team_id=$1 and user_id=$2", [teamA, member]);
    const pending = await loadBotPending(token, actor, guild);
    const current = await resolveBotContext(actor, guild, pending.team_id);
    expect(() => assertBotStaff(current)).toThrowError(expect.objectContaining({ code: 'DISCORD_ROLE_FORBIDDEN' }));
    await rows('delete from team_members where team_id=$1 and user_id=$2', [teamA, member]);
    await expect(resolveBotContext(actor, guild, pending.team_id)).rejects.toMatchObject({ code: 'DISCORD_TEAM_FORBIDDEN' });
  });

  it('allows an unlink confirmation without an active team but still requires the original identity', async () => {
    await rows('delete from team_members where user_id=$1', [member]);
    const response: any = await executeDiscordAccount(interaction(), 'compte delier', {});
    const token = response.components[0].components[0].custom_id.slice('nxt:confirm:'.length);
    expect(await loadBotPending(token, actor, guild)).toMatchObject({ command: 'compte delier', team_id: null });
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
    await expect(loadBotPending(token, otherActor, guild, true)).rejects.toMatchObject({ code: 'DISCORD_BUTTON_EXPIRED' });
  });

  it('refuses to create persistent identity artifacts from an isolated deployment', async () => {
    const ctx = await resolveBotContext(actor, guild, teamA);
    await expect(withDiscordContext({ deploy: { context: 'deploy-preview' } }, () => saveBotPending(ctx, 'review partager', {}, 'confirm'))).rejects.toMatchObject({ code: 'DISCORD_DEPLOY_PREVIEW_DISABLED' });
    await expect(withDiscordContext({ deploy: { context: 'branch-deploy' } }, () => unlinkDiscordAccount(actor))).rejects.toMatchObject({ code: 'DISCORD_DEPLOY_PREVIEW_DISABLED' });
    expect(await rows('select * from discord_bot_pending')).toHaveLength(0);
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
  });

  it('purges expired temporary notes and retired jobs while preserving identities, history and uncertain sends', async () => {
    const identity=await botIdentity(actor);
    await rows(`insert into discord_bot_pending(token_hash,link_id,guild_id,team_id,command,kind,options,expires_at)
      values($1,$3,$4,$5,'review creer','modal','{"resume":"private expired note"}',now()-interval '61 minutes'),
        ($2,$3,$4,$5,'review creer','modal','{}',now()-interval '59 minutes')`,['a'.repeat(64),'b'.repeat(64),identity.id,guild,teamA]);
    await rows(`insert into discord_account_link_requests(token_hash,discord_user_id,guild_id,discord_label,expires_at)
      values($1,$3,$4,'expired',now()-interval '61 minutes'),($2,$3,$4,'recent',now()-interval '59 minutes')`,['c'.repeat(64),'d'.repeat(64),actor,guild]);
    for(const status of ['sent','cancelled','failed','uncertain','queued','sending']) {
      await rows(`insert into discord_bot_outbox(team_id,guild_id,channel_id,channel_kind,kind,dedupe_key,config_version,state,updated_at)
        values($1,$2,$3,'reviews','review',$4,1,$4,now()-interval '31 days')`,[teamA,guild,'100000000000000301',status]);
    }
    await rows("insert into discord_team_goals(team_id,title) values($1,'Keep goal history')",[teamA]);
    expect(await pruneDiscordBotArtifacts()).toEqual({pending:1,linkRequests:1,outbox:3});
    expect((await rows('select token_hash from discord_bot_pending'))[0].token_hash).toBe('b'.repeat(64));
    expect((await rows('select token_hash from discord_account_link_requests'))[0].token_hash).toBe('d'.repeat(64));
    expect((await rows('select state from discord_bot_outbox order by state')).map(row=>row.state)).toEqual(['queued','sending','uncertain']);
    expect(await rows('select * from discord_user_links')).toHaveLength(1);
    expect(await rows('select * from discord_team_goals')).toHaveLength(1);
  });
});
