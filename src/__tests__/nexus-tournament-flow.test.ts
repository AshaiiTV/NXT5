import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ pg: null as any, beforeBatch: null as null | (() => Promise<void>) }));
const identity = vi.hoisted(() => ({ user: null as any, cookie: '' }));
vi.mock('../../netlify/functions/_lib/auth', () => ({
  readSessionCookie: () => identity.cookie,
  requireAuth: async () => {
    if (!identity.user) throw Object.assign(new Error('Expired'), { status: 401 });
    return identity.user;
  },
  isPlatformAdmin: (user: any) => user?.is_platform_admin === true,
  assertSessionSecret: () => {},
}));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({
  requirePlatformAdmin: async () => {
    if (!identity.user?.is_platform_admin) throw Object.assign(new Error('Forbidden'), { status: 403 });
    return identity.user;
  }
}));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: async () => {}, assertSubjectRateLimit: async () => {} }));
vi.mock('../../netlify/functions/_lib/db', async () => {
  const { neon, neonConfig } = await import('@neondatabase/serverless');
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) => result.fields.map((field: any) => {
          const value = row[field.name];
          if (value == null) return null;
          if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 't' : 'f';
          if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', field.dataTypeID === 1184 ? '+00' : '');
          return String(value);
        })),
        rowCount: result.affectedRows ?? result.rows.length
      };
    }
    try {
      if (body.queries) {
        const mutate = db.beforeBatch;
        db.beforeBatch = null;
        await mutate?.();
        const results = await db.pg.transaction(async (tx: any) => {
          const results = [];
          for (const query of body.queries) results.push(await execute(tx, query));
          return results;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(db.pg, body)));
    } catch (err: any) {
      return new Response(JSON.stringify({ message: err.message, code: err.code, constraint: err.constraint }), { status: 400 });
    }
  };
  return { sql: neon('postgresql://test:test@local-test.invalid/nexus') };
});

import { createNexusPairing, connectNexus, saveNexusSubmission } from '../../netlify/functions/_lib/nexus-store';
import { createSeason, updateSeason, registerTeam, reviewRegistration, generateSchedule, scheduleFixture, reviewTournamentSubmission, loadTournamentState, seedPlayoffs } from '../../netlify/functions/_lib/nexus-tournament-store';
import { advanceSwissRound, createManualFixture } from '../../netlify/functions/_lib/nexus-extra-formats';
import overviewHandler from '../../netlify/functions/nexus-overview';

const teams: any[] = [];
let gameNumber = 10000;
const baseTime = Date.now() - 8 * 3600_000;
const config = (extra: any = {}) => ({ name: 'Saison de test', format: 'round_robin', legs: 1, regularBestOf: 1, playoffEnabled: true, playoffSize: 4, playoffBestOf: 1, playoffFormat: 'single_elimination', finalBestOf: 1, rulesConfirmed: true, ...extra });

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.exec(`
    create table users(id uuid primary key);
    create table teams(id uuid primary key,name text,owner_id uuid references users(id));
    create table team_members(team_id uuid,user_id uuid,role text);
    create table players(id uuid primary key,team_id uuid references teams(id),name text,riot_id text,role text,roster_status text);
    create table app_schema_migrations(migration_key text primary key);
  `);
  for (const migration of ['20261031_nexus_import.sql','20261101_nexus_tournament.sql','20261104_nexus_tie_breakers.sql']) {
    await db.pg.exec(readFileSync(new URL(`../../database/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  await db.pg.exec("insert into app_schema_migrations values ('nexus-import-20261031-v1'),('nexus-tournament-20261101-v1'),('nexus-tie-breakers-20261104-v1')");
}, 20_000);
beforeEach(async () => {
  db.beforeBatch = null; identity.user = null; identity.cookie = ''; teams.length = 0;
  for (const key of ['AWS_LAMBDA_FUNCTION_NAME','LAMBDA_TASK_ROOT','SITE_ID']) vi.stubEnv(key, '');
  await db.pg.exec('truncate nexus_seasons,nexus_fixtures,teams,users cascade; truncate team_members;');
  for (let t = 0; t < 6; t++) {
    const team = { id: randomUUID(), ownerId: randomUUID(), name: `Équipe ${t + 1}`, players: [] as any[] };
    await db.pg.query('insert into users values ($1)', [team.ownerId]);
    await db.pg.query('insert into teams values ($1,$2,$3)', [team.id, team.name, team.ownerId]);
    for (let p = 0; p < 5; p++) {
      const player = { id: randomUUID(), riotId: `Team${t + 1} Player${p + 1}#EUW` };
      team.players.push(player);
      await db.pg.query('insert into players values ($1,$2,$3,$4,$5,$6)', [player.id,team.id,`Joueur ${p + 1}`,player.riotId,['TOP','JGL','MID','ADC','SUP'][p],'MAIN']);
    }
    teams.push(team);
  }
});
afterAll(async () => { await db.pg.close(); });

