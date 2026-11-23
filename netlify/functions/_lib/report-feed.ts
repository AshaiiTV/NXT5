import { sql } from './db';

// The workspace bootstrap must stay well below Netlify's ~6 MB response cap.
// Each review can hold 256 000 characters, so only the newest contents are
// inlined; older ones are flagged and loaded on demand through reports-manage.
export const REPORT_FEED_LIMIT = 1000;
export const REPORT_FEED_CONTENT_BUDGET_BYTES = 2_000_000;

export const REPORT_STAFF_ROLES = ['owner', 'captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];

type FeedOptions = { limit?: number; budgetBytes?: number };

/**
 * Newest visible reports of a team (drafts only for staff). `content` (and the
 * frozen copy in `original_debrief.content`) is returned while the cumulative
 * size, newest first, stays within the budget; later rows carry
 * `content_omitted: true`. The budget is computed in SQL from octet_length, so
 * omitted contents are never read out of the database.
 */
export async function loadTeamReports(teamId: string, userId: string, options: FeedOptions = {}) {
  const limit = options.limit ?? REPORT_FEED_LIMIT;
  const budgetBytes = options.budgetBytes ?? REPORT_FEED_CONTENT_BUDGET_BYTES;
  const rows = await sql`
    with visible_reports as (
      select reports.id, reports.created_at,
        octet_length(reports.content) as body_bytes,
        octet_length(reports.content) + coalesce(octet_length(reports.original_debrief->>'content'), 0) as content_bytes
      from reports
      where reports.team_id = ${teamId}
        and (reports.discord_status <> 'draft'
          or exists(select 1 from teams t left join team_members tm on tm.team_id = t.id and tm.user_id = ${userId}
            where t.id = reports.team_id and (t.owner_id = ${userId} or tm.role = any(${REPORT_STAFF_ROLES}))))
      order by reports.created_at desc, reports.id desc
      limit ${limit}
    ), budgeted as (
      select id, body_bytes, content_bytes = 0 or sum(content_bytes) over (
        order by created_at desc, id desc rows between unbounded preceding and current row) <= ${budgetBytes} as inline_content
      from visible_reports
    )
    select reports.id, reports.team_id, reports.match_id, reports.match_ids, reports.created_by, reports.is_team_note,
      reports.source, reports.title, reports.created_at, reports.updated_at, reports.discord_status,
      case when budgeted.inline_content or budgeted.body_bytes = 0 then reports.content end as content,
      case when budgeted.inline_content then reports.original_debrief else reports.original_debrief - 'content' end as original_debrief,
      not budgeted.inline_content as content_omitted,
      users.name as author_name
    from budgeted
    join reports on reports.id = budgeted.id
    left join users on users.id = reports.created_by
    order by reports.created_at desc, reports.id desc
  `;
  return rows;
}
