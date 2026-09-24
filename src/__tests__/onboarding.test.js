import { describe, expect, it } from "vitest";
import { getOnboardingSteps } from "../utils/onboarding.js";

const team = { id: "team-a", owner_id: "owner-a" };
const user = { id: "owner-a" };
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const roster = (teamId = team.id) => roles.map((role) => ({ id: `${teamId}-${role}`, team_id: teamId, role, roster_status: "MAIN" }));
const match = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const report = (id, extra = {}) => ({ id, team_id: team.id, ...extra });
const steps = (data = {}, options = {}) => Object.fromEntries(getOnboardingSteps({ data, currentTeam: team, user, ...options }).map((step) => [step.id, step]));

describe("guided onboarding actions", () => {
  it("leads an owner with an empty team to the actual roster form", () => {
    const result = steps();
    expect(result.teams).toMatchObject({ done: false, disabled: false, detail: "0 / 5 postes renseignés", action: "Ajouter les joueurs", path: "/gestion-equipe?section=roster" });
    expect(result.matches).toMatchObject({ disabled: false, path: "/gestion-equipe?section=roster", action: "Ajouter les joueurs" });
    expect(result.matches.reason).toContain("5 profils joueurs distincts");
    expect(result.reports).toMatchObject({ done: false, disabled: true, path: "", reason: "Importe une partie pour préparer le débrief." });
  });

  it("counts unique Main Team lanes, excluding staff, substitutes and inactive profiles", () => {
    const players = [
      ...roster().slice(0, 2),
      { id: "duplicate-top", team_id: team.id, role: "TOP", roster_status: "MAIN" },
      { id: "coach", team_id: team.id, role: "COACH", roster_status: "MAIN" },
      { id: "mid-sub", team_id: team.id, role: "MID", roster_status: "SUB" },
      { id: "adc-inactive", team_id: team.id, role: "ADC", roster_status: "INACTIVE" },
      { id: "sub", team_id: team.id, role: "SUB", roster_status: "MAIN" },
    ];
    expect(steps({ players }).teams).toMatchObject({ detail: "2 / 5 postes renseignés", done: false });
    expect(steps({ players: roster() }).teams).toMatchObject({ detail: "5 / 5 postes renseignés", done: true, action: "Voir les joueurs", path: "/equipes" });
  });

  it("permits import with five distinct gameplay profiles even without five Main Team lanes", () => {
    const players = roster().map((player, index) => ({ ...player, roster_status: index % 2 ? "SUB" : "INACTIVE" }));
    expect(steps({ players }).teams.done).toBe(false);
    expect(steps({ players }).matches).toMatchObject({ path: "/games?import=1", action: "Importer une partie", disabled: false });
    const duplicated = [...players.slice(0, 4), players[0], { id: "coach", team_id: team.id, role: "COACH" }];
    expect(steps({ players: duplicated }).matches.path).toBe("/gestion-equipe?section=roster");
  });

  it.each(["captain", "coach", "assistant", "analyst", "manager", "board"])("allows %s to manage the active team", (role) => {
    const memberUser = { id: "staff" };
    const currentMember = { team_id: team.id, user_id: memberUser.id, role };
    expect(steps({ players: roster() }, { user: memberUser, currentMember }).matches.path).toBe("/games?import=1");
  });

  it.each(["member", "player"])("does not propose writes forbidden to a %s", (role) => {
    const memberUser = { id: "player-a" };
    const options = { user: memberUser, currentMember: { team_id: team.id, user_id: memberUser.id, role } };
    const empty = steps({}, options);
    expect(empty.teams).toMatchObject({ disabled: true, path: "/equipes" });
    expect(empty.matches).toMatchObject({ disabled: true, path: "" });
    expect(empty.matches.reason).toContain("staff");
    const populated = steps({ players: roster(), matches: [match("game")] }, options);
    expect(populated.teams).toMatchObject({ disabled: false, action: "Voir les joueurs", path: "/equipes" });
    expect(populated.matches).toMatchObject({ disabled: false, path: "/games" });
    expect(populated.trends).toMatchObject({ disabled: true, path: "" });
    expect(populated.reports).toMatchObject({ disabled: false, path: "/rapports?match=game&compose=1" });
  });

  it("lets a member continue to Review when the staff must complete the roster and imports", () => {
    const memberUser = { id: "member" };
    const result = steps({ players: roster().slice(0, 3), matches: [match("first"), match("second")] }, {
      user: memberUser,
      currentMember: { team_id: team.id, user_id: memberUser.id, role: "member" },
    });
    expect(result.teams).toMatchObject({ done: false, disabled: true, path: "/equipes" });
    expect(result.teams.reason).toContain("staff");
    expect(result.trends).toMatchObject({ done: false, disabled: true, path: "" });
    expect(result.trends.reason).toContain("staff");
    expect(Object.values(result).find((step) => !step.done && !step.disabled)?.id).toBe("reports");
  });

  it("does not reuse a staff role from another account or another team", () => {
    const data = { players: roster(), matches: [match("game")] };
    const otherUser = { id: "new-account" };
    for (const currentMember of [
      { user_id: user.id, team_id: team.id, role: "captain" },
      { user_id: otherUser.id, team_id: "team-b", role: "captain" },
    ]) {
      const result = steps(data, { user: otherUser, currentMember });
      expect(result.matches.path).toBe("/games");
      expect(result.teams.path).toBe("/equipes");
      expect(result.reports.disabled).toBe(true);
    }
  });

  it("keeps importing toward three games then opens trends", () => {
    const data = { players: roster(), matches: [match("one"), match("two")] };
    expect(steps(data).matches).toMatchObject({ done: true, action: "Voir les parties", path: "/games" });
    expect(steps(data).trends).toMatchObject({ done: false, detail: "2 / 3 parties importées", action: "Importer une partie", path: "/games?import=1" });
    expect(steps({ ...data, matches: [...data.matches, match("three")] }).trends).toMatchObject({ done: true, detail: "3 / 3 parties importées", action: "Voir les analyses", path: "/tendances" });
  });

  it("starts the first review on the latest game without modifying the source order", () => {
    const matches = [match("old", { game_date: "2026-08-01" }), match("latest /?", { game_date: "2026-09-22" }), match("unknown")];
    expect(steps({ matches }).reports).toMatchObject({ done: false, disabled: false, action: "Créer un débrief", path: "/rapports?match=latest%20%2F%3F&compose=1" });
    expect(matches.map((item) => item.id)).toEqual(["old", "latest /?", "unknown"]);
  });

  it("opens an existing review even when it has no linked game", () => {
    expect(steps({ reports: [report("review /?")] }).reports).toMatchObject({ done: true, disabled: false, path: "/rapports?report=review%20%2F%3F", action: "Voir le débrief" });
  });

  it("keeps onboarding incomplete after five games until the first review exists", () => {
    const data = { players: roster(), matches: Array.from({ length: 5 }, (_, id) => match(String(id + 1))) };
    const unfinished = Object.values(steps(data));
    expect(unfinished.filter((step) => step.done)).toHaveLength(3);
    expect(unfinished.find((step) => !step.done)?.id).toBe("reports");
    expect(Object.values(steps({ ...data, reports: [report("first-review")] })).every((step) => step.done)).toBe(true);
  });

  it("isolates progress and destinations to the active team", () => {
    const data = {
      players: roster("team-b"),
      matches: [1, 2, 3, 4, 5].map((id) => match(String(id), { team_id: "team-b" })),
      reports: [report("other-review", { team_id: "team-b" })],
    };
    expect(Object.values(steps(data)).every((step) => !step.done)).toBe(true);
    const otherTeam = { id: "team-b", owner_id: user.id };
    expect(Object.values(steps(data, { currentTeam: otherTeam })).every((step) => step.done)).toBe(true);
    expect(getOnboardingSteps({ data, user })).toEqual([]);
  });
});
