import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiUploadJson } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { ImportGameFlow } from "../pages/workspace/GameOperations.jsx";
import { ImporterDownloadPanel } from "../pages/workspace/ImporterDownloadPanel.jsx";
import { championDisplayName } from "../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../pages/workspace/shell-shared.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = {
  BLUE: ["Aatrox", "LeeSin", "Ahri", "Jinx", "Lulu"],
  RED: ["Garen", "Vi", "Lux", "Ashe", "Leona"],
};
const cleanups = [];
const participantValue = (id) => `participant:${id}`;
const assignments = (side) => Object.fromEntries(roles.map((role, index) => [role, participantValue(index + (side === "BLUE" ? 1 : 6))]));
function preview(identity = "duplicate") {
  return {
    teams: ["BLUE", "RED"].map((side, sideIndex) => ({
      side, win: side === "BLUE",
      participants: roles.map((role, index) => ({
        participantId: sideIndex * 5 + index + 1,
        teamPosition: role,
        champion: champions[side][index],
        riotId: identity === "duplicate" ? "Même pseudo#EUW" : "",
        summonerName: identity === "duplicate" ? "Même pseudo" : "Joueur anonyme",
      })),
    })),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    location: new URL("https://nxt5.test/games"),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    setTimeout: vi.fn(), clearTimeout: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }));
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((node) => text(node).trim() === label); }
function select(renderer, label) { return renderer.root.findAllByType("select").find((node) => node.props["aria-label"] === label); }
function enemySelects(renderer) { return renderer.root.findAllByType("select").filter((node) => node.props["aria-label"]?.startsWith("Poste · ")); }
function enemySelect(renderer, side, index) { return select(renderer, `Poste · ${championDisplayName(champions[side][index])}`); }
async function click(renderer, label) {
  const target = button(renderer, label);
  expect(target, label).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onClick());
}
async function change(target, value) {
  expect(target).toBeTruthy();
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onChange({ target: { value } }));
}
async function chooseSide(renderer, side) {
  const target = renderer.root.findAllByType("button").find((node) => text(node).startsWith(side === "BLUE" ? "Côté bleu" : "Côté rouge"));
  expect(target).toBeTruthy();
  await act(async () => target.props.onClick());
}
async function load(renderer, source = { label: "Scrim vs adversaires", info: { gameId: "fixture" } }, match = preview()) {
  apiUploadJson.mockResolvedValueOnce({ match });
  const content = JSON.stringify(source);
  await act(async () => renderer.root.findByType(ImporterDownloadPanel).props.onImport({
    name: "game.json", size: content.length, text: async () => content,
  }));
  return source;
}
async function mount(overrides = {}) {
  const props = {
    data: {
      ...DEFAULT_DATA,
      teams: [{ id: "team", owner_id: "owner" }],
      players: roles.map((role) => ({ id: `profile-${role}`, team_id: "team", name: `NXT5 ${role}`, role })),
    },
    selectedTeamId: "team", user: { id: "owner" }, currentMember: { role: "captain" }, refreshAll: vi.fn(), pushToast: vi.fn(), onImported: vi.fn(),
    ...overrides,
  };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ImportGameFlow {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return { renderer, props };
}

describe("enemy role assignment while importing a game", () => {
  it.each([
    { role: "member", team_id: "team", user_id: "visitor" },
    { role: "coach", team_id: "other-team", user_id: "visitor" },
    { role: "coach", team_id: "team", user_id: "other-user" },
  ])("explains import access without a file picker for unauthorized membership %j", async (currentMember) => {
    const { renderer } = await mount({ user: { id: "visitor" }, currentMember });
    expect(renderer.root.findAllByType(ImporterDownloadPanel)).toHaveLength(0);
    expect(text(renderer.root)).toContain("L’import est réservé au staff");
    expect(apiUploadJson).not.toHaveBeenCalled();
  });

  it("leads an owner with insufficient distinct players directly to their setup", async () => {
    const { renderer } = await mount({ data: { ...DEFAULT_DATA, teams: [{ id: "team", owner_id: "owner" }], players: [
      ...roles.slice(0, 4).map((role) => ({ id: role, team_id: "team", role })),
      { id: "TOP", team_id: "team", role: "TOP" },
      { id: "coach", team_id: "team", role: "COACH" },
      { id: "foreign", team_id: "other-team", role: "SUP" },
    ] } });
    expect(renderer.root.findAllByType(ImporterDownloadPanel)).toHaveLength(0);
    expect(renderer.root.findByType("a").props.href).toBe("/gestion-equipe?section=roster");
    expect(apiUploadJson).not.toHaveBeenCalled();
  });

  it("waits for our side before showing editable enemy roles", async () => {
    const { renderer } = await mount();
    await load(renderer);
    expect(enemySelects(renderer)).toHaveLength(0);
    expect(text(renderer.root)).toContain("Choisis le côté de ton équipe pour continuer.");
    expect(renderer.root.findAllByProps({ label: "Nom de la partie" })).toHaveLength(0);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await chooseSide(renderer, "BLUE");
    expect(enemySelects(renderer)).toHaveLength(5);
    expect(renderer.root.findAllByProps({ label: "Nom de la partie" })).toHaveLength(1);
    for (const node of enemySelects(renderer)) {
      expect(node.props.disabled).not.toBe(true);
      expect(node.findAllByType("option").map((option) => option.props.value).filter(Boolean)).toEqual(roles);
    }
  });

  it.each([
    ["BLUE", "duplicate"], ["RED", "duplicate"],
    ["BLUE", "anonymous"], ["RED", "anonymous"],
  ])("swaps enemy posts and imports exact participants from %s with %s identities", async (side, identity) => {
    const { renderer, props } = await mount();
    const source = await load(renderer, undefined, preview(identity));
    await chooseSide(renderer, side);
    const enemySide = side === "BLUE" ? "RED" : "BLUE";
    const labels = enemySelects(renderer).map((node) => node.props["aria-label"]);
    expect(enemySelect(renderer, enemySide, 0).props.value).toBe("TOP");
    expect(enemySelect(renderer, enemySide, 2).props.value).toBe("MID");
    await change(enemySelect(renderer, enemySide, 0), "MID");
    expect(enemySelect(renderer, enemySide, 0).props.value).toBe("MID");
    expect(enemySelect(renderer, enemySide, 2).props.value).toBe("TOP");
    expect(enemySelects(renderer).map((node) => node.props["aria-label"])).toEqual(labels);
    expect(enemySelects(renderer).map((node) => node.props.value).sort()).toEqual([...roles].sort());

    const expectedEnemies = assignments(enemySide);
    [expectedEnemies.TOP, expectedEnemies.MID] = [expectedEnemies.MID, expectedEnemies.TOP];
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson).toHaveBeenLastCalledWith("matches-import-file", {
      teamId: "team", payload: source, label: source.label, categoryIds: [], allyTeamSide: side,
      laneAssignments: assignments(side), enemyLaneAssignments: expectedEnemies,
      playerAssignments: Object.fromEntries(roles.map((role) => [role, `profile-${role}`])),
    }, expect.any(Function));
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(props.onImported).toHaveBeenCalledWith({ match: { id: "saved" } });
  });

  it("blocks confirmation until an unassigned enemy has a post again", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await change(enemySelect(renderer, "RED", 0), "");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Attribue un poste à chaque champion adverse pour confirmer l’import.");
    await act(async () => button(renderer, "Confirmer l’import").props.onClick());
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    await change(enemySelect(renderer, "RED", 0), "TOP");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
  });

  it("does not submit missing allies or duplicated NXT5 profiles", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await change(select(renderer, `Champion allié · ${roleLabel("TOP")}`), "");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await change(select(renderer, `Champion allié · ${roleLabel("TOP")}`), participantValue(1));
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    await change(select(renderer, `Profil NXT5 · ${roleLabel("MID")}`), "profile-TOP");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => button(renderer, "Confirmer l’import").props.onClick());
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    await change(select(renderer, `Profil NXT5 · ${roleLabel("MID")}`), "profile-MID");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
  });

  it("retains manual enemy posts when the selected side is clicked again", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await change(enemySelect(renderer, "RED", 0), "MID");
    await chooseSide(renderer, "BLUE");
    expect(enemySelect(renderer, "RED", 0).props.value).toBe("MID");
    expect(enemySelect(renderer, "RED", 2).props.value).toBe("TOP");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
  });

  it("swaps allied champions with duplicate names without assigning one participant twice", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await change(select(renderer, `Champion allié · ${roleLabel("TOP")}`), participantValue(3));
    expect(select(renderer, `Champion allié · ${roleLabel("TOP")}`).props.value).toBe(participantValue(3));
    expect(select(renderer, `Champion allié · ${roleLabel("MID")}`).props.value).toBe(participantValue(1));
    const selectedAllies = roles.map((role) => select(renderer, `Champion allié · ${roleLabel(role)}`).props.value);
    expect(new Set(selectedAllies).size).toBe(5);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls.at(-1)[1].laneAssignments).toEqual({
      TOP: participantValue(3), JGL: participantValue(2), MID: participantValue(1), ADC: participantValue(4), SUP: participantValue(5),
    });
  });

  it("discards the previous enemy assignments when another JSON is loaded or the draft is reset", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await change(enemySelect(renderer, "RED", 0), "MID");
    await load(renderer, { label: "Nouvelle game", info: { gameId: "new-fixture" } });
    expect(enemySelects(renderer)).toHaveLength(0);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await chooseSide(renderer, "BLUE");
    expect(enemySelect(renderer, "RED", 0).props.value).toBe("TOP");
    expect(enemySelect(renderer, "RED", 2).props.value).toBe("MID");
    await click(renderer, "Réinitialiser");
    expect(enemySelects(renderer)).toHaveLength(0);
    expect(button(renderer, "Confirmer l’import")).toBeUndefined();
    expect(renderer.root.findByType(ImporterDownloadPanel).props.hasPreview).toBe(false);
  });
});
