import { isDeepStrictEqual } from 'node:util';

export const REVIEW_BACKFILL_KEY = 'automatic-review-v3-20260908';

function fail(code) {
  return Object.assign(new Error(`Review backfill stopped: ${code}`), { code });
}

// An old, editable note can quote the internal marker. Only recognize a V3
// boundary when the surrounding text has the generated document structure.
export function preservedReviewNotes(content, stripGeneratedContent) {
  const original = String(content ?? '');
  const boundary = /^\[NXT5_REPORT_V3\]\r?$/m.exec(original);
  if (boundary) {
    const header = original.slice(0, boundary.index);
    const footer = original.slice(boundary.index + boundary[0].length);
    const generated = /^VERDICT COACH\r?\n/.test(header)
      && /^CAUSE RACINE\r?$/m.test(header)
      && /^PLAN D'EXÉCUTION\r?$/m.test(header)
      && /^\r?\nNotes staff\r?\n/.test(footer);
    if (!generated) return original;
  }
  return stripGeneratedContent(original);
}

function metadata(report) {
  const { content, updated_at, ...rest } = report;
  return rest;
}

/**
 * One production operation across all teams. The caller supplies a dedicated
 * pg-compatible connection and the same generator used by the workspace.
 * No text or credentials are logged or returned in the operational summary.
 */
export async function runReviewBackfill({
  client,
  generateContent,
  stripGeneratedContent,
  getMatchIds,
  migrationKey = REVIEW_BACKFILL_KEY,
}) {
  if (!client?.query || ![generateContent, stripGeneratedContent, getMatchIds].every(fn => typeof fn === 'function')) {
    throw fail('INVALID_BACKFILL_CONFIGURATION');
  }
  await client.query('begin isolation level repeatable read');
  try {
    await client.query("set local lock_timeout = '30s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query('select pg_advisory_xact_lock($1)', [1853387830]);
    await client.query(`create table if not exists nxt5_review_backfill_runs (
      operation_key text primary key,
      completed_at timestamptz not null default now(),
      result jsonb not null
    )`);
    await client.query(`create table if not exists nxt5_review_backfill_backups (
      operation_key text not null,
      report_id uuid not null references reports(id) on delete cascade,
      team_id uuid not null references teams(id) on delete cascade,
      original_report jsonb not null,
      original_content text not null,
      rewritten_content text not null,
      backed_up_at timestamptz not null default now(),
      primary key (operation_key, report_id)
    )`);
    const previous = await client.query('select result from nxt5_review_backfill_runs where operation_key = $1', [migrationKey]);
    if (previous.rows.length) {
      await client.query('commit');
      return { ...previous.rows[0].result, alreadyCompleted: true };
    }

    // The locks remain held while generation, backups, updates and verification
    // run. Concurrent saved notes cannot be replaced by an earlier snapshot.
    const reports = (await client.query('select to_jsonb(reports) as report from reports order by id for update')).rows.map(row => row.report);
    const result = { operationKey: migrationKey, scanned: reports.length, updated: 0, unchanged: 0, skipped: [], alreadyCompleted: false };
    const idsByReport = new Map(reports.map(report => {
      const candidates = getMatchIds(report);
      const ids = [...new Set((Array.isArray(candidates) ? candidates : [])
        .filter(id => typeof id === 'string').map(id => id.trim()).filter(Boolean))];
      // Earlier rows gained an empty match_ids default while keeping match_id.
      if (!ids.length && typeof report.match_id === 'string' && report.match_id.trim()) ids.push(report.match_id.trim());
      return [report.id, ids];
    }));
    const matchIds = [...new Set([...idsByReport.values()].flat())];
    const matches = matchIds.length ? (await client.query(
      'select * from matches where id::text = any($1::text[]) order by id for share', [matchIds],
    )).rows : [];
    const participants = matches.length ? (await client.query(
      'select * from match_participants where match_id::text = any($1::text[]) order by match_id, team_key, role, id for share',
      [matches.map(match => String(match.id))],
    )).rows : [];
    const participantMap = new Map();
    for (const participant of participants) {
      const id = String(participant.match_id);
      const rows = participantMap.get(id) || [];
      rows.push(participant);
      participantMap.set(id, rows);
    }
    const matchMap = new Map(matches.map(match => [String(match.id), {
      ...match, raw: match.raw || {}, participants: participantMap.get(String(match.id)) || [],
    }]));

    for (const report of reports) {
      const ids = idsByReport.get(report.id);
      const linked = ids.map(id => matchMap.get(id));
      let reason;
      if (!ids.length) reason = 'NO_LINKED_GAMES';
      else if (ids.length > 20) reason = 'TOO_MANY_LINKED_GAMES';
      else if (linked.some(match => !match || String(match.team_id) !== String(report.team_id))) reason = 'MISSING_LINKED_GAME';
      else if (linked.some(match => !match.participants.some(row => row.team_key === 'ALLY')
        || !match.participants.some(row => row.team_key === 'ENEMY'))) reason = 'MISSING_PARTICIPANTS';
      if (reason) {
        result.skipped.push({ reportId: report.id, teamId: report.team_id, reason });
        continue;
      }

      const original = String(report.content ?? '');
      const notes = preservedReviewNotes(original, stripGeneratedContent);
      if (typeof notes !== 'string') throw fail('INVALID_PRESERVED_NOTES');
      // Normalize links for the generator only; preserve their stored shape.
      const generationReport = { ...report, match_ids: ids };
      const content = await generateContent(generationReport, linked, notes);
      if (typeof content !== 'string' || !content.trim()) throw fail('INVALID_GENERATED_CONTENT');
      if (stripGeneratedContent(content) !== notes || !content.endsWith(notes)) throw fail('NOTES_PRESERVATION_FAILED');
      if (await generateContent({ ...generationReport, content }, linked, notes) !== content) throw fail('GENERATOR_NOT_IDEMPOTENT');
      if (content.length > 256000) {
        result.skipped.push({ reportId: report.id, teamId: report.team_id, reason: 'CONTENT_TOO_LONG' });
        continue;
      }
      if (content === original) {
        result.unchanged += 1;
        continue;
      }

      await client.query(`insert into nxt5_review_backfill_backups
        (operation_key, report_id, team_id, original_report, original_content, rewritten_content)
        values ($1, $2, $3, $4::jsonb, $5, $6)`,
      [migrationKey, report.id, report.team_id, JSON.stringify(report), original, content]);
      const saved = await client.query(`update reports set content = $1, updated_at = now()
        where id = $2 and team_id = $3 and content is not distinct from $4
        returning to_jsonb(reports) as report`, [content, report.id, report.team_id, original]);
      if (saved.rows.length !== 1) throw fail('REPORT_CHANGED_DURING_BACKFILL');
      const persisted = saved.rows[0].report;
      if (persisted.content !== content || stripGeneratedContent(persisted.content) !== notes) throw fail('PERSISTED_NOTES_PRESERVATION_FAILED');
      if (!isDeepStrictEqual(metadata(persisted), metadata(report))) throw fail('REPORT_METADATA_CHANGED');
      result.updated += 1;
    }
    await client.query('insert into nxt5_review_backfill_runs (operation_key, result) values ($1, $2::jsonb)', [migrationKey, JSON.stringify(result)]);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
