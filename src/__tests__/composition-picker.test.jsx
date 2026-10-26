import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextInput } from "../components/ui/Core.jsx";
import { CompositionChampionBank, CompositionChampionTile } from "../pages/workspace/DraftWorkspace.jsx";
import { setLanguage } from "../i18n/locale.js";

const players = [
  { id: "top", name: "Titulaire", role: "TOP" },
  { id: "sub", name: "Remplaçant", role: "TOP" },
  { id: "mid", name: "Midlaner", role: "MID" },
  { id: "jungle", name: "Jungler", role: "JGL" },
  { id: "adc", name: "Tireur", role: "ADC" },
  { id: "support", name: "Support", role: "SUP" },
];
const poolRow = (id, champion, status, player = players[0], role = player.role) => ({
  id, champion, status, player_id: player.id, player_name: player.name, role, source: "manual",
});
const rows = [
  poolRow("aatrox", "Aatrox", "lock"),
  poolRow("camille", "Camille", "pocket"),
  poolRow("fiora", "Fiora", "pocket"),
  poolRow("gwen", "Gwen", "work"),
  poolRow("darius", "Darius", "danger"),
  poolRow("ornn", "Ornn", "lock", players[1]),
  poolRow("ahri", "Ahri", "lock", players[2]),
  poolRow("syndra", "Syndra", "work", players[2]),
  poolRow("mid-aatrox", "Aatrox", "pocket", players[2]),
  poolRow("sejuani", "Sejuani", "lock", players[3]),
  poolRow("jinx", "Jinx", "lock", players[4]),
  poolRow("lulu", "Lulu", "lock", players[5]),
  poolRow("wrong-role", "Pantheon", "lock", players[0], "MID"),
];
const slots = {
  TOP: { playerId: "top", poolId: "aatrox" },
  JGL: { playerId: "jungle", poolId: "sejuani" },
  MID: { playerId: "mid", poolId: "ahri" },
  ADC: { playerId: "adc", poolId: "jinx" },
  SUP: { playerId: "support", poolId: "lulu" },
};
const allRowIds = ["aatrox", "camille", "fiora", "gwen", "darius", "ahri", "syndra", "mid-aatrox", "sejuani", "jinx", "lulu"].sort();
let renderer;
beforeEach(() => setLanguage("fr"));
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; });
const text = node => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const mount = props => act(() => { renderer = TestRenderer.create(<CompositionChampionBank players={players} rows={rows} slots={slots} {...props} />); });
const update = props => act(() => renderer.update(<CompositionChampionBank players={players} rows={rows} slots={slots} {...props} />));
const buttons = () => renderer.root.findAllByType("button");
const filterButton = label => buttons().find(node => text(node).startsWith(label));
const tiles = () => renderer.root.findAllByType(CompositionChampionTile);
const rowIds = () => tiles().map(node => node.props.row.id).sort();
const tileButton = rowId => tiles().find(node => node.props.row.id === rowId).findByType("button");
const search = () => renderer.root.findAllByType(TextInput).find(node => node.props.label === "Rechercher un champion");
const click = node => act(() => node.props.onClick());
const query = value => act(() => search().props.onChange(value));

