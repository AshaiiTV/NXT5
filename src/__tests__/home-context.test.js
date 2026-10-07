import { describe, expect, it } from "vitest";
import { getHomeContext, homeMatchTimestamp } from "../utils/home-context.js";

const now = Date.parse("2026-10-07T12:00:00Z");
const team = { id: "team-a", owner_id: "owner" };
const owner = { id: "owner" };
const playerUser = { id: "player-user" };
const playerMember = { team_id: team.id, user_id: playerUser.id, role: "player" };
const game = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const report = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const event = (id, extra = {}) => ({ id, team_id: team.id, title: id, status: "scheduled", starts_at: "2026-10-07T13:00:00Z", duration_minutes: 60, ...extra });
const context = (data = {}, options = {}) => getHomeContext({ data, currentTeam: team, user: owner, now, ...options });

describe("team home context", () => {
  it("distinguishes an empty team from a recent or inactive team", () => {
    expect(getHomeContext({ now }).category).toBe("no-team");
    expect(context({}, { currentTeam: { owner_id: owner.id } })).toMatchObject({ category: "no-team", canImport: false, canReview: false });
    expect(context().category).toBe("new-team");
    expect(context({ matches: [game("recent", { game_date: now })] }).category).toBe("recent-activity");
    expect(context({ matches: [game("old", { game_date: "2025-01-01" })] }).category).toBe("quiet-team");
    expect(context({ matches: [game("unknown")] }).category).toBe("quiet-team");
  });

  it("keeps all home facts isolated to the selected team and tolerates absent collections", () => {
    const data = {
      players: [{ id: "foreign", team_id: "other", user_id: owner.id, role: "TOP" }, null],
      matches: [game("foreign", { team_id: "other", game_date: now }), {}, null],
      reports: [report("foreign", { team_id: "other" }), null],
      botEvents: [event("foreign", { team_id: "other" }), null],
      availability: [{ team_id: "other", week_start: "2026-10-05", slots: { _events: { "WED|23:00": { label: "Other" } } } }],
    };
    expect(context(data)).toMatchObject({ category: "new-team", latestMatch: null, latestReport: null, linkedPlayer: null,
      nextEvent: null, counts: { players: 0, importPlayers: 0, matches: 0, recentMatches: 0, reports: 0, pendingReviews: 0 } });
    expect(context({ players: {}, matches: null, reports: "invalid", botEvents: {} }).matches).toEqual([]);
    expect(context(null).category).toBe("new-team");
    expect(getHomeContext({ data, now }).nextEvent).toBeNull();
  });

  it("counts distinct eligible import profiles without mistaking staff for players or blocking import", () => {
    const players = ["TOP", "JGL", "MID", "ADC", "SUB"].map((role, index) => ({ id: `p${index}`, team_id: team.id, role }));
    const result = context({ players: [...players, players[0], { id: "coach", team_id: team.id, role: "COACH" },
      { id: "foreign", team_id: "other", role: "SUP" }] });
    expect(result.counts.importPlayers).toBe(5);
    expect(result.rosterReady).toBe(true);
    expect(context({ players: [players[0], players[0]] })).toMatchObject({ missingImportPlayers: 4, rosterReady: false, canImport: true });
    expect(context({ players: [{ ...players[0], roster_status: "INACTIVE" }] }).importPlayers).toHaveLength(1);
  });

  it("uses the played date before the import date and never the last modification", () => {
    const old = game("old", { game_date: "2026-01-01", created_at: "2026-10-07T11:00:00Z", updated_at: now });
    const recent = game("recent", { game_date: "2026-10-06T18:00:00Z" });
    const rawOld = game("raw-old", { raw: { info: { gameStartTimestamp: Date.parse("2025-01-01") } }, game_date: now });
    const matches = Object.freeze([old, rawOld, recent, game("undated", { updated_at: now })]);
    const result = context({ matches });
    expect(result.matches.map(({ id }) => id)).toEqual(["recent", "old", "raw-old", "undated"]);
    expect(result.latestMatch).toBe(recent);
    expect(result.recentMatches).toEqual([recent]);
    expect(matches[0]).toBe(old);
    expect(homeMatchTimestamp(game("fallback", { game_date: "bad", created_at: now }))).toBe(now);
    expect(homeMatchTimestamp(game("updated", { updated_at: now }))).toBeNull();
  });

  it("includes the full 14-day boundary while excluding future, missing and invalid dates", () => {
    const threshold = now - 14 * 86_400_000;
    const data = { matches: [game("boundary", { game_date: threshold }), game("before", { game_date: threshold - 1 }),
      game("now", { game_date: now }), game("future", { game_date: now + 1 }), game("missing"), game("invalid", { game_date: "bad" })] };
    expect(context(data).recentMatches.map(({ id }) => id)).toEqual(["now", "boundary"]);
    expect(context(data, { now: new Date(now) }).counts.recentMatches).toBe(2);
    expect(context(data, { now: "bad" }).counts.recentMatches).toBe(0);
  });

  it.each(["captain", "coach", "assistant", "analyst", "manager", "board"])("permits %s only for the current account and team", (role) => {
    const currentMember = { ...playerMember, role };
    expect(context({}, { user: playerUser, currentMember })).toMatchObject({ manager: true, canImport: true, canManageRoster: true, canReview: true });
    expect(context({}, { user: playerUser, currentMember: { ...currentMember, team_id: "other" } })).toMatchObject({ manager: false, canImport: false, canReview: false });
    expect(context({}, { user: playerUser, currentMember: { ...currentMember, user_id: "other" } })).toMatchObject({ manager: false, canImport: false, canReview: false });
  });

  it("lets a member create a review without granting import or staff access", () => {
    expect(context({}, { user: playerUser, currentMember: playerMember })).toMatchObject({ manager: false, canImport: false, canReview: true });
    expect(context({}, { user: null, currentMember: playerMember })).toMatchObject({ manager: false, canImport: false, canReview: false });
  });
});

