import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DraftAssistance from "../components/draft/DraftAssistance.jsx";
import { Compositions } from "../pages/workspace/DraftWorkspace.jsx";
import { SelectInput, TextInput } from "../components/ui/Core.jsx";
import { apiFetch } from "../api/client.js";
import { openAppPath } from "../app/routing.js";
import { setLanguage } from "../i18n/locale.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../app/routing.js", async (importOriginal) => ({ ...await importOriginal(), openAppPath: vi.fn() }));

const top = { id: "top", team_id: "team", name: "Titulaire", role: "TOP" };
const substitute = { id: "sub", team_id: "team", name: "Remplaçant", role: "TOP" };
const mid = { id: "mid", team_id: "team", name: "Midlaner", role: "MID" };
const pool = (id, champion, player = top, extra = {}) => ({ id, team_id: player.team_id, player_id: player.id, player_name: player.name, role: player.role, champion, source: "manual", status: "lock", ...extra });
const match = (id, result, patch, category, opponent = "Darius", extra = {}) => ({
  id, team_id: "team", result, patch, category_ids: [category], opponent: `Source ${id}`,
  participants: [{ team_key: "ALLY", player_id: top.id, role: "TOP", champion: "Ornn" }, { team_key: "ENEMY", role: "TOP", champion: opponent }], ...extra,
});
function fixture() {
  return {
    teams: [{ id: "team", name: "NXT5" }],
    players: [top, substitute, mid, { ...top, id: "foreign", team_id: "foreign" }],
    championPool: [pool("ornn", "Ornn"), pool("malphite", "Malphite"), pool("quinn", "Quinn", substitute), pool("ahri", "Ahri", mid), pool("syndra", "Syndra", mid), pool("mid-ornn", "Ornn", mid), pool("foreign", "Garen", { ...top, team_id: "foreign" })],
    matches: [match("a", "Victoire", "16.20", "scrim"), match("b", "Défaite", "16.20", "official"), match("c", "Défaite", "16.19", "scrim", "Garen"), match("d", "pending", "16.20", "scrim"), match("foreign", "Victoire", "99.99", "foreign", "Darius", { team_id: "foreign" })],
    matchCategories: [{ id: "scrim", team_id: "team", name: "Entraînement" }, { id: "official", team_id: "team", name: "Officiel" }, { id: "foreign", team_id: "foreign", name: "Autre équipe" }],
    compositions: [],
  };
}

let renderer;
beforeEach(() => {
  setLanguage("fr");
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("requestAnimationFrame", (callback) => { callback(); return 1; });
});
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllGlobals(); });
const text = node => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const mount = element => { act(() => { renderer = TestRenderer.create(element); }); };
const update = element => { act(() => { renderer.update(element); }); };
const control = label => renderer.root.findAllByType(SelectInput).find(node => node.props.label === label);
const change = (label, value) => act(() => control(label).props.onChange(value));
const choices = () => renderer.root.findAllByProps({ className: "nxt5-draft-assistance-choice" });
const names = () => choices().map(node => text(node.findByType("h4")));
const choice = name => choices().find(node => text(node.findByType("h4")) === name);
const pickButton = name => choice(name).findAllByType("button").find(node => node.props["aria-label"]?.startsWith("Choisir "));
const sourceButtons = name => choice(name).findAllByProps({ className: "nxt5-draft-assistance-sources" }).flatMap(node => node.findAllByType("button"));
const click = node => act(() => node.props.onClick());
const propsFor = extra => ({ data: fixture(), teamId: "team", slots: { TOP: { playerId: top.id }, MID: { playerId: mid.id } }, champions: ["Ornn", "Malphite", "Ahri", "Syndra", "Darius", "Kai'Sa", "Wukong"], onPick: vi.fn(), ...extra });

