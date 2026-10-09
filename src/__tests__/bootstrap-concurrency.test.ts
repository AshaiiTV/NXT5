import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(), requireAuth: vi.fn(), assertSessionSecret: vi.fn(),
  assertSchemaReady: vi.fn(), loadMatchPage: vi.fn(),
  loadBotWorkflows: vi.fn(), seedDefaultMatchCategories: vi.fn(),
}));

vi.mock('../../netlify/functions/_lib/db', () => ({ sql: mocks.sql }));
vi.mock('../../netlify/functions/_lib/auth', () => ({
  requireAuth: mocks.requireAuth, assertSessionSecret: mocks.assertSessionSecret,
}));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: mocks.assertSchemaReady }));
vi.mock('../../netlify/functions/_lib/match-page', async importOriginal => ({
  ...await importOriginal<typeof import('../../netlify/functions/_lib/match-page')>(),
  loadMatchPage: mocks.loadMatchPage,
}));
vi.mock('../../netlify/functions/_lib/discord-bot-bootstrap', () => ({ loadBotWorkflows: mocks.loadBotWorkflows }));
vi.mock('../../netlify/functions/_lib/match-categories', () => ({ seedDefaultMatchCategories: mocks.seedDefaultMatchCategories }));
vi.mock('../../netlify/functions/_lib/safe-log', () => ({ logFailure: vi.fn() }));

import bootstrap from '../../netlify/functions/bootstrap';
import { safeTeam } from '../../netlify/functions/_lib/teams';

const userId = 'user-staff';
const teamId = 'team-selected';
const otherTeamId = 'team-other';
const teams = [
  { id: otherTeamId, owner_id: userId, name: 'Other team', invite_code: 'private-other' },
  { id: teamId, owner_id: userId, name: 'Selected team', invite_code: 'private-selected' },
];
const page = {
  matches: [{ id: 'match-page', team_id: teamId }],
  pagination: { limit: 1, offset: 2, total: 8, hasMore: true, nextOffset: 3 },
  totals: { games: 8, wins: 5, losses: 3 },
};
const workflows = { botEvents: [{ id: 'event', team_id: teamId }], botGoals: [{ id: 'goal', team_id: teamId }] };
const rows = Object.fromEntries([
  'players', 'team_members', 'champion_pool', 'improvements', 'composition_types', 'reports',
  'match_archives', 'match_categories', 'team_invite_codes', 'player_availability',
  'player_coaching_notes', 'player_goals',
].map(table => [table, [{ id: `${table}-row`, team_id: teamId }]]));
rows.improvements[0].title = 'Review the next objective';
rows.matches = [
  { result: 'Victoire', impact_score: '72', duration: '29:05', side: 'Bleu', vision_score: '+12' },
  { result: 'Défaite' },
];

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Drain continuations without timers or elapsed-time assertions. Every mocked
// operation stays pending until the test explicitly releases its promise.
async function flushMicrotasks() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function statement(strings: TemplateStringsArray) {
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function queryRows(strings: TemplateStringsArray) {
  const query = statement(strings);
  if (query.startsWith('select distinct teams.')) return teams;
  const table = query.match(/\bfrom (\w+)/)?.[1];
  if (!table || !rows[table]) throw new Error(`Unexpected bootstrap query: ${query}`);
  return rows[table];
}

function request(query = `teamId=${teamId}&limit=1&offset=2`) {
  return bootstrap(new Request(`https://nxt5.test/.netlify/functions/bootstrap?${query}`), {} as any);
}

function expectNoDataGroups() {
  expect(mocks.loadMatchPage).not.toHaveBeenCalled();
  expect(mocks.loadBotWorkflows).not.toHaveBeenCalled();
  expect(mocks.seedDefaultMatchCategories).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAuth.mockResolvedValue({ id: userId });
  mocks.assertSchemaReady.mockResolvedValue(undefined);
  mocks.sql.mockImplementation((strings: TemplateStringsArray) => Promise.resolve(queryRows(strings)));
  mocks.loadMatchPage.mockResolvedValue(page);
  mocks.loadBotWorkflows.mockResolvedValue(workflows);
  mocks.seedDefaultMatchCategories.mockResolvedValue(undefined);
});

