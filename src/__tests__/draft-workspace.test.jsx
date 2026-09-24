import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button, SelectInput, TextInput } from "../components/ui/Core.jsx";
import { Champions, Compositions, CompositionSlot } from "../pages/workspace/DraftWorkspace.jsx";

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
  it("selects only a champion declared for the chosen player and role", () => {
    const onChange = vi.fn();
    render(<CompositionSlot role="TOP" slot={{ playerId: "top", poolId: "" }} players={players} rows={rows} onChange={onChange} />);
    const picker = selectRole("TOP");
    expect(picker.findAllByType("option").map((node) => node.props.value)).toEqual(["", "aatrox"]);
    act(() => picker.findByType("select").props.onChange({ target: { value: "aatrox" } }));
    expect(onChange).toHaveBeenCalledWith("TOP", { playerId: "top", poolId: "aatrox" });
    const substitute = renderer.root.findAllByType("button").find((node) => node.props.children === "Remplaçant");
    act(() => substitute.props.onClick());
    expect(onChange).toHaveBeenLastCalledWith("TOP", { playerId: "sub", poolId: "" });
  });

  it("explains a missing list and disables the selector without selecting another player’s champions", () => {
    render(<CompositionSlot role="SUP" slot={{}} players={players} rows={rows} onChange={vi.fn()} />);
    expect(selectRole("SUP").props.disabled).toBe(true);
    expect(selectRole("SUP").findAllByType("option").map((node) => node.props.value)).toEqual([""]);
  });

  it("keeps draft choices when the glossary opens and saves the same composition payload", async () => {
    apiFetch.mockResolvedValue({});
    const refreshAll = vi.fn(async () => {});
    render(<Compositions data={{ players, championPool: rows, compositions: [] }} selectedTeamId="team" currentMember={{ role: "player" }} user={{ id: "user" }} refreshAll={refreshAll} pushToast={vi.fn()} />);
    act(() => renderer.root.findByType(TextInput).props.onChange("Notre composition"));
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