describe("draft assistance interaction", () => {
  it("changes role and opponent while retaining only the active player's available manual champions", () => {
    mount(<DraftAssistance {...propsFor()} />);
    expect(names()).toEqual(["Ornn", "Malphite"]);
    expect(text(renderer.toJSON())).toContain("Pool de Titulaire · TOP");
    change("Champion adverse (facultatif)", "Ornn");
    expect(names()).toEqual(["Malphite"]);
    change("Poste à préparer", "MID");
    expect(names()).toEqual(["Ahri", "Syndra"]);
    expect(text(renderer.toJSON())).toContain("Pool de Midlaner · MID");
    expect(control("Champion adverse (facultatif)").props.value).toBe("Ornn");
    change("Champion adverse (facultatif)", "");
    expect(names()).toEqual(["Ahri", "Ornn", "Syndra"]);
  });

  it("uses the player selected in the composition, including an alternate at the same role", () => {
    const props = propsFor();
    mount(<DraftAssistance {...props} />);
    update(<DraftAssistance {...props} slots={{ ...props.slots, TOP: { playerId: substitute.id } }} />);
    expect(names()).toEqual(["Quinn"]);
    expect(text(renderer.toJSON())).toContain("Pool de Remplaçant · TOP");
    click(pickButton("Quinn"));
    expect(props.onPick).toHaveBeenCalledExactlyOnceWith("TOP", { playerId: "sub", poolId: "quinn" });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("excludes picks at other roles and preserves a selected candidate with its choice button disabled", () => {
    const props = propsFor({ slots: { TOP: { playerId: top.id, poolId: "ornn" }, MID: { playerId: mid.id } } });
    mount(<DraftAssistance {...props} />);
    expect(names()).toContain("Ornn");
    expect(pickButton("Ornn").props.disabled).toBe(true);
    expect(text(pickButton("Ornn"))).toBe("Dans la composition");
    expect(pickButton("Malphite").props.disabled).toBe(false);
    update(<DraftAssistance {...props} slots={{ TOP: { playerId: top.id }, MID: { playerId: mid.id, poolId: "mid-ornn" } }} />);
    expect(names()).toEqual(["Malphite"]);
    update(<DraftAssistance {...props} disabled />);
    expect(choices().every(node => node.findAllByType("button").filter(button => button.props["aria-label"]?.startsWith("Choisir ")).every(button => button.props.disabled))).toBe(true);
  });

  it("combines team, category and patch filters in statistics and exact source matches", () => {
    mount(<DraftAssistance {...propsFor()} />);
    expect(text(choice("Ornn"))).toContain("33,3 % de victoires");
    expect(text(choice("Ornn"))).toContain("3 résultats connus sur 4 parties");
    expect(control("Patch des parties").findAllByType("option").map(node => node.props.value)).toEqual(["", "16.20", "16.19"]);
    expect(control("Catégorie des parties").findAllByType("option").map(text)).not.toContain("Autre équipe");
    change("Catégorie des parties", "scrim");
    expect(text(choice("Ornn"))).toContain("50 % de victoires");
    expect(text(choice("Ornn"))).toContain("2 résultats connus sur 3 parties");
    change("Patch des parties", "16.20");
    expect(text(choice("Ornn"))).toContain("100 % de victoires");
    expect(text(choice("Ornn"))).toContain("1 résultats connus sur 2 parties");
    change("Champion adverse (facultatif)", "Darius");
    expect(sourceButtons("Ornn").map(text)).toEqual(["Source a", "Source d"]);
    click(sourceButtons("Ornn")[0]);
    expect(openAppPath).toHaveBeenLastCalledWith("/games?match=a");
    click(sourceButtons("Ornn")[1]);
    expect(openAppPath).toHaveBeenLastCalledWith("/games?match=d");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows only the observed opponent matchup sources and safely encodes match identifiers", () => {
    const data = fixture();
    data.matches = [match("game /?&=#", "Victoire", "16.20", "scrim"), match("other-opponent", "Défaite", "16.20", "scrim", "Garen")];
    mount(<DraftAssistance {...propsFor({ data })} />);
    expect(sourceButtons("Ornn")).toHaveLength(2);
    change("Champion adverse (facultatif)", "Darius");
    expect(sourceButtons("Ornn")).toHaveLength(1);
    click(sourceButtons("Ornn")[0]);
    expect(openAppPath).toHaveBeenLastCalledWith(`/games?match=${encodeURIComponent("game /?&=#")}`);
    expect(text(choice("Ornn"))).toContain("Face à Darius au même poste");
    expect(text(choice("Ornn"))).toContain("50 % de victoires");
    expect(text(choice("Ornn"))).toContain("100 % de victoires");
  });

  it("distinguishes unavailable results and missing games from a measured zero percent", () => {
    const data = fixture();
    data.matches = [match("unknown", "pending", "16.20", "scrim")];
    mount(<DraftAssistance {...propsFor({ data })} />);
    change("Champion adverse (facultatif)", "Darius");
    expect(text(choice("Ornn"))).toContain("Résultat indisponible");
    expect(text(choice("Ornn"))).toContain("0 résultats connus sur 1 parties");
    expect(text(choice("Ornn"))).not.toContain("0 %");
    expect(text(choice("Malphite"))).toContain("Aucune partie renseignée");
    expect(sourceButtons("Malphite")).toHaveLength(0);
    const lossData = { ...data, matches: [match("loss", "Défaite", "16.20", "scrim")] };
    update(<DraftAssistance {...propsFor({ data: lossData })} />);
    expect(text(choice("Ornn"))).toContain("0 % de victoires");
  });

  it("explains a missing player or an empty pool without proposing a champion from another team", () => {
    mount(<DraftAssistance {...propsFor()} />);
    change("Poste à préparer", "JGL");
    expect(names()).toEqual([]);
    expect(text(renderer.toJSON())).toContain("Aucun joueur à ce poste");
    expect(text(renderer.toJSON())).toContain("Ajoute un profil à ce poste");
    const data = fixture();
    data.championPool = [];
    update(<DraftAssistance {...propsFor({ data })} />);
    change("Poste à préparer", "TOP");
    expect(names()).toEqual([]);
    expect(text(renderer.toJSON())).toContain("Aucun champion disponible dans ce pool");
  });

  it("opens external information through a canonical HTTPS link without fetching or blending statistics", () => {
    mount(<DraftAssistance {...propsFor()} />);
    expect(renderer.root.findAllByType("a")).toHaveLength(0);
    change("Champion adverse (facultatif)", "Kai'Sa");
    const link = renderer.root.findByType("a");
    expect(link.props.href).toBe("https://mobalytics.gg/lol/champions/kaisa/counters/top");
    expect(link.props).toMatchObject({ target: "_blank", rel: "noopener noreferrer" });
    expect(text(link)).toContain("Kai'Sa");
    expect(text(renderer.toJSON())).toContain("Ces statistiques ne sont pas importées");
    change("Champion adverse (facultatif)", "Wukong");
    for (const [role, slug] of [["TOP", "top"], ["JGL", "jungle"], ["MID", "mid"], ["ADC", "adc"], ["SUP", "support"]]) {
      change("Poste à préparer", role);
      expect(renderer.root.findByType("a").props.href).toBe(`https://mobalytics.gg/lol/champions/monkeyking/counters/${slug}`);
      expect(text(renderer.root.findByType("a"))).toContain("Wukong");
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("retains ID-less evidence without offering an invalid source navigation", () => {
    const data = fixture();
    data.matches = [match(undefined, "Victoire", "16.20", "scrim", "Darius", { opponent: "Import sans identifiant" }), match("valid", "Défaite", "16.20", "scrim")];
    mount(<DraftAssistance {...propsFor({ data })} />);
    expect(text(choice("Ornn"))).toContain("2 résultats connus sur 2 parties");
    const sources = sourceButtons("Ornn");
    expect(sources.map(text)).toEqual(["Source valid"]);
    click(sources[0]);
    expect(openAppPath).toHaveBeenLastCalledWith("/games?match=valid");
  });
});

describe("composition integration", () => {
  it("applies an assisted choice only to the draft until the composition is explicitly saved", async () => {
    const data = fixture();
    const refreshAll = vi.fn().mockResolvedValue(undefined);
    const pushToast = vi.fn();
    mount(<Compositions data={data} selectedTeamId="team" currentMember={{ role: "captain" }} user={{ id: "user" }} refreshAll={refreshAll} pushToast={pushToast} />);
    click(pickButton("Ornn"));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(pickButton("Ornn").props.disabled).toBe(true);
    expect(names()).toContain("Ornn");
    change("Champion adverse (facultatif)", "Darius");
    change("Catégorie des parties", "scrim");
    change("Patch des parties", "16.20");
    const title = renderer.root.findAllByType(TextInput).find(node => node.props.label === "Nom de la composition");
    act(() => title.props.onChange("Test de draft"));
    const preventDefault = vi.fn();
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledOnce();
    const [endpoint, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(endpoint).toBe("composition-types-manage");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ action: "create", teamId: "team", compositionId: null, title: "Test de draft", notes: "", tags: [], slots: { TOP: { playerId: "top", poolId: "ornn" }, JGL: { playerId: "", poolId: "" }, MID: { playerId: "mid", poolId: "" }, ADC: { playerId: "", poolId: "" }, SUP: { playerId: "", poolId: "" } } });
    expect(refreshAll).toHaveBeenCalledOnce();
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green" }));
    expect(pickButton("Ornn").props.disabled).toBe(false);
  });
});
