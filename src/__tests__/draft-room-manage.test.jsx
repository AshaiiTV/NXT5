import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { DraftRoomWorkspace } from "../components/draft/LiveDraftRoom.jsx";
import { DraftArena } from "../components/draft/DraftArena.jsx";
import { Button } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));

const rooms = [
  { id: "11111111-1111-4111-8111-111111111111", blue_name: "Dombessat", red_name: "Arcane Horizon", game_number: 1, series_length: 4, step: 20, linked: 0 },
  { id: "22222222-2222-4222-8222-222222222222", blue_name: "Arcane Horizon", red_name: "Dombessat", game_number: 4, series_length: 4, step: 20, linked: 4 },
];
let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.clearAllMocks(); vi.unstubAllGlobals(); });
const body = call => JSON.parse(call[1].body);
const deleteButtons = () => renderer.root.findAll(node => node.type === "button" && String(node.props["aria-label"] || "").startsWith("Supprimer la salle"));

async function mount(canEdit = true) {
  apiFetch.mockImplementation(async (_path, options) => body([0, options]).action === "list" ? { rooms, canEdit } : { deleted: {} });
  await act(async () => { renderer = TestRenderer.create(<DraftRoomWorkspace teamId="team" teamName="Arcane Horizon" matches={[]} route={{ search: "" }} navigate={vi.fn()} />); });
}

describe("draft room deletion", () => {
  it("asks for confirmation, mentions linked games and removes only the confirmed room", async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("window", { confirm, location: { origin: "https://nxt5.org" } });
    await mount();
    expect(deleteButtons()).toHaveLength(2);
    expect(JSON.stringify(renderer.toJSON())).toContain("4 parties liées");

    await act(async () => deleteButtons()[1].props.onClick());
    expect(confirm.mock.calls[0][0]).toContain("4 partie(s) jouée(s)");
    expect(confirm.mock.calls[0][0]).toContain("Les 4 parties de la série");
    expect(apiFetch.mock.calls.filter(call => body(call).action === "delete")).toHaveLength(0);

    await act(async () => deleteButtons()[0].props.onClick());
    const deletion = apiFetch.mock.calls.find(call => body(call).action === "delete");
    expect(body(deletion)).toEqual({ action: "delete", teamId: "team", roomId: rooms[0].id });
    expect(deleteButtons()).toHaveLength(1);
    expect(renderer.root.findByProps({ role: "status" }).children.join("")).toContain("supprimée");
  });

  it("keeps the room and shows the error when the server refuses", async () => {
    vi.stubGlobal("window", { confirm: vi.fn(() => true), location: { origin: "https://nxt5.org" } });
    await mount();
    apiFetch.mockRejectedValueOnce(Object.assign(new Error("Accès à cette équipe refusé."), { status: 403 }));
    await act(async () => deleteButtons()[0].props.onClick());
    expect(deleteButtons()).toHaveLength(2);
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("refusé");
  });

  it("hides deletion from members who cannot edit", async () => {
    await mount(false);
    expect(deleteButtons()).toHaveLength(0);
  });
});

describe("draft correction after the game", () => {
  const names = ["Lissandra","Vi","Aatrox","JarvanIV","MonkeyKing","Taliyah","Neeko","XinZhao","Ezreal","Hwei","Amumu","Syndra","Olaf","Alistar","Kaisa","Trundle","Renekton","Malphite","Ashe","Bard"];
  const room = { firstPick: "blue", blueName: "Dombessat", redName: "Arcane Horizon", moves: names, blocked: [], turnSeconds: 0, side: "red", gameNumber: 1, seriesLength: 1 };
  const slots = () => renderer.root.findAll(node => node.type === "button" && node.props.className === "live-slot-edit");
  const button = label => renderer.root.findAllByType(Button).find(node => JSON.stringify(node.props.children ?? "").includes(label));
  function arena(edit) {
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    act(() => { renderer = TestRenderer.create(<DraftArena room={room} pending={false} recent={-1} onMove={vi.fn()} onStart={vi.fn()} onPrepareVoice={vi.fn()} edit={edit} />,
      { createNodeMock: () => ({ clientWidth: 640, clientHeight: 360, complete: false, getContext: () => null }) }); });
  }

  it("turns every slot of the board into a correction target and picks from the illustrated catalogue", () => {
    const edit = { moves: [...names], selected: 0, onSelect: vi.fn(), onChoose: vi.fn(), onCancel: vi.fn(), onSave: vi.fn() };
    arena(edit);
    expect(slots()).toHaveLength(20);
    expect(slots()[0].props["aria-label"]).toBe("Corriger Ban 1 · Dombessat : Lissandra");
    act(() => slots()[7].props.onClick());
    expect(edit.onSelect).toHaveBeenCalledWith(expect.any(Number));
    const catalogue = renderer.root.findAll(node => node.type === "button" && node.props["aria-label"] === "Jinx");
    expect(catalogue).toHaveLength(1);
    expect(renderer.root.findAll(node => node.type === "button" && node.props["aria-label"] === "Vi")).toHaveLength(0); // already used in another slot
    act(() => catalogue[0].props.onClick());
    expect(edit.onChoose).toHaveBeenCalledWith("Jinx");
    act(() => button("Ban non utilisé").props.onClick());
    expect(edit.onChoose).toHaveBeenLastCalledWith(null);
    expect(button("Enregistrer la correction").props.disabled).toBe(true);
  });

  it("counts the changed slots, offers to restore one and saves", () => {
    const moves = names.map((c,i) => i === 0 ? null : c);
    const edit = { moves, selected: 0, onSelect: vi.fn(), onChoose: vi.fn(), onCancel: vi.fn(), onSave: vi.fn() };
    arena(edit);
    expect(JSON.stringify(renderer.toJSON())).toContain("1 emplacement(s) modifié(s)");
    act(() => button("Rétablir").props.onClick());
    expect(edit.onChoose).toHaveBeenCalledWith("Lissandra");
    const save = button("correction(s)");
    expect(save.props.disabled).toBe(false);
    act(() => save.props.onClick());
    expect(edit.onSave).toHaveBeenCalledOnce();
  });
});
