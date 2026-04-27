import { sql } from './_lib/db.mjs';
import { json, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

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
    impactTrend: recent[0]?.primary_focus || 'Pas encore assez de données',
    visionDiff: recent[0]?.vision_score || '—',
    visionTrend: recent[0]?.main_issue || 'Analyse vision à générer',
    midgameRisk: improvements[0] ? 'À surveiller' : '—',
    riskTrend: improvements[0]?.title || 'Priorités non calculées'
  };
}

export default async function handler(request, context) {
  try {
    const user = await requireAuth(request, context);
    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.owner_id = ${user.id} or team_members.user_id = ${user.id}
      order by teams.created_at asc
    `;
    const teamIds = teams.map((t) => t.id);

    if (!teamIds.length) {
      return json({ dashboard: buildDashboard([], []), teams: [], players: [], teamMembers: [], matches: [], championPool: [], improvements: [], reports: [] });
    }

    const players = await sql`select * from players where team_id = any(${teamIds}) order by created_at asc`;
    const teamMembers = await sql`
      select
        team_members.*,
        users.account_name,
        users.name
      from team_members
      join users on users.id = team_members.user_id
      where team_members.team_id = any(${teamIds})
      order by team_members.created_at asc
    `;
    const matches = await sql`select * from matches where team_id = any(${teamIds}) order by created_at desc limit 50`;
    const matchIds = matches.map((m) => m.id);
    const participants = matchIds.length ? await sql`select * from match_participants where match_id = any(${matchIds}) order by team_key asc, role asc` : [];

    const byMatch = new Map();
    for (const p of participants) {
      if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, []);
      byMatch.get(p.match_id).push(p);
    }

    const enrichedMatches = matches.map((m) => ({ ...m, participants: byMatch.get(m.id) || [] }));
    const championPool = await sql`select * from champion_pool where team_id = any(${teamIds}) order by games desc, winrate desc`;
    const improvements = await sql`select * from improvements where team_id = any(${teamIds}) order by rank asc, created_at desc limit 12`;
    const reports = await sql`select * from reports where team_id = any(${teamIds}) order by created_at desc limit 20`;

    return json({ dashboard: buildDashboard(enrichedMatches, improvements), teams, players, teamMembers, matches: enrichedMatches, championPool, improvements, reports });
  } catch (err) {
    return handleError(err);
  }
}
