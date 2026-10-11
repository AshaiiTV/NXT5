import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, loadMigrations } from '../../tools/migration-runner.mjs';

const { query, authenticate, importDraft } = vi.hoisted(() => ({ query: vi.fn(), authenticate: vi.fn(), importDraft: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: query }));
vi.mock('../../netlify/functions/_lib/auth', async importOriginal => ({ ...await importOriginal<any>(), requireAuth: authenticate }));
vi.mock('../../netlify/functions/_lib/drafter-import', () => ({ importDrafterDraft: importDraft }));
import handler from '../../netlify/functions/opponents-drafts';
import { createDraftPreviewToken, MATCH_DRAFTS_SCHEMA_VERSION, MATCH_OPPONENTS_SCHEMA_VERSION, OPPONENTS_SCHEMA_VERSION, OPPONENT_LIMITS } from '../../netlify/functions/_lib/opponents';
import type { DrafterSnapshot } from '../../netlify/functions/_lib/drafter-import';

const owner = crypto.randomUUID();
const staff = crypto.randomUUID();
const outsider = crypto.randomUUID();
const viewer = crypto.randomUUID();
const teamId = crypto.randomUUID();
const otherTeam = crypto.randomUUID();
const matchId = crypto.randomUUID();
const otherMatchId = crypto.randomUUID();
const foreignMatchId = crypto.randomUUID();
let db: PGlite;
let beforeTransaction: (() => Promise<void>) | null = null;
const snapshot: DrafterSnapshot = {
  source: 'drafter.lol', sourceId: 'IiYYZGok', sourceDraftId: 'SecondDraft', gameNumber: 2,
  sourceUrl: 'https://drafter.lol/draft/IiYYZGok?game=2', blueName: 'Arcane Horizon', redName: 'OPIF',
  bluePicks: ['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Locke'], redPicks: ['Yunara', 'Lulu', 'Anivia', 'Kennen', 'Maokai'],
  blueBans: ['Jhin', 'Khazix', 'JarvanIV', 'Gnar', null], redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', 'Diana'],
  status: 'completed' as const, fearless: false, ironman: false, firstPick: 'blue' as const,
  patch: null, importedAt: '2026-10-12T10:00:00.000Z', warnings: ['Un ban vide.']
};
// These handlers run against isolated PGlite, even inside a Netlify build.
// Hosted SITE_ID/AWS markers otherwise override the local CONTEXT fallback.
// The deployment-barrier test supplies its own explicit preview context.
const context: any = { deploy: { context: 'dev' } };
function request(body: any, headers: Record<string, string> = {}) {
  return new Request('https://nxt5.org/api/opponents-drafts', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://nxt5.org', ...headers }, body: JSON.stringify(body)
  });
}
const call = (action: string, values: any = {}) => handler(request({ action, teamId, ...values }), context);
async function create(name = 'OPIF', values: any = {}) {
  const response = await call('create-opponent', { name, ...values });
  expect(response.status).toBe(200);
  return (await response.json()).opponent;
}
async function preview() {
  const response = await call('preview', { url: snapshot.sourceUrl });
  expect(response.status).toBe(200);
  return response.json();
}
const statement = (parts: TemplateStringsArray) => parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');

beforeAll(async () => {
  db = new PGlite(); await db.waitReady;
  const client = { query: async (text: string, params?: unknown[]) => params ? db.query(text, params) : (await db.exec(text)).at(-1) || { rows: [] } };
  const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
  expect(migrations.some(m => m.key === OPPONENTS_SCHEMA_VERSION)).toBe(true);
  expect(migrations.some(m => m.key === MATCH_DRAFTS_SCHEMA_VERSION)).toBe(true);
  expect(migrations.some(m => m.key === MATCH_OPPONENTS_SCHEMA_VERSION)).toBe(true);
  await applyMigrations(client, migrations);
  query.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => (await db.query(statement(parts), values)).rows);
  (query as any).transaction = async callback => {
    if (beforeTransaction) { const run = beforeTransaction; beforeTransaction = null; await run(); }
    const queries = callback((parts: TemplateStringsArray, ...values: unknown[]) => ({ text: statement(parts), values }));
    return db.transaction(async tx => {
      const results: unknown[] = [];
      for (const item of queries) results.push((await tx.query(item.text, item.values)).rows);
      return results;
    });
  };
}, 20_000);

