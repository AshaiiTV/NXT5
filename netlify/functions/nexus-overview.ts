import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json } from "./_lib/http";
import { requireAuth, isPlatformAdmin, readSessionCookie } from "./_lib/auth";
import { sql } from "./_lib/db";
import { assertNexusSchema } from "./_lib/nexus-store";
import { loadTournamentState, seriesFor } from "./_lib/nexus-tournament-store";
export function nexusOverview(
  fixtures: any[],
  submissions: any[],
  teamIds: Set<string>,
  staff = false,
) {
  return fixtures.map((fixture) => {
    const canViewDetails =
      staff || teamIds.has(fixture.team_a_id) || teamIds.has(fixture.team_b_id);
    const gameTime = (row: any) =>
      Number(row.game_time ?? row.summary?.gameStartedAt);
    const accepted = submissions
      .filter(
        (row) => row.fixture_id === fixture.id && row.status === "accepted",
      )
      .sort((a, b) => {
        const aTime =
          Number.isFinite(gameTime(a)) && gameTime(a) > 0
            ? gameTime(a)
            : Infinity;
        const bTime =
          Number.isFinite(gameTime(b)) && gameTime(b) > 0
            ? gameTime(b)
            : Infinity;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.game_id).localeCompare(String(b.game_id));
      });
    const hasGameOrder =
      accepted.every(
        (row) => Number.isFinite(gameTime(row)) && gameTime(row) > 0,
      ) && new Set(accepted.map(gameTime)).size === accepted.length;
    const games = accepted.map((row, index) => ({
      gameId: row.game_id,
      ...(hasGameOrder ? { gameNumber: index + 1 } : {}),
      winner: row.summary.winner,
      duration: row.summary.duration,
      submittedAt: row.created_at,
    }));
    const result: any = {
      id: fixture.id,
      label: fixture.label,
      teamA: fixture.team_a,
      teamB: fixture.team_b,
      teamAId: fixture.team_a_id,
      teamBId: fixture.team_b_id,
      seasonId: fixture.season_id,
      stage: fixture.stage,
      fixtureKey: fixture.fixture_key,
      round: fixture.round,
      bestOf: fixture.best_of,
      bracketGroup: fixture.bracket_group,
      groupId: fixture.group_id,
      scheduled: Boolean(fixture.starts_at),
      startsAt: fixture.starts_at,
      endsAt: fixture.ends_at,
      platform: fixture.platform,
      canViewDetails,
      games,
      series:
        fixture.team_a_id && fixture.team_b_id
          ? seriesFor(fixture, accepted)
          : null,
    };
    if (canViewDetails) {
      result.roster = fixture.roster;
      result.statistics = accepted.map((row) => ({
        gameId: row.game_id,
        participants: row.summary.participants,
        teams: row.summary.teams,
      }));
    }
    return result;
  });
}
export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, "GET");
    let user: any = null;
    if (readSessionCookie(context)) {
      try {
        user = await requireAuth(request, context);
      } catch (err: any) {
        if (err.status !== 401 && err.code !== "EMAIL_VERIFICATION_REQUIRED")
          throw err;
      }
    }
    await assertNexusSchema();
    const [state, membership] = await Promise.all([
      loadTournamentState(),
      user
        ? sql`select id from teams where owner_id = ${user.id} union select team_id as id from team_members where user_id = ${user.id}`
        : Promise.resolve([]),
    ]);
    const staff = Boolean(user && isPlatformAdmin(user));
    const teamIds = new Set<string>(membership.map((row) => row.id));
    const seasons = state.seasons.filter(
      (row) => staff || row.status !== "draft",
    );
    const visible = new Set(seasons.map((row) => row.id));
    const result = nexusOverview(
      state.rawFixtures.filter(
        (row) => row.stage !== "legacy" && visible.has(row.season_id),
      ),
      state.games,
      teamIds,
      staff,
    );
    return json({
      access: staff
        ? "staff"
        : result.some((row) => row.canViewDetails)
          ? "member"
          : "guest",
      seasons: seasons.map(({ tieResolutionNote, ...row }) => row),
      fixtures: result,
      standings: state.standings.filter((row) => visible.has(row.seasonId)),
      playoffs: state.playoffs.filter((row) => visible.has(row.seasonId)),
    });
  } catch (err) {
    return handleError(err);
  }
}
