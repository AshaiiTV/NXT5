import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import { Champions, Compositions, CompositionSlot, CompositionCard, compositionMastery, compositionPickList } from "../pages/workspace/DraftWorkspace.jsx";
import { CHAMPION_IDS } from "../../shared/champion-catalog.js";
import { compositionSlots } from "../utils/planning.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));

const players = [
  { id: "top", team_id: "team", role: "TOP", name: "Top", user_id: "user" },
  { id: "sub", team_id: "team", role: "TOP", name: "Remplaçant" },
  { id: "mid", team_id: "team", role: "MID", name: "Mid" },
];
const rows = [
  { id: "aatrox", team_id: "team", player_id: "top", player_name: "Top", role: "TOP", champion: "Aatrox", status: "lock", source: "manual" },
  { id: "ornn", team_id: "team", player_id: "sub", player_name: "Remplaçant", role: "TOP", champion: "Ornn", status: "work", source: "manual" },
  { id: "ahri", team_id: "team", player_id: "mid", player_name: "Mid", role: "MID", champion: "Ahri", status: "pocket", source: "manual" },
];
let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.clearAllMocks(); });
function render(element, options) { act(() => { renderer = TestRenderer.create(element, options); }); return renderer.root; }
function selectRole(role) { return renderer.root.findAllByType(SelectInput).find((node) => node.props.label === `Champion · ${role}`); }

