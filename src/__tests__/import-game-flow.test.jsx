import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUploadJson } from "../api/client.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { CategoryMultiSelect, ImportGameFlow } from "../pages/workspace/GameOperations.jsx";
import { TextInput } from "../components/ui/Core.jsx";
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
const categories = [
  { id: "scrim", team_id: "team", name: "Scrim", is_default: true },
  { id: "league", team_id: "team", name: "Ligue" },
  { id: "other-category", team_id: "other-team", name: "Autre équipe" },
];
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
  apiFetch.mockImplementation(async (endpoint, options) => {
    if (endpoint === "opponents-drafts" && JSON.parse(options.body).action === "list-opponents") return { opponents: [], canEdit: true };
    throw new Error(`Unexpected request: ${endpoint}`);
  });
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
function mutationRequests() { return apiFetch.mock.calls.filter(([endpoint, options]) => endpoint !== "opponents-drafts" || JSON.parse(options.body).action !== "list-opponents"); }
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
async function chooseScrim(renderer) {
  const tag = button(renderer, "Scrim");
  if (tag && !tag.props["aria-pressed"]) await click(renderer, "Scrim");
}
async function chooseSide(renderer, side, { selectTag = true } = {}) {
  const target = renderer.root.findAllByType("button").find((node) => text(node).startsWith(side === "BLUE" ? "Côté bleu" : "Côté rouge"));
  expect(target).toBeTruthy();
  await act(async () => target.props.onClick());
  if (selectTag) await chooseScrim(renderer);
}
async function load(renderer, source = { label: "Scrim vs adversaires", info: { gameId: "fixture" } }, match = preview(), { selectTag = true } = {}) {
  apiUploadJson.mockResolvedValueOnce({ match });
  const content = JSON.stringify(source);
  await act(async () => renderer.root.findByType(ImporterDownloadPanel).props.onImport({
    name: "game.json", size: content.length, text: async () => content,
  }));
  if (selectTag) await chooseScrim(renderer);
  return source;
}
async function mount(overrides = {}) {
  const props = {
    data: {
      ...DEFAULT_DATA,
      teams: [{ id: "team", owner_id: "owner" }],
      players: roles.map((role) => ({ id: `profile-${role}`, team_id: "team", name: `NXT5 ${role}`, role })),
      matchCategories: categories,
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

  it("lets an owner preview a file before creating missing players", async () => {
    const { renderer } = await mount({ data: { ...DEFAULT_DATA, matchCategories: categories, teams: [{ id: "team", owner_id: "owner" }], players: [
      ...roles.slice(0, 4).map((role) => ({ id: role, team_id: "team", role })),
      { id: "TOP", team_id: "team", role: "TOP" },
      { id: "coach", team_id: "team", role: "COACH" },
      { id: "foreign", team_id: "other-team", role: "SUP" },
    ] } });
    expect(renderer.root.findAllByType(ImporterDownloadPanel)).toHaveLength(1);
    expect(apiUploadJson).not.toHaveBeenCalled();
    expect(mutationRequests()).toHaveLength(0);
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    expect(text(renderer.root)).toContain("Créer les profils manquants depuis le fichier");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
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
      teamId: "team", payload: source, label: source.label, categoryIds: ["scrim"], allyTeamSide: side,
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


describe("optional opponent team while importing", () => {
  const opponentLabel = "Équipe adverse (facultatif)";
  const opponentName = "Nom de l’équipe adverse";
  const existingOpponents = [{ id: "otters", name: "Otters" }, { id: "aurora", name: "Aurora" }];
  const nameField = (renderer) => renderer.root.findAllByType(TextInput).find((node) => node.props.label === opponentName);
  const lastImport = () => apiUploadJson.mock.calls.at(-1)[1];
  async function ready() {
    const mounted = await mount();
    await load(mounted.renderer);
    await chooseSide(mounted.renderer, "BLUE");
    return mounted;
  }

  it("lists teams alphabetically and associates an existing team only on import confirmation", async () => {
    apiFetch.mockResolvedValue({ opponents: existingOpponents, canEdit: true });
    const { renderer } = await ready();
    expect(select(renderer, opponentLabel).findAllByType("option").map(text)).toEqual(["Non renseignée", "Aurora", "Otters"]);
    expect(apiFetch).toHaveBeenCalledWith("opponents-drafts", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "list-opponents", teamId: "team" }) }));
    await change(select(renderer, opponentLabel), "otters");
    expect(mutationRequests()).toHaveLength(0);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved", opponent_id: "otters" } });
    await click(renderer, "Confirmer l’import");
    expect(lastImport()).toMatchObject({ teamId: "team", opponentId: "otters" });
    expect(lastImport()).not.toHaveProperty("newOpponentName");
    expect(select(renderer, opponentLabel)).toBeUndefined();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    expect(select(renderer, opponentLabel).props.value).toBe("");
  });

  it("creates a named opponent through the final import only and never sends an existing ID with it", async () => {
    apiFetch.mockResolvedValue({ opponents: existingOpponents, canEdit: true });
    const { renderer } = await ready();
    await change(select(renderer, opponentLabel), "otters");
    await click(renderer, "Nouvelle équipe");
    expect(nameField(renderer).props.maxLength).toBe(80);
    expect(text(renderer.root)).toContain("Cette équipe sera créée et associée à la partie lors de la confirmation de l’import.");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => nameField(renderer).props.onChange("   "));
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => nameField(renderer).props.onChange("x".repeat(81)));
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => nameField(renderer).props.onChange("  North Stars  "));
    expect(mutationRequests()).toHaveLength(0);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved", opponent_id: "new" } });
    await click(renderer, "Confirmer l’import");
    expect(lastImport()).toMatchObject({ newOpponentName: "North Stars" });
    expect(lastImport()).not.toHaveProperty("opponentId");
    expect(mutationRequests()).toHaveLength(0);
  });

  it("cancels team creation without a mutation and restores the previous choice", async () => {
    apiFetch.mockResolvedValue({ opponents: existingOpponents, canEdit: true });
    const { renderer } = await ready();
    await change(select(renderer, opponentLabel), "otters");
    await click(renderer, "Nouvelle équipe");
    await act(async () => nameField(renderer).props.onChange("Unused name"));
    await click(renderer, "Annuler la création");
    expect(select(renderer, opponentLabel).props.value).toBe("otters");
    expect(mutationRequests()).toHaveLength(0);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    await click(renderer, "Nouvelle équipe");
    expect(nameField(renderer).props.value).toBe("");
  });

  it("omits both fields without a choice so reimport preserves its existing opponent", async () => {
    const { renderer } = await ready();
    expect(select(renderer, opponentLabel).props.value).toBe("");
    expect(text(renderer.root)).toContain("laisser ce champ vide conserve l’équipe déjà associée");
    apiUploadJson.mockResolvedValueOnce({ match: { id: "existing", opponent_id: "already-linked" } });
    await click(renderer, "Confirmer l’import");
    expect(lastImport()).not.toHaveProperty("opponentId");
    expect(lastImport()).not.toHaveProperty("newOpponentName");
  });

  it("does not block an otherwise ready import while the optional list loads or fails, and can retry it", async () => {
    let rejectList;
    apiFetch.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectList = reject; }));
    const { renderer } = await ready();
    expect(text(renderer.root)).toContain("Chargement des équipes adverses…");
    expect(select(renderer, opponentLabel).props.disabled).toBe(true);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    await act(async () => rejectList(new Error("Offline")));
    expect(text(renderer.root)).toContain("Tu peux continuer l’import sans en choisir.");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    apiFetch.mockResolvedValueOnce({ opponents: existingOpponents, canEdit: true });
    await click(renderer, "Réessayer");
    expect(select(renderer, opponentLabel).props.disabled).toBe(false);
    expect(select(renderer, opponentLabel).findAllByType("option")).toHaveLength(3);
  });

  it("keeps entered names after an import error and clears choices for another preview or a reset", async () => {
    const { renderer } = await ready();
    await click(renderer, "Nouvelle équipe");
    await act(async () => nameField(renderer).props.onChange("North Stars"));
    apiUploadJson.mockRejectedValueOnce(new Error("Import failed"));
    await click(renderer, "Confirmer l’import");
    expect(nameField(renderer).props.value).toBe("North Stars");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    await load(renderer, { info: { gameId: "second" } });
    await chooseSide(renderer, "BLUE");
    expect(select(renderer, opponentLabel).props.value).toBe("");
    await click(renderer, "Nouvelle équipe");
    await act(async () => nameField(renderer).props.onChange("Discarded"));
    await click(renderer, "Réinitialiser");
    expect(select(renderer, opponentLabel)).toBeUndefined();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    expect(select(renderer, opponentLabel).props.value).toBe("");
  });

  it("aborts and ignores a previous team's list and resets its choice when switching teams", async () => {
    let resolveOldList;
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOldList = resolve; }));
    const { renderer, props } = await ready();
    const oldSignal = apiFetch.mock.calls[0][1].signal;
    const nextProps = { ...props, selectedTeamId: "other-team", data: { ...props.data, teams: [{ id: "other-team", owner_id: "owner" }], players: props.data.players.map((player) => ({ ...player, team_id: "other-team" })) } };
    await act(async () => renderer.update(<ImportGameFlow {...nextProps} />));
    expect(oldSignal.aborted).toBe(true);
    expect(select(renderer, opponentLabel)).toBeUndefined();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    apiFetch.mockResolvedValueOnce({ opponents: [{ id: "new-team-opponent", name: "New opponent" }], canEdit: true });
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    await act(async () => resolveOldList({ opponents: existingOpponents, canEdit: true }));
    expect(select(renderer, opponentLabel).findAllByType("option").map(text)).toEqual(["Non renseignée", "New opponent"]);
    expect(select(renderer, opponentLabel).props.value).toBe("");
    expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toEqual({ action: "list-opponents", teamId: "other-team" });
  });
});

