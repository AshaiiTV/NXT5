import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pg: null as any, sql: vi.fn(), request: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: state.sql }));
vi.mock('../../netlify/functions/_lib/discord-client', async original => ({ ...await original<any>(), discordRequest: state.request }));
import { executeDiscordRead } from '../../netlify/functions/_lib/discord-bot-read';
import type { BotContext } from '../../netlify/functions/_lib/discord-bot-common';

const id = (n: number) => `71000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const team = id(1), otherTeam = id(2), owner = id(3), member = id(4), another = id(5);
const ownPlayer = id(6), teammate = id(7), outsider = id(8);
const ctx: BotContext = { teamId: team, teamName: 'Équipe A', guildId: '100000000000000001', discordUserId: '100000000000000002',
  userId: member, role: 'player', canStaff: false, canManage: false, playerIds: [ownPlayer], timezone: 'Europe/Paris' };
const staff = { ...ctx, userId: owner, role: 'coach', canStaff: true };
const now = new Date('2026-09-22T12:00:00Z');
const rows = async (query: string, params: any[] = []) => (await state.pg.query(query, params)).rows;
const render = (payload: any) => JSON.stringify(payload);
const field = (payload: any, name: string) => payload.embeds[0].fields.find((f: any) => f.name === name)?.value;
const read = (command: string, options: any = {}, context = ctx) => executeDiscordRead(context, command, options);

beforeAll(async () => {
  state.pg = new PGlite();
  await state.pg.exec(readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    .replace('create extension if not exists pgcrypto;', '').replaceAll('gen_random_bytes(5)', "decode('0000000000','hex')"));
  for (const file of ['20260915_discord_publications.sql', '20260922_discord_bot_workflows.sql']) {
    await state.pg.exec(readFileSync(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
}, 30_000);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.stubEnv('PUBLIC_SITE_URL', 'https://nxt5.example');
  state.sql.mockReset().mockImplementation(rows);
  state.request.mockReset();
  await state.pg.exec('truncate users cascade');
  await rows(`insert into users(id,account_name,name,password_hash) values
    ($1,'owner','Coach','unused'),($2,'member','Membre','unused'),($3,'another','Autre','unused')`, [owner, member, another]);
  await rows("insert into teams(id,owner_id,name,tag) values($1,$3,'Équipe A','AAA'),($2,$3,'Autre équipe','BBB')", [team, otherTeam, owner]);
  await rows(`insert into players(id,team_id,user_id,name,role,roster_status) values
    ($1,$4,$6,'Alpha','MID','MAIN'),($2,$4,$7,'Bravo','JGL','MAIN'),($3,$5,$7,'Secret','MID','MAIN')`,
  [ownPlayer, teammate, outsider, team, otherTeam, member, another]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
afterAll(async () => { await state.pg?.close(); });

async function match(n: number, opts: any = {}) {
  const matchId = id(n), played = opts.played || '2026-09-21T18:00:00Z';
  await rows(`insert into matches(id,team_id,game_id,opponent,result,side,duration,duration_seconds,raw,created_at,category_id,category_ids)
    values($1,$2,$3,$4,$5,'Blue Side','30:00',1800,$6::jsonb,$7,$8,$9::jsonb)`,
  [matchId, opts.team || team, `EUW_${n}`, opts.name || `Opponent ${n}`, opts.result || 'Victoire',
    JSON.stringify({ info: { gameStartTimestamp: new Date(played).getTime(), gameDuration: 1800 } }), opts.imported || now.toISOString(), opts.category || null, JSON.stringify(opts.categories || [])]);
  for (const side of ['ALLY', 'ENEMY']) for (let i = 0; i < (side === 'ALLY' ? opts.count ?? 5 : 5); i++) {
    await rows(`insert into match_participants(match_id,player_id,team_key,champion,role,kills,deaths,assists,gold,vision,cs)
      values($1,$2,$3,$4,$5,$6,2,5,10000,20,180)`, [matchId,
      side === 'ALLY' && i === 0 ? (opts.team === otherTeam ? outsider : ownPlayer) : null,
      side, i === 0 ? 'Ahri' : `Champion${i}`, ['MID', 'TOP', 'JGL', 'ADC', 'SUP'][i], opts.kills ?? 3]);
  }
  return matchId;
}
async function report(n: number, opts: any = {}) {
  await rows(`insert into reports(id,team_id,title,content,created_at,updated_at,discord_status,discord_summary,discord_version,match_id,match_ids)
    values($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10::jsonb)`, [id(n), opts.team || team, opts.title || `Review ${n}`,
    opts.content || 'Résumé généré\n[NXT5_REPORT_V3]\nNotes staff\nPRIVATE_STAFF_SECRET', now.toISOString(), opts.status || 'published',
    opts.summary || '', opts.version || 1, opts.match || null, JSON.stringify(opts.matches || [])]);
  return id(n);
}

describe('Discord read commands · scoped queries and truthful aggregates', () => {
  it('returns null only for unknown commands and validates UUIDs before looking up games', async () => {
    state.sql.mockClear();
    expect(await read('unknown')).toBeNull();
    await expect(read('game voir', { game: "';delete from matches" })).rejects.toMatchObject({ status: 400 });
    expect(state.sql).not.toHaveBeenCalled();
    await expect(read('game voir', { game: id(999) })).rejects.toMatchObject({ status: 404 });
  });

  it('uses played dates, scopes categories and excludes unknown results from winrate', async () => {
    const cat = id(20);
    await rows("insert into match_categories(id,team_id,name) values($1,$2,'Scrim')", [cat, team]);
    await match(30, { categories: [cat] });
    await match(31, { category: cat, result: 'Défaite', kills: 5 });
    await match(32, { category: cat, result: 'Analyse', count: 4 });
    await match(33, { category: cat, played: '2025-01-01T00:00:00Z', imported: now.toISOString() });
    await match(34, { team: otherTeam });
    await match(35); // outside the requested category
    const payload = await read('bilan', { periode: 'semaine', categorie: 'Scrim' });
    expect(field(payload, 'Résultats')).toContain('3 games · 1 victoires · 1 défaites · 1 résultats inconnus');
    expect(field(payload, 'Résultats')).toContain('50 %');
    expect(field(payload, 'Kills / game')).toBe('20 · 2/3 games renseignées');
    expect(render(payload)).not.toContain('Opponent 33');
    expect(render(payload)).not.toContain('Opponent 34');
    expect(render(payload)).not.toContain('Opponent 35');
    expect(payload.allowed_mentions.parse).toEqual([]);
    expect(payload.flags).toBe(64);
  });

  it('compares consecutive periods without replacing absent data with zero', async () => {
    await match(30, { kills: 3 });
    await match(31, { played: '2026-09-10T12:00:00Z', result: 'Défaite', kills: 1 });
    const payload = await read('stats tendance', { periode: 'semaine' });
    expect(field(payload, 'Kills / game')).toContain('Actuel : 15 (1) · Précédent : 5 (1)');
    expect(field(payload, 'Kills / game')).toContain('Écart : 10');
    const empty = await read('stats equipe', { categorie: undefined, periode: 'jour' });
    // The recent game is in the last 24 hours; remove it and exercise no game/no denominator.
    await rows('delete from matches where id=$1', [id(30)]);
    const missing = await read('stats equipe', { periode: 'jour' });
    expect(field(missing, 'Kills / game')).toContain('Indisponible');
    expect(field(missing, 'Résultats')).toContain('Taux de victoire : Indisponible');
    expect(empty).toBeTruthy();
  });

  it('offers period/group menus and computes a selected group across its actual dates', async () => {
    await match(30, { played: '2025-01-01T00:00:00Z' });
    await match(31);
    await match(32, { team: otherTeam });
    await rows("insert into match_archives(id,team_id,name,match_ids) values($1,$2,'Bloc ancien',$3::jsonb),($4,$5,'SECRET_GROUP','[]')",
      [id(40), team, JSON.stringify([id(30), id(31), id(32)]), id(41), otherTeam]);
    expect((await read('bilan')).components[0].components[0].custom_id).toBe(`nxt:read:bilan:${team}`);
    const selection = await read('bilan', { periode: 'session' });
    expect(selection.components[0].components[0].options).toEqual([{ label: 'Bloc ancien', value: id(40) }]);
    const payload = await read('bilan', { periode: 'session', groupe: id(40) });
    expect(field(payload, 'Résultats')).toContain('2 games');
    expect(render(payload)).not.toContain(id(32));
    await expect(read('bilan', { periode: 'session', groupe: id(41) })).rejects.toMatchObject({ status: 404 });
  });

  it('finds the latest played game and rejects comparisons across teams', async () => {
    await match(30, { played: '2026-09-01T00:00:00Z', imported: '2026-09-22T11:00:00Z' });
    await match(31, { played: '2026-09-21T00:00:00Z', imported: '2026-09-21T01:00:00Z' });
    await match(32, { team: otherTeam });
    const payload = await read('derniere');
    expect(field(payload, 'Game')).toContain(id(31));
    await expect(read('game comparer', { game_a: id(31), game_b: id(32) })).rejects.toMatchObject({ status: 404 });
    expect(state.request).not.toHaveBeenCalled();
    const menu = (await read('game chercher')).components[0].components[0];
    expect(menu.custom_id).toBe(`nxt:read:game:${team}`);
    expect(menu.options.map((o: any) => o.value)).toEqual([id(31)]);
    await rows("update matches set raw='{}' where id=$1", [id(31)]);
    expect(field(await read('game voir', { game: id(31) }), 'Game')).toContain('Date d’import (date de partie inconnue)');
    expect((await read('bilan', { periode: 'semaine' })).embeds[0].description).toContain('leur date d’import est utilisée');
  });

  it('reuses only a current published PNG from the trusted Discord attachment host', async () => {
    await match(30);
    const [current] = await rows('select publication_revision from matches where id=$1', [id(30)]);
    const channel = '100000000000000030', messageId = '100000000000000031';
    await rows(`insert into discord_publications(team_id,entity_id,guild_id,channel_id,message_id,state,published_revision)
      values($1,$2,$3,$4,$5,'published',$6)`, [team, id(30), ctx.guildId, channel, messageId, Number(current.publication_revision) - 1]);
    await read('game voir', { game: id(30) });
    expect(state.request).not.toHaveBeenCalled(); // stale image would disagree with the corrected stats
    await rows('update discord_publications set published_revision=$1', [current.publication_revision]);
    const url = 'https://cdn.discordapp.com/attachments/100000000000000030/100000000000000031/game.png?sig=example';
    state.request.mockResolvedValueOnce({ attachments: [{ url }] });
    expect((await read('game voir', { game: id(30) })).embeds[0].image).toEqual({ url });
    state.request.mockResolvedValueOnce({ attachments: [{ url: 'https://untrusted.example/private.png' }] });
    expect((await read('game voir', { game: id(30) })).embeds[0].image).toBeUndefined();
  });

  it('aggregates only the selected allied player and counts champion games once', async () => {
    await match(30);
    await match(31, { result: 'Défaite', kills: 5 });
    await match(32, { team: otherTeam });
    const payload = await read('joueur stats', { joueur: 'Alpha', periode: 'semaine' });
    expect(field(payload, 'Échantillon')).toContain('2 games · 1 victoires · 1 défaites');
    expect(field(payload, 'Kills / game')).toBe('4 · 2/2 games');
    const champions = await read('stats champions', { joueur: ownPlayer, periode: 'semaine' });
    expect(field(champions, 'Ahri')).toContain('2 games · 1 V / 1 D · 50 %');
    await expect(read('joueur profil', { joueur: outsider })).rejects.toMatchObject({ status: 404 });
  });
});

describe('Discord reads · private player goals and review versions', () => {
  it('combines legacy/new goals while keeping other players’ individual goals private', async () => {
    await rows(`insert into player_goals(id,team_id,player_id,title,metric,target_value) values
      ($1,$4,$5,'OLD_OWN','deaths',3),($2,$4,$6,'OTHER_PRIVATE','vision',30),($3,$7,$8,'OUTSIDE_PRIVATE','deaths',2)`,
    [id(50), id(51), id(52), team, ownPlayer, teammate, otherTeam, outsider]);
    await rows(`insert into discord_team_goals(id,team_id,player_id,title) values
      ($1,$4,null,'COLLECTIVE'),($2,$4,$5,'NEW_OWN'),($3,$4,$6,'NEW_PRIVATE')`, [id(53), id(54), id(55), team, ownPlayer, teammate]);
    await rows('insert into discord_player_goal_updates(team_id,goal_id,user_id,note) values($1,$2,$3,\'Mon progrès\')', [team, id(50), member]);
    await rows('insert into discord_goal_updates(team_id,goal_id,user_id,note) values($1,$2,$3,\'CONFIDENTIAL_NOTE\')', [team, id(55), another]);
    const payload = render(await read('objectifs liste'));
    for (const allowed of ['OLD\\_OWN', 'NEW\\_OWN', 'COLLECTIVE']) expect(payload).toContain(allowed.replace(/\\/g, '\\\\'));
    expect(payload).not.toContain('OTHER');
    expect(payload).not.toContain('PRIVATE');
    expect(payload).toContain('Mon progrès');
    expect(payload).not.toContain('CONFIDENTIAL');
    await expect(read('objectifs liste', { joueur: teammate })).rejects.toMatchObject({ status: 403 });
    const all = render(await read('objectifs liste', {}, staff));
    expect(all).toContain('OTHER');
    expect(all).not.toContain('OUTSIDE');
    await rows("update player_goals set status='completed' where id=$1", [id(50)]);
    const history = await read('objectifs liste');
    expect(field(history, 'Objectifs récemment clôturés')).toContain('Mon progrès');
  });

  it('hides drafts and staff notes from members and keeps legacy free text private', async () => {
    await report(60);
    await report(61, { title: 'PRIVATE_DRAFT', status: 'draft' });
    await report(62, { content: 'UNKNOWN_PRIVATE_LEGACY' });
    await report(63, { team: otherTeam, title: 'OUTSIDE_REVIEW' });
    const list = render(await read('review liste'));
    expect(list).not.toContain('PRIVATE'); expect(list).not.toContain('OUTSIDE');
    const menu = (await read('review liste')).components[0].components[0];
    expect(menu.custom_id).toBe(`nxt:read:review:${team}`);
    expect(menu.options.map((o: any) => o.value)).toEqual(expect.arrayContaining([id(60), id(62)]));
    expect(menu.options.map((o: any) => o.value)).not.toContain(id(61));
    const publicReview = render(await read('review voir', { review: id(60) }));
    expect(publicReview).toContain('Résumé généré');
    expect(publicReview).not.toContain('PRIVATE');
    expect(render(await read('review voir', { review: id(62) }))).not.toContain('UNKNOWN');
    expect(render(await read('review voir', { review: id(60) }, staff))).toContain('PRIVATE');
    await expect(read('review voir', { review: id(61) })).rejects.toMatchObject({ status: 404 });
    await expect(read('review voir', { review: id(63) }, staff)).rejects.toMatchObject({ status: 404 });
  });

  it('counts confirmations for the exact shared version and requires staff before any lookup', async () => {
    await report(60, { version: 2 });
    await rows('insert into discord_review_recipients(team_id,report_id,user_id,report_version) values($1,$2,$3,2),($1,$2,$4,2)', [team, id(60), member, another]);
    await rows('insert into discord_review_reads(team_id,report_id,user_id,report_version) values($1,$2,$3,1),($1,$2,$4,2)', [team, id(60), member, another]);
    state.sql.mockClear();
    await expect(read('review lectures', { review: id(60) })).rejects.toMatchObject({ status: 403 });
    expect(state.sql).not.toHaveBeenCalled();
    const payload = await read('review lectures', { review: id(60) }, staff);
    expect(payload.embeds[0].description).toContain('Version 2 · 1/2');
    expect(field(payload, 'Destinataires de cette version')).toContain('Sans confirmation · Membre');
    expect(field(payload, 'Destinataires de cette version')).toContain('Lu · Autre');
  });

  it('withholds an approved summary after the source review changes until the staff revalidates it', async () => {
    await report(60, { summary: 'Résumé approuvé initial' });
    expect(render(await read('review voir', { review: id(60) }))).toContain('Résumé approuvé initial');
    await rows('update reports set content=$2 where id=$1', [id(60), 'Nouveau contenu généré\n[NXT5_REPORT_V3]\nNotes staff\nCONFIDENTIAL']);
    expect((await rows('select discord_summary_stale from reports where id=$1', [id(60)]))[0].discord_summary_stale).toBe(true);
    const memberView = render(await read('review voir', { review: id(60) }));
    expect(memberView).toContain('doit être revalidé');
    expect(memberView).not.toContain('Résumé approuvé initial');
    expect(memberView).not.toContain('Nouveau contenu généré');
    expect(memberView).not.toContain('CONFIDENTIAL');
    expect(render(await read('review voir', { review: id(60) }, staff))).toContain('Nouveau contenu généré');
    await rows("update reports set discord_summary='Résumé de nouveau validé',discord_summary_stale=false where id=$1", [id(60)]);
    expect(render(await read('review voir', { review: id(60) }))).toContain('Résumé de nouveau validé');
  });
});

describe('Discord reads · planning and preparation', () => {
  it('merges new and legacy events, deduplicates shared slots and does not leak availability notes', async () => {
    const slots = { _events: { 'TUE|20:00': { label: 'Legacy scrim', type: 'scrim' }, 'WED|21:00': { label: 'Shared match', type: 'match' } } };
    await rows(`insert into player_availability(team_id,player_id,week_start,slots,notes) values
      ($1,$2,'2026-09-21',$4::jsonb,'PRIVATE_AVAILABILITY'),($1,$3,'2026-09-21',$4::jsonb,'PRIVATE_AVAILABILITY')`, [team, ownPlayer, teammate, JSON.stringify(slots)]);
    await rows(`insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes,status) values
      ($1,$5,'Shared match','match','2026-09-23T19:00:00Z',60,'scheduled'),
      ($2,$5,'New review','review','2026-09-24T18:00:00Z',45,'scheduled'),
      ($3,$5,'CANCELLED','scrim','2026-09-24T18:00:00Z',45,'cancelled'),
      ($4,$6,'OUTSIDE','scrim','2026-09-24T18:00:00Z',45,'scheduled')`, [id(70), id(71), id(72), id(73), team, otherTeam]);
    const payload = await read('planning', { periode: 'semaine' });
    expect(payload.embeds[0].fields.map((f: any) => f.name)).toEqual(['Legacy scrim', 'Shared match', 'New review']);
    expect(field(payload, 'Legacy scrim')).toContain(`<t:${Math.floor(Date.parse('2026-09-22T18:00:00Z') / 1000)}:f>`);
    expect(render(payload)).not.toContain('PRIVATE'); expect(render(payload)).not.toContain('CANCELLED'); expect(render(payload)).not.toContain('OUTSIDE');
  });

  it('converts legacy slots across the autumn DST change and uses the local end of today', async () => {
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    await rows(`insert into player_availability(team_id,player_id,week_start,slots) values($1,$2,'2026-10-19',$3::jsonb)`, [team, ownPlayer, JSON.stringify({ _events: { 'SUN|20:00': { label: 'After DST', type: 'scrim' } } })]);
    const week = await read('planning', { periode: 'semaine' });
    expect(field(week, 'After DST')).toContain(`<t:${Math.floor(Date.parse('2026-10-25T19:00:00Z') / 1000)}:f>`);
    const today = await read('planning', { periode: 'aujourdhui' });
    expect(today.embeds[0].fields).toEqual([]);
  });

  it('supports registered role names and makes deterministic staff-only pool suggestions', async () => {
    await rows(`insert into champion_pool(team_id,player_id,player_name,champion,status,role,games) values
      ($1,$2,'Bravo','Lee Sin','work','JGL',2),($1,$2,'Bravo','Vi','comfort','JGL',20),($3,$4,'Secret','PRIVATE_CHAMP','work','MID',0)`, [team, teammate, otherTeam, outsider]);
    expect(field(await read('pool voir', { role: 'jungle' }), 'Bravo · Lee Sin')).toContain('work');
    await expect(read('pool suggerer', { joueur: teammate, objectif: 'travail' })).rejects.toMatchObject({ status: 403 });
    const result = await read('pool suggerer', { joueur: teammate, objectif: 'travail' }, staff);
    expect(result.embeds[0].fields[0].name).toBe('Lee Sin');
    expect(render(result)).not.toContain('PRIVATE');
    expect(result.embeds[0].description).toContain('Règle déterministe');
  });

  it('filters composition slots by actual champion pools and rejects foreign preparation events', async () => {
    await rows("insert into champion_pool(id,team_id,player_id,player_name,champion,role) values($1,$2,$3,'Alpha','Ahri','MID')", [id(80), team, ownPlayer]);
    await rows('insert into composition_types(team_id,title,slots) values($1,$2,$3::jsonb)', [team, 'Catch', JSON.stringify({ MID: { playerId: ownPlayer, poolId: id(80) } })]);
    expect(field(await read('draft compositions', { role: 'mid', champion: 'Ahri' }), 'Catch')).toContain('MID : Ahri');
    expect((await read('draft compositions', { champion: 'Ashe' })).embeds[0].fields).toEqual([]);
    await rows("insert into discord_team_events(id,team_id,title,event_type,starts_at,duration_minutes) values($1,$2,'PRIVATE_EVENT','scrim',now(),60)", [id(81), otherTeam]);
    await expect(read('draft preparer', { evenement: id(81) }, staff)).rejects.toMatchObject({ status: 404 });
  });
});