describe('bootstrap independent data loading', () => {
  it('overlaps all three groups only after authorization and schema readiness, preserving the response', async () => {
    const auth = deferred<{ id: string }>();
    const membership = deferred<typeof teams>();
    const schema = deferred();
    const matches = deferred<typeof page>();
    const bot = deferred<typeof workflows>();
    const seed = deferred();
    const teamQueries = deferred();
    mocks.requireAuth.mockReturnValue(auth.promise);
    mocks.assertSchemaReady.mockReturnValue(schema.promise);
    mocks.loadMatchPage.mockReturnValue(matches.promise);
    mocks.loadBotWorkflows.mockReturnValue(bot.promise);
    mocks.seedDefaultMatchCategories.mockReturnValue(seed.promise);
    mocks.sql.mockImplementation((strings: TemplateStringsArray) => {
      if (statement(strings).startsWith('select distinct teams.')) return membership.promise;
      return teamQueries.promise.then(() => queryRows(strings));
    });
    let completed = false;
    const response = request().then(value => { completed = true; return value; });

    await flushMicrotasks();
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.assertSchemaReady).not.toHaveBeenCalled();
    expectNoDataGroups();

    auth.resolve({ id: userId });
    await flushMicrotasks();
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([userId, userId]);
    expect(mocks.assertSchemaReady).not.toHaveBeenCalled();
    expectNoDataGroups();

    membership.resolve(teams);
    await flushMicrotasks();
    expect(mocks.assertSchemaReady).toHaveBeenCalledTimes(1);
    expectNoDataGroups();

    schema.resolve();
    await flushMicrotasks();
    // Neither the match page nor the bot nor the category seed has completed.
    expect(mocks.loadMatchPage).toHaveBeenCalledExactlyOnceWith(teamId, { limit: 1, offset: 2 });
    expect(mocks.loadBotWorkflows).toHaveBeenCalledExactlyOnceWith(teamId, userId);
    expect(mocks.seedDefaultMatchCategories).toHaveBeenCalledExactlyOnceWith([teamId], userId);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);

    seed.resolve();
    await flushMicrotasks();
    // Team reads now overlap the still-pending matches and Discord workflows.
    expect(mocks.sql).toHaveBeenCalledTimes(14);
    for (const call of mocks.sql.mock.calls.slice(1)) {
      const parameters = call.slice(1).flat();
      expect(parameters).toContain(teamId);
      expect(parameters).not.toContain(otherTeamId);
    }
    expect(completed).toBe(false);

    matches.resolve(page);
    teamQueries.resolve();
    await flushMicrotasks();
    expect(completed).toBe(false);
    bot.resolve(workflows);
    const result = await response;
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toEqual({
      dashboard: {
        recentWinrate: '50%', winrateTrend: '1W / 1L sur les 2 dernières',
        impactScore: '72', impactTrend: '29:05 · Bleu', visionDiff: '+12',
        visionTrend: 'Différence de vision dernière game', midgameRisk: 'Donnée disponible',
        riskTrend: 'Review the next objective',
      },
      selectedTeamId: teamId, ...page, ...workflows, teams: teams.map(safeTeam),
      players: rows.players, teamMembers: rows.team_members, championPool: rows.champion_pool,
      improvements: rows.improvements, compositions: rows.composition_types, reports: rows.reports,
      matchArchives: rows.match_archives, matchCategories: rows.match_categories,
      inviteCodes: rows.team_invite_codes, availability: rows.player_availability,
      profileCoachingNotes: rows.player_coaching_notes, playerGoals: rows.player_goals,
    });
  });

  it('keeps matchesOnly limited to the authorized match page', async () => {
    const matches = deferred<typeof page>();
    mocks.loadMatchPage.mockReturnValue(matches.promise);
    const response = request(`teamId=${teamId}&limit=1&offset=2&matchesOnly=1`);
    await flushMicrotasks();
    expect(mocks.assertSchemaReady).toHaveBeenCalledTimes(1);
    expect(mocks.loadMatchPage).toHaveBeenCalledExactlyOnceWith(teamId, { limit: 1, offset: 2 });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.loadBotWorkflows).not.toHaveBeenCalled();
    expect(mocks.seedDefaultMatchCategories).not.toHaveBeenCalled();

    matches.resolve(page);
    expect(await (await response).json()).toEqual({ selectedTeamId: teamId, ...page });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.loadBotWorkflows).not.toHaveBeenCalled();
    expect(mocks.seedDefaultMatchCategories).not.toHaveBeenCalled();
  });

  it.each(['authentication', 'membership', 'schema'] as const)('starts no data group when %s fails', async gate => {
    if (gate === 'authentication') mocks.requireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    if (gate === 'schema') mocks.assertSchemaReady.mockRejectedValue(Object.assign(new Error('Not ready'), { status: 503 }));
    const result = await request(gate === 'membership' ? 'teamId=foreign-team' : undefined);
    expect(result.status).toBe({ authentication: 401, membership: 403, schema: 503 }[gate]);
    expect(await result.json()).not.toHaveProperty('matches');
    expectNoDataGroups();
    expect(mocks.sql).toHaveBeenCalledTimes(gate === 'authentication' ? 0 : 1);
    expect(mocks.assertSchemaReady).toHaveBeenCalledTimes(gate === 'schema' ? 1 : 0);
  });

  it('returns the empty-team response without starting any data group', async () => {
    mocks.sql.mockResolvedValue([]);
    const result = await request('limit=1&offset=2');
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ selectedTeamId: null, teams: [], matches: [], botEvents: [], botGoals: [] });
    expectNoDataGroups();
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.assertSchemaReady).not.toHaveBeenCalled();
  });

  it.each(['matches', 'bot', 'seed', 'team query'] as const)('returns an error instead of partial data when %s fails', async group => {
    const failure = new Error('Private database diagnostic');
    if (group === 'matches') mocks.loadMatchPage.mockRejectedValue(failure);
    if (group === 'bot') mocks.loadBotWorkflows.mockRejectedValue(failure);
    if (group === 'seed') mocks.seedDefaultMatchCategories.mockRejectedValue(failure);
    if (group === 'team query') mocks.sql.mockImplementation((strings: TemplateStringsArray) =>
      statement(strings).startsWith('select distinct teams.') ? Promise.resolve(teams) : Promise.reject(failure));
    const result = await request();
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: 'Erreur serveur.' });
  });
});
