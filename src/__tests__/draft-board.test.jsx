import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import DraftBoard from "../components/draft/DraftBoard.jsx";
import { canonicalChampion, championDisplayName } from "../../shared/champions.js";

vi.mock("../pages/workspace/workspace-shared.jsx", () => ({
  ChampionPortrait: ({ champion, alt }) => <img alt={alt || champion} data-champion={champion} />,
  ChampionBackdrop: ({ champion, alt }) => <img alt={alt || champion} data-champion={champion} />,
  championDisplayName: champion => champion,
}));

const snapshot = {
  source: "drafter.lol", status: "completed", sourceId: "board-series", sourceDraftId: "board-source-1", gameNumber: 1,
  sourceUrl: "https://drafter.lol/draft/board-series?game=1", blueName: "Notre équipe fictive", redName: "Adversaire fictif", firstPick: "blue",
  bluePicks: ["Aatrox", "Zeri", "Braum", "DrMundo", "Ahri"], redPicks: ["Yunara", "Lulu", "Anivia", "Kennen", "Maokai"],
  blueBans: ["Jhin", "Khazix", "JarvanIV", "Gnar", "Sylas"], redBans: ["MonkeyKing", "Poppy", "Thresh", "Syndra", "Diana"],
  orderEvidence: { version: 1, basis: "reconstructed-public-slots", format: "standard-20", firstPick: "blue", reason: "public-slot-fields-v1" },
};
const allChampions = [...snapshot.bluePicks, ...snapshot.redPicks, ...snapshot.blueBans, ...snapshot.redBans];
let renderer;
function text(node = renderer.root) { return node.children.map(child => typeof child === "string" ? child : text(child)).join(""); }
function range() { return renderer.root.findByProps({ type: "range" }); }
function button(label) {
  const target = renderer.root.findAllByType("button").find(node => node.props["aria-label"] === label || text(node) === label);
  expect(target, `Button “${label}” should be available`).toBeDefined();
  return target;
}
function click(label) { act(() => button(label).props.onClick()); }
function seek(step) { act(() => range().props.onChange({ target: { value: String(step) } })); }
function displayedChampions() {
  return new Set(renderer.root.findAllByType("img").map(node => {
    if (node.props["data-champion"]) return canonicalChampion(node.props["data-champion"]);
    const image = new URL(node.props.src || "", "https://local.invalid");
    return image.searchParams.get("url")?.match(/\/([^/]+)_0\.jpg$/)?.[1];
  }).filter(Boolean));
}
function expectRevealed(champions) {
  expect([...displayedChampions()].sort()).toEqual(champions.map(canonicalChampion).sort());
  const accessibleText = text() + renderer.root.findAll(node => typeof node.type === "string")
    .map(node => `${node.props["aria-label"] || ""} ${node.props.title || ""}`).join(" ");
  for (const champion of allChampions.filter(champion => !champions.includes(champion))) {
    expect(accessibleText).not.toContain(championDisplayName(champion));
  }
}
async function mount(props = {}) {
  await act(async () => { renderer = TestRenderer.create(<DraftBoard snapshot={snapshot} allySide="blue" {...props} />); });
}
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; vi.clearAllMocks(); });

