import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { ChampionSectionTabs, MatchupNotebook } from "../components/profile/MatchupNotebook.jsx";
import { Button, SelectInput, TextAreaInput, TextInput } from "../components/ui/Core.jsx";
import { ProfileChampionsView } from "../pages/workspace/PlayerUltimateProfile.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
let playerNumber = 0;
beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true) });
  vi.stubGlobal("requestAnimationFrame", (callback) => callback());
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
const own = { id: "own", champion: "Orianna", role: "MID", team_key: "ALLY", raw: { participantId: 1 } };
const enemy = { id: "enemy", champion: "Syndra", role: "MID", team_key: "ENEMY", raw: { participantId: 6 } };
function sampleRow(id, result = null, opponents = [enemy]) {
  return { ...own, match: { id, team_id: "team-a", result, game_date: "2026-09-15", duration: "25:00", participants: [own, ...opponents], raw: {} } };
}
const notebook = (overrides = {}) => ({ opponentChampion: "syndra", role: "MID", revision: 3, plan: { lanePlan: "Plan du coach", vigilance: "", toKeep: "" }, experiments: [], ...overrides });
async function mount({ rows = [sampleRow("one", "Victoire"), sampleRow("two")], notebooks = [], canEdit = true, ...overrides } = {}) {
  const calls = [];
  let rejectSave = null;
  let allowedToEdit = canEdit;
  let refreshVersion = 0;
  const props = { champion: "Orianna", rows, teamId: "team-a", playerId: `player-${++playerNumber}`, userId: "user-a", renderGames: (games) => <output data-games>{games.map((game) => game.match.id).join(",")}</output>, ...overrides };
  apiFetch.mockImplementation(async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    if (url === "match-details") return { matches: rows.filter((row) => body.matchIds.includes(row.match.id)).map((row) => row.match) };
    if (body.action === "list") return { notebooks, canEdit: allowedToEdit };
    if (rejectSave) throw rejectSave;
    return { notebook: { ...body, revision: body.expectedRevision + 1 } };
  });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<MatchupNotebook {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    renderer, props, calls,
    failSave(error) { rejectSave = error; },
    async refreshAccess(allowed) {
      allowedToEdit = allowed;
      await act(async () => renderer.update(<MatchupNotebook {...props} bootstrapRevision={++refreshVersion} />));
    },
    get root() { return renderer.root; },
    get words() { return text(renderer.toJSON()); },
    async open(key = "MID|syndra") { await act(async () => renderer.root.findByProps({ "data-matchup": key }).props.onClick()); },
    async press(label) { await act(async () => renderer.root.findAllByType(Button).find((button) => text(button) === label).props.onClick()); },
    change(type, label, value) { act(() => renderer.root.findAllByType(type).find((field) => field.props.label === label).props.onChange(value)); },
    async submit() { await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() })); },
  };
}

