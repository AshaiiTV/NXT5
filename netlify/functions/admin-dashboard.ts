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
  const [summaryRows, recentTeamRows, recentUserRows, teamSizeRows, regionRows, dailyRows, featureRows, matchHealthRows, accountFunnelRows, rosterRows, weeklyRows, teamDirectoryRows] = await Promise.all([
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
    `,
    sql`
      select
        (select count(distinct team_id) from players) as roster,
        (select count(distinct team_id) from matches) as matches,
        (select count(distinct team_id) from champion_pool) as champion_pool,
        (select count(distinct team_id) from composition_types) as compositions,
        (select count(distinct team_id) from reports) as reports,
        (select count(distinct team_id) from player_availability) as planning,
        (select count(distinct team_id) from player_goals) as goals,
        (select count(distinct team_id) from match_archives) as archives
    `,
    sql`
      select
        count(*) filter (where result = 'Victoire') as wins,
        count(*) filter (where result = 'Défaite') as losses,
        count(*) filter (where result = 'Analyse') as analyses,
        count(*) filter (where created_at >= now() - interval '24 hours') as imports_24h,
        count(*) filter (where created_at >= now() - interval '7 days') as imports_7d,
        count(distinct team_id) filter (where created_at >= now() - interval '30 days') as importing_teams_30d,
        coalesce(avg(duration_seconds) filter (where duration_seconds > 0), 0) as average_duration_seconds,
        count(*) filter (where patch is not null and patch <> '') as matches_with_patch,
        count(*) filter (where duration_seconds is not null and duration_seconds > 0) as matches_with_duration
      from matches
    `,
    sql`
      select
        (select count(distinct user_id) from team_members) as users_in_team,
        (select count(distinct user_id) from players where user_id is not null) as users_linked_to_player,
        (select count(*) from users where coalesce(email_verified, false)) as verified,
        (select count(distinct user_id) from sessions where last_seen_at >= now() - interval '30 days') as seen_30d,
        (select count(distinct sessions.user_id)
          from sessions join users on users.id = sessions.user_id
          where users.created_at < now() - interval '30 days'
            and sessions.last_seen_at >= now() - interval '30 days') as returning_30d
    `,
    sql`
      select
        count(*) filter (where roster_status = 'MAIN') as main,
        count(*) filter (where roster_status = 'SUB') as substitutes,
        count(*) filter (where roster_status = 'INACTIVE') as inactive,
        count(*) filter (where role in ('COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD')) as staff,
        count(*) filter (where role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB')) as competitors,
        count(*) filter (where user_id is not null) as linked,
        count(*) filter (where riot_id is not null and riot_id <> '') as riot_configured
      from players
    `,
    sql`
      with weeks as (
        select generate_series(
          date_trunc('week', now()) - interval '11 weeks',
          date_trunc('week', now()),
          interval '1 week'
        ) as week
      )
      select
        to_char(weeks.week, 'YYYY-MM-DD') as date,
        (select count(*) from users where users.created_at >= weeks.week and users.created_at < weeks.week + interval '1 week') as users,
        (select count(*) from teams where teams.created_at >= weeks.week and teams.created_at < weeks.week + interval '1 week') as teams,
        (select count(*) from matches where matches.created_at >= weeks.week and matches.created_at < weeks.week + interval '1 week') as matches,
        (select count(distinct user_id) from sessions where sessions.last_seen_at >= weeks.week and sessions.last_seen_at < weeks.week + interval '1 week') as active_users
      from weeks
      order by weeks.week asc
    `,
    sql`
      select teams.id, teams.name, teams.tag, teams.region, teams.created_at,
        (select count(*) from players where players.team_id = teams.id) as players,
        (select count(*) from matches where matches.team_id = teams.id) as matches,
        (select max(matches.created_at) from matches where matches.team_id = teams.id) as last_activity_at
      from teams
      order by coalesce((select max(matches.created_at) from matches where matches.team_id = teams.id), teams.created_at) desc
      limit 500
    `
  ]);

  const summary: any = summaryRows[0] || {};
  const averages: any = teamSizeRows[0] || {};
  const features: any = featureRows[0] || {};
  const matchHealth: any = matchHealthRows[0] || {};
  const accountFunnel: any = accountFunnelRows[0] || {};
  const roster: any = rosterRows[0] || {};

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
    adoption: {
      roster: count(features.roster), matches: count(features.matches), championPool: count(features.champion_pool),
      compositions: count(features.compositions), reports: count(features.reports), planning: count(features.planning),
      goals: count(features.goals), archives: count(features.archives)
    },
    matchHealth: {
      wins: count(matchHealth.wins), losses: count(matchHealth.losses), analyses: count(matchHealth.analyses),
      imports24h: count(matchHealth.imports_24h), imports7d: count(matchHealth.imports_7d),
      importingTeams30d: count(matchHealth.importing_teams_30d),
      averageDurationSeconds: count(matchHealth.average_duration_seconds),
      matchesWithPatch: count(matchHealth.matches_with_patch), matchesWithDuration: count(matchHealth.matches_with_duration)
    },
    accountFunnel: {
      registered: count(summary.users), verified: count(accountFunnel.verified), usersInTeam: count(accountFunnel.users_in_team),
      usersLinkedToPlayer: count(accountFunnel.users_linked_to_player), seen30d: count(accountFunnel.seen_30d),
      returning30d: count(accountFunnel.returning_30d)
    },
    rosterHealth: {
      main: count(roster.main), substitutes: count(roster.substitutes), inactive: count(roster.inactive),
      staff: count(roster.staff), competitors: count(roster.competitors), linked: count(roster.linked),
      riotConfigured: count(roster.riot_configured)
    },
    teamsByRegion: regionRows.map((row: any) => ({ region: row.region || 'Non renseignée', count: count(row.team_count) })),
    daily: dailyRows.map((row: any) => ({ date: row.date, users: count(row.users), teams: count(row.teams), matches: count(row.matches) })),
    weekly: weeklyRows.map((row: any) => ({ date: row.date, users: count(row.users), teams: count(row.teams), matches: count(row.matches), activeUsers: count(row.active_users) })),
    teamDirectory: teamDirectoryRows.map((row: any) => ({
      id: row.id, name: row.name, tag: row.tag, region: row.region, createdAt: row.created_at,
      players: count(row.players), matches: count(row.matches), lastActivityAt: row.last_activity_at || null
    })),
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

async function loadTeamDetail(teamId: string) {
  const [teamRows, rosterRows, matchRows, dailyRows, benchmarkRows] = await Promise.all([
    sql`
      select teams.id, teams.name, teams.tag, teams.region, teams.created_at,
        (select count(*) from team_members where team_id = teams.id) as members,
        (select count(*) from players where team_id = teams.id) as players,
        (select count(*) from matches where team_id = teams.id) as matches,
        (select count(*) from reports where team_id = teams.id) as reports,
        (select count(*) from composition_types where team_id = teams.id) as compositions,
        (select count(*) from player_availability where team_id = teams.id) as availability_entries,
        (select count(distinct player_id) from player_availability where team_id = teams.id and week_start = date_trunc('week', current_date)::date) as players_planned_current_week,
        (select count(*) from player_goals where team_id = teams.id) as goals,
        (select count(*) from champion_pool where team_id = teams.id) as champion_pool_entries,
        (select count(*) from match_archives where team_id = teams.id) as archives,
        (select count(distinct role) from players where team_id = teams.id and roster_status = 'MAIN' and role in ('TOP','JGL','MID','ADC','SUP')) as main_roles_covered,
        (select count(*) from players where team_id = teams.id and user_id is not null) as linked_players,
        (select max(created_at) from matches where team_id = teams.id) as last_match_at
      from teams where teams.id = ${teamId} limit 1
    `,
    sql`
      select role, roster_status, count(*) as count,
        count(*) filter (where user_id is not null) as linked,
        count(*) filter (where riot_id is not null and riot_id <> '') as riot_configured
      from players where team_id = ${teamId}
      group by role, roster_status order by role, roster_status
    `,
    sql`
      select
        count(*) filter (where result = 'Victoire') as wins,
        count(*) filter (where result = 'Défaite') as losses,
        count(*) filter (where result = 'Analyse') as analyses,
        count(*) filter (where created_at >= now() - interval '7 days') as last_7d,
        count(*) filter (where created_at >= now() - interval '30 days') as last_30d,
        coalesce(avg(duration_seconds) filter (where duration_seconds > 0), 0) as average_duration_seconds,
        count(*) filter (where patch is not null and patch <> '') as with_patch,
        count(*) filter (where duration_seconds is not null and duration_seconds > 0) as with_duration
      from matches where team_id = ${teamId}
    `,
    sql`
      with days as (
        select generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') as day
      )
      select to_char(days.day, 'YYYY-MM-DD') as date,
        (select count(*) from matches where team_id = ${teamId} and created_at >= days.day and created_at < days.day + interval '1 day') as matches
      from days order by days.day asc
    `,
    sql`
      with per_team as (
        select teams.id,
          (select count(*) from players where team_id = teams.id) as players,
          (select count(*) from matches where team_id = teams.id) as matches,
          (select count(*) from matches where team_id = teams.id and created_at >= now() - interval '30 days') as matches_30d,
          (select count(*) from reports where team_id = teams.id) as reports,
          (select count(*) from composition_types where team_id = teams.id) as compositions
        from teams
      )
      select
        coalesce(percentile_cont(0.5) within group (order by players), 0) as median_players,
        coalesce(percentile_cont(0.5) within group (order by matches), 0) as median_matches,
        coalesce(percentile_cont(0.5) within group (order by matches_30d), 0) as median_matches_30d,
        coalesce(percentile_cont(0.5) within group (order by reports), 0) as median_reports,
        coalesce(percentile_cont(0.5) within group (order by compositions), 0) as median_compositions
      from per_team
    `
  ]);
  const team: any = teamRows[0];
  if (!team) return null;
  const matches: any = matchRows[0] || {};
  const benchmark: any = benchmarkRows[0] || {};
  const playerTotal = count(team.players);
  const matchTotal = count(team.matches);
  const mainRolesCovered = count(team.main_roles_covered);
  const linkedPlayers = count(team.linked_players);
  const matches30d = count(matches.last_30d);
  const dataQualityRate = matchTotal ? (count(matches.with_patch) + count(matches.with_duration)) / (matchTotal * 2) : 0;
  const workflowSignals = [count(team.reports) > 0, count(team.compositions) > 0, count(team.players_planned_current_week) > 0, count(team.goals) > 0];
  const healthScore = Math.round(
    (mainRolesCovered / 5) * 25 +
    (playerTotal ? linkedPlayers / playerTotal : 0) * 15 +
    Math.min(1, matches30d / 8) * 25 +
    workflowSignals.filter(Boolean).length * 5 +
    dataQualityRate * 15
  );
  const signals = [
    matches30d === 0 ? { level: 'critical', title: 'Aucune activité récente', detail: 'Aucune game importée sur les 30 derniers jours.' } : null,
    mainRolesCovered < 5 ? { level: 'warning', title: 'Roster compétitif incomplet', detail: `${mainRolesCovered}/5 rôles titulaires sont couverts.` } : null,
    playerTotal > 0 && linkedPlayers / playerTotal < 0.6 ? { level: 'warning', title: 'Peu de profils liés', detail: `${linkedPlayers}/${playerTotal} joueurs sont reliés à un compte.` } : null,
    matches30d >= 3 && count(team.reports) === 0 ? { level: 'opportunity', title: 'Games sans boucle de review', detail: 'Du volume est importé mais aucune review structurée n’est enregistrée.' } : null,
    matches30d >= 3 && count(team.compositions) === 0 ? { level: 'opportunity', title: 'Préparation draft absente', detail: 'L’équipe joue régulièrement sans composition préparée.' } : null,
    mainRolesCovered === 5 && matches30d >= 4 ? { level: 'positive', title: 'Socle opérationnel', detail: 'Roster complet et activité régulière sur les 30 derniers jours.' } : null
  ].filter(Boolean);
  return {
    team: { id: team.id, name: team.name, tag: team.tag, region: team.region, createdAt: team.created_at, lastMatchAt: team.last_match_at || null },
    totals: {
      members: count(team.members), players: count(team.players), matches: count(team.matches), reports: count(team.reports),
      compositions: count(team.compositions), availabilityEntries: count(team.availability_entries), goals: count(team.goals),
      championPoolEntries: count(team.champion_pool_entries), archives: count(team.archives),
      playersPlannedCurrentWeek: count(team.players_planned_current_week), mainRolesCovered, linkedPlayers
    },
    matches: {
      wins: count(matches.wins), losses: count(matches.losses), analyses: count(matches.analyses), last7d: count(matches.last_7d),
      last30d: count(matches.last_30d), averageDurationSeconds: count(matches.average_duration_seconds),
      withPatch: count(matches.with_patch), withDuration: count(matches.with_duration)
    },
    roster: rosterRows.map((row: any) => ({ role: row.role, status: row.roster_status, count: count(row.count), linked: count(row.linked), riotConfigured: count(row.riot_configured) })),
    daily: dailyRows.map((row: any) => ({ date: row.date, matches: count(row.matches) })),
    health: { score: healthScore, signals },
    benchmark: {
      medianPlayers: count(benchmark.median_players), medianMatches: count(benchmark.median_matches),
      medianMatches30d: count(benchmark.median_matches_30d), medianReports: count(benchmark.median_reports),
      medianCompositions: count(benchmark.median_compositions)
    }
  };
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    await requirePlatformAdmin(request, context);
    const url = new URL(request.url);
    const teamId = String(url.searchParams.get('teamId') || '').trim();
    if (url.searchParams.get('view') === 'team') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId)) {
        throw Object.assign(new Error('Identifiant équipe invalide.'), { status: 400 });
      }
      const detail = await loadTeamDetail(teamId);
      if (!detail) throw Object.assign(new Error('Équipe introuvable.'), { status: 404 });
      return json(detail);
    }
    return json(await loadDashboard());
  } catch (err) {
    return handleError(err);
  }
}