describe("accessible composition choices", () => {
  it("keeps the player's pool first and offers every remaining champion once, excluding substitutes from pool groups", () => {
    const onChange = vi.fn();
    render(<CompositionSlot role="TOP" slot={{ playerId: "top", poolId: "" }} players={players} rows={rows} onChange={onChange} />);
    const picker = selectRole("TOP");
    const groups = picker.findAllByType("optgroup");
    expect(groups[0].findAllByType("option").map(node => node.props.value)).toEqual(["aatrox"]);
    const others = groups.at(-1);
    expect(others.props.label).toBe("Autres champions");
    const values = others.findAllByType("option").map(node => node.props.value);
    expect(values).toHaveLength(CHAMPION_IDS.length - 1);
    expect(values).not.toContain("champion:Aatrox");
    expect(values).toContain("champion:Ornn");
    expect(values).not.toContain("ornn");
    expect(new Set(values).size).toBe(values.length);
    act(() => picker.findByType("select").props.onChange({ target: { value: "aatrox" } }));
    expect(onChange).toHaveBeenCalledWith("TOP", { playerId: "top", poolId: "aatrox" });
    const playerPicker = renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Joueur · TOP");
    act(() => playerPicker.findByType("select").props.onChange({ target: { value: "sub" } }));
    expect(onChange).toHaveBeenLastCalledWith("TOP", { playerId: "sub", poolId: "" });
  });

  it("offers the full catalogue for an empty pool or a role without a player, without borrowing private pool rows", () => {
    const onChange = vi.fn();
    render(<CompositionSlot role="SUP" slot={{}} players={players} rows={rows} onChange={onChange} />);
    expect(selectRole("SUP").props.disabled).not.toBe(true);
    expect(selectRole("SUP").findAllByType("option")).toHaveLength(CHAMPION_IDS.length + 1);
    act(() => selectRole("SUP").props.onChange("champion:Thresh"));
    expect(onChange).toHaveBeenCalledWith("SUP", { playerId: "", poolId: "", champion: "Thresh" });
    expect(selectRole("SUP").findAllByType("option").map(node => node.props.value)).not.toContain("ahri");
  });

  it("saves an outside-pool pick without creating a pool row and restores its portrait, analysis and saved card", async () => {
    apiFetch.mockResolvedValue({});
    const data = { players, championPool: rows, compositions: [] };
    render(<Compositions data={data} selectedTeamId="team" currentMember={{ role: "player" }} user={{ id: "user" }} refreshAll={vi.fn()} pushToast={vi.fn()} />);
    act(() => renderer.root.findAllByType(TextInput).find(node => node.props.label === "Nom de la composition").props.onChange("Essai hors pool"));
    act(() => selectRole("MID").props.onChange("champion:MonkeyKing"));
    expect(selectRole("MID").props.value).toBe("champion:MonkeyKing");
    expect(apiFetch).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(apiFetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(apiFetch.mock.calls[0][1].body);
    const savedSlots = compositionSlots(JSON.stringify(payload.slots));
    expect(savedSlots.MID).toEqual({ playerId: "mid", poolId: "", champion: "MonkeyKing" });
    expect(compositionPickList(savedSlots, rows)).toEqual([expect.objectContaining({ role: "MID", champion: "MonkeyKing", outsidePool: true })]);
    expect(compositionMastery(savedSlots, rows)).toEqual({ label: "Maîtrise non renseignée", tone: "slate" });
    act(() => renderer.update(<CompositionCard composition={{ title: "Essai hors pool", slots: savedSlots }} rows={rows} players={players} />));
    const cardText = JSON.stringify(renderer.toJSON());
    expect(cardText).toContain("Wukong");
    expect(cardText).toContain("Hors pool");
    expect(cardText).toContain("Mid");
    expect(data.championPool).toEqual(rows);
    act(() => renderer.update(<CompositionSlot role="MID" slot={savedSlots.MID} players={players} rows={rows} onChange={vi.fn()} />));
    expect(selectRole("MID").props.value).toBe("champion:MonkeyKing");
  });

  it("removes the free champion when switching to a pool pick or another player", () => {
    const onChange = vi.fn();
    render(<CompositionSlot role="TOP" slot={{ playerId: "top", poolId: "", champion: "Ornn" }} players={players} rows={rows} onChange={onChange} />);
    act(() => selectRole("TOP").props.onChange("aatrox"));
    expect(onChange).toHaveBeenLastCalledWith("TOP", { playerId: "top", poolId: "aatrox" });
    act(() => renderer.root.findAllByType(SelectInput).find(node => node.props.label === "Joueur · TOP").props.onChange("sub"));
    expect(onChange).toHaveBeenLastCalledWith("TOP", { playerId: "sub", poolId: "" });
  });

  it("recognizes a newly declared champion only for its own player and role", () => {
    const slot = { playerId: "top", poolId: "", champion: "Ornn" };
    expect(compositionMastery({ TOP: slot }, rows).label).toBe("Maîtrise non renseignée");
    const declaredRows = [...rows, { ...rows[0], id: "new-ornn", champion: "Ornn" }];
    expect(compositionMastery({ TOP: slot }, declaredRows).label).toBe("Très maîtrisée");
    render(<CompositionSlot role="TOP" slot={slot} players={players} rows={declaredRows} onChange={vi.fn()} />);
    expect(selectRole("TOP").props.value).toBe("new-ornn");
    expect(selectRole("TOP").findAllByType("option").map(node => node.props.value)).not.toContain("champion:Ornn");
  });

  it("reconciles legacy name-only pool rows without borrowing an ID-linked row from a namesake", () => {
    const slot = { playerId: "top", poolId: "", champion: "Ornn" };
    const legacyRows = [...rows, { ...rows[0], id: "legacy-ornn", player_id: null, champion: "Ornn" }];
    render(<CompositionSlot role="TOP" slot={slot} players={players} rows={legacyRows} onChange={vi.fn()} />);
    expect(selectRole("TOP").props.value).toBe("legacy-ornn");
    expect(compositionMastery({ TOP: slot }, legacyRows, players).label).toBe("Très maîtrisée");
    const namesakeRows = [...rows, { ...legacyRows.at(-1), player_id: "other-player" }];
    act(() => renderer.update(<CompositionSlot role="TOP" slot={slot} players={players} rows={namesakeRows} onChange={vi.fn()} />));
    expect(selectRole("TOP").props.value).toBe("champion:Ornn");
    expect(selectRole("TOP").findAllByType("option").map(node => node.props.value)).toContain("champion:Ornn");
  });

  it("keeps draft choices when the glossary opens and saves the same composition payload", async () => {
    apiFetch.mockResolvedValue({});
    const refreshAll = vi.fn(async () => {});
    render(<Compositions data={{ players, championPool: rows, compositions: [] }} selectedTeamId="team" currentMember={{ role: "player" }} user={{ id: "user" }} refreshAll={refreshAll} pushToast={vi.fn()} />);
    act(() => renderer.root.findAllByType(TextInput).find(node => node.props.label === "Nom de la composition").props.onChange("Notre composition"));
    act(() => selectRole("TOP").props.onChange("aatrox"));
    const glossary = renderer.root.findAllByType(Button).find((node) => node.props["aria-expanded"] !== undefined);
    act(() => glossary.props.onClick());
    expect(selectRole("TOP").props.value).toBe("aatrox");
    const details = renderer.root.findAllByType("details");
    expect(details.length).toBeGreaterThan(0);
    expect(details.every((node) => !node.props.open)).toBe(true);
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0][0]).toBe("composition-types-manage");
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ action: "create", teamId: "team", title: "Notre composition", slots: { TOP: { playerId: "top", poolId: "aatrox" } } });
    expect(refreshAll).toHaveBeenCalledOnce();
  });

  it("opens the catalogue search directly without saving or changing the selected player", () => {
    const focus = vi.fn();
    render(<Champions data={{ teams: [{ id: "team" }], players, championPool: rows }} selectedTeamId="team" currentMember={{ role: "player" }} user={{ id: "user" }} refreshAll={vi.fn()} pushToast={vi.fn()} />, {
      createNodeMock: (element) => element.type === "aside" ? { querySelector: () => ({ focus }) } : null,
    });
    const add = renderer.root.findAllByType(Button).find((node) => node.props.children === "Ajouter un champion");
    act(() => add.props.onClick());
    expect(focus).toHaveBeenCalledOnce();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

it("R-F7 patches the common pool after add, move and delete, including Pool → Compositions → Pool", async () => {
  vi.stubGlobal("window", { confirm: () => true });
  let shared = [];
  const base = { teams: [{ id: "team" }], players, compositions: [] };
  let tab = "pool";
  const props = { selectedTeamId: "team", currentMember: { role: "player" }, user: { id: "user" }, pushToast: vi.fn() };
  const page = () => tab === "pool" ? <Champions {...props} data={{ ...base, championPool: shared }} setData={setData} refreshAll={refreshAll} /> : <Compositions {...props} data={{ ...base, championPool: shared }} refreshAll={refreshAll} />;
  const refreshAll = vi.fn(() => new Promise(() => {}));
  const setData = update => { shared = update({ ...base, championPool: shared }).championPool; renderer.update(page()); };
  apiFetch.mockImplementation(async (_path, options) => {
    const body = JSON.parse(options.body);
    if (body.action === "delete") return { ok: true };
    const pick = { ...rows[0], status: body.status };
    return { pick };
  });
  render(page());
  await act(async () => renderer.root.findByProps({ "aria-label": "Classer Aatrox" }).props.onChange({ target: { value: "lock" } }));
  expect(refreshAll).not.toHaveBeenCalled();
  act(() => { tab = "compositions"; renderer.update(page()); });
  expect(selectRole("TOP").findAllByType("option").map(node => node.props.value)).toContain("aatrox");
  act(() => { tab = "pool"; renderer.update(page()); });
  await act(async () => renderer.root.findByProps({ "aria-label": "Déplacer Aatrox" }).props.onChange({ target: { value: "work" } }));
  expect(refreshAll).not.toHaveBeenCalled();
  expect(shared[0].status).toBe("work");
  await act(async () => renderer.root.findByProps({ "aria-label": "Retirer Aatrox de la liste" }).props.onClick());
  expect(refreshAll).not.toHaveBeenCalled();
  act(() => { tab = "compositions"; renderer.update(page()); });
  expect(selectRole("TOP").findAllByType("option").map(node => node.props.value)).not.toContain("aatrox");
  act(() => { tab = "pool"; renderer.update(page()); });
  expect(renderer.root.findAllByProps({ "aria-label": "Déplacer Aatrox" })).toHaveLength(0);
  vi.unstubAllGlobals();
});


it('T5-05 renders historical malformed slots with a populated champion pool', () => {
  vi.stubGlobal('window', { scrollTo: vi.fn() });
  render(<Compositions data={{ players, championPool: rows, compositions: [{
    id: 'legacy', team_id: 'team', created_by: 'user', title: 'Ancienne composition',
    slots: JSON.stringify({ TOP: null, JGL: [], MID: { poolId: 'ahri', playerId: 'mid' }, ADC: 12, SUP: 'bad', UNKNOWN: { poolId: 'aatrox' } }),
  }] }} selectedTeamId="team" currentMember={{ role: 'player' }} user={{ id: 'user' }} refreshAll={vi.fn()} pushToast={vi.fn()} />);
  expect(JSON.stringify(renderer.toJSON())).toContain('Ancienne composition');
  const edit = renderer.root.findAllByType(Button).find(node => node.props.children === 'Modifier');
  act(() => edit.props.onClick());
  expect(selectRole('MID').props.value).toBe('ahri');
  expect(selectRole('TOP').props.value).toBe('');
  vi.unstubAllGlobals();
});