describe("matchup notebook view", () => {
  it("lists strict opponents with known-result sampling and shared notebook status", async () => {
    const ambiguous = sampleRow("ambiguous", "Victoire", [enemy, { ...enemy, id: "second" }]);
    const app = await mount({ rows: [sampleRow("one", "Victoire"), sampleRow("two"), ambiguous], notebooks: [notebook({ experiments: [{ id: "trial-a", title: "Départ défensif", status: "active", matchIds: [] }] })] });
    const rows = app.root.findAllByProps({ className: "matchup-row" });
    expect(rows).toHaveLength(1);
    expect(text(rows[0])).toContain("100 %");
    expect(text(rows[0])).toContain("1 résultat connu");
    expect(text(rows[0])).toContain("Essai en cours");
    expect(app.words).toContain("1 partie sans adversaire de même poste");
    await app.open();
    expect(app.words).toContain("Orianna face à Syndra");
    expect(app.root.findByProps({ "data-games": true }).children).toEqual(["one,two"]);
  });

  it("saves plan and trial edits for the correct player, champion, role and linked game", async () => {
    const app = await mount({ notebooks: [notebook()] });
    await app.open();
    await app.press("Modifier le carnet");
    app.change(TextAreaInput, "Plan de départ", "Garder le contrôle de la wave");
    app.change(TextAreaInput, "Points de vigilance", "Le niveau 6 adverse");
    await app.press("Ajouter un essai");
    app.change(TextInput, "Titre de l’essai", "Premier achat défensif");
    app.change(SelectInput, "État de l’essai", "active");
    app.change(TextAreaInput, "Ce qu’on veut tester", "Avancer le premier retour");
    app.change(TextAreaInput, "Observations du joueur", "Plus stable sur la deuxième wave");
    app.change(TextAreaInput, "Conclusion du joueur et du staff", "À confirmer sur deux scrims");
    act(() => app.root.findAllByType("input").find((input) => input.props.type === "checkbox").props.onChange({ target: { checked: true } }));
    await app.submit();
    const saved = app.calls.find((call) => call.body.action === "save").body;
    expect(saved).toMatchObject({ action: "save", teamId: "team-a", playerId: app.props.playerId, champion: "orianna", opponentChampion: "syndra", role: "MID", expectedRevision: 3,
      plan: { lanePlan: "Garder le contrôle de la wave", vigilance: "Le niveau 6 adverse", toKeep: "" },
      experiments: [{ title: "Premier achat défensif", status: "active", plan: "Avancer le premier retour", observation: "Plus stable sur la deuxième wave", conclusion: "À confirmer sur deux scrims", matchIds: ["one"] }],
    });
    expect(saved.experiments[0].id).toBeTruthy();
    expect(app.root.findAllByType("form")).toHaveLength(0);
    expect(app.words).toContain("Carnet enregistré.");
    expect(app.root.findAllByType("a").map((anchor) => anchor.props.href)).toContain("/games?match=one");
  });

  it("shows shared plans but no editing controls when the server denies write access", async () => {
    const app = await mount({ notebooks: [notebook()], canEdit: false });
    await app.open();
    expect(app.words).toContain("Plan du coach");
    expect(app.words).toContain("Le joueur lié au profil et le staff peuvent modifier ce carnet");
    expect(app.root.findAllByType("form")).toHaveLength(0);
    expect(app.root.findAllByType("textarea")).toHaveLength(0);
    expect(app.root.findAllByType(Button).some((button) => /Modifier|Préparer|Enregistrer/.test(text(button)))).toBe(false);
  });

  it("shows the server plan after edit access is removed while preserving a separate local draft", async () => {
    const app = await mount({ notebooks: [notebook()] });
    await app.open();
    await app.press("Modifier le carnet");
    app.change(TextAreaInput, "Plan de départ", "Brouillon personnel non enregistré");
    await app.refreshAccess(false);
    expect(app.root.findAllByType("form")).toHaveLength(0);
    const sharedPlan = app.root.findAllByProps({ className: "matchup-plan" })[0];
    expect(text(sharedPlan)).toContain("Plan du coach");
    expect(text(sharedPlan)).not.toContain("Brouillon personnel non enregistré");
    expect(app.root.findAllByType(Button).some((button) => text(button) === "Copier mon brouillon")).toBe(true);
    await app.refreshAccess(true);
    expect(app.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.value).toBe("Brouillon personnel non enregistré");
    await app.press("Annuler");
  });

  it("keeps a failed draft when returning to the list and opening the duel again", async () => {
    const app = await mount();
    await app.open();
    await app.press("Préparer le carnet");
    app.change(TextAreaInput, "Plan de départ", "Mon plan non enregistré");
    app.failSave(new Error("Connexion perdue"));
    await app.submit();
    expect(app.words).toContain("Connexion perdue");
    expect(app.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.value).toBe("Mon plan non enregistré");
    await app.press("Tous les matchups");
    await app.open();
    expect(app.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.value).toBe("Mon plan non enregistré");
    expect(app.words).toContain("Modifications non enregistrées");
    await app.press("Annuler");
  });

  it("explains revision conflicts while keeping the editable plan", async () => {
    const app = await mount({ notebooks: [notebook()] });
    await app.open();
    await app.press("Modifier le carnet");
    app.change(TextAreaInput, "Plan de départ", "Version du joueur");
    app.failSave(Object.assign(new Error("Conflict"), { code: "NOTEBOOK_REVISION_CONFLICT" }));
    await app.submit();
    expect(app.words).toContain("Ce carnet a été modifié par une autre personne");
    expect(app.words).toContain("Copier mon brouillon");
    expect(app.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.value).toBe("Version du joueur");
    await app.press("Annuler");
  });

  it("displays missing duel metrics as unavailable and limits game rows to the selected patch", async () => {
    const first = sampleRow("one");
    first.match.patch = "26.18";
    const second = sampleRow("two");
    second.match.patch = "26.17";
    const app = await mount({ rows: [first, second] });
    await app.open();
    expect(app.words).toContain("Résultats indisponibles");
    const milestones = app.root.findByProps({ className: "matchup-milestones" });
    const metrics = milestones.findAllByType("dd");
    expect(metrics).toHaveLength(9);
    expect(metrics.every((metric) => text(metric) === "—0/2 parties renseignées")).toBe(true);
    await act(async () => app.root.findAllByType(SelectInput).find((field) => field.props.label === "Patch des statistiques").props.onChange("26.18"));
    expect(app.root.findByProps({ "data-games": true }).children).toEqual(["one"]);
    expect(app.words).toContain("0/1 parties renseignées");
  });
});

