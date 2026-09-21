import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), transaction: vi.fn(), auth: vi.fn(), secret: vi.fn(), rate: vi.fn(),
  persist: vi.fn(), riot: vi.fn(), side: vi.fn(), wake: vi.fn(), schema: vi.fn(), emails: vi.fn(), notify: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: Object.assign(mocks.sql, { transaction: mocks.transaction }) }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: mocks.secret, requireAuth: mocks.auth }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: mocks.rate }));
vi.mock('../../netlify/functions/_lib/analytics', () => ({ persistAnalyzedMatch: mocks.persist }));
vi.mock('../../netlify/functions/_lib/riot', () => ({ fetchRiotMatch: mocks.riot }));
vi.mock('../../netlify/functions/_lib/match-side', () => ({ changeMatchSide: mocks.side }));
vi.mock('../../netlify/functions/_lib/discord-wake', () => ({ wakeDiscordPublications: mocks.wake }));
vi.mock('../../netlify/functions/_lib/migrations', () => ({ assertSchemaReady: mocks.schema }));
vi.mock('../../netlify/functions/_getTeamMembers.js', () => ({ getTeamMemberEmails: mocks.emails }));
vi.mock('../../netlify/functions/_mailer.js', () => ({ sendNotification: mocks.notify }));

import importRiot from '../../netlify/functions/matches-import';
import importFile from '../../netlify/functions/matches-import-file';
import manageMatches from '../../netlify/functions/matches-manage';
import manageCategories from '../../netlify/functions/match-categories-manage';
import deletePlayer from '../../netlify/functions/players-delete';
import deleteTeam from '../../netlify/functions/teams-delete';
import matchDetails from '../../netlify/functions/match-details';
import { assertMatchSourceMutationEnvironment } from '../../netlify/functions/_lib/match-source-environment';

const TEAM = '10000000-0000-4000-8000-000000000001';
const MATCH = '10000000-0000-4000-8000-000000000002';
const USER = '10000000-0000-4000-8000-000000000003';
const riotMatch = { metadata: { matchId: 'EUW1_123456789' }, info: { participants: [], teams: [] } };
const context = (deployContext: string) => ({ deploy: { context: deployContext }, site: { id: 'site-test' }, requestId: 'request-test' }) as any;
const request = (body: object) => new Request('https://preview.example/.netlify/functions/test', { method: 'POST', headers: {
  'content-type': 'application/json', origin: 'https://preview.example', 'x-nf-deploy-context': 'production',
}, body: JSON.stringify(body) });
const common = { teamId: TEAM, matchId: MATCH, playerId: USER, categoryId: MATCH, label: 'Correction', gameId: 'EUW1_123456789', payload: { match: riotMatch } };
const writes = [
  ['Riot import', importRiot, {}], ['file import', importFile, {}],
  ...['update', 'roles', 'side', 'delete', 'review-status'].map((action) => [`match ${action}`, manageMatches, { action }] as const),
  ...['create', 'update', 'delete'].map((action) => [`category ${action}`, manageCategories, { action }] as const),
  ['player cascade', deletePlayer, {}], ['team cascade', deleteTeam, {}],
] as const;

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('CONTEXT', 'production');
  vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'hosted-test'); vi.stubEnv('SITE_ID', 'site-test'); vi.stubEnv('LAMBDA_TASK_ROOT', '');
  vi.stubEnv('PUBLIC_SITE_URL', 'https://nxt5.example');
  mocks.auth.mockResolvedValue({ id: USER }); mocks.rate.mockResolvedValue(undefined); mocks.schema.mockResolvedValue(undefined);
  mocks.persist.mockResolvedValue({ id: MATCH, team_id: TEAM, game_id: common.gameId });
  mocks.riot.mockResolvedValue(riotMatch); mocks.emails.mockResolvedValue([]);
  mocks.sql.mockImplementation(async (strings) => {
    const statement = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (statement.includes('from matches')) return [{ id: MATCH, team_id: TEAM, raw: riotMatch }];
    if (statement.includes('from match_participants')) return [];
    return [{ id: TEAM, owner_id: USER, role: 'captain' }];
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe.each(['deploy-preview', 'branch-deploy', ''])('source mutation barrier in runtime %s', (deployContext) => {
  it.each(writes)('rejects %s before any DB, auth, Riot, persistence or notification effect', async (_name, handler, body) => {
    const response = await handler(request({ ...common, ...body }), context(deployContext));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: deployContext ? 'MATCH_SOURCE_DEPLOY_PREVIEW_DISABLED' : 'MATCH_SOURCE_DEPLOY_CONTEXT_UNAVAILABLE' });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});

describe('source mutation compatibility and read-only requests', () => {
  it('does not accept build variables or request headers as proof of a hosted production invocation', async () => {
    const response = await importRiot(request(common), {} as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'MATCH_SOURCE_DEPLOY_CONTEXT_UNAVAILABLE' });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
  it.each([['Riot', importRiot], ['file', importFile]] as const)('keeps %s import enabled on the production site without a CONTEXT environment variable', async (_name, handler) => {
    vi.stubEnv('CONTEXT', '');
    const invocation = context('production');
    const response = await handler(request(common), invocation);
    expect(response.status).toBe(200);
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.persist.mock.calls[0][0]).toMatchObject({ gameId: common.gameId, userId: USER });
    expect(mocks.wake).toHaveBeenCalledWith(invocation);
  });
  it('keeps an explicit local invocation and local CLI fallback usable', async () => {
    expect(() => assertMatchSourceMutationEnvironment(context('dev'))).not.toThrow();
    for (const key of ['AWS_LAMBDA_FUNCTION_NAME', 'LAMBDA_TASK_ROOT', 'SITE_ID']) vi.stubEnv(key, '');
    vi.stubEnv('CONTEXT', 'dev');
    expect(() => assertMatchSourceMutationEnvironment({})).not.toThrow();
    expect((await importFile(request(common), {} as any)).status).toBe(200);
    expect(mocks.persist).toHaveBeenCalledOnce();
  });
  it.each([['Riot', importRiot], ['file', importFile]] as const)('allows read-only %s previewOnly requests without saving a game or waking the publisher', async (_name, handler) => {
    const response = await handler(request({ ...common, previewOnly: true }), context('deploy-preview'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gameId: common.gameId, match: { gameId: common.gameId } });
    expect(mocks.persist).not.toHaveBeenCalled(); expect(mocks.wake).not.toHaveBeenCalled();
    expect(mocks.emails).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('keeps POST match-details readable on a deployment preview', async () => {
    const response = await matchDetails(request({ teamId: TEAM, matchId: MATCH }), context('deploy-preview'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ matches: [{ id: MATCH, participants: [] }] });
    expect(mocks.persist).not.toHaveBeenCalled(); expect(mocks.wake).not.toHaveBeenCalled();
  });
});