describe("home reviews", () => {
  it("links grouped, serialized and legacy reports to real team matches and selects the latest report", () => {
    const matches = [game("one", { game_date: now }), game("two", { game_date: now - 1 }), game("three", { game_date: now - 2 }), game("todo", { game_date: now - 3 })];
    const old = report("old", { match_ids: ["one", "two"], created_at: "2026-10-01" });
    const newest = report("newest", { match_ids: JSON.stringify(["one", "two", "foreign"]), created_at: "2026-10-07" });
    const legacy = report("legacy", { match_id: "three", match_ids: "bad", created_at: "2026-10-02" });
    const reports = Object.freeze([old, newest, legacy, report("foreign", { team_id: "other", match_id: "todo", created_at: now })]);
    const result = context({ matches, reports });
    expect(result.latestMatchReport).toBe(newest);
    expect(result.latestReport).toBe(newest);
    expect(result.reportForMatch("two")).toBe(newest);
    expect(result.reportForMatch(matches[2])).toBe(legacy);
    expect(result.reportForMatch("foreign")).toBeNull();
    expect(result.reportForMatch(game("one", { team_id: "other" }))).toBeNull();
    expect(result.unreviewedRecentMatches.map(({ id }) => id)).toEqual(["todo"]);
    expect(reports[0]).toBe(old);
  });

  it("does not treat an unrelated review or an import review flag as a linked debrief", () => {
    const data = { matches: [game("one", { game_date: now, review_status: "done" })],
      reports: [report("unrelated", { match_id: "other" }), report("empty-group", { match_ids: [], match_id: "one" })] };
    expect(context(data).unreviewedRecentMatches).toHaveLength(1);
  });

  it("keeps staff drafts unavailable to ordinary players", () => {
    const draft = report("draft", { match_id: "one", discord_status: "draft" });
    const data = { matches: [game("one", { game_date: now })], reports: [draft] };
    expect(context(data).latestMatchReport).toBe(draft);
    const result = context(data, { user: playerUser, currentMember: playerMember });
    expect(result.reports).toEqual([]);
    expect(result.unreviewedRecentMatches).toHaveLength(1);
  });
});