async function openAndRegister(count = 4, extra: any = {}) {
  const season = await createSeason(config(extra));
  await updateSeason({ seasonId: season.id, status: 'open' });
  for (const team of teams.slice(0, count)) {
    const registration = await registerTeam(team.ownerId, { seasonId: season.id, teamId: team.id });
    await reviewRegistration({ registrationId: registration.id, status: 'approved' });
  }
  return season;
}
async function prepare(fixture: any) {
  return scheduleFixture({ fixtureId: fixture.id, startsAt: new Date(baseTime - 60_000).toISOString(), endsAt: new Date(baseTime + 7 * 3600_000).toISOString(), playerIdsA: teams.find(team => team.id === fixture.teamAId).players.map((p: any) => p.id), playerIdsB: teams.find(team => team.id === fixture.teamBId).players.map((p: any) => p.id) });
}
async function importGame(fixture: any, winner = 'A', token?: string) {
  let binding: any;
  if (!token) {
    const paired = await createNexusPairing({ fixtureId: fixture.id, uploaderRiotId: fixture.roster[0] });
    const linked = await connectNexus(paired.code);
    token = linked.token; binding = linked.binding;
  }
  const id = `EUW1_${++gameNumber}`;
  const data = { fixtureId: fixture.id, payload: { source: 'lcu-match-history', timeline: null, match: { metadata: { matchId: id }, info: {
    gameType: 'CUSTOM_GAME', queueId: 0, mapId: 11, gameCreation: baseTime + (gameNumber - 10000) * 2000, gameDuration: 1200,
    teams: [{ teamId: 100, win: winner === 'A' }, { teamId: 200, win: winner === 'B' }],
    participants: fixture.roster.map((riotId: string, index: number) => ({ participantId: index + 1, teamId: index < 5 ? 100 : 200, championId: index + 1, championName: `Champion${index + 1}`, riotIdGameName: riotId.split('#')[0], riotIdTagline: 'EUW', kills: 2, deaths: 1, assists: 3 }))
  } } } };
  const receipt = await saveNexusSubmission(token!, data, id);
  return { ...receipt, token, binding, data, id };
}
async function complete(fixture: any, winner = 'A') {
  const ready = await prepare(fixture);
  let imported: any;
  for (let i = 0; i < Math.floor(fixture.bestOf / 2) + 1; i++) {
    imported = await importGame(ready, winner, imported?.token);
    await reviewTournamentSubmission({ submissionId: imported.submissionId, status: 'accepted' });
  }
  return imported;
}
// A BO3 lost 1-2 lets game difference separate teams level on points.
async function completeWithLoserGame(fixture: any, winner: 'A' | 'B') {
  const ready = await prepare(fixture);
  let imported: any = await importGame(ready, winner === 'A' ? 'B' : 'A');
  await reviewTournamentSubmission({ submissionId: imported.submissionId, status: 'accepted' });
  for (let i = 0; i < 2; i++) {
    imported = await importGame(ready, winner, imported.token);
    await reviewTournamentSubmission({ submissionId: imported.submissionId, status: 'accepted' });
  }
}
// Three teams beat each other in a circle: everyone has three points, only
// the game difference differs (team 1: +1, team 3: 0, team 2: -1).
async function playCircularSeason(extra: any) {
  const season = await openAndRegister(3, { regularBestOf: 3, playoffSize: 2, playoffFormat: 'single_elimination', doubleVariant: 'nexus_site', ...extra });
  const schedule = await generateSchedule({ seasonId: season.id });
  expect(schedule.fixtures).toHaveLength(3);
  await updateSeason({ seasonId: season.id, status: 'running' });
  const [one, two, three] = teams.slice(0, 3).map(team => team.id);
  for (const fixture of schedule.fixtures) {
    const pair = [fixture.teamAId, fixture.teamBId];
    if (pair.includes(one) && pair.includes(two)) await complete(fixture, fixture.teamAId === one ? 'A' : 'B');
    else if (pair.includes(two) && pair.includes(three)) await completeWithLoserGame(fixture, fixture.teamAId === two ? 'A' : 'B');
    else await completeWithLoserGame(fixture, fixture.teamAId === three ? 'A' : 'B');
  }
  const table = (await loadTournamentState()).standings.find(row => row.seasonId === season.id)!;
  return { season, table, one, two, three };
}
async function overview(user?: any) {
  identity.user = user || null; identity.cookie = user ? 'session-test' : '';
  const response = await overviewHandler(new Request('https://nxt5.test/.netlify/functions/nexus-overview'), {} as any);
  expect(response.status).toBe(200);
  return response.json();
}