beforeEach(async () => {
  vi.stubEnv('SESSION_SECRET', 'opponents-test-secret-'.repeat(5));
  vi.stubEnv('CONTEXT', 'dev');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await db.exec('truncate users cascade; delete from rate_limits;');
  await db.query('insert into app_schema_migrations(migration_key) values($1),($2),($3) on conflict do nothing', [OPPONENTS_SCHEMA_VERSION, MATCH_DRAFTS_SCHEMA_VERSION, MATCH_OPPONENTS_SCHEMA_VERSION]);
  for (const id of [owner, staff, viewer, outsider]) {
    await db.query('insert into users(id,account_name,name,password_hash,email,email_verified) values($1::uuid,$1::text,$1::text,$1::text,$2,true)', [id, `${id}@example.test`]);
  }
  await db.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Main','NXT'),($3,$4,'Other','OTHER')", [teamId, owner, otherTeam, outsider]);
  await db.query("insert into team_members(team_id,user_id,role) values($1,$2,'analyst'),($1,$3,'viewer')", [teamId, staff, viewer]);
  await db.query("insert into matches(id,team_id,game_id,created_by) values($1,$2,'first-match',$3),($4,$2,'second-match',$3),($5,$6,'foreign-match',$7)",
    [matchId, teamId, owner, otherMatchId, foreignMatchId, otherTeam, outsider]);
  beforeTransaction = null;
  query.mockClear(); authenticate.mockReset().mockResolvedValue({ id: owner });
  importDraft.mockReset().mockResolvedValue(structuredClone(snapshot));
});

const matchToken = (values: Partial<DrafterSnapshot> = {}, userId = owner) => createDraftPreviewToken({ ...snapshot, ...values }, teamId, userId);
const linkMatch = (values: any = {}) => call('save-match-draft', { matchId, allySide: 'blue', previewToken: matchToken(), ...values });
async function linkedDraft(values: any = {}) {
  const response = await linkMatch(values);
  expect(response.status).toBe(200);
  return (await response.json()).draft;
}