describe("visual draft board", () => {
  it("starts with both final compositions and all known bans", async () => {
    await mount();
    expect(text()).toContain(snapshot.blueName); expect(text()).toContain(snapshot.redName);
    expect(text(renderer.root.findAllByType("label").find(label => label.findAllByProps({ type: "range" }).length))).toContain("Étape de la draft");
    expect(Number(range().props.min)).toBe(0); expect(Number(range().props.max)).toBe(20);
    expect(Number(range().props.value)).toBe(20);
    expectRevealed(allChampions);
    expect(button("Étape suivante").props.disabled).toBe(true);
  });

  it("can restart, advance and step back without revealing future champions", async () => {
    await mount(); click("Revoir depuis le début");
    expect(Number(range().props.value)).toBe(0);
    expectRevealed([]);
    expect(button("Étape précédente").props.disabled).toBe(true);
    click("Étape suivante");
    expect(Number(range().props.value)).toBe(1);
    expectRevealed(["Jhin"]);
    click("Étape précédente");
    expect(Number(range().props.value)).toBe(0);
    expectRevealed([]);
  });

  it("reveals bans, opening picks and later picks in the verified 20-slot order", async () => {
    await mount();
    const initialBans = [...snapshot.blueBans.slice(0, 3), ...snapshot.redBans.slice(0, 3)];
    seek(6); expectRevealed(initialBans);
    seek(7); expectRevealed([...initialBans, "Aatrox"]);
    seek(8); expectRevealed([...initialBans, "Aatrox", "Yunara"]);
    const firstPhase = [...initialBans, ...snapshot.bluePicks.slice(0, 3), ...snapshot.redPicks.slice(0, 3)];
    seek(12); expectRevealed(firstPhase);
    seek(13); expectRevealed([...firstPhase, "Syndra"]);
    const allBans = [...snapshot.blueBans, ...snapshot.redBans];
    seek(16); expectRevealed([...allBans, ...snapshot.bluePicks.slice(0, 3), ...snapshot.redPicks.slice(0, 3)]);
    seek(17); expectRevealed([...allBans, ...snapshot.bluePicks.slice(0, 3), ...snapshot.redPicks.slice(0, 4)]);
    click("Voir la draft finale");
    expect(Number(range().props.value)).toBe(20); expectRevealed(allChampions);
  });

  it("mirrors the full sequence when the red side selects first", async () => {
    await mount({ allySide: "red", snapshot: { ...snapshot, firstPick: "red", orderEvidence: { ...snapshot.orderEvidence, firstPick: "red" } } });
    click("Revoir depuis le début"); click("Étape suivante");
    expectRevealed(["MonkeyKing"]);
    const initialBans = [...snapshot.blueBans.slice(0, 3), ...snapshot.redBans.slice(0, 3)];
    seek(7); expectRevealed([...initialBans, "Yunara"]);
    seek(8); expectRevealed([...initialBans, "Yunara", "Aatrox"]);
  });

  it("resets a newly selected draft to its final state", async () => {
    await mount(); seek(7);
    const nextSnapshot = { ...snapshot, sourceDraftId: "board-source-2", sourceId: "board-series-2", gameNumber: 2, blueName: "Nouvelle équipe fictive" };
    await act(async () => { renderer.update(<DraftBoard snapshot={nextSnapshot} allySide="blue" />); });
    expect(Number(range().props.value)).toBe(20);
    expect(text()).toContain("Nouvelle équipe fictive");
    expectRevealed(allChampions);
  });

  it("keeps a legacy final board visible without creating an unverified replay", async () => {
    await mount({ snapshot: { ...snapshot, orderEvidence: undefined } });
    expectRevealed(allChampions);
    expect(renderer.root.findAllByProps({ type: "range" })).toHaveLength(0);
    expect(renderer.root.findAllByType("button").filter(node => text(node) === "Revoir depuis le début")).toHaveLength(0);
  });

  it("distinguishes skipped and unknown bans only once their slots are reached", async () => {
    const partial = {
      ...snapshot,
      blueBans: [null, ...snapshot.blueBans.slice(1)],
      redBans: [snapshot.redBans[0], null, ...snapshot.redBans.slice(2)],
      banStates: { blue: ["skipped", "selected", "selected", "selected", "selected"], red: ["selected", "unknown", "selected", "selected", "selected"] },
    };
    await mount({ snapshot: partial });
    expect(text()).toContain("Ban non utilisé"); expect(text()).toContain("Non renseigné");
    expectRevealed(allChampions.filter(champion => !["Jhin", "Poppy"].includes(champion)));
    click("Revoir depuis le début");
    expect(text()).not.toContain("Ban non utilisé"); expect(text()).not.toContain("Non renseigné");
    click("Étape suivante");
    expect(text()).toContain("Ban non utilisé"); expect(text()).not.toContain("Non renseigné");
    seek(4);
    expect(text()).toContain("Ban non utilisé"); expect(text()).toContain("Non renseigné");
    expectRevealed(["MonkeyKing", "Khazix"]);
  });

  it("shows an incomplete final composition without claiming a replay or a champion for the empty slot", async () => {
    await mount({ snapshot: { ...snapshot, bluePicks: [...snapshot.bluePicks.slice(0, 4), null] } });
    expectRevealed(allChampions.filter(champion => champion !== "Ahri"));
    expect(text()).toContain("Non renseigné");
    expect(text()).toContain("Ordre non vérifié");
    expect(renderer.root.findAllByProps({ type: "range" })).toHaveLength(0);
  });

  it("lets a direct timeline choice reveal that exact event and recover the final board", async () => {
    await mount(); click("Revoir depuis le début");
    const timeline = renderer.root.findByProps({ "aria-label": "Accès direct aux étapes de la draft" });
    const event = timeline.findAllByType("button").find(node => node.props["aria-label"].startsWith("Étape 7 :"));
    expect(event.props["aria-label"]).toContain("À révéler");
    act(() => event.props.onClick());
    expect(Number(range().props.value)).toBe(7);
    expectRevealed([...snapshot.blueBans.slice(0, 3), ...snapshot.redBans.slice(0, 3), "Aatrox"]);
    click("Voir la draft finale"); expectRevealed(allChampions);
  });

  it("falls back to the champion portrait when a splash cannot load", async () => {
    await mount();
    const splash = renderer.root.findAllByType("img").find(node => node.props.src?.includes("Aatrox_0.jpg"));
    expect(splash).toBeDefined();
    act(() => splash.props.onError());
    expect(renderer.root.findAllByType("img").some(node => node.props["data-champion"] === "Aatrox")).toBe(true);
    expectRevealed(allChampions);
  });
});