describe("required match tags", () => {
  it("allows preview without a tag but requires an explicit selection before publishing", async () => {
    const { renderer, props } = await mount();
    const source = await load(renderer, undefined, undefined, { selectTag: false });
    await chooseSide(renderer, "BLUE", { selectTag: false });
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    expect(apiUploadJson.mock.calls[0][1]).toEqual({ teamId: "team", payload: source, previewOnly: true });
    expect(button(renderer, "Scrim").props["aria-pressed"]).toBe(false);
    expect(text(renderer.root)).toContain("Tags (au moins un)");
    expect(text(renderer.root)).toContain("Ajoute au moins un tag à la partie.");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => button(renderer, "Confirmer l’import").props.onClick());
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    expect(props.onImported).not.toHaveBeenCalled();

    await click(renderer, "Scrim");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    await click(renderer, "Scrim");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await act(async () => button(renderer, "Confirmer l’import").props.onClick());
    expect(apiUploadJson).toHaveBeenCalledTimes(1);

    await click(renderer, "Ligue");
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls.at(-1)[1].categoryIds).toEqual(["league"]);
    expect(props.onImported).toHaveBeenCalledWith({ match: { id: "saved" } });
  });

  it.each([{ categoryIds: ["unknown"] }, { categoryIds: ["other-category"] }, { categoryIds: ["unknown", "other-category"] }])("does not treat unavailable tags %j as a valid selection", async ({ categoryIds }) => {
    const { renderer } = await mount();
    await load(renderer, undefined, undefined, { selectTag: false });
    await chooseSide(renderer, "BLUE", { selectTag: false });
    expect(button(renderer, "Autre équipe")).toBeUndefined();
    await act(async () => renderer.root.findByType(CategoryMultiSelect).props.onChange(categoryIds));
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Ajoute au moins un tag à la partie.");
    await act(async () => button(renderer, "Confirmer l’import").props.onClick());
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
  });

  it("clears the chosen tag when a new file is loaded and when an import is reset", async () => {
    const { renderer } = await mount();
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    expect(button(renderer, "Scrim").props["aria-pressed"]).toBe(true);
    await load(renderer, { label: "Deuxième partie" }, undefined, { selectTag: false });
    await chooseSide(renderer, "BLUE", { selectTag: false });
    expect(button(renderer, "Scrim").props["aria-pressed"]).toBe(false);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    await click(renderer, "Ligue");
    await click(renderer, "Réinitialiser");
    expect(renderer.root.findAllByType(CategoryMultiSelect)).toHaveLength(0);
    await load(renderer, { label: "Troisième partie" }, undefined, { selectTag: false });
    await chooseSide(renderer, "BLUE", { selectTag: false });
    expect(renderer.root.findByType(CategoryMultiSelect).props.selectedIds).toEqual([]);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
  });
});


