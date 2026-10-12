import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeWorkspace from "../pages/workspace/HomeWorkspace.jsx";
import { getHomeContext } from "../utils/home-context.js";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const team = { id: "team", name: "Équipe actuelle", owner_id: "owner" };
const user = { id: "me" };
const player = { id: "my-player", team_id: team.id, user_id: user.id, name: "Mon joueur", role: "MID" };
const goal = (id, overrides = {}) => ({
  id, team_id: team.id, player_id: player.id, title: id, status: "active",
  metric: "deaths", operator: "lte", target_value: 3, required_successes: 2, sample_size: 3,
  ...overrides,
});
const cleanups = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function fixture(data = {}, overrides = {}) {
  return {
    data: { players: [player], matches: [], playerGoals: [], botGoals: [], ...data },
    currentTeam: team,
    currentMember: { team_id: team.id, user_id: user.id, role: "player" },
    user,
    steps: [],
    navigate: vi.fn(),
    now: NOW,
    ...overrides,
  };
}

const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const heading = (renderer) => renderer.root.findAll((node) => /^h[1-6]$/.test(node.type) && text(node) === "Tes objectifs");

async function render(props) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<HomeWorkspace {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}

describe("linked profile goals on the home screen", () => {
  it("selects only active individual goals for the account's profile in the current team", () => {
    const measured = goal("Mon objectif mesuré");
    const instruction = goal("Ma consigne");
    const excluded = [
      goal("Objectif du coéquipier", { player_id: "teammate" }),
      goal("Objectif d’une autre équipe", { team_id: "other" }),
      goal("Objectif collectif", { player_id: null }),
      goal("Objectif clôturé", { status: "completed" }),
      goal("Objectif archivé", { status: "archived" }),
      goal("État inconnu", { status: "unexpected" }),
      goal("Sans état", { status: undefined }),
      null,
      {},
    ];
    const result = getHomeContext(fixture({
      players: [player, { id: "teammate", team_id: team.id, user_id: "someone-else" }],
      playerGoals: [measured, ...excluded],
      botGoals: [instruction, ...excluded],
    }));
    expect(result.linkedPlayer).toBe(player);
    expect(result.playerGoals).toEqual([measured]);
    expect(result.botGoals).toEqual([instruction]);
  });

  it("does not fall back to another player's goals for an unlinked account or missing team", () => {
    const data = { playerGoals: [goal("Confidentiel")], botGoals: [goal("Autre consigne")] };
    for (const overrides of [{ user: { id: "unlinked" } }, { user: null }, { currentTeam: null }]) {
      expect(getHomeContext(fixture(data, overrides))).toMatchObject({ linkedPlayer: null, playerGoals: [], botGoals: [] });
    }
    expect(getHomeContext(fixture({ ...data, players: [{ ...player, team_id: "other" }] })))
      .toMatchObject({ linkedPlayer: null, playerGoals: [], botGoals: [] });
    expect(getHomeContext(fixture(data, { user: { id: "owner" } })))
      .toMatchObject({ linkedPlayer: null, playerGoals: [], botGoals: [] });
  });

  it("tolerates absent goal collections and compares numeric and string identifiers consistently", () => {
    const numericPlayer = { id: 2, team_id: 1, user_id: 3 };
    const measured = goal("Numeric IDs", { team_id: "1", player_id: "2" });
    expect(getHomeContext(fixture({ players: [numericPlayer], playerGoals: [measured], botGoals: {} }, {
      currentTeam: { id: "1" }, user: { id: "3" },
    }))).toMatchObject({ linkedPlayer: numericPlayer, playerGoals: [measured], botGoals: [] });
    expect(getHomeContext(fixture({ playerGoals: null, botGoals: "invalid" })))
      .toMatchObject({ playerGoals: [], botGoals: [] });
    expect(getHomeContext()).toMatchObject({ playerGoals: [], botGoals: [] });
  });

  it("deduplicates goal identifiers without changing the loaded collections", () => {
    const measured = Object.freeze(goal("Measured"));
    const instruction = Object.freeze(goal("Instruction"));
    const playerGoals = Object.freeze([measured, measured]);
    const botGoals = Object.freeze([instruction, instruction]);
    const result = getHomeContext(fixture({ playerGoals, botGoals }));
    expect(result.playerGoals).toEqual([measured]);
    expect(result.botGoals).toEqual([instruction]);
    expect(playerGoals).toHaveLength(2);
    expect(botGoals).toHaveLength(2);
  });

  it("shows measured targets and coaching instructions without requiring an imported game", async () => {
    const measured = goal("Réduire mes morts");
    const instructions = Array.from({ length: 4 }, (_, index) => goal(`Consigne personnelle ${index + 1}`, {
      due_at: "2026-10-20T12:00:00Z",
    }));
    const renderer = await render(fixture({ playerGoals: [measured], botGoals: instructions }));
    const content = text(renderer.toJSON());
    expect(heading(renderer)).toHaveLength(1);
    expect(content).toContain("Les objectifs en cours de ton profil lié.");
    expect(content).toContain(measured.title);
    for (const instruction of instructions) expect(content).toContain(instruction.title);
    expect(content).toMatch(/≤\s*3/);
    expect(content).toContain("Échéance");
    expect(content).toContain("20");
    expect(content).not.toMatch(/Validé|Cible atteinte|Hors cible/);
  });

  it("opens the linked profile's coaching view using the encoded player identifier", async () => {
    const id = "joueur / équipe";
    const props = fixture({ players: [{ ...player, id }], playerGoals: [goal("Mon suivi", { player_id: id })] });
    const renderer = await render(props);
    const link = renderer.root.findAllByType("a").find((node) => text(node).includes("Ouvrir mon suivi"));
    const destination = "/mon-profil/coaching?player=joueur%20%2F%20%C3%A9quipe";
    expect(link?.props.href).toBe(destination);
    const event = { button: 0, preventDefault: vi.fn() };
    act(() => link.props.onClick(event));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(props.navigate).toHaveBeenCalledWith(destination);
  });

  it("hides the goals section when the linked profile has no active individual objective", async () => {
    const renderer = await render(fixture());
    expect(heading(renderer)).toHaveLength(0);
    const unavailable = [goal("Terminé", { status: "completed" }), goal("Archivé", { status: "archived" }),
      goal("Collectif", { player_id: null }), goal("Coéquipier", { player_id: "other" })];
    await act(async () => renderer.update(<HomeWorkspace {...fixture({ playerGoals: unavailable, botGoals: unavailable })} />));
    expect(heading(renderer)).toHaveLength(0);
    expect(text(renderer.toJSON())).not.toContain("Ouvrir mon suivi");
    const unlinked = fixture({ playerGoals: [goal("Autre profil")] }, { user: { id: "unlinked" } });
    await act(async () => renderer.update(<HomeWorkspace {...unlinked} />));
    expect(heading(renderer)).toHaveLength(0);
    expect(text(renderer.toJSON())).not.toContain("Autre profil");
  });

  it("keeps a staff profile's instructions visible without linking to another player's follow-up", async () => {
    const renderer = await render(fixture({
      players: [{ ...player, role: "COACH" }, { ...player, id: "teammate", user_id: "someone-else" }],
      botGoals: [goal("Préparer mes observations")],
    }));
    expect(heading(renderer)).toHaveLength(1);
    expect(text(renderer.toJSON())).toContain("Préparer mes observations");
    expect(text(renderer.toJSON())).not.toContain("Ouvrir mon suivi");
  });

  it("refreshes the visible goals after reload and drops closed objectives", async () => {
    const props = fixture({ playerGoals: [goal("Objectif initial")] });
    const renderer = await render(props);
    await act(async () => renderer.update(<HomeWorkspace {...props} loading />));
    expect(text(renderer.toJSON())).toContain("Objectif initial");
    const refreshed = fixture({ playerGoals: [goal("Objectif initial", { status: "completed" })], botGoals: [goal("Nouvelle consigne")] });
    await act(async () => renderer.update(<HomeWorkspace {...refreshed} />));
    expect(text(renderer.toJSON())).not.toContain("Objectif initial");
    expect(text(renderer.toJSON())).toContain("Nouvelle consigne");
  });

  it("changes the displayed objectives when the account or selected team changes", async () => {
    const teammate = { ...player, id: "teammate", user_id: "other-account" };
    const otherTeamPlayer = { ...player, id: "other-player", team_id: "other-team" };
    const data = {
      players: [player, teammate, otherTeamPlayer],
      playerGoals: [goal("Objectif de mon profil"), goal("Objectif du compte suivant", { player_id: teammate.id }),
        goal("Objectif de la nouvelle équipe", { team_id: otherTeamPlayer.team_id, player_id: otherTeamPlayer.id })],
    };
    const renderer = await render(fixture(data));
    expect(text(renderer.toJSON())).toContain("Objectif de mon profil");
    await act(async () => renderer.update(<HomeWorkspace {...fixture(data, { user: { id: teammate.user_id } })} />));
    expect(text(renderer.toJSON())).toContain("Objectif du compte suivant");
    expect(text(renderer.toJSON())).not.toContain("Objectif de mon profil");
    await act(async () => renderer.update(<HomeWorkspace {...fixture(data, { currentTeam: { ...team, id: otherTeamPlayer.team_id } })} />));
    expect(text(renderer.toJSON())).toContain("Objectif de la nouvelle équipe");
    expect(text(renderer.toJSON())).not.toContain("Objectif du compte suivant");
    expect(text(renderer.toJSON())).not.toContain("Objectif de mon profil");
  });
});