describe("champion section tabs keyboard navigation", () => {
  it("uses arrow, Home and End keys, roving focus and tab-panel connections", () => {
    const onChange = vi.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<ChampionSectionTabs active="statistics" onChange={onChange} id="champion-one" />); });
    cleanups.push(() => act(() => renderer.unmount()));
    const tabs = renderer.root.findAllByProps({ role: "tab" });
    expect(tabs.map((tab) => tab.props.tabIndex)).toEqual([0, -1]);
    expect(tabs.map((tab) => tab.props["aria-controls"])).toEqual(["champion-one-panel", "champion-one-panel"]);
    const nodes = [{ focus: vi.fn() }, { focus: vi.fn() }];
    const press = (tab, key) => {
      const event = { key, preventDefault: vi.fn(), currentTarget: { parentElement: { querySelectorAll: () => nodes } } };
      act(() => tabs[tab].props.onKeyDown(event));
      return event;
    };
    expect(press(0, "ArrowLeft").preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("matchups");
    expect(nodes[1].focus).toHaveBeenCalledTimes(1);
    press(1, "ArrowRight");
    expect(onChange).toHaveBeenLastCalledWith("statistics");
    press(1, "Home");
    expect(onChange).toHaveBeenLastCalledWith("statistics");
    press(0, "End");
    expect(onChange).toHaveBeenLastCalledWith("matchups");
    expect(press(0, "Tab").preventDefault).not.toHaveBeenCalled();
  });
});

describe("profile champions integration", () => {
  it("opens the notebook inside the champion, restores drafts after a tab change and resets on a new player", async () => {
    const rows = [sampleRow("profile-game", "Victoire")];
    const calls = [];
    apiFetch.mockImplementation(async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      return url === "player-matchups" ? { notebooks: [], canEdit: true } : { matches: rows.map((row) => row.match) };
    });
    const props = { championStats: [{ champion: "Orianna", games: 1, rows }], teamId: "team-a", userId: "profile-user", selectedPlayer: { id: "profile-player-a" }, selectedCategoryId: "scrims" };
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<ProfileChampionsView {...props} />); });
    cleanups.push(() => act(() => renderer.unmount()));
    act(() => renderer.root.findByProps({ "data-champion": "Orianna" }).props.onClick());
    expect(renderer.root.findAllByType(MatchupNotebook)).toHaveLength(0);
    const selectTab = async (label) => {
      await act(async () => renderer.root.findAllByProps({ role: "tab" }).find((tab) => text(tab) === label).props.onClick());
    };
    await selectTab("Matchups");
    expect(renderer.root.findByType(MatchupNotebook).props.playerId).toBe("profile-player-a");
    expect(calls.find((call) => call.url === "player-matchups").body).toMatchObject({ action: "list", playerId: "profile-player-a", teamId: "team-a", champion: "orianna" });
    const tab = renderer.root.findAllByProps({ role: "tab" }).find((item) => item.props["aria-selected"]);
    expect(renderer.root.findByProps({ role: "tabpanel" }).props["aria-labelledby"]).toBe(tab.props.id);
    await act(async () => renderer.root.findByProps({ "data-matchup": "MID|syndra" }).props.onClick());
    act(() => renderer.root.findAllByType(Button).find((button) => text(button) === "Préparer le carnet").props.onClick());
    act(() => renderer.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.onChange("Plan conservé en changeant d’onglet"));
    await selectTab("Statistiques");
    expect(renderer.root.findAllByType(MatchupNotebook)).toHaveLength(0);
    await selectTab("Matchups");
    await act(async () => renderer.root.findByProps({ "data-matchup": "MID|syndra" }).props.onClick());
    expect(renderer.root.findAllByType(TextAreaInput).find((field) => field.props.label === "Plan de départ").props.value).toBe("Plan conservé en changeant d’onglet");
    act(() => renderer.root.findAllByType(Button).find((button) => text(button) === "Annuler").props.onClick());
    await act(async () => renderer.update(<ProfileChampionsView {...props} selectedPlayer={{ id: "profile-player-b" }} />));
    expect(renderer.root.findAllByType(MatchupNotebook)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "data-champion": "Orianna" })).toHaveLength(1);
  });
});