describe('drafts attached to played matches', () => {
  it('reads an empty match draft for all team members and refuses matches outside the selected team', async () => {
    authenticate.mockResolvedValue({ id: viewer });
    expect(await (await call('get-match-draft', { matchId })).json()).toEqual({ draft: null, opponents: [], canEdit: false });
    expect((await call('get-match-draft', { matchId: foreignMatchId })).status).toBe(404);
    expect((await call('get-match-draft', { matchId: crypto.randomUUID() })).status).toBe(404);
    expect((await call('get-match-draft', { matchId: 'invalid' })).status).toBe(400);
  });

  it('saves drafts without creating or inferring any opponent affiliation', async () => {
    const draft = await linkedDraft({ snapshot: { redName: 'Forged enemy' }, name: 'Forged name' });
    const second = await linkedDraft({ matchId: otherMatchId, previewToken: matchToken({ gameNumber: 3 }) });
    const listed = await (await call('list')).json();
    expect(listed.opponents).toEqual([]); expect(listed.opponentMatches).toEqual([]);
    expect(draft.opponentId).toBeNull(); expect(second.opponentId).toBeNull();
    expect(listed.drafts.map(d => d.matchId).sort()).toEqual([matchId, otherMatchId].sort());
    expect(await (await call('get-match-draft', { matchId })).json()).toMatchObject({ draft, canEdit: true, opponents: listed.opponents });
    expect(importDraft).not.toHaveBeenCalled();
  });

  it('does not assign a dossier from either the chosen side or an obsolete client opponentId', async () => {
    const first = await linkedDraft({ allySide: 'red' });
    expect((await (await call('list')).json()).opponents).toEqual([]);
    const custom = await create('Known organization', { notes: 'Keep historical notes' });
    const second = await linkedDraft({ opponentId: custom.id, allySide: 'red' });
    expect(second.id).toBe(first.id); expect(second.opponentId).toBeNull();
    expect((await (await call('list')).json()).opponents).toContainEqual(custom);
  });

  it('replaces links with an existing or new source while keeping every old snapshot in its dossier', async () => {
    const original = await linkedDraft();
    const legacyOpponent = await create();
    const existing = await (await call('save-draft', { opponentId: legacyOpponent.id, allySide: 'blue',
      previewToken: matchToken({ sourceId: 'ExistingLoose', sourceDraftId: 'ExistingLoose' }) })).json();
    expect(existing.draft.matchId).toBeNull();
    const linked = await linkedDraft({ previewToken: matchToken({ sourceId: 'ExistingLoose', sourceDraftId: 'ExistingLoose' }) });
    expect(linked.id).toBe(existing.draft.id);
    let listed = await (await call('list')).json();
    expect(listed.drafts).toHaveLength(2);
    expect(listed.drafts.find(d => d.id === original.id).matchId).toBeNull();
    const replacement = await linkedDraft({ previewToken: matchToken({ sourceId: 'NewSource', sourceDraftId: 'NewSource', redName: 'New Enemy' }) });
    listed = await (await call('list')).json();
    expect(listed.drafts).toHaveLength(3); expect(listed.opponents).toHaveLength(1);
    expect(listed.drafts.filter(d => d.matchId)).toEqual([replacement]);
    expect(listed.drafts.find(d => d.id === original.id).snapshot).toEqual(snapshot);
  });

  it('refuses to steal a source linked to another match without detaching either match or creating an orphan dossier', async () => {
    const first = await linkedDraft();
    const second = await linkedDraft({ matchId: otherMatchId, previewToken: matchToken({ sourceId: 'SecondSource' }) });
    const response = await linkMatch({ matchId: otherMatchId, previewToken: matchToken({ redName: 'Must not create' }) });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'DRAFT_ALREADY_LINKED' });
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual(first);
    expect((await (await call('get-match-draft', { matchId: otherMatchId })).json()).draft).toEqual(second);
    expect((await (await call('list')).json()).opponents).toHaveLength(0);
  });

  it('detaches idempotently without deleting history and then allows explicit relinking to another match', async () => {
    const draft = await linkedDraft();
    for (let n = 0; n < 2; n++) expect(await (await call('unlink-match-draft', { matchId })).json()).toEqual({ ok: true, draft: null });
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toBeNull();
    expect((await (await call('list')).json()).drafts).toEqual([{ ...draft, matchId: null }]);
    expect(await linkedDraft({ matchId: otherMatchId })).toMatchObject({ id: draft.id, matchId: otherMatchId });
  });

  it('preserves matchId when an existing source is reimported through the dossier action', async () => {
    const draft = await linkedDraft();
    const legacyOpponent = await create();
    const updated = await call('save-draft', { opponentId: legacyOpponent.id, allySide: 'red', previewToken: matchToken() });
    expect(updated.status).toBe(200); expect((await updated.json()).draft).toMatchObject({ id: draft.id, matchId, allySide: 'red' });
  });

  it('requires staff permissions for attach/detach and validates token, match and opponent without partial writes', async () => {
    authenticate.mockResolvedValue({ id: viewer });
    expect((await linkMatch()).status).toBe(403);
    expect((await call('unlink-match-draft', { matchId })).status).toBe(403);
    authenticate.mockResolvedValue({ id: outsider });
    expect((await call('get-match-draft', { matchId })).status).toBe(403);
    await create('Foreign dossier', { teamId: otherTeam });
    authenticate.mockResolvedValue({ id: owner });
    expect((await linkMatch({ matchId: foreignMatchId })).status).toBe(404);
    expect((await call('unlink-match-draft', { matchId: foreignMatchId })).status).toBe(404);
    expect((await linkMatch({ matchId: crypto.randomUUID() })).status).toBe(404);
    expect((await linkMatch({ previewToken: matchToken({}, staff) })).status).toBe(409);
    expect((await linkMatch({ previewToken: 'forged' })).status).toBe(409);
    const listed = await (await call('list')).json(); expect(listed.opponents).toEqual([]); expect(listed.drafts).toEqual([]);
  });

  it.each(['save-match-draft', 'unlink-match-draft'])('revalidates staff permission under the team lock before %s', async action => {
    const original = await linkedDraft();
    authenticate.mockResolvedValue({ id: staff });
    beforeTransaction = async () => { await db.query("update team_members set role='viewer' where user_id=$1", [staff]); };
    const response = await call(action, { matchId, allySide: 'blue', previewToken: matchToken({ sourceId: 'RejectedSource' }, staff) });
    expect(response.status).toBe(403);
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual(original);
    expect((await (await call('list')).json()).drafts).toHaveLength(1);
  });

  it('rechecks the match under the transaction lock after a concurrent deletion', async () => {
    beforeTransaction = async () => { await db.query('delete from matches where id=$1', [matchId]); };
    expect((await linkMatch()).status).toBe(404);
    expect((await db.query('select id from team_opponents')).rows).toEqual([]);
    expect((await db.query('select id from opponent_drafts')).rows).toEqual([]);
  });

  it('checks draft capacity before creating a dossier or releasing the current match draft', async () => {
    const original = await linkedDraft();
    await db.query(`insert into opponent_drafts(team_id,opponent_id,ally_side,source_id,game_number,source_url,snapshot)
      select $1,$2,'blue','source_'||g,1,'https://drafter.lol/draft/source_'||g,$3::jsonb from generate_series(1,199) g`, [teamId, original.opponentId, JSON.stringify(snapshot)]);
    expect((await linkMatch({ previewToken: matchToken({ sourceId: 'OverCapacity', redName: 'Do not create' }) })).status).toBe(409);
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual(original);
    expect((await (await call('list')).json()).opponents).toHaveLength(0);
    const replacement = await linkedDraft({ previewToken: matchToken({ sourceId: 'source_1', gameNumber: 1 }) });
    expect(replacement.matchId).toBe(matchId);
    expect((await (await call('list')).json()).drafts).toHaveLength(200);
  });

  it('saves match drafts independently of dossier capacity', async () => {
    const original = await linkedDraft();
    await db.query(`insert into team_opponents(team_id,name,normalized_name)
      select $1,'Opponent '||g,'opponent '||g from generate_series(1,100) g`, [teamId]);
    expect(await linkedDraft({ previewToken: matchToken({ sourceId: 'OtherSource' }) })).toMatchObject({ matchId, opponentId: original.opponentId });
  });

  it('rolls back a released link and an automatic dossier when the database rejects the replacement draft', async () => {
    const original = await linkedDraft();
    await db.exec("alter table opponent_drafts add constraint test_reject_draft check(source_id <> 'RejectedSource')");
    try {
      const response = await linkMatch({ previewToken: matchToken({ sourceId: 'RejectedSource', redName: 'Rollback this dossier' }) });
      expect(response.status).toBe(500);
      expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual(original);
      expect((await (await call('list')).json()).opponents).toHaveLength(0);
    } finally { await db.exec('alter table opponent_drafts drop constraint test_reject_draft'); }
  });

  it('enforces match isolation and uniqueness in SQL and retains draft history when a match is deleted', async () => {
    const original = await linkedDraft();
    await expect(db.query('update opponent_drafts set match_id=$1 where id=$2', [foreignMatchId, original.id])).rejects.toMatchObject({ code: '23503' });
    await expect(db.query(`insert into opponent_drafts(team_id,opponent_id,match_id,ally_side,source_id,game_number,source_url,snapshot)
      values($1,$2,$3,'blue','duplicate',1,'https://drafter.lol/draft/duplicate','{}')`, [teamId, original.opponentId, matchId])).rejects.toMatchObject({ code: '23505' });
    await db.query('delete from matches where id=$1', [matchId]);
    expect((await (await call('list')).json()).drafts).toEqual([{ ...original, matchId: null }]);
  });

  it('requires the additional match draft migration before querying its new column', async () => {
    await db.query('delete from app_schema_migrations where migration_key=$1', [MATCH_DRAFTS_SCHEMA_VERSION]);
    expect((await call('get-match-draft', { matchId })).status).toBe(503);
    expect((await call('list')).status).toBe(503);
  });
});
afterAll(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); await db.close(); });

