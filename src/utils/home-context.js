import { ROLES } from "../../shared/roles.js";
import { canManageOnboarding } from "./onboarding.js";
import { aggregatePlanningEvents } from "./planning-events.js";
import { sortTrendMatches, trendMatchTimestamp } from "./trends.js";

export const HOME_RECENT_DAYS = 14;
const DAY = 86_400_000;
const GAMEPLAY_ROLES = new Set([...ROLES, "SUB"]);
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const sameId = (a, b) => a != null && b != null && String(a) !== "" && String(a) === String(b);
const rows = (value) => Array.isArray(value) ? value : [];
const timestamp = (value) => trendMatchTimestamp({ date: value });

/** A correction or a new import must not make an old played game recent. */
export function homeMatchTimestamp(match) {
  return trendMatchTimestamp(match);
}

function uniqueTeamRows(value, teamId) {
  const unique = new Map();
  for (const row of rows(value)) {
    if (row?.id != null && String(row.id) !== "" && sameId(row.team_id, teamId)) unique.set(String(row.id), row);
  }
  return [...unique.values()];
}

function reportMatchIds(report) {
  if (Array.isArray(report.match_ids)) return report.match_ids;
  if (typeof report.match_ids === "string") {
    try {
      const ids = JSON.parse(report.match_ids);
      if (Array.isArray(ids)) return ids;
    } catch { /* Legacy reports may only have match_id. */ }
  }
  return report.match_id == null ? [] : [report.match_id];
}

function currentMonday(now) {
  const day = new Date(now);
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() || 7) - 1));
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function planningCellTimestamp(week, key) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week);
  const cell = /^(MON|TUE|WED|THU|FRI|SAT|SUN)\|([01]\d|2[0-3]):([0-5]\d)$/.exec(key);
  if (!date || !cell) return null;
  const [, year, month, day] = date.map(Number);
  const start = new Date(year, month - 1, day, 12);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day || start.getDay() !== 1) return null;
  // The native planning grid uses the viewer's local calendar. Its midnight
  // cell belongs to the END of the labelled day, including Sunday -> Monday.
  start.setDate(start.getDate() + DAYS.indexOf(cell[1]) + (cell[2] === "00" && cell[3] === "00" ? 1 : 0));
  start.setHours(Number(cell[2]), Number(cell[3]), 0, 0);
  return Number.isFinite(start.getTime()) ? start.getTime() : null;
}

function nextTeamEvent(data, teamId, now) {
  if (now === null) return null;
  const candidates = uniqueTeamRows(data.botEvents, teamId).flatMap((event) => {
    if (event.status && event.status !== "scheduled") return [];
    const startsAt = timestamp(event.starts_at);
    const duration = Number(event.duration_minutes);
    const endsAt = startsAt !== null && Number.isFinite(duration) && duration > 0 ? startsAt + duration * 60_000 : null;
    if (startsAt === null || (startsAt < now && (endsAt === null || endsAt <= now))) return [];
    return [{ ...event, source: "discord", event, label: event.title, type: event.event_type,
      startsAt, endsAt, inProgress: startsAt <= now && endsAt !== null && endsAt > now }];
  });
  const weeks = new Map();
  for (const row of rows(data.availability)) {
    if (!sameId(row?.team_id, teamId)) continue;
    // Match Planning's treatment of legacy availability without week_start.
    const week = row.week_start ? String(row.week_start).slice(0, 10) : currentMonday(now);
    weeks.set(week, [...(weeks.get(week) || []), row]);
  }
  for (const [week, availability] of weeks) {
    for (const [key, group] of Object.entries(aggregatePlanningEvents(availability))) {
      const startsAt = planningCellTimestamp(week, key);
      const endsAt = startsAt === null ? null : startsAt + 3_600_000;
      if (startsAt === null || endsAt <= now) continue;
      for (const event of group.events) {
        // A saved cell is a shared session, not one session per player.
        candidates.push({ source: "planning", event, id: `planning:${week}:${key}:${event.type}:${event.label}`,
          team_id: teamId, title: event.label, label: event.label, type: event.type, event_type: event.type,
          starts_at: new Date(startsAt).toISOString(), duration_minutes: 60,
          startsAt, endsAt, inProgress: startsAt <= now && endsAt > now });
      }
    }
  }
  return candidates.sort((a, b) => a.startsAt - b.startsAt)[0] || null;
}

