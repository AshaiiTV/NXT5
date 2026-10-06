import { describe, expect, it } from "vitest";
import { canManageOnboarding, getOnboardingSteps, onboardingVisitsForRoute } from "../utils/onboarding.js";

const team = { id: "team-a", owner_id: "owner" };
const owner = { id: "owner" };
const playerUser = { id: "player" };
const player = { id: "profile", team_id: team.id, user_id: playerUser.id, role: "MID" };
const match = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const report = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const steps = (data = {}, options = {}) => getOnboardingSteps({ data, currentTeam: team, user: owner, ...options });
const next = rows => rows.find(row => !row.done && !row.disabled);

describe("a first useful session", () => {
  it("lets an owner start directly with an import, including with an empty roster", () => {
    const result = steps();
    expect(result).toHaveLength(3);
    expect(next(result)).toMatchObject({ id: "matches", path: "/games?import=1", disabled: false });
    expect(result.slice(1).every(step => step.disabled)).toBe(true);
  });
  it.each(["captain", "coach", "assistant", "analyst", "manager", "board"])("offers importing to %s in this team", role => {
    expect(next(steps({}, { user: playerUser, currentMember: { team_id: team.id, user_id: playerUser.id, role } })).id).toBe("matches");
  });
  it("never reuses a staff role from another account or team", () => {
    for (const currentMember of [{ team_id: "other", user_id: playerUser.id, role: "coach" }, { team_id: team.id, user_id: "someone-else", role: "coach" }]) {
      expect(canManageOnboarding({ currentTeam: team, user: playerUser, currentMember })).toBe(false);
      expect(steps({}, { user: playerUser, currentMember }).some(step => step.path.includes("import=1"))).toBe(false);
    }
  });
  it("moves from a single imported match to its summary, then the first debrief", () => {
    const data = { matches: [match("one /?")] };
    expect(next(steps(data))).toMatchObject({ id: "reading", path: "/games?match=one%20%2F%3F" });
    expect(next(steps(data, { discovered: ["reading"] }))).toMatchObject({ id: "reports", path: "/rapports?match=one%20%2F%3F&compose=1" });
    expect(steps({ ...data, reports: [report("first")] }, { discovered: ["reading"] }).every(step => step.done)).toBe(true);
  });
  it("selects the newest game without sorting source data in place", () => {
    const matches = [match("old", { game_date: "2026-08-01" }), match("new", { game_date: "2026-09-22" })];
    expect(next(steps({ matches })).path).toBe("/games?match=new");
    expect(matches[0].id).toBe("old");
  });
  it("gives new players personal steps even in a fully populated team", () => {
    const data = { players: [player], matches: [match("one")], reports: [report("review")] };
    const result = steps(data, { user: playerUser });
    expect(result.map(step => step.id)).toEqual(["profile", "planning", "team-review"]);
    expect(result.every(step => !step.done)).toBe(true);
    expect(next(result).path).toBe("/mon-profil?player=profile");
    expect(result[2].path).toBe("/rapports?report=review");
  });
  it("lets an unlinked player view team work without proposing forbidden setup", () => {
    const result = steps({ matches: [match("one")] }, { user: playerUser });
    expect(result[0]).toMatchObject({ disabled: true, path: "" });
    expect(result[0].reason).toContain("responsable");
    expect(result[1].disabled).toBe(true);
    expect(next(result)).toMatchObject({ id: "team-review", path: "/games?match=one" });
    expect(next(steps({}, { user: playerUser }))).toBeUndefined();
  });
  it("counts saved personal availability, including an explicit note of unavailability", () => {
    const data = { players: [player], availability: [{ team_id: team.id, player_id: player.id, slots: JSON.stringify({ MON: ["20:00"] }) }] };
    expect(steps(data, { user: playerUser })[1].done).toBe(true);
    data.availability[0].slots = {};
    expect(steps(data, { user: playerUser })[1].done).toBe(false);
    data.availability[0].notes = "Absent cette semaine";
    expect(steps(data, { user: playerUser })[1].done).toBe(true);
    data.availability[0].player_id = "another-player";
    expect(steps(data, { user: playerUser })[1].done).toBe(false);
  });
  it("isolates milestones from another team and needs real data despite saved visits", () => {
    const data = { players: [{ ...player, team_id: "other" }], matches: [match("other", { team_id: "other" })], reports: [report("other", { team_id: "other" })] };
    expect(steps(data, { discovered: ["reading"] }).every(step => !step.done)).toBe(true);
    expect(steps(data, { user: playerUser, discovered: ["profile", "team-review"] }).every(step => !step.done)).toBe(true);
    expect(getOnboardingSteps({ data, user: owner })).toEqual([]);
  });
});

describe("personal discovery", () => {
  const data = { players: [player], matches: [match("game")], reports: [report("review")] };
  const visits = (path, search = "") => onboardingVisitsForRoute({ route: { path, search }, currentTeam: team, user: playerUser, data });
  it("does not complete steps from menus, missing objects or another player's profile", () => {
    expect(visits("/games")).toEqual([]);
    expect(visits("/games", "?match=foreign")).toEqual([]);
    expect(visits("/rapports", "?report=review&compose=1")).toEqual([]);
    expect(visits("/mon-profil", "?player=other")).toEqual([]);
    expect(visits("/planning")).toEqual([]);
  });
  it("recognizes the linked profile and actual team game/report destinations", () => {
    expect(visits("/mon-profil", "?player=profile")).toEqual(["profile"]);
    expect(visits("/games", "?match=game")).toEqual(["reading", "team-review"]);
    expect(visits("/rapports", "?report=review")).toEqual(["team-review"]);
  });
});