describe("home next session", () => {
  it("prioritizes a session in progress over future sessions and ignores canceled or ended sessions", () => {
    const ongoing = event("ongoing", { starts_at: "2026-10-07T11:30:00Z", duration_minutes: 60 });
    const botEvents = Object.freeze([event("future"), event("cancelled", { status: "cancelled", starts_at: "2026-10-07T11:45:00Z" }),
      event("ended", { starts_at: "2026-10-07T11:00:00Z" }), event("invalid", { starts_at: "bad" }), ongoing]);
    expect(context({ botEvents }).nextEvent).toMatchObject({ event: ongoing, source: "discord", startsAt: now - 1_800_000,
      endsAt: now + 1_800_000, inProgress: true });
    expect(botEvents[0].id).toBe("future");
    expect(context({ botEvents: [event("starts-now", { starts_at: now })] }).nextEvent.inProgress).toBe(true);
    expect(context({ botEvents: [ongoing] }, { now: now + 1_800_000 }).nextEvent).toBeNull();
    expect(context({ botEvents }, { now: "invalid" }).nextEvent).toBeNull();
  });

  it("does not invent ongoing duration for malformed sessions", () => {
    expect(context({ botEvents: [event("past", { starts_at: now - 1, duration_minutes: null })] }).nextEvent).toBeNull();
    expect(context({ botEvents: [event("future", { duration_minutes: "bad" })] }).nextEvent).toMatchObject({ endsAt: null, inProgress: false });
  });

  it("includes native planning sessions and merges players' identical session cells", () => {
    const localNow = new Date(2026, 9, 7, 19, 30).getTime();
    const availability = ["a", "b"].map((player_id) => ({ team_id: team.id, player_id, week_start: "2026-10-05",
      slots: JSON.stringify({ _events: { "WED|20:00": { type: "scrim", label: "Scrim" } } }) }));
    const result = context({ availability }, { now: localNow });
    expect(result.nextEvent).toMatchObject({ source: "planning", title: "Scrim", duration_minutes: 60,
      startsAt: new Date(2026, 9, 7, 20).getTime(), endsAt: new Date(2026, 9, 7, 21).getTime(), inProgress: false,
      event: { playerIds: ["a", "b"] } });
    expect(context({ availability }, { now: new Date(2026, 9, 7, 20, 30) }).nextEvent.inProgress).toBe(true);
  });

  it("places a Sunday midnight cell at the start of Monday and rejects invalid week/cell dates", () => {
    const localNow = new Date(2026, 9, 11, 23, 30).getTime();
    const availability = [{ team_id: team.id, week_start: "2026-10-05", slots: { _events: {
      "SUN|00:00": { label: "Late review", type: "review" }, "SUN|25:00": { label: "Invalid" }, "XXX|23:45": { label: "Invalid" },
    } } }, { team_id: team.id, week_start: "2026-02-30", slots: { _events: { "SUN|00:00": { label: "Invalid date" } } } }];
    expect(context({ availability }, { now: localNow }).nextEvent).toMatchObject({ title: "Late review", startsAt: new Date(2026, 9, 12, 0).getTime() });
    expect(context({ availability }, { now: new Date(2026, 9, 12, 1) }).nextEvent).toBeNull();
  });

  it("matches the native planning's current-week fallback for legacy rows without a week", () => {
    const localNow = new Date(2026, 9, 7, 19, 30).getTime();
    const availability = [{ team_id: team.id, player_id: "a", slots: { events: { "WED|20:00": { label: "Legacy scrim" } } } },
      { team_id: team.id, slots: "invalid" }];
    expect(context({ availability }, { now: localNow }).nextEvent.startsAt).toBe(new Date(2026, 9, 7, 20).getTime());
  });
});
