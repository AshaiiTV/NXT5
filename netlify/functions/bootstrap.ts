import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { safeTeam } from './_lib/teams';
import { loadMatchPage, matchPageOptions } from './_lib/match-page';
import { json, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { seedDefaultMatchCategories } from './_lib/match-categories';

async function ensureBootstrapSchema() {
  await assertSchemaReady();
}

function buildDashboard(matches, improvements) {
  const recent = matches.slice(0, 10);
  const wins = recent.filter((m) => m.result === 'Victoire').length;
  const losses = recent.filter((m) => m.result === 'Défaite').length;
  const total = wins + losses;
  const winrate = total ? Math.round((wins / total) * 100) : null;

  return {
    recentWinrate: winrate === null ? '—' : `${winrate}%`,
    winrateTrend: total ? `${wins}W / ${losses}L sur les ${total} dernières` : 'Importe des games pour calculer',
    impactScore: recent[0]?.impact_score || '—',
    impactTrend: recent[0] ? `${recent[0].duration || '--:--'} · ${recent[0].side || 'Side ?'}` : 'Pas encore assez de données',
    visionDiff: recent[0]?.vision_score || '—',
    visionTrend: recent[0] ? 'Différence de vision dernière game' : 'Pas encore assez de données',
    midgameRisk: improvements[0] ? 'Donnée disponible' : '—',
    riskTrend: improvements[0]?.title || 'Aucune donnée calculée'
  };
}

async function loadAvailability(teamIds) {
  try {
    return await sql`
      select player_availability.*
      from player_availability
      where player_availability.team_id = any(${teamIds})
      order by player_availability.updated_at desc
    `;
  } catch (err) {
    if (err?.code === '42P01') return [];
    throw err;
  }
}

async function loadProfileCoachingNotes(teamIds) {
  try {
    return await sql`
      select player_coaching_notes.*, users.name as updated_by_name
      from player_coaching_notes
      left join users on users.id = player_coaching_notes.updated_by
      where player_coaching_notes.team_id = any(${teamIds})
      order by player_coaching_notes.updated_at desc
    `;
  } catch (err) {
    if (err?.code === '42P01') return [];
    throw err;
  }
}

async function loadInviteCodes(teamIds, userId) {
  try {
    return await sql`
      select team_invite_codes.*, users.name as created_by_name
      from team_invite_codes
      join teams on teams.id = team_invite_codes.team_id
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${userId}
      left join users on users.id = team_invite_codes.created_by
      where team_invite_codes.team_id = any(${teamIds})
        and team_invite_codes.expires_at > now()
        and (teams.owner_id = ${userId} or team_members.role in ('captain', 'manager'))
      order by team_invite_codes.expires_at asc
    `;
  } catch (err) {
    if (err?.code === '42P01') return [];
    throw err;
  }
}

async function loadMatchArchives(teamIds) {
  try {
    return await sql`
      select match_archives.*, users.name as created_by_name
      from match_archives
      left join users on users.id = match_archives.created_by
      where match_archives.team_id = any(${teamIds})
      order by match_archives.created_at desc
      limit 100
    `;
  } catch (err) {
    if (err?.code === '42P01') return [];
    throw err;
  }
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    assertSessionSecret();
    const user = await requireAuth(request, context);
    const url = new URL(request.url);
    const pageOptions = matchPageOptions(url);
    const requestedTeamId = String(url.searchParams.get('teamId') || '').trim();
    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.owner_id = ${user.id} or team_members.user_id = ${user.id}
      order by teams.created_at asc
    `;
    const selectedTeam = requestedTeamId ? teams.find(team => team.id === requestedTeamId) : teams[0];
    if (requestedTeamId && !selectedTeam) throw Object.assign(new Error('Accès à cette équipe refusé.'), { status: 403 });
    if (!selectedTeam) {
      return json({ dashboard: buildDashboard([], []), selectedTeamId: null,
        pagination: { ...pageOptions, total: 0, hasMore: false, nextOffset: null },
        totals: { games: 0, wins: 0, losses: 0 }, teams: [], players: [], teamMembers: [], matches: [],
        championPool: [], compositions: [], improvements: [], reports: [], matchArchives: [], matchCategories: [],
        inviteCodes: [], availability: [], profileCoachingNotes: [], playerGoals: [] });
    }
    const selectedTeamId = String(selectedTeam.id);
    const teamIds = [selectedTeamId];
    await ensureBootstrapSchema();
    const page = await loadMatchPage(selectedTeamId, pageOptions);
    if (url.searchParams.get('matchesOnly') === '1') return json({ selectedTeamId, ...page });
    await seedDefaultMatchCategories(teamIds, user.id);
    const [players, teamMembers, championPool, improvements, compositions, reports, matchArchives,
      matchCategories, inviteCodes, availability, profileCoachingNotes, playerGoals, recentMatches] = await Promise.all([
      sql`select * from players where team_id = ${selectedTeamId} order by created_at asc`,
      sql`select team_members.*, users.account_name, users.name
          from team_members join users on users.id = team_members.user_id
          where team_members.team_id = ${selectedTeamId} order by team_members.created_at asc`,
      sql`select * from champion_pool where team_id = ${selectedTeamId} order by games desc, winrate desc`,
      sql`select * from improvements where team_id = ${selectedTeamId} order by rank asc, created_at desc limit 12`,
      sql`select composition_types.*, users.name as created_by_name
          from composition_types left join users on users.id = composition_types.created_by
          where composition_types.team_id = ${selectedTeamId} order by composition_types.created_at desc limit 50`,
      sql`select reports.*, users.name as author_name from reports left join users on users.id = reports.created_by
          where reports.team_id = ${selectedTeamId} order by reports.created_at desc`,
      loadMatchArchives(teamIds),
      sql`select * from match_categories where team_id = ${selectedTeamId} order by is_default desc, name asc`,
      loadInviteCodes(teamIds, user.id), loadAvailability(teamIds), loadProfileCoachingNotes(teamIds),
      sql`select player_goals.*, users.name as created_by_name from player_goals
          left join users on users.id = player_goals.created_by where player_goals.team_id = ${selectedTeamId}
          order by (player_goals.status = 'active') desc, player_goals.created_at desc`,
      sql`select result, impact_score, duration, side, vision_score from matches where team_id = ${selectedTeamId}
          order by created_at desc, id desc limit 10`
    ]);
    return json({ dashboard: buildDashboard(recentMatches, improvements), selectedTeamId, ...page,
      teams: teams.map(safeTeam), players, teamMembers, championPool, compositions, improvements, reports,
      matchArchives, matchCategories, inviteCodes, availability, profileCoachingNotes, playerGoals });
  } catch (err) {
    return handleError(err);
  }
}