describe("recognized team import suggestions", () => {
  function recognizedPreview(gameId = "EUW1_7123456789") {
    const match = preview();
    return { ...match, gameId, teams: match.teams.map((team) => ({
      ...team,
      participants: team.participants.map((participant, index) => ({
        ...participant, riotId: `${team.side} Joueur ${index + 1}#EUW`, summonerName: `${team.side} Joueur ${index + 1}`,
      })),
    })) };
  }
  function recognizedRoster(match, side) {
    return match.teams.find((team) => team.side === side).participants.map((participant, index) => ({
      id: `profile-${roles[index]}`, team_id: "team", role: roles[index], name: participant.summonerName, riot_id: participant.riotId,
    }));
  }
  async function mountRecognized(match, side, roster = recognizedRoster(match, side)) {
    return mount({ data: { ...DEFAULT_DATA, matchCategories: categories, teams: [{ id: "team", owner_id: "owner" }], players: roster } });
  }
  const nameInput = (renderer) => renderer.root.findAllByType(TextInput).find((node) => node.props.label === "Nom de la partie");
  const sideButton = (renderer, side) => renderer.root.findAllByType("button").find((node) => text(node).startsWith(side === "BLUE" ? "Côté bleu" : "Côté rouge"));

  it.each(["BLUE", "RED"])("suggests %s and a usable name, then waits for explicit confirmation before saving", async (side) => {
    const match = recognizedPreview();
    const { renderer, props } = await mountRecognized(match, side);
    const source = await load(renderer, { info: { gameId: 7123456789 } }, match, { selectTag: false });
    expect(sideButton(renderer, side).props["aria-pressed"]).toBe(true);
    expect(nameInput(renderer).props.value).toBe(match.gameId);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    expect(apiUploadJson.mock.calls[0][1]).toEqual({ teamId: "team", payload: source, previewOnly: true });
    expect(mutationRequests()).toHaveLength(0);
    expect(props.onImported).not.toHaveBeenCalled();
    expect(props.refreshAll).not.toHaveBeenCalled();

    await click(renderer, "Scrim");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson).toHaveBeenLastCalledWith("matches-import-file", {
      teamId: "team", payload: source, label: match.gameId, categoryIds: ["scrim"], allyTeamSide: side,
      laneAssignments: assignments(side), enemyLaneAssignments: assignments(side === "BLUE" ? "RED" : "BLUE"),
      playerAssignments: Object.fromEntries(roles.map((role) => [role, `profile-${role}`])),
    }, expect.any(Function));
    expect(props.onImported).toHaveBeenCalledWith({ match: { id: "saved" } });
  });

  it.each([
    [{ metadata: { label: "Finale contre Otters" } }, "Finale contre Otters"],
    [{ info: { gameId: 7123456789 } }, "EUW1_7123456789"],
  ])("keeps the supplied or suggested name editable and submits the exact edit: %j", async (source, initialName) => {
    const match = recognizedPreview();
    const { renderer } = await mountRecognized(match, "BLUE");
    await load(renderer, source, match);
    expect(nameInput(renderer).props.value).toBe(initialName);
    await act(async () => nameInput(renderer).props.onChange("Session du samedi · Partie 2"));
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls.at(-1)[1]).toEqual(expect.objectContaining({
      payload: source, label: "Session du samedi · Partie 2", allyTeamSide: "BLUE",
    }));
  });

  it("keeps corrected enemy posts when the suggested side is clicked again", async () => {
    const match = recognizedPreview();
    const { renderer } = await mountRecognized(match, "BLUE");
    await load(renderer, {}, match);
    await change(enemySelect(renderer, "RED", 0), "MID");
    await chooseSide(renderer, "BLUE");
    expect(enemySelect(renderer, "RED", 0).props.value).toBe("MID");
    expect(enemySelect(renderer, "RED", 2).props.value).toBe("TOP");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
  });

  it("keeps the captain's manual side and assignments after an automatic suggestion", async () => {
    const match = recognizedPreview();
    const { renderer } = await mountRecognized(match, "BLUE");
    await load(renderer, {}, match);
    await chooseSide(renderer, "RED");
    await change(enemySelect(renderer, "BLUE", 0), "MID");
    await act(async () => nameInput(renderer).props.onChange("Côté corrigé"));
    await chooseSide(renderer, "RED");
    expect(sideButton(renderer, "RED").props["aria-pressed"]).toBe(true);
    expect(sideButton(renderer, "BLUE").props["aria-pressed"]).toBe(false);
    expect(enemySelect(renderer, "BLUE", 0).props.value).toBe("MID");
    expect(enemySelect(renderer, "BLUE", 2).props.value).toBe("TOP");
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls.at(-1)[1]).toEqual(expect.objectContaining({
      allyTeamSide: "RED", label: "Côté corrigé",
      enemyLaneAssignments: { TOP: participantValue(3), JGL: participantValue(2), MID: participantValue(1), ADC: participantValue(4), SUP: participantValue(5) },
    }));
  });

  it("returns to manual choice when the next file does not identify the team", async () => {
    const match = recognizedPreview();
    const { renderer } = await mountRecognized(match, "BLUE");
    await load(renderer, {}, match);
    await change(enemySelect(renderer, "RED", 0), "MID");
    await load(renderer, {}, { ...preview("anonymous"), gameId: "EUW1_7123456790" });
    expect(sideButton(renderer, "BLUE").props["aria-pressed"]).toBe(false);
    expect(sideButton(renderer, "RED").props["aria-pressed"]).toBe(false);
    expect(enemySelects(renderer)).toHaveLength(0);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(text(renderer.root)).toContain("Choisis le côté de ton équipe pour continuer.");
    await chooseSide(renderer, "BLUE");
    expect(nameInput(renderer).props.value).toBe("EUW1_7123456790");
    expect(enemySelect(renderer, "RED", 0).props.value).toBe("TOP");
  });

  it.each([
    { team_id: "other-team" },
    { role: "COACH" },
  ])("does not recognize a team through a profile outside the gameplay roster: %j", async (overrides) => {
    const match = recognizedPreview();
    const roster = recognizedRoster(match, "BLUE");
    roster[4] = { ...roster[4], ...overrides };
    const { renderer } = await mountRecognized(match, "BLUE", roster);
    await load(renderer, {}, match);
    expect(sideButton(renderer, "BLUE").props["aria-pressed"]).toBe(false);
    expect(enemySelects(renderer)).toHaveLength(0);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(mutationRequests()).toHaveLength(0);
  });

  it("gives a complete Riot ID priority over an earlier profile's misleading display name", async () => {
    const match = recognizedPreview();
    const roster = recognizedRoster(match, "BLUE");
    roster.unshift({ id: "misleading", team_id: "team", role: "TOP", riot_id: "Remplaçant#EUW", name: roster[0].riot_id });
    const { renderer } = await mountRecognized(match, "BLUE", roster);
    await load(renderer, {}, match);
    expect(sideButton(renderer, "BLUE").props["aria-pressed"]).toBe(true);
    expect(select(renderer, `Profil NXT5 · ${roleLabel("TOP")}`).props.value).toBe("profile-TOP");
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls.at(-1)[1].playerAssignments).toEqual(Object.fromEntries(roles.map((role) => [role, `profile-${role}`])));
  });
});

