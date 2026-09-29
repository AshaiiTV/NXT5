import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Statistics } from "../pages/workspace/GameWorkspace.jsx";
import { apiFetch } from "../api/client.js";
import { Button, TextInput } from "../components/ui/Core.jsx";
vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/routing.js", async original => ({ ...await original(), openAppPath: vi.fn() }));
let renderer;
beforeEach(() => { vi.stubGlobal("window", { location: new URL("https://nxt5.test/games?view=groups"), addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.resetAllMocks(); vi.unstubAllGlobals(); });
const button = label => renderer.root.findAllByType(Button).find(node => node.props.children === label);
async function mount(count) {
  const props = { data: { teams: [{ id: "team", owner_id: "u" }], matches: Array.from({ length: count }, (_, i) => ({ id: `m${i}`, team_id: "team", game_id: `game${i}`, participants: [] })) }, selectedTeamId: "team", user: { id: "u" }, refreshAll: vi.fn(), pushToast: vi.fn(), route: { path: "/games", search: "?view=groups" } };
  await act(async () => { renderer = TestRenderer.create(<Statistics {...props} />); });
  act(() => button("Créer un groupe").props.onClick());
  act(() => renderer.root.findAllByType(TextInput).find(node => node.props.label === "Nom du groupe").props.onChange("Scrim"));
  act(() => button(count > 80 ? "Sélectionner les 80 premières" : "Tout sélectionner").props.onClick());
  return props;
}
const submit = () => renderer.root.findByProps({ className: "games-group-form" }).props.onSubmit({ preventDefault() {} });
describe("B2 group creation", () => {
  it("keeps the created id and refreshes after a failed debrief, then updates rather than duplicates", async () => {
    const props = await mount(2);
    apiFetch.mockResolvedValueOnce({ archive: { id: "created" } }).mockRejectedValueOnce(new Error("Débrief indisponible"));
    await act(async () => submit());
    expect(props.pushToast).toHaveBeenCalledWith(expect.objectContaining({ text: "Groupe créé, débrief non généré : Débrief indisponible" }));
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(button("Enregistrer")).toBeTruthy();
    apiFetch.mockResolvedValueOnce({ archive: { id: "created" } });
    await act(async () => submit());
    const writes = apiFetch.mock.calls.filter(([path]) => path === "match-archives-manage").map(([, options]) => JSON.parse(options.body));
    expect(writes.map(body => body.action)).toEqual(["create", "update"]);
    expect(writes[1].archiveId).toBe("created");
    expect(props.refreshAll).toHaveBeenCalledTimes(2);
  });
  it.each([21, 81])("warns before creating a group of %s games and caps selection at 80", async count => {
    await mount(count);
    expect(JSON.stringify(renderer.toJSON())).toContain("il sera créé sans débrief automatique");
    const boxes = renderer.root.findAllByProps({ type: "checkbox" });
    expect(boxes.filter(node => node.props.checked)).toHaveLength(Math.min(count, 80));
    if (count > 80) expect(boxes.filter(node => !node.props.checked).every(node => node.props.disabled)).toBe(true);
    apiFetch.mockResolvedValueOnce({ archive: { id: "created" } });
    await act(async () => submit());
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).matchIds).toHaveLength(Math.min(count, 80));
  });
  it("refreshes and preserves the form when group creation fails", async () => {
    const props = await mount(1); apiFetch.mockRejectedValueOnce(new Error("Réseau"));
    await act(async () => submit());
    expect(props.refreshAll).toHaveBeenCalledOnce();
    expect(button("Créer le groupe")).toBeTruthy();
  });
});
