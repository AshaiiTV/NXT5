import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runReviewBackfill, preservedReviewNotes } from '../../tools/review-backfill-runner.mjs';
import { buildRetroactiveCoachContent, stripGeneratedReportContent, reportMatchIds } from '../pages/workspace/GameWorkspace.jsx';

const databases = [];
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const teamA = id(1);
const teamB = id(2);
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.close())); });

async function fixture() {
  const db = new PGlite();
  databases.push(db);
  await db.waitReady;
  await db.exec(`
    create table teams (id uuid primary key);
    create table matches (id uuid primary key, team_id uuid references teams(id), result text,
      side text, duration text, raw jsonb);
    create table match_participants (id uuid primary key, match_id uuid references matches(id),
      team_key text, role text, summoner_name text, champion text, kills integer, deaths integer,
      assists integer, gold integer, damage integer, vision integer, raw jsonb);
    create table reports (id uuid primary key, team_id uuid references teams(id) on delete cascade,
      match_id uuid references matches(id), match_ids jsonb, title text, content text,
      created_by uuid, created_at timestamptz, updated_at timestamptz, extra_metadata jsonb);
  `);
  await db.query('insert into teams values ($1), ($2)', [teamA, teamB]);
  const client = { query: vi.fn((sql, params) => db.query(sql, params)) };
  const match = async (number, teamId = teamA, withParticipants = true) => {
    await db.query('insert into matches values ($1, $2, $3, $4, $5, $6)',
      [id(number), teamId, 'Victoire', 'BLUE', '25:00', { nxt5Label: `Game ${number}` }]);
    if (withParticipants) {
      await db.query(`insert into match_participants values
        ($1, $3, 'ALLY', 'ADC', 'Joueur allié', 'Jinx', 3, 2, 4, 10000, 20000, 15, '{"participantId":1,"teamId":100}'),
        ($2, $3, 'ENEMY', 'ADC', 'Adversaire', 'Ashe', 2, 3, 1, 8000, 17000, 12, '{"participantId":6,"teamId":200}')`,
      [id(number + 1000), id(number + 2000), id(number)]);
    }
  };
  const report = async (number, content, matchNumbers = [10], teamId = teamA) => {
    await db.query(`insert into reports values ($1, $2, $3, $4, $5, $6, $7,
      '2025-01-01T12:00:00.123456Z', '2025-01-02T12:00:00.987654Z', '{"custom":"Conserver"}')`,
    [id(number), teamId, matchNumbers.length && matchNumbers[0] !== 999 ? id(matchNumbers[0]) : null,
      matchNumbers.map(id), 'Titre staff inchangé', content, id(99)]);
  };
  const rows = async () => (await db.query('select to_jsonb(reports) as report from reports order by id')).rows.map(row => row.report);
  const run = overrides => runReviewBackfill({ client, generateContent: buildRetroactiveCoachContent,
    stripGeneratedContent: stripGeneratedReportContent, getMatchIds: reportMatchIds, ...overrides });
  return { db, client, match, report, rows, run };
}