describe("explicit roster creation from an import preview", () => {
  const uniquePreview = () => ({ teams: preview().teams.map(team => ({ ...team, participants: team.participants.map((player, index) => ({ ...player, riotId: `${team.side} Joueur ${index}#EUW`, summonerName: `${team.side} Joueur ${index}` })) })) });
  const emptyTeam = { ...DEFAULT_DATA, matchCategories: categories, teams: [{ id: "team", owner_id: "owner" }], players: [] };
  const field = (renderer, label) => renderer.root.findAllByType(TextInput).find(node => node.props.label === label);

  it("does not create profiles on preview/side selection, then links five confirmed identities and imports", async () => {
    const { renderer, props } = await mount({ data: emptyTeam });
    await load(renderer, { label: "Première partie", info: { gameId: "new-team" } }, uniquePreview());
    expect(apiUploadJson.mock.calls[0][1].previewOnly).toBe(true);
    expect(mutationRequests()).toHaveLength(0);
    await chooseSide(renderer, "BLUE");
    expect(mutationRequests()).toHaveLength(0);
    expect(button(renderer, "Créer les profils proposés").props.disabled).toBe(false);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    const created = roles.map((role, index) => ({ id: `created-${index}`, role, team_id: "team", name: `BLUE Joueur ${index}`, riot_id: `BLUE Joueur ${index}#EUW` }));
    apiFetch.mockResolvedValueOnce({ players: created, createdCount: 5 });
    await click(renderer, "Créer les profils proposés");
    const [endpoint, options] = mutationRequests()[0];
    expect(endpoint).toBe("players-import-roster");
    expect(JSON.parse(options.body)).toEqual({ teamId: "team", profiles: roles.map((role, index) => ({ role, name: `BLUE Joueur ${index}`, riotId: `BLUE Joueur ${index}#EUW` })) });
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(roles.map(role => select(renderer, `Profil NXT5 · ${roleLabel(role)}`).props.value)).toEqual(created.map(player => player.id));
    expect(button(renderer, "Créer les profils proposés")).toBeUndefined();
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(false);
    apiUploadJson.mockResolvedValueOnce({ match: { id: "saved" } });
    await click(renderer, "Confirmer l’import");
    expect(apiUploadJson.mock.calls[1][1].playerAssignments).toEqual(Object.fromEntries(roles.map((role, index) => [role, `created-${index}`])));
    expect(props.onImported).toHaveBeenCalledWith({ match: { id: "saved" } });
  });

  it("rejects duplicate or incomplete identities locally and retains corrected fields after a server failure", async () => {
    const { renderer } = await mount({ data: emptyTeam });
    await load(renderer);
    await chooseSide(renderer, "BLUE");
    expect(button(renderer, "Créer les profils proposés").props.disabled).toBe(true);
    for (const [index, role] of roles.entries()) {
      await act(async () => field(renderer, `Riot ID · ${roleLabel(role)}`).props.onChange(`Unique ${index}#EUW`));
    }
    expect(button(renderer, "Créer les profils proposés").props.disabled).toBe(false);
    await act(async () => field(renderer, "Riot ID · Top").props.onChange("Sans tag"));
    expect(button(renderer, "Créer les profils proposés").props.disabled).toBe(true);
    expect(mutationRequests()).toHaveLength(0);
    await act(async () => field(renderer, "Riot ID · Top").props.onChange("Unique 0#EUW"));
    apiFetch.mockRejectedValueOnce(new Error("Réessaie"));
    await click(renderer, "Créer les profils proposés");
    expect(field(renderer, "Riot ID · Top").props.value).toBe("Unique 0#EUW");
    expect(button(renderer, "Créer les profils proposés").props.disabled).toBe(false);
    expect(button(renderer, "Confirmer l’import").props.disabled).toBe(true);
    expect(apiUploadJson).toHaveBeenCalledTimes(1);
  });
});

it("B10 announces malformed JSON inside the import panel and releases busy state", async () => {
  const onBusyChange = vi.fn();
  const { renderer } = await mount({ onBusyChange });
  await act(async () => renderer.root.findByType(ImporterDownloadPanel).props.onImport({ name: "broken.json", size: 5, text: async () => "{oops" }));
  expect(renderer.root.findAllByProps({ role: "alert" }).some(node => text(node).includes("JSON valide"))).toBe(true);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(apiUploadJson).not.toHaveBeenCalled();
});

it("B12 releases the import dialog when the upload times out", async () => {
  const onBusyChange = vi.fn();
  const { renderer } = await mount({ onBusyChange });
  apiUploadJson.mockRejectedValueOnce(new Error("L’envoi a dépassé le délai maximal."));
  await act(async () => renderer.root.findByType(ImporterDownloadPanel).props.onImport({ name: "game.json", size: 2, text: async () => "{}" }));
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(renderer.root.findByType(ImporterDownloadPanel).props.fileImporting).toBe(false);
  expect(renderer.root.findAllByProps({ role: "alert" }).some(node => text(node).includes("délai maximal"))).toBe(true);
});