describe('independent opponent affiliation of played matches', () => {
  it('backfills only previously linked matches and preserves data when the additive migration is replayed', async () => {
    const legacyDb = new PGlite(); await legacyDb.waitReady;
    try {
      const client = { query: async (text: string, params?: unknown[]) => params ? legacyDb.query(text, params) : (await legacyDb.exec(text)).at(-1) || { rows: [] } };
      const migrations = (await loadMigrations()).map(m => ({ ...m, sql: m.sql.replace(/create extension if not exists pgcrypto;/g, '').replaceAll('gen_random_bytes(5)', "decode('0123456789','hex')") }));
      const migration = migrations.find(m => m.key === MATCH_OPPONENTS_SCHEMA_VERSION)!;
      await applyMigrations(client, migrations.filter(m => m !== migration));
      await legacyDb.query("insert into users(id,account_name,name,password_hash) values($1,'legacy','Legacy','disabled')", [owner]);
      await legacyDb.query("insert into teams(id,owner_id,name,tag) values($1,$2,'Legacy','OLD')", [teamId, owner]);
      await legacyDb.query("insert into matches(id,team_id,game_id,created_by,raw) values($1,$2,'linked',$3,'{\"preserve\":true}'),($4,$2,'unlinked',$3,'{}')", [matchId, teamId, owner, otherMatchId]);
      const opponentId = crypto.randomUUID();
      await legacyDb.query("insert into team_opponents(id,team_id,name,normalized_name,notes) values($1,$2,'Legacy','legacy','Keep notes')", [opponentId, teamId]);
      await legacyDb.query(`insert into opponent_drafts(team_id,opponent_id,match_id,ally_side,source_id,game_number,source_url,snapshot)
        values($1,$2,$3,'blue','legacy_linked',1,'https://drafter.lol/draft/legacy_linked',$4::jsonb),
        ($1,$2,null,'red','legacy_loose',1,'https://drafter.lol/draft/legacy_loose',$4::jsonb)`, [teamId, opponentId, matchId, JSON.stringify(snapshot)]);
      const draftsBefore = (await legacyDb.query('select * from opponent_drafts order by source_id')).rows;
      expect(await applyMigrations(client, migrations)).toEqual([MATCH_OPPONENTS_SCHEMA_VERSION]);
      expect((await legacyDb.query('select id,opponent_id,raw from matches order by game_id')).rows).toEqual([
        { id: matchId, opponent_id: opponentId, raw: { preserve: true } }, { id: otherMatchId, opponent_id: null, raw: {} }
      ]);
      expect((await legacyDb.query('select * from opponent_drafts order by source_id')).rows).toEqual(draftsBefore);
      await legacyDb.query('update matches set opponent_id=null where id=$1', [matchId]);
      await legacyDb.exec(migration.sql);
      expect((await legacyDb.query('select opponent_id from matches where id=$1', [matchId])).rows).toEqual([{ opponent_id: null }]);
      expect((await legacyDb.query('select * from opponent_drafts order by source_id')).rows).toEqual(draftsBefore);
      expect(await applyMigrations(client, migrations)).toEqual([]);
    } finally { await legacyDb.close(); }
  }, 20_000);

  it('assigns, changes and clears an opponent without touching any draft bytes or metadata', async () => {
    const draft = await linkedDraft();
    expect((await (await call('list')).json()).opponents).toEqual([]);
    const first = await create('OPIF'); const second = await create('Other opponent');
    const before = (await db.query('select * from opponent_drafts where id=$1', [draft.id])).rows[0];
    for (const opponentId of [first.id, second.id, null]) {
      expect(await (await call('set-match-opponent', { matchId, opponentId })).json()).toEqual({ opponentId });
      expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBe(opponentId);
      expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual({ ...draft, opponentId });
      expect((await db.query('select * from opponent_drafts where id=$1', [draft.id])).rows[0]).toEqual(before);
    }
    expect((await (await call('list')).json()).opponentMatches).toEqual([]);
  });

  it('keeps an assigned opponent through draft creation, replacement, legacy save, detach and relink', async () => {
    const opponent = await create('Declared opponent');
    const legacy = await create('Obsolete legacy opponent');
    expect((await call('set-match-opponent', { matchId, opponentId: opponent.id })).status).toBe(200);
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toBeNull();
    const draft = await linkedDraft({ opponentId: legacy.id });
    expect(draft.opponentId).toBe(opponent.id);
    const legacySave = await call('save-draft', { opponentId: legacy.id, allySide: 'red', previewToken: matchToken() });
    expect((await legacySave.json()).draft).toMatchObject({ id: draft.id, opponentId: opponent.id, matchId });
    const replacement = await linkedDraft({ opponentId: 'ignored-obsolete-value', previewToken: matchToken({ sourceId: 'Replacement' }) });
    expect(replacement.opponentId).toBe(opponent.id);
    expect((await (await call('list')).json()).drafts.find(row => row.id === draft.id)).toMatchObject({ matchId: null, opponentId: null });
    await call('unlink-match-draft', { matchId });
    expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBe(opponent.id);
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toBeNull();
    expect(await linkedDraft({ matchId: otherMatchId })).toMatchObject({ opponentId: null, matchId: otherMatchId });
    expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBe(opponent.id);
  });

  it('lists the canonical known enemy champions of associated matches with explicit completeness and no draft fallback', async () => {
    const opponent = await create();
    await call('set-match-opponent', { matchId, opponentId: opponent.id });
    await call('set-match-opponent', { matchId: otherMatchId, opponentId: opponent.id });
    await linkedDraft();
    await db.query(`update matches set raw='{"nxt5Label":"  Scrim A  ","info":{"gameCreation":1700000000000}}', result='Victoire' where id=$1`, [matchId]);
    for (const [champion, role] of [['Wukong', 'TOP'], ["Kai'Sa", 'ADC'], ['None', 'MID'], ['', 'JUNGLE'], ['unknown', 'SUPPORT']]) {
      await db.query("insert into match_participants(match_id,team_key,champion,role) values($1,'ENEMY',$2,$3)", [matchId, champion, role]);
    }
    await db.query("insert into match_participants(match_id,team_key,champion,role) values($1,'ALLY','Ahri','MID')", [matchId]);
    let listed = (await (await call('list')).json()).opponentMatches;
    expect(listed).toHaveLength(2);
    expect(listed.find(row => row.id === matchId)).toMatchObject({ opponentId: opponent.id, gameId: 'first-match', label: 'Scrim A',
      date: '2023-11-14T22:13:20.000Z', result: 'Victoire', enemyPicks: ['Kaisa', 'MonkeyKing'], enemyPicksComplete: false });
    expect(listed.find(row => row.id === otherMatchId)).toMatchObject({ enemyPicks: [], enemyPicksComplete: false });
    await db.query("update match_participants set champion=case role when 'MID' then 'Ahri' when 'JUNGLE' then 'Lee Sin' when 'SUPPORT' then 'Braum' else champion end where match_id=$1 and team_key='ENEMY'", [matchId]);
    listed = (await (await call('list')).json()).opponentMatches;
    expect(listed.find(row => row.id === matchId)).toMatchObject({ enemyPicksComplete: true });
    await db.query("update match_participants set champion='MonkeyKing' where match_id=$1 and team_key='ENEMY' and role='SUPPORT'", [matchId]);
    expect((await (await call('list')).json()).opponentMatches.find(row => row.id === matchId).enemyPicksComplete).toBe(false);
  });

  it('requires staff writes, allows member reads and rejects foreign matches and opponents in the API and SQL', async () => {
    const local = await create();
    authenticate.mockResolvedValue({ id: outsider });
    const foreign = await create('Foreign', { teamId: otherTeam });
    expect((await call('get-match-opponent', { matchId })).status).toBe(403);
    authenticate.mockResolvedValue({ id: viewer });
    expect(await (await call('get-match-opponent', { matchId })).json()).toEqual({ opponentId: null, opponents: [local], canEdit: false });
    expect((await call('set-match-opponent', { matchId, opponentId: local.id })).status).toBe(403);
    authenticate.mockResolvedValue({ id: staff });
    expect((await call('set-match-opponent', { matchId, opponentId: local.id })).status).toBe(200);
    for (const action of ['get-match-opponent', 'set-match-opponent']) {
      expect((await call(action, { matchId: foreignMatchId, opponentId: local.id })).status).toBe(404);
    }
    expect((await call('set-match-opponent', { matchId, opponentId: foreign.id })).status).toBe(404);
    for (const opponentId of [undefined, '', 'invalid', false]) {
      expect((await call('set-match-opponent', { matchId, opponentId })).status).toBe(400);
    }
    await expect(db.query('update matches set opponent_id=$1 where id=$2', [foreign.id, matchId])).rejects.toMatchObject({ code: '23503' });
    expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBe(local.id);
    expect((await call('set-match-opponent', { matchId, opponentId: null })).status).toBe(200);
  });

  it('revalidates staff and opponent existence under transaction locks with no partial affiliation changes', async () => {
    const opponent = await create(); const draft = await linkedDraft();
    authenticate.mockResolvedValue({ id: staff });
    beforeTransaction = async () => { await db.query("update team_members set role='viewer' where user_id=$1", [staff]); };
    expect((await call('set-match-opponent', { matchId, opponentId: opponent.id })).status).toBe(403);
    authenticate.mockResolvedValue({ id: owner });
    beforeTransaction = async () => { await db.query('delete from team_opponents where id=$1', [opponent.id]); };
    expect((await call('set-match-opponent', { matchId, opponentId: opponent.id })).status).toBe(404);
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toEqual(draft);
    expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBeNull();
  });

  it('blocks match source writes in deployment previews before authentication or database access', async () => {
    const response = await handler(request({ action: 'set-match-opponent', teamId, matchId, opponentId: null }), { deploy: { context: 'deploy-preview' } } as any);
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'MATCH_SOURCE_DEPLOY_PREVIEW_DISABLED' });
    expect(query).not.toHaveBeenCalled(); expect(authenticate).not.toHaveBeenCalled();
  });

  it('retains matches and snapshots when their opponent is deleted, including legacy references', async () => {
    const opponent = await create();
    await call('set-match-opponent', { matchId, opponentId: opponent.id });
    const draft = await linkedDraft();
    await call('save-draft', { opponentId: opponent.id, allySide: 'blue', previewToken: matchToken() });
    await db.query('delete from team_opponents where id=$1', [opponent.id]);
    expect((await (await call('get-match-opponent', { matchId })).json()).opponentId).toBeNull();
    expect((await (await call('get-match-draft', { matchId })).json()).draft).toMatchObject({ id: draft.id, matchId, opponentId: null, snapshot });
    expect((await db.query('select opponent_id from opponent_drafts where id=$1', [draft.id])).rows).toEqual([{ opponent_id: null }]);
  });

  it('fails explicitly when associated matches exceed the read bound instead of reporting truncated trends', async () => {
    const opponent = await create();
    await db.query(`insert into matches(team_id,game_id,created_by,opponent_id)
      select $1,'bounded-'||g,$2,$3 from generate_series(1,$4::int) g`, [teamId, owner, opponent.id, OPPONENT_LIMITS.opponentMatches + 1]);
    const response = await call('list');
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'OPPONENT_LIMIT_REACHED' });
  });

  it('requires the independent affiliation migration before reading or writing its column', async () => {
    await db.query('delete from app_schema_migrations where migration_key=$1', [MATCH_OPPONENTS_SCHEMA_VERSION]);
    expect((await call('get-match-opponent', { matchId })).status).toBe(503);
    expect((await call('set-match-opponent', { matchId, opponentId: null })).status).toBe(503);
    expect((await call('list')).status).toBe(503);
  });
});