/** Team-scoped facts for the home screen; presentation and CTA priority live in the UI. */
export function getHomeContext({ data = {}, currentTeam, currentMember, user, now = Date.now() } = {}) {
  data = data || {};
  const teamId = currentTeam?.id;
  const hasTeam = teamId != null && String(teamId) !== "";
  const nowAt = timestamp(now);
  const manager = hasTeam && canManageOnboarding({ currentTeam, currentMember, user });
  const member = sameId(currentMember?.team_id, teamId) && sameId(currentMember?.user_id, user?.id);
  const players = uniqueTeamRows(data.players, teamId);
  // Import accepts distinct gameplay profiles, including substitutes and inactive
  // gameplay profiles for historical games. Profiles may also be created during import.
  const importPlayers = players.filter((player) => GAMEPLAY_ROLES.has(String(player.role || "").toUpperCase()));
  const matches = sortTrendMatches(uniqueTeamRows(data.matches, teamId));
  const latestMatch = matches[0] || null;
  const recentMatches = nowAt === null ? [] : matches.filter((match) => {
    const playedAt = homeMatchTimestamp(match);
    return playedAt !== null && playedAt >= nowAt - HOME_RECENT_DAYS * DAY && playedAt <= nowAt;
  });
  const reports = uniqueTeamRows(data.reports, teamId)
    .filter((report) => report.discord_status !== "draft" || manager)
    .map((report, index) => ({ report, index, at: timestamp(report.created_at) }))
    .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity) || a.index - b.index)
    .map(({ report }) => report);
  const matchIds = new Set(matches.map((match) => String(match.id)));
  const reportsByMatch = new Map();
  for (const report of reports) {
    for (const id of reportMatchIds(report)) {
      if (matchIds.has(String(id)) && !reportsByMatch.has(String(id))) reportsByMatch.set(String(id), report);
    }
  }
  const reportForMatch = (matchOrId) => {
    if (matchOrId && typeof matchOrId === "object" && !sameId(matchOrId.team_id, teamId)) return null;
    const id = matchOrId && typeof matchOrId === "object" ? matchOrId.id : matchOrId;
    return reportsByMatch.get(String(id)) || null;
  };
  const pendingReviewMatches = matches.filter((match) => !reportForMatch(match));
  const unreviewedRecentMatches = recentMatches.filter((match) => !reportForMatch(match));
  const nextEvent = nextTeamEvent(data, teamId, nowAt);
  return {
    category: !hasTeam ? "no-team" : !matches.length ? "new-team" : recentMatches.length ? "recent-activity" : "quiet-team",
    manager, canImport: manager, canManageRoster: manager,
    // reports-manage permits every team member to create their own review.
    canReview: Boolean(user?.id && (manager || member)),
    players, importPlayers, linkedPlayer: players.find((player) => sameId(player.user_id, user?.id)) || null,
    rosterReady: importPlayers.length >= ROLES.length, missingImportPlayers: Math.max(0, ROLES.length - importPlayers.length),
    matches, latestMatch, latestMatchAt: homeMatchTimestamp(latestMatch), recentMatches,
    reports, latestReport: reports[0] || null, latestMatchReport: reportForMatch(latestMatch), reportForMatch,
    pendingReviewMatches, unreviewedRecentMatches, nextEvent,
    counts: { players: players.length, importPlayers: importPlayers.length, matches: matches.length,
      recentMatches: recentMatches.length, reports: reports.length, pendingReviews: pendingReviewMatches.length },
  };
}