describe('native teams through tournament and the existing NXT5 importer', () => {
  it('runs a season to its final, keeps retries idempotent and reserves reviewed results for staff during preopening', async () => {
    const season = await openAndRegister();
    const first = await generateSchedule({ seasonId: season.id });
    const repeated = await generateSchedule({ seasonId: season.id });
    expect(new Set(repeated.fixtures.map((f: any) => f.id))).toEqual(new Set(first.fixtures.map((f: any) => f.id)));
    expect(first.fixtures).toHaveLength(6);
    await updateSeason({ seasonId: season.id, status: 'running' });

    const ready = await prepare(first.fixtures[0]);
    const firstWinner = teams.findIndex(t => t.id === ready.teamAId) < teams.findIndex(t => t.id === ready.teamBId) ? 'A' : 'B';
    const imported = await importGame(ready, firstWinner);
    expect(imported.binding).toMatchObject({ competitionId: 'nexus-rising', fixtureId: ready.id, roster: ready.roster });
    expect(await saveNexusSubmission(imported.token!, imported.data, imported.id)).toMatchObject({ duplicate: true, submissionId: imported.submissionId });
    const staff = {id: randomUUID(), is_platform_admin: true};
    expect((await overview(staff)).fixtures.find((f: any) => f.id === ready.id).games).toHaveLength(0);
    await reviewTournamentSubmission({ submissionId: imported.submissionId, status: 'accepted' });
    const staffFixture = (await overview(staff)).fixtures.find((f: any) => f.id === ready.id);
    expect(staffFixture.games).toHaveLength(1);
    expect(staffFixture.statistics[0].participants).toHaveLength(10);
    expect(JSON.stringify(staffFixture)).not.toContain(imported.token);
    expect(await overview()).toEqual({access: 'coming_soon', seasons: [], fixtures: [], standings: [], playoffs: []});
    const owner = teams.find(t => t.id === ready.teamAId);
    expect(await overview({ id: owner.ownerId })).toEqual({access: 'coming_soon', seasons: [], fixtures: [], standings: [], playoffs: []});
    expect(await overview({ id: teams[5].ownerId })).toEqual({access: 'coming_soon', seasons: [], fixtures: [], standings: [], playoffs: []});

    for (const fixture of first.fixtures.slice(1)) {
      const winner = teams.findIndex(t => t.id === fixture.teamAId) < teams.findIndex(t => t.id === fixture.teamBId) ? 'A' : 'B';
      await complete(fixture, winner);
    }
    const state = await loadTournamentState();
    const table = state.standings.find(row => row.seasonId === season.id)!;
    expect(table.rows.map(row => row.teamId)).toEqual(teams.slice(0, 4).map(t => t.id));
    expect(table.ties).toHaveLength(0);
    const seeded = await seedPlayoffs({ seasonId: season.id, seeds: table.rows.map(row => row.teamId) });
    expect(seeded.fixtures).toHaveLength(2);
    const semi = await complete(seeded.fixtures[0]);
    await complete(seeded.fixtures[1]);
    const afterSemis = await loadTournamentState();
    const final = afterSemis.fixtures.find(f => f.seasonId === season.id && f.stage === 'playoff' && !seeded.fixtures.some((old: any) => old.id === f.id))!;
    expect(final).toBeTruthy();
    await complete(final);
    await expect(reviewTournamentSubmission({ submissionId: semi.submissionId, status: 'rejected' })).rejects.toMatchObject({ status: 409 });
    expect(await updateSeason({ seasonId: season.id, status: 'completed' })).toMatchObject({ status: 'completed' });
  }, 30_000);

  it('applies only the configured tie-breakers, whatever the double elimination variant says', async () => {
    await expect(createSeason(config({ tieBreakers: ['points'] }))).rejects.toThrow('Règles de départage invalides.');
    await expect(createSeason(config({ tieBreakers: ['gameDifference', 'gameDifference'] }))).rejects.toThrow('Règles de départage invalides.');
    expect((await createSeason(config())).tieBreakers).toEqual([]);

    // The Nexus variant is stored but the playoffs are a single elimination: no rule is inferred from it.
    const level = await playCircularSeason({});
    expect(level.table.rows.map(row => row.points)).toEqual([3, 3, 3]);
    expect(level.table.ties).toEqual([expect.objectContaining({ teamIds: expect.arrayContaining([level.one, level.two, level.three]), crossesQualification: true })]);
    expect(level.table.qualificationBlocked).toBe(true);
    await expect(seedPlayoffs({ seasonId: level.season.id, seeds: [level.one, level.three] })).rejects.toThrow('Documente la résolution des égalités');

    const separated = await playCircularSeason({ tieBreakers: ['headToHead', 'gameDifference'] });
    expect(separated.table.rows.map(row => [row.teamId, row.gameDifference])).toEqual([[separated.one, 1], [separated.three, 0], [separated.two, -1]]);
    expect(separated.table.ties).toEqual([]);
    expect(separated.table.rows.map(row => row.qualified)).toEqual([true, true, false]);
    const seeds = [separated.one, separated.three];
    // Without a tie the note stays optional, but never unbounded.
    await expect(seedPlayoffs({ seasonId: separated.season.id, seeds, tieResolutionNote: 'x'.repeat(2001) })).rejects.toThrow('ne peut pas dépasser 2000 caractères');
    await expect(seedPlayoffs({ seasonId: separated.season.id, seeds, tieResolutionNote: { text: 'objet' } })).rejects.toThrow('doit être un texte');
    expect((await loadTournamentState()).rawSeasons.find(row => row.id === separated.season.id).playoff_bracket).toBeNull();
    const seeded = await seedPlayoffs({ seasonId: separated.season.id, seeds, tieResolutionNote: 'Égalité levée par la différence de games.' });
    expect(seeded.fixtures).toHaveLength(1);
    expect(seeded.season.tieBreakers).toEqual(['headToHead', 'gameDifference']);
    expect((await loadTournamentState()).rawSeasons.find(row => row.id === separated.season.id).tie_resolution_note).toBe('Égalité levée par la différence de games.');
    // The locked format still accepts a plain status change.
    await complete(seeded.fixtures[0]);
    expect(await updateSeason({ seasonId: separated.season.id, status: 'completed' })).toMatchObject({ status: 'completed', tieBreakers: ['headToHead', 'gameDifference'] });
    await expect(updateSeason({ seasonId: separated.season.id, tieBreakers: [] })).rejects.toMatchObject({ status: 409 });
  }, 60_000);

  it('creates custom fixtures once per request, using approved native teams only', async () => {
    const season = await openAndRegister(2, { format: 'custom', playoffEnabled: false });
    await generateSchedule({ seasonId: season.id });
    const body = { seasonId: season.id, requestId: randomUUID(), teamAId: teams[0].id, teamBId: teams[1].id, round: 1, bestOf: 3, label: 'Rencontre libre' };
    const created = await createManualFixture(body);
    expect((await createManualFixture(body)).fixture?.id).toBe(created.fixture?.id);
    await expect(createManualFixture({ ...body, bestOf: 1 })).rejects.toMatchObject({ status: 409 });
    await expect(createManualFixture({ ...body, requestId: randomUUID() })).rejects.toMatchObject({ status: 409, code: 'NEXUS_ROUND_CONFLICT' });
    await expect(createManualFixture({ ...body, requestId: randomUUID(), teamBId: teams[5].id })).rejects.toMatchObject({ status: 403 });
    expect((await db.pg.query('select * from nexus_fixtures')).rows).toHaveLength(1);
  });

  it('rejects a late game beyond the won BO and serializes competing staff approvals', async () => {
    const season = await openAndRegister(4, { regularBestOf: 3 });
    const schedule = await generateSchedule({ seasonId: season.id });
    await updateSeason({ seasonId: season.id, status: 'running' });
    const played = await complete(schedule.fixtures[0]);
    const ready = (await loadTournamentState()).fixtures.find(f => f.id === schedule.fixtures[0].id)!;
    const extra = await importGame(ready, 'B', played.token);
    await expect(reviewTournamentSubmission({ submissionId: extra.submissionId, status: 'accepted' })).rejects.toMatchObject({ status: 409, code: 'NEXUS_SERIES_CONFLICT' });
    const next = await prepare(schedule.fixtures[1]);
    const opening = await importGame(next, 'A');
    await reviewTournamentSubmission({ submissionId: opening.submissionId, status: 'accepted' });
    const [a,b] = await Promise.all([importGame(next, 'A', opening.token),importGame(next, 'A', opening.token)]);
    const reviewed = await Promise.allSettled([reviewTournamentSubmission({ submissionId: a.submissionId, status: 'accepted' }),reviewTournamentSubmission({ submissionId: b.submissionId, status: 'accepted' })]);
    expect(reviewed.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const state = await loadTournamentState();
    expect(state.fixtures.find(f => f.id === next.id)?.series).toMatchObject({ status: 'complete', winsA: 2, winsB: 0 });
    expect(state.games.filter(g => g.fixture_id === next.id)).toHaveLength(2);
  });

  it('advances Swiss only after reviewed series and never repeats a round or an opponent', async () => {
    const season = await openAndRegister(4, { format: 'swiss', swissRounds: 3, playoffEnabled: false });
    const first = await generateSchedule({ seasonId: season.id });
    expect(first.fixtures).toHaveLength(2);
    await updateSeason({ seasonId: season.id, status: 'running' });
    await expect(advanceSwissRound({ seasonId: season.id, round: 2 })).rejects.toMatchObject({ status: 409 });
    const firstResults = [];
    for (const fixture of first.fixtures) firstResults.push(await complete(fixture));
    const second = await advanceSwissRound({ seasonId: season.id, round: 2 });
    expect(second.fixtures).toHaveLength(2);
    const allPairs = [...first.fixtures,...second.fixtures].map((f: any) => [f.teamAId,f.teamBId].sort().join('|'));
    expect(new Set(allPairs).size).toBe(4);
    expect((await advanceSwissRound({ seasonId: season.id, round: 2 })).fixtures.map((f: any) => f.id)).toEqual(second.fixtures.map((f: any) => f.id));
    await expect(reviewTournamentSubmission({ submissionId: firstResults[0].submissionId, status: 'rejected' })).rejects.toMatchObject({ status: 409, code: 'NEXUS_SWISS_ROUND_LOCKED' });
  });

  it.each([
    { format: 'single_elimination', doubleVariant: 'standard', count: 4, triggerReset: false },
    { format: 'double_elimination', doubleVariant: 'standard', count: 4, triggerReset: false },
    { format: 'double_elimination', doubleVariant: 'standard', count: 4, triggerReset: true },
    { format: 'double_elimination', doubleVariant: 'nexus_site', count: 6, triggerReset: false },
    { format: 'double_elimination', doubleVariant: 'nexus_pdf', count: 6, triggerReset: false }
  ])('finishes $format / $doubleVariant (reset $triggerReset) using only generated encounters', async ({ format, doubleVariant, count, triggerReset }) => {
    const season = await openAndRegister(count, { format, doubleVariant, playoffFormat: format, playoffSize: count, upperFinalBestOf: 1 });
    await generateSchedule({ seasonId: season.id, seeds: teams.slice(0, count).map(t => t.id), firstSeedOpponent: 4 });
    await updateSeason({ seasonId: season.id, status: 'running' });
    let completed = 0, champion: any = null;
    for (let step = 0; step < 20; step++) {
      const state = await loadTournamentState();
      champion = state.playoffs.find(p => p.seasonId === season.id)?.bracket.winnerTeamId;
      if (champion) break;
      const next = state.fixtures.find(f => f.seasonId === season.id && f.series?.status === 'pending');
      expect(next, 'Every unresolved bracket must expose its next playable fixture').toBeTruthy();
      await complete(next, triggerReset && next!.fixtureKey === 'de-final' ? 'B' : 'A');
      completed++;
    }
    expect(champion).toBeTruthy();
    expect(completed).toBe(doubleVariant.startsWith('nexus_') ? 8 : format === 'single_elimination' ? 3 : triggerReset ? 7 : 6);
    expect(await updateSeason({ seasonId: season.id, status: 'completed' })).toMatchObject({ status: 'completed' });
  }, 30_000);

  it('qualifies teams from each group and rejects a lower-ranked team in place of a group winner', async () => {
    const season = await openAndRegister(6, { format: 'groups', groupCount: 2, advancePerGroup: 1, playoffSize: 2 });
    const schedule = await generateSchedule({ seasonId: season.id });
    expect(schedule.fixtures).toHaveLength(6);
    await updateSeason({ seasonId: season.id, status: 'running' });
    for (const fixture of schedule.fixtures) {
      const winner = teams.findIndex(t => t.id === fixture.teamAId) < teams.findIndex(t => t.id === fixture.teamBId) ? 'A' : 'B';
      await complete(fixture, winner);
    }
    const standings = (await loadTournamentState()).standings.filter(s => s.seasonId === season.id);
    expect(standings).toHaveLength(2);
    const seeds = standings.map(s => s.rows[0].teamId);
    await expect(seedPlayoffs({ seasonId: season.id, seeds: [standings[0].rows[1].teamId, seeds[1]] })).rejects.toThrow();
    const playoffs = await seedPlayoffs({ seasonId: season.id, seeds });
    expect(playoffs.fixtures).toHaveLength(1);
    await complete(playoffs.fixtures[0]);
    expect(await updateSeason({ seasonId: season.id, status: 'completed' })).toMatchObject({ status: 'completed' });
  }, 30_000);
});

describe('nexus-tie-breakers migration on an existing Nexus schema', () => {
  it('keeps the rule previously applied to Nexus brackets, leaves other seasons level and rejects unknown keys', async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table users(id uuid primary key);
      create table teams(id uuid primary key, name text, owner_id uuid references users(id) on delete cascade);
      create table team_members(team_id uuid, user_id uuid, role text);
      create table players(id uuid primary key, team_id uuid references teams(id) on delete cascade, name text, riot_id text, role text, roster_status text);
    `);
    for (const migration of ['20261031_nexus_import.sql', '20261101_nexus_tournament.sql', '20261103_nexus_team_lifecycle.sql']) {
      await pg.exec(readFileSync(new URL(`../../database/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await pg.query(`insert into nexus_seasons(name, format, playoff_enabled, playoff_format, double_variant, playoff_size) values
      ('Bêta site', 'round_robin', true, 'double_elimination', 'nexus_site', 6),
      ('Direct PDF', 'double_elimination', true, 'double_elimination', 'nexus_pdf', 6),
      ('Variante oubliée', 'round_robin', true, 'single_elimination', 'nexus_site', 4),
      ('Sans playoffs', 'swiss', false, 'double_elimination', 'nexus_pdf', 6),
      ('Standard', 'round_robin', true, 'double_elimination', 'standard', 4)`);
    const migration = readFileSync(new URL('../../database/migrations/20261104_nexus_tie_breakers.sql', import.meta.url), 'utf8');
    await pg.exec(migration);
    await pg.exec(migration);
    expect((await pg.query('select name, tie_breakers from nexus_seasons order by name')).rows).toEqual([
      { name: 'Bêta site', tie_breakers: ['headToHead', 'gameDifference'] },
      { name: 'Direct PDF', tie_breakers: ['headToHead', 'gameDifference'] },
      { name: 'Sans playoffs', tie_breakers: [] },
      { name: 'Standard', tie_breakers: [] },
      { name: 'Variante oubliée', tie_breakers: [] },
    ]);
    await expect(pg.query(`update nexus_seasons set tie_breakers = '["points"]'::jsonb where name = 'Standard'`)).rejects.toMatchObject({ constraint: 'nexus_seasons_tie_breakers_check' });
    await expect(pg.query(`update nexus_seasons set tie_breakers = '{"headToHead":true}'::jsonb where name = 'Standard'`)).rejects.toMatchObject({ constraint: 'nexus_seasons_tie_breakers_check' });
    await pg.query(`update nexus_seasons set tie_breakers = '["gameDifference","headToHead"]'::jsonb where name = 'Standard'`);
    await pg.close();
  }, 30_000);
});