describe('opponent draft server', () => {
  it('imports a preview, stores its trusted snapshot and lists the opponent with its chosen ally side', async () => {
    const opponent = await create('  OPIF  ', { notes: 'Préparer la prochaine série.' });
    const imported = await preview();
    expect(imported.snapshot).toEqual(snapshot);
    const response = await call('save-draft', { opponentId: opponent.id, allySide: 'blue', previewToken: imported.previewToken,
      snapshot: { ...snapshot, blueName: 'Forged' } });
    expect(response.status).toBe(200);
    const saved = (await response.json()).draft;
    expect(saved).toMatchObject({ opponentId: null, allySide: 'blue', sourceId: 'IiYYZGok', gameNumber: 2, snapshot });
    expect(importDraft).toHaveBeenCalledTimes(1);
    const listed = await (await call('list')).json();
    expect(listed).toMatchObject({ canEdit: true, limits: OPPONENT_LIMITS, opponents: [opponent], drafts: [saved] });
  });

  it('keeps opponent creation idempotent without overwriting notes and upserts reimported drafts', async () => {
    const original = await create('OPIF', { notes: 'Keep me' });
    expect(await create('  opif ', { notes: 'Overwrite' })).toEqual(original);
    const second = await create('Other opponent');
    const imported = await preview();
    const first = await (await call('save-draft', { opponentId: original.id, allySide: 'blue', previewToken: imported.previewToken })).json();
    const changed = await (await call('save-draft', { opponentId: second.id, allySide: 'red', previewToken: imported.previewToken })).json();
    expect(changed.draft).toMatchObject({ id: first.draft.id, opponentId: null, allySide: 'red' });
    expect((await (await call('list')).json()).drafts).toHaveLength(1);
  });

  it('allows staff writes and member reads while denying viewer writes and outsiders', async () => {
    authenticate.mockResolvedValue({ id: staff }); await create();
    authenticate.mockResolvedValue({ id: viewer });
    expect(await (await call('list')).json()).toMatchObject({ canEdit: false, opponents: [expect.objectContaining({ name: 'OPIF' })] });
    for (const action of ['create-opponent', 'preview', 'save-draft']) expect((await call(action, { name: 'No', url: snapshot.sourceUrl })).status).toBe(403);
    authenticate.mockResolvedValue({ id: outsider });
    expect((await call('list')).status).toBe(403);
    expect(importDraft).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated, cross-origin, wrong-method, invalid identifiers and oversized requests', async () => {
    authenticate.mockRejectedValueOnce(Object.assign(new Error('Session absente.'), { status: 401 }));
    expect((await call('list')).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect((await handler(request({ action: 'list', teamId }, { origin: 'https://evil.example' }), context)).status).toBe(403);
    expect((await handler(request({ action: 'list', teamId }, { 'sec-fetch-site': 'cross-site' }), context)).status).toBe(403);
    expect((await handler(new Request('https://nxt5.org/api/opponents-drafts'), context)).status).toBe(405);
    for (const invalid of ['', 'not-a-uuid', 123, {}, 'x'.repeat(80)]) expect((await call('list', { teamId: invalid })).status).toBe(400);
    expect((await call('list', { huge: 'x'.repeat(25000) })).status).toBe(413);
    expect((await call('unknown')).status).toBe(400);
    expect(importDraft).not.toHaveBeenCalled();
  });

  it('validates name, notes, side and opponent id without truncating input', async () => {
    for (const values of [{ name: '' }, { name: 'x'.repeat(81) }, { name: {} }, { name: 'OPIF', notes: 'x'.repeat(2001) }]) {
      expect((await call('create-opponent', values)).status).toBe(400);
    }
    const opponent = await create(); const imported = await preview();
    expect((await call('save-draft', { opponentId: 'invalid', allySide: 'blue', previewToken: imported.previewToken })).status).toBe(400);
    expect((await call('save-draft', { opponentId: opponent.id, allySide: 'other', previewToken: imported.previewToken })).status).toBe(400);
    expect((await call('preview', { url: {} })).status).toBe(400);
  });

  it('binds preview tokens to account, team and lifetime, rejects tampering and requires the session secret', async () => {
    const opponent = await create(); const imported = await preview();
    const save = (token: string) => call('save-draft', { opponentId: opponent.id, allySide: 'blue', previewToken: token });
    const dot = imported.previewToken.indexOf('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(imported.previewToken.slice(0, dot), 'base64url').toString()),
      snapshot: { ...snapshot, blueName: 'Forged' } })).toString('base64url');
    for (const token of [forgedPayload + imported.previewToken.slice(dot),
      createDraftPreviewToken(snapshot, teamId, staff), createDraftPreviewToken(snapshot, otherTeam, owner),
      createDraftPreviewToken(snapshot, teamId, owner, Date.now() - 16 * 60 * 1000), 'invalid', 'a'.repeat(21000)]) {
      expect((await save(token)).status).toBe(409);
    }
    vi.stubEnv('SESSION_SECRET', '');
    expect((await save(imported.previewToken)).status).toBe(500);
    expect((await db.query('select id from opponent_drafts')).rows).toEqual([]);
  });

  it('rejects cross-team opponent attachments in the API and the database', async () => {
    authenticate.mockResolvedValue({ id: outsider });
    const foreign = await create('Foreign', { teamId: otherTeam });
    authenticate.mockResolvedValue({ id: owner }); const imported = await preview();
    expect((await call('save-draft', { opponentId: foreign.id, allySide: 'red', previewToken: imported.previewToken })).status).toBe(404);
    await expect(db.query(`insert into opponent_drafts(team_id,opponent_id,ally_side,source_id,game_number,source_url,snapshot)
      values($1,$2,'blue','x',1,'https://drafter.lol/draft/x','{}')`, [teamId, foreign.id])).rejects.toMatchObject({ code: '23503' });
  });

  it.each(['create-opponent', 'save-draft'])('revalidates staff permissions under the mutation lock for %s', async action => {
    const opponent = await create();
    authenticate.mockResolvedValue({ id: staff }); const imported = await preview();
    beforeTransaction = async () => { await db.query("update team_members set role='viewer' where team_id=$1 and user_id=$2", [teamId, staff]); };
    const response = await call(action, { name: 'Blocked', opponentId: opponent.id, allySide: 'blue', previewToken: imported.previewToken });
    expect(response.status).toBe(403);
    expect((await db.query('select id from opponent_drafts')).rows).toEqual([]);
    expect((await db.query('select name from team_opponents')).rows).toEqual([{ name: 'OPIF' }]);
  });

  it('rechecks access after importing the remote source', async () => {
    authenticate.mockResolvedValue({ id: staff });
    importDraft.mockImplementationOnce(async () => {
      await db.query('delete from team_members where user_id=$1', [staff]); return snapshot;
    });
    expect((await call('preview', { url: snapshot.sourceUrl })).status).toBe(403);
  });

  it.each(['user', 'team'])('enforces the %s preview budget before requesting Drafter again', async budget => {
    await preview();
    await db.query('update rate_limits set attempts=$1 where endpoint=$2', [budget === 'user' ? 6 : 12, `drafter-preview-${budget}`]);
    const response = await call('preview', { url: snapshot.sourceUrl });
    expect(response.status).toBe(429); expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(importDraft).toHaveBeenCalledTimes(1);
  });

  it('requires its migration without running runtime DDL', async () => {
    await db.query('delete from app_schema_migrations where migration_key=$1', [OPPONENTS_SCHEMA_VERSION]); query.mockClear();
    const response = await call('list');
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: 'SCHEMA_MIGRATION_REQUIRED' });
    expect(query.mock.calls.map(([parts]) => parts.join(' ')).join(' ')).not.toMatch(/create |alter /i);
  });

  it('caps stored opponents and drafts while allowing existing records to be reused at the cap', async () => {
    const opponent = await create(); const imported = await preview();
    await db.query(`insert into team_opponents(team_id,name,normalized_name)
      select $1,'Opponent '||g,'opponent '||g from generate_series(1,99) g`, [teamId]);
    expect((await call('create-opponent', { name: 'One too many' })).status).toBe(409);
    expect(await create()).toEqual(opponent);
    await db.query(`insert into opponent_drafts(team_id,opponent_id,ally_side,source_id,game_number,source_url,snapshot)
      select $1,$2,'blue','source_'||g,1,'https://drafter.lol/draft/source_'||g,$3::jsonb from generate_series(1,200) g`, [teamId, opponent.id, JSON.stringify(snapshot)]);
    const save = () => call('save-draft', { opponentId: opponent.id, allySide: 'blue', previewToken: imported.previewToken });
    expect((await save()).status).toBe(409);
    await db.query("update opponent_drafts set source_id='IiYYZGok',game_number=2 where source_id='source_1'");
    expect((await save()).status).toBe(200);
    const listed = await (await call('list')).json(); expect(listed.opponents).toHaveLength(100); expect(listed.drafts).toHaveLength(200);
    await db.query("insert into team_opponents(team_id,name,normalized_name) values($1,'Legacy excess','legacy excess')", [teamId]);
    expect((await call('list')).status).toBe(409);
  });
});
