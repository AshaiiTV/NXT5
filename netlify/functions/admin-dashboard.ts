import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertMethod, handleError, json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';

const RECENT_LIMIT = 10;

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Read-only, platform-wide statistics. Keep this payload deliberately free of
 * email addresses, session/IP data, invite codes and imported match raw data.
 */
async function loadDashboard() {
  const [summaryRows, recentTeamRows, recentUserRows, teamSizeRows, regionRows, dailyRows] = await Promise.all([
    sql`
      select
        (select count(*) from teams) as teams,
        (select count(*) from users) as users,
        (select count(*) from players) as players,
        (select count(*) from matches) as matches,
        (select count(*) from teams where created_at >= now() - interval '7 days') as teams_7d,
        (select count(*) from teams where created_at >= now() - interval '30 days') as teams_30d,
        (select count(*) from users where created_at >= now() - interval '7 days') as users_7d,
        (select count(*) from users where created_at >= now() - interval '30 days') as users_30d,
        (select count(*) from players where created_at >= now() - interval '7 days') as players_7d,
        (select count(*) from players where created_at >= now() - interval '30 days') as players_30d,
        (select count(*) from matches where created_at >= now() - interval '7 days') as matches_7d,
        (select count(*) from matches where created_at >= now() - interval '30 days') as matches_30d,
        (select count(distinct user_id) from sessions where revoked_at is null and expires_at > now() and last_seen_at >= now() - interval '7 days') as active_users_7d,
        (select count(distinct user_id) from sessions where revoked_at is null and expires_at > now() and last_seen_at >= now() - interval '30 days') as active_users_30d,
        (select count(distinct team_id) from matches where created_at >= now() - interval '7 days') as active_teams_7d,
        (select count(distinct team_id) from matches where created_at >= now() - interval '30 days') as active_teams_30d,
        (select count(*) from users where coalesce(email_verified, false)) as verified_users
    `,
    sql`
      select
        teams.id,
        teams.name,
        teams.tag,
        teams.region,
        teams.created_at,
        users.name as owner_name,
        (select count(*) from team_members where team_members.team_id = teams.id) as member_count,
        (select count(*) from players where players.team_id = teams.id) as player_count,
        (select count(*) from matches where matches.team_id = teams.id) as match_count,
        (select max(matches.created_at) from matches where matches.team_id = teams.id) as last_match_at
      from teams
      join users on users.id = teams.owner_id
      order by teams.created_at desc
      limit ${RECENT_LIMIT}
    `,
    sql`
      select
        users.id,
        users.account_name,
        users.name,
        coalesce(users.email_verified, false) as email_verified,
        users.created_at,
        (select count(*) from team_members where team_members.user_id = users.id) as team_count,
        (select max(sessions.last_seen_at) from sessions where sessions.user_id = users.id) as last_seen_at
      from users
      order by users.created_at desc
      limit ${RECENT_LIMIT}
    `,
    sql`
      select
        coalesce(avg(member_count), 0) as members_per_team,
        coalesce(avg(player_count), 0) as players_per_team,
        coalesce(avg(match_count), 0) as matches_per_team,
        count(*) filter (where member_count = 0) as teams_without_members,
        count(*) filter (where player_count = 0) as teams_without_players,
        count(*) filter (where match_count = 0) as teams_without_matches
      from (
        select
          teams.id,
          (select count(*) from team_members where team_members.team_id = teams.id) as member_count,
          (select count(*) from players where players.team_id = teams.id) as player_count,
          (select count(*) from matches where matches.team_id = teams.id) as match_count
        from teams
      ) per_team
    `,
    sql`
      select region, count(*) as team_count
      from teams
      group by region
      order by team_count desc, region asc
      limit 20
    `,
    sql`
      with days as (
        select generate_series(
          date_trunc('day', now()) - interval '29 days',
          date_trunc('day', now()),
          interval '1 day'
        ) as day
      )
      select
        to_char(days.day, 'YYYY-MM-DD') as date,
        (select count(*) from users where users.created_at >= days.day and users.created_at < days.day + interval '1 day') as users,
        (select count(*) from teams where teams.created_at >= days.day and teams.created_at < days.day + interval '1 day') as teams,
        (select count(*) from matches where matches.created_at >= days.day and matches.created_at < days.day + interval '1 day') as matches
      from days
      order by days.day asc
    `
  ]);

  const summary: any = summaryRows[0] || {};
  const averages: any = teamSizeRows[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      teams: count(summary.teams), users: count(summary.users),
      players: count(summary.players), matches: count(summary.matches)
    },
    growth: {
      days7: { teams: count(summary.teams_7d), users: count(summary.users_7d), players: count(summary.players_7d), matches: count(summary.matches_7d) },
      days30: { teams: count(summary.teams_30d), users: count(summary.users_30d), players: count(summary.players_30d), matches: count(summary.matches_30d) }
    },
    activity: {
      activeUsers7d: count(summary.active_users_7d),
      activeUsers30d: count(summary.active_users_30d),
      activeTeams7d: count(summary.active_teams_7d),
      activeTeams30d: count(summary.active_teams_30d),
      verifiedUsers: count(summary.verified_users)
    },
    averages: {
      membersPerTeam: Number(Number(averages.members_per_team || 0).toFixed(1)),
      playersPerTeam: Number(Number(averages.players_per_team || 0).toFixed(1)),
      matchesPerTeam: Number(Number(averages.matches_per_team || 0).toFixed(1))
    },
    attention: {
      teamsWithoutMembers: count(averages.teams_without_members),
      teamsWithoutPlayers: count(averages.teams_without_players),
      teamsWithoutMatches: count(averages.teams_without_matches)
    },
    teamsByRegion: regionRows.map((row: any) => ({ region: row.region || 'Non renseignée', count: count(row.team_count) })),
    daily: dailyRows.map((row: any) => ({ date: row.date, users: count(row.users), teams: count(row.teams), matches: count(row.matches) })),
    recentTeams: recentTeamRows.map((row: any) => ({
      id: row.id, name: row.name, tag: row.tag, region: row.region,
      ownerName: row.owner_name, createdAt: row.created_at,
      memberCount: count(row.member_count), playerCount: count(row.player_count),
      matchCount: count(row.match_count), lastMatchAt: row.last_match_at || null
    })),
    recentUsers: recentUserRows.map((row: any) => ({
      id: row.id, accountName: row.account_name, name: row.name,
      emailVerified: Boolean(row.email_verified), createdAt: row.created_at,
      teamCount: count(row.team_count), lastSeenAt: row.last_seen_at || null
    }))
  };
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    await requirePlatformAdmin(request, context);
    return json(await loadDashboard());
  } catch (err) {
    return handleError(err);
  }
}