describe("simultaneous team composition picker", () => {
  it("shows all five selected players' pools together and excludes substitutes and wrong-role rows", () => {
    const onPick = vi.fn();
    mount({ onPick });
    expect(rowIds()).toEqual(allRowIds);
    expect(filterButton("Tous les niveaux").props["aria-pressed"]).toBe(true);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
    for (const role of ["TOP", "JGL", "MID", "ADC", "SUP"]) {
      const column = renderer.root.findByProps({ "data-role": role });
      expect(column.props["aria-label"]).toContain(role);
      expect(column.findAllByType(CompositionChampionTile).length).toBeGreaterThan(0);
    }
    for (const id of ["aatrox", "sejuani", "ahri", "jinx", "lulu"]) expect(tileButton(id).props["aria-pressed"]).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("chooses a MID portrait immediately without switching away from TOP or hiding other players", () => {
    const onPick = vi.fn();
    mount({ onPick, activeRole: "TOP" });
    click(tileButton("syndra"));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("MID", { playerId: "mid", poolId: "syndra" });
    update({ onPick, activeRole: "MID", slots: { ...slots, MID: { playerId: "mid", poolId: "syndra" } } });
    expect(rowIds()).toEqual(allRowIds);
    expect(tileButton("syndra").props["aria-pressed"]).toBe(true);
    expect(tileButton("aatrox").props["aria-pressed"]).toBe(true);
  });

  it("applies search and mastery globally while keeping same-champion rows assigned to their own players", () => {
    const onPick = vi.fn();
    mount({ onPick });
    query("AATROX");
    expect(rowIds()).toEqual(["aatrox", "mid-aatrox"]);
    click(filterButton("Situationnel"));
    expect(rowIds()).toEqual(["mid-aatrox"]);
    expect(onPick).not.toHaveBeenCalled();
    click(tileButton("mid-aatrox"));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("MID", { playerId: "mid", poolId: "mid-aatrox" });
  });

  it("keeps both identical champion portraits independently selectable and selected", () => {
    const onPick = vi.fn();
    mount({ onPick });
    click(tileButton("aatrox"));
    // Native buttons dispatch click for Enter/Space with detail === 0.
    act(() => tileButton("mid-aatrox").props.onClick({ detail: 0 }));
    expect(onPick.mock.calls).toEqual([
      ["TOP", { playerId: "top", poolId: "aatrox" }],
      ["MID", { playerId: "mid", poolId: "mid-aatrox" }],
    ]);
    update({ onPick, slots: { ...slots, MID: { playerId: "mid", poolId: "mid-aatrox" } } });
    expect(tileButton("aatrox").props["aria-pressed"]).toBe(true);
    expect(tileButton("mid-aatrox").props["aria-pressed"]).toBe(true);
    expect(tileButton("ahri").props["aria-pressed"]).toBe(false);
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    act(() => tileButton("mid-aatrox").props.onDragStart({ dataTransfer }));
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/json", JSON.stringify({ role: "MID", playerId: "mid", poolId: "mid-aatrox" }));
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  it("clears empty global filters without changing any composition selection", () => {
    const onPick = vi.fn();
    mount({ onPick });
    click(filterButton("Confiance"));
    query("introuvable");
    expect(rowIds()).toEqual([]);
    const reset = filterButton("Réinitialiser les filtres");
    expect(reset.props.type).toBe("button");
    click(reset);
    expect(search().props.value).toBe("");
    expect(filterButton("Tous les niveaux").props["aria-pressed"]).toBe(true);
    expect(rowIds()).toEqual(allRowIds);
    for (const id of ["aatrox", "sejuani", "ahri", "jinx", "lulu"]) expect(tileButton(id).props["aria-pressed"]).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("prevents Enter in search from submitting the composition while keeping other keys native", () => {
    const onPick = vi.fn();
    mount({ onPick });
    query("Aatrox");
    const input = search().findByType("input");
    const preventDefault = vi.fn();
    act(() => input.props.onKeyDown({ key: "Enter", preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
    const nativeKey = vi.fn();
    act(() => input.props.onKeyDown({ key: "ArrowLeft", preventDefault: nativeKey }));
    expect(nativeKey).not.toHaveBeenCalled();
    expect(rowIds()).toEqual(["aatrox", "mid-aatrox"]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("retains global filters across external role highlights without hiding another role's matching champions", () => {
    const onPick = vi.fn();
    const onRoleChange = vi.fn();
    mount({ onPick, activeRole: "TOP", onRoleChange });
    click(filterButton("Situationnel"));
    query("Aatrox");
    expect(rowIds()).toEqual(["mid-aatrox"]);
    for (const activeRole of ["MID", "SUP", "TOP"]) {
      update({ onPick, activeRole, onRoleChange });
      expect(rowIds()).toEqual(["mid-aatrox"]);
      expect(search().props.value).toBe("Aatrox");
      expect(filterButton("Situationnel").props["aria-pressed"]).toBe(true);
    }
    expect(onPick).not.toHaveBeenCalled();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("changes only the TOP player's available pool when choosing a substitute and retains shared filters", () => {
    const onPick = vi.fn();
    mount({ onPick });
    query("Ornn");
    expect(rowIds()).toEqual([]);
    const substituteSlots = { ...slots, TOP: { playerId: "sub", poolId: "" } };
    update({ onPick, slots: substituteSlots });
    expect(search().props.value).toBe("Ornn");
    expect(rowIds()).toEqual(["ornn"]);
    query("");
    expect(rowIds()).toEqual(["ornn", "ahri", "syndra", "mid-aatrox", "sejuani", "jinx", "lulu"].sort());
    expect(tileButton("ahri").props["aria-pressed"]).toBe(true);
    click(tileButton("ornn"));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("TOP", { playerId: "sub", poolId: "ornn" });
  });

  it("leaves a missing player's pool empty while retaining every other player's portraits", () => {
    const onPick = vi.fn();
    mount({ onPick, players: players.filter(player => player.role !== "SUP") });
    expect(rowIds()).toEqual(allRowIds.filter(id => id !== "lulu"));
    expect(renderer.root.findByProps({ "data-role": "SUP" }).findAllByType(CompositionChampionTile)).toHaveLength(0);
    expect(buttons().every(node => node.props.type === "button")).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("keeps a selected mastery filter visible when a substitute removes its last champion", () => {
    const onPick = vi.fn();
    mount({ onPick });
    click(filterButton("Entraînement"));
    expect(rowIds()).toEqual(["darius"]);
    update({ onPick, slots: { ...slots, TOP: { playerId: "sub", poolId: "" } } });
    expect(rowIds()).toEqual([]);
    expect(filterButton("Entraînement").props["aria-pressed"]).toBe(true);
    expect(text(filterButton("Entraînement"))).toContain("0");
    expect(filterButton("Tous les niveaux").props["aria-pressed"]).toBe(false);
    click(filterButton("Réinitialiser les filtres"));
    expect(rowIds()).toEqual(["ornn", "ahri", "syndra", "mid-aatrox", "sejuani", "jinx", "lulu"].sort());
    expect(tileButton("ahri").props["aria-pressed"]).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
  });
});
