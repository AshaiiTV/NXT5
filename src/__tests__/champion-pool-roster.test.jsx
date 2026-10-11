import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Champions } from "../pages/workspace/DraftWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));

const player = (id, role, roster_status = "MAIN", extra = {}) => ({
  id, team_id: "team", name: id, role, roster_status, ...extra,
});
const top = player("Top titulaire", "TOP");
const substitute = player("Top remplaçant", "TOP", "SUB", { user_id: "sub-user" });
const inactive = player("Ancien top", "TOP", "INACTIVE");
const flex = player("Remplaçant polyvalent", "SUB");
let renderer;
let props;
let nativeDetails;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
});

function mount(players, overrides = {}) {
  nativeDetails = [];
  props = {
    data: { teams: [{ id: "team" }, { id: "second" }], players, championPool: [] },
    selectedTeamId: "team",
    currentMember: { role: "coach" },
    user: { id: "coach-user" },
    pushToast: vi.fn(),
    ...overrides,
  };
  act(() => {
    renderer = TestRenderer.create(<Champions {...props} />, {
      createNodeMock(element) {
        if (element.type !== "details") return null;
        const details = { open: Boolean(element.props.open) };
        nativeDetails.push(details);
        return details;
      },
    });
  });
}

function update(overrides) {
  props = { ...props, ...overrides };
  act(() => renderer.update(<Champions {...props} />));
}

function playerButtons(container = renderer.root) {
  return container.findAll((node) => node.type === "button" && node.props.className === "nxt5-pool-player");
}

function name(button) {
  return button.findByProps({ className: "nxt5-pool-player-name" }).children.join("");
}

function namesIn(className) {
  return renderer.root.findAllByProps({ className }).flatMap((container) => playerButtons(container).map(name));
}

function selectedName() {
  return playerButtons().filter((button) => button.props["aria-pressed"]).map(name);
}

function choose(playerName) {
  act(() => playerButtons().find((button) => name(button) === playerName).props.onClick());
}

function text(node) {
  return node.children.map((child) => typeof child === "string" ? child : text(child)).join("");
}