describe('one-time historical review backfill', () => {
  it('rewrites every team, preserves exact notes and metadata, and saves originals durably', async () => {
    const { db, client, match, report, rows, run } = await fixture();
    await match(10); await match(20, teamB);
    const manual = `  Notes écrites à la main\n${'Conserver cette décision.\n'.repeat(700)}\n/KDA "ADC"  \n`;
    const legacy = 'VERDICT COACH\nCorrection staff dans le verdict\n\n[NXT5_REPORT_V2]\nNotes staff\nDernière décision  \n';
    await report(100, manual);
    await report(200, legacy, [20], teamB);
    const before = await rows();
    const result = await run();
    expect(result).toMatchObject({ scanned: 2, updated: 2, unchanged: 0, skipped: [], alreadyCompleted: false });
    const after = await rows();
    expect(stripGeneratedReportContent(after[0].content)).toBe(manual);
    expect(stripGeneratedReportContent(after[1].content)).toBe(legacy.replace('[NXT5_REPORT_V2]\n', ''));
    for (let index = 0; index < after.length; index += 1) {
      expect(after[index]).toEqual({ ...before[index], content: after[index].content, updated_at: after[index].updated_at });
      expect(after[index].content).toContain('LECTURE PAR JOUEUR');
      expect(after[index].updated_at).not.toBe(before[index].updated_at);
    }
    const backups = (await db.query('select * from nxt5_review_backfill_backups order by report_id')).rows;
    expect(backups.map(backup => backup.original_report)).toEqual(before);
    expect(backups.map(backup => backup.original_content)).toEqual(before.map(row => row.content));
    expect(backups.map(backup => backup.rewritten_content)).toEqual(after.map(row => row.content));
    expect((await db.query('select result from nxt5_review_backfill_runs')).rows).toEqual([{ result }]);
    const queries = client.query.mock.calls.map(([sql]) => sql);
    expect(queries).toContain('begin isolation level repeatable read');
    expect(queries.some(sql => /from reports order by id for update$/.test(sql))).toBe(true);
    expect(queries.filter(sql => /for share$/.test(sql))).toHaveLength(2);
  }, 30_000);

  it('keeps a quoted V3 marker inside old manual or V2 notes without losing the prefix', async () => {
    const { match, report, rows, run } = await fixture();
    await match(10);
    const manual = 'Décision manuelle importante\n[NXT5_REPORT_V3]\nNotes staff\nExemple cité  \n';
    const legacy = 'VERDICT COACH\nCorrection libre\n[NXT5_REPORT_V2]\nNotes staff\n[NXT5_REPORT_V3]\nNe rien supprimer\n';
    expect(preservedReviewNotes(manual, stripGeneratedReportContent)).toBe(manual);
    expect(preservedReviewNotes(legacy, stripGeneratedReportContent)).toBe(legacy);
    await report(100, manual); await report(200, legacy);
    await run();
    expect((await rows()).map(row => stripGeneratedReportContent(row.content))).toEqual([manual, legacy]);
  });

  it('refreshes recognized V3 content and keeps all group links in their original order', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10); await match(20);
    const notes = '  Notes staff de groupe\n[NXT5_REPORT_V3]\nExemple littéral à conserver\n';
    const generated = `VERDICT COACH\nAncienne analyse\nCAUSE RACINE\nAncienne cause\nPLAN D'EXÉCUTION\nAncien plan\n[NXT5_REPORT_V3]\nNotes staff\n${notes}`;
    await report(100, generated, [20, 10, 20]);
    await run();
    const [saved] = await rows();
    expect(stripGeneratedReportContent(saved.content)).toBe(notes);
    expect(saved.content).not.toContain('Ancienne analyse');
    expect(saved.content).toContain('GAME 1 · Game 20');
    expect(saved.content).toContain('GAME 2 · Game 10');
    expect(saved.match_ids).toEqual([id(20), id(10), id(20)]);
    expect(saved.match_id).toBe(id(20));
    expect((await db.query('select original_content from nxt5_review_backfill_backups')).rows).toEqual([{ original_content: generated }]);
  });

  it('retains complete saved reviews when linked games or participant data are unavailable', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10); await match(20, teamB); await match(30, teamA, false);
    await report(100, 'Review libre', []);
    await report(200, 'Game supprimée', [999]);
    await report(300, 'Lien équipe étrangère', [20]);
    await report(400, 'Participants absents', [10, 30]);
    const before = await rows();
    const result = await run();
    expect(result).toMatchObject({ scanned: 4, updated: 0, unchanged: 0 });
    expect(result.skipped.map(item => item.reason)).toEqual(['NO_LINKED_GAMES', 'MISSING_LINKED_GAME', 'MISSING_LINKED_GAME', 'MISSING_PARTICIPANTS']);
    expect(await rows()).toEqual(before);
    expect((await db.query('select * from nxt5_review_backfill_backups')).rows).toEqual([]);
  });

  it('handles primary legacy links, JSON-string lists and null entries without altering stored links', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10);
    await report(100, 'Ancienne note avec lien principal');
    await report(200, 'Notes dont la liste est une chaîne JSON');
    await report(300, 'Notes avec entrées vides');
    await report(400, 'Notes avec liste nulle');
    await db.query("update reports set match_ids = '[]'::jsonb where id = $1", [id(100)]);
    await db.query('update reports set match_ids = $1::jsonb where id = $2', [JSON.stringify(JSON.stringify([id(10)])), id(200)]);
    await db.query('update reports set match_ids = $1::jsonb where id = $2', [JSON.stringify([null, '', ` ${id(10)} `, id(10)]), id(300)]);
    await db.query('update reports set match_ids = null where id = $1', [id(400)]);
    const before = await rows();
    expect(await run()).toMatchObject({ scanned: 4, updated: 4, skipped: [] });
    const after = await rows();
    expect(after.map(row => stripGeneratedReportContent(row.content))).toEqual(before.map(row => row.content));
    expect(after.map(row => [row.match_id, row.match_ids])).toEqual(before.map(row => [row.match_id, row.match_ids]));
  });

  it('skips excessive linked games and oversized generated content without truncating notes', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10);
    await report(100, 'Conserver tous les liens');
    await db.query('update reports set match_ids = $1::jsonb where id = $2',
      [JSON.stringify(Array.from({ length: 21 }, (_, index) => id(index + 10))), id(100)]);
    await report(200, 'N'.repeat(255999));
    const before = await rows();
    const result = await run();
    expect(result.skipped.map(item => item.reason)).toEqual(['TOO_MANY_LINKED_GAMES', 'CONTENT_TOO_LONG']);
    expect(await rows()).toEqual(before);
    expect((await db.query('select * from nxt5_review_backfill_backups')).rows).toEqual([]);
  });

  it('rolls back earlier updates and all backups when generation loses any note', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10);
    await report(100, 'Première note'); await report(200, 'Deuxième note');
    const before = await rows();
    await expect(run({ generateContent: (saved, matches, notes) => buildRetroactiveCoachContent(saved, matches,
      saved.id === id(200) ? '' : notes) })).rejects.toMatchObject({ code: 'NOTES_PRESERVATION_FAILED' });
    expect(await rows()).toEqual(before);
    expect((await db.query("select to_regclass('nxt5_review_backfill_backups') as backups, to_regclass('nxt5_review_backfill_runs') as runs")).rows)
      .toEqual([{ backups: null, runs: null }]);
  });

  it('verifies the persisted content and rolls back database-side truncation', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10); await report(100, 'Notes placées à la fin : ne pas tronquer.');
    const before = await rows();
    await db.exec(`create function truncate_report() returns trigger language plpgsql as $$
      begin new.content := left(new.content, 20); return new; end $$;
      create trigger truncate_report before update on reports for each row execute function truncate_report();`);
    await expect(run()).rejects.toMatchObject({ code: 'PERSISTED_NOTES_PRESERVATION_FAILED' });
    expect(await rows()).toEqual(before);
  });

  it('does not touch later edits or new reports after completion and removes backups with deleted reports', async () => {
    const { db, match, report, rows, run } = await fixture();
    await match(10); await report(100, 'Notes historiques');
    const first = await run();
    await db.query('update reports set content = $1 where id = $2', ['Notes modifiées après migration', id(100)]);
    await report(200, 'Nouvelle review après migration');
    const before = await rows();
    const generateContent = vi.fn(() => { throw new Error('Must not regenerate after completion'); });
    expect(await run({ generateContent })).toEqual({ ...first, alreadyCompleted: true });
    expect(generateContent).not.toHaveBeenCalled();
    expect(await rows()).toEqual(before);
    await db.query('delete from reports where id = $1', [id(100)]);
    expect((await db.query('select * from nxt5_review_backfill_backups')).rows).toEqual([]);
    expect((await db.query('select * from nxt5_review_backfill_runs')).rows).toHaveLength(1);
  });
});