describe("champion pool roster selection", () => {
  it("shows one starter per lane in lane order and keeps other profiles behind a closed disclosure", () => {
    const players = [
      substitute, inactive, player("Support titulaire", "SUP"), top,
      player("ADC titulaire", "ADC"), player("Mid titulaire", "MID"),
      player("Jungle titulaire", "JGL"), flex,
      player("Coach", "COACH"), player("Joueur autre équipe", "TOP", "MAIN", { team_id: "second" }),
    ];
    mount(players, { data: { teams: [{ id: "team" }], players, championPool: [
      { id: "aatrox", team_id: "team", player_id: top.id, champion: "Aatrox", source: "manual", status: "lock" },
      { id: "foreign", team_id: "second", player_id: top.id, champion: "Ornn", source: "manual", status: "lock" },
    ] } });

    expect(namesIn("nxt5-pool-roster")).toEqual(["Top titulaire", "Jungle titulaire", "Mid titulaire", "ADC titulaire", "Support titulaire"]);
    expect(namesIn("nxt5-pool-other-grid")).toEqual(expect.arrayContaining([substitute.name, inactive.name, flex.name]));
    expect(namesIn("nxt5-pool-other-grid")).toHaveLength(3);
    expect(playerButtons().map(name)).not.toContain("Coach");
    expect(playerButtons().map(name)).not.toContain("Joueur autre équipe");
    expect(selectedName()).toEqual([top.name]);
    expect(renderer.root.findByProps({ className: "nxt5-pool-other-players" }).props.open).toBeFalsy();
    expect(nativeDetails.at(-1).open).toBe(false);
    expect(playerButtons().find((button) => name(button) === top.name).findByProps({ className: "nxt5-pool-player-count" }).children).toEqual(["1"]);
  });

  it("keeps the first legacy main per lane and places duplicate mains among the other profiles", () => {
    const legacy = { id: "legacy-top", team_id: "team", name: "Z ancien titulaire", role: "TOP" };
    const duplicate = { id: "duplicate-top", team_id: "team", name: "A autre profil", role: "TOP" };
    const camelCaseSub = { id: "camel-sub", team_id: "team", name: "Sub camelCase", role: "MID", rosterStatus: "SUB" };
    mount([legacy, duplicate, camelCaseSub]);

    expect(namesIn("nxt5-pool-roster")).toEqual([legacy.name]);
    expect(namesIn("nxt5-pool-other-grid")).toEqual(expect.arrayContaining([duplicate.name, camelCaseSub.name]));
    expect(selectedName()).toEqual([legacy.name]);
  });

  it("opens other profiles for the linked substitute and identifies substitute and inactive statuses", () => {
    mount([top, substitute, inactive, flex], { currentMember: { role: "player" }, user: { id: "sub-user" } });

    expect(selectedName()).toEqual([substitute.name]);
    expect(nativeDetails.at(-1).open).toBe(true);
    expect(text(playerButtons().find((button) => name(button) === substitute.name))).toContain("Remplaçant");
    expect(text(playerButtons().find((button) => name(button) === inactive.name))).toContain("Hors effectif actif");
    expect(namesIn("nxt5-pool-roster")).toEqual([top.name]);
  });

  it("edits the chosen substitute pool without changing the main player's identity", async () => {
    mount([top, substitute]);
    choose(substitute.name);
    apiFetch.mockResolvedValue({ pick: {
      id: "sub-ornn", team_id: "team", player_id: substitute.id, player_name: substitute.name,
      role: "TOP", champion: "Ornn", status: "work", source: "manual",
    } });

    await act(async () => renderer.root.findByProps({ "aria-label": "Classer Ornn" }).props.onChange({ target: { value: "work" } }));

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0][0]).toBe("champion-pool-manual");
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ teamId: "team", playerId: substitute.id, champion: "Ornn", status: "work" });
    expect(selectedName()).toEqual([substitute.name]);
    expect(playerButtons().find((button) => name(button) === top.name).findByProps({ className: "nxt5-pool-player-count" }).children).toEqual(["0"]);
  });

  it("resets selection and closes the disclosure when changing to another team's starter", () => {
    const secondMain = player("Second titulaire", "MID", "MAIN", { team_id: "second" });
    const secondSub = player("Second remplaçant", "MID", "SUB", { team_id: "second" });
    mount([substitute, top, secondSub, secondMain]);
    choose(substitute.name);
    expect(nativeDetails.at(-1).open).toBe(true);

    update({ selectedTeamId: "second" });

    expect(selectedName()).toEqual([secondMain.name]);
    expect(namesIn("nxt5-pool-roster")).toEqual([secondMain.name]);
    expect(namesIn("nxt5-pool-other-grid")).toEqual([secondSub.name]);
    expect(nativeDetails.at(-1).open).toBe(false);
  });

  it("keeps a valid selection visible when its roster status is demoted", () => {
    mount([top, substitute]);
    expect(selectedName()).toEqual([top.name]);

    update({ data: { ...props.data, players: [{ ...top, roster_status: "SUB" }, { ...substitute, roster_status: "MAIN" }] } });

    expect(namesIn("nxt5-pool-roster")).toEqual([substitute.name]);
    expect(selectedName()).toEqual([top.name]);
    expect(namesIn("nxt5-pool-other-grid")).toEqual([top.name]);
    expect(nativeDetails.at(-1).open).toBe(true);
  });

  it("selects an active substitute when no starter exists, then retains access to inactive-only rosters", () => {
    mount([inactive, substitute, flex]);
    expect(namesIn("nxt5-pool-roster")).toEqual([]);
    expect(selectedName()).toEqual([substitute.name]);
    expect(nativeDetails.at(-1).open).toBe(true);

    update({ data: { ...props.data, players: [inactive] } });

    expect(selectedName()).toEqual([inactive.name]);
    expect(namesIn("nxt5-pool-other-grid")).toEqual([inactive.name]);
    expect(nativeDetails.at(-1).open).toBe(true);
  });

  it("falls back to a starter when the selected profile disappears", () => {
    mount([substitute, top, player("Mid titulaire", "MID")]);
    choose(substitute.name);

    update({ data: { ...props.data, players: props.data.players.filter((row) => row.id !== substitute.id) } });

    expect(selectedName()).toEqual([top.name]);
    expect(renderer.root.findAllByProps({ className: "nxt5-pool-other-players" })).toHaveLength(0);
  });
});
