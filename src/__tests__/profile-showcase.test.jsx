import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileShowcase } from "../components/profile/ProfileShowcase.jsx";
import { ProfileNavigation } from "../pages/workspace/ProfileNavigation.jsx";
import { PlayerUltimateProfile } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { profilePathFromView, profileViewFromPath } from "../app/routing.js";
import { loadProfileShowcaseAssets } from "../utils/profile-showcase-canvas.js";
import { pngDownloadPages } from "../utils/png-report.js";

vi.mock("../utils/profile-showcase-canvas.js", () => ({ drawProfileShowcase: vi.fn(), loadProfileShowcaseAssets: vi.fn() }));
vi.mock("../utils/png-report.js", async (importOriginal) => ({ ...await importOriginal(), pngDownloadPages: vi.fn() }));
vi.mock("../components/ui/ModalDialog.jsx", () => ({ ModalDialog: ({ children, onClose, ...props }) => <dialog aria-label={props["aria-labelledby"]} onClose={onClose}>{children}</dialog> }));
let renderer;
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const button = (label) => renderer.root.findAllByType("button").find((node) => text(node) === label);
const player = { id: "p1", name: "Nova", role: "ADC" };
const rows = Array.from({ length: 6 }, (_, i) => ({ champion: i === 5 ? "KaiSa" : "Jhin", kills: i === 5 ? 15 : 3, deaths: 1, assists: 5, cs_per_min: 7 + i / 5, kill_participation: 0.7, match: { id: `m${i}`, result: i === 1 ? "Défaite" : "Victoire", game_date: `2026-10-0${i + 1}T12:00:00Z`, duration_seconds: 1800 } }));
const props = { player, rows, teamName: "Astral", category: "Tournoi", teammates: [player] };
const canvas = { width: 1080, height: 1620, getContext: () => ({ drawImage: vi.fn() }) };
const focusControl = vi.fn();
const mount = async (element = <ProfileShowcase {...props} />) => act(async () => { renderer = TestRenderer.create(element, { createNodeMock: (node) => node.type === "canvas" ? canvas : node.type === "button" ? { focus: () => focusControl(node.props["aria-label"]) } : null }); });

beforeEach(() => {
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, createElement: vi.fn(() => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) })) });
  vi.mocked(loadProfileShowcaseAssets).mockResolvedValue({ art: { width: 100, height: 100 }, logo: null, mark: null });
  vi.mocked(pngDownloadPages).mockResolvedValue(undefined);
});
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("player card and Wrapped", () => {
  it("scopes the actual profile card to the selected player and category", async () => {
    vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil/carte?player=p1") });
    const players = [{ ...player, team_id: "t1" }, { id: "p2", team_id: "t1", name: "Lumen", role: "SUP" }];
    const matches = rows.map((row, index) => ({ ...row.match, team_id: "t1", category_ids: [index < 3 ? "early" : "late"], participants: [{ ...row, player_id: "p1", team_key: "ALLY", role: "ADC" }, { ...row, champion: "Braum", player_id: "p2", team_key: "ALLY", role: "SUP" }] }));
    await mount(<PlayerUltimateProfile data={{ players, matches, teams: [{ id: "t1", name: "Astral" }], matchCategories: [{ id: "early", team_id: "t1", name: "Début" }] }} selectedTeamId="t1" user={{ id: "reader" }} route={{ path: "/mon-profil/carte", search: "?player=p1" }} navigate={vi.fn()} />);
    expect(renderer.root.findByType("canvas").props["aria-label"]).toContain("6 parties");
    const selects = renderer.root.findAllByType(SelectInput);
    await act(async () => selects.find((node) => node.props.label === "Catégorie").props.onChange("early"));
    expect(renderer.root.findByType("canvas").props["aria-label"]).toContain("Début");
    expect(renderer.root.findByType("canvas").props["aria-label"]).toContain("3 parties");
    await act(async () => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Joueur").props.onChange("p2"));
    expect(renderer.root.findByType("canvas").props["aria-label"]).toContain("Lumen, Astral");
    expect(loadProfileShowcaseAssets).toHaveBeenLastCalledWith("Braum");
  });

  it("keeps the default profile and offers a routed, keyboard reachable sixth section", async () => {
    expect(profileViewFromPath("/mon-profil")).toBe("overview");
    expect(profileViewFromPath("/mon-profil/carte")).toBe("showcase");
    expect(profilePathFromView("showcase")).toBe("/mon-profil/carte");
    const change = vi.fn();
    await mount(<ProfileNavigation activeId="showcase" onChange={change} />);
    const tab = renderer.root.findByProps({ id: "profile-tab-showcase" });
    expect(tab.props["aria-selected"]).toBe(true);
    expect(tab.props.tabIndex).toBe(0);
    expect(text(tab)).toContain("Carte & Wrapped");
  });

  it("uses current player and category data, flips the card and exports exactly the visible face", async () => {
    await mount();
    expect(text(renderer.toJSON())).toContain("Tournoi");
    expect(renderer.root.findByType("canvas").props["aria-label"]).toContain("Nova, Astral");
    await act(async () => button("Voir le verso").props.onClick());
    expect(button("Voir le recto")).toBeTruthy();
    await act(async () => button("Exporter le verso").props.onClick());
    const [canvases, filename] = vi.mocked(pngDownloadPages).mock.calls[0];
    expect(canvases).toHaveLength(1);
    expect(canvases[0]).not.toBe(canvas);
    expect(canvases[0]).toMatchObject({ width: 1080, height: 1620 });
    expect(filename).toBe("nxt5-nova-carte-verso.png");
    expect(text(renderer.toJSON())).toContain("téléchargé en PNG");
  });

  it("navigates every chapter, uses the highlight champion and preserves its source link", async () => {
    await mount();
    await act(async () => button("Découvrir le Wrapped").props.onClick());
    expect(button("Précédent").props.disabled).toBe(true);
    await act(async () => button("Suivant").props.onClick());
    await act(async () => button("Suivant").props.onClick());
    expect(loadProfileShowcaseAssets).toHaveBeenLastCalledWith("Kaisa");
    const link = renderer.root.findByType("a");
    expect(link.props.href).toBe("/games?match=m5");
    await act(async () => button("Suivant").props.onClick());
    await act(async () => button("Suivant").props.onClick());
    expect(text(renderer.toJSON())).toContain("Avec Astral.");
    await act(async () => button("Revoir le bilan").props.onClick());
    expect(button("Précédent").props.disabled).toBe(true);
  });

  it("keeps chapter controls with the artwork and moves their keyboard focus without global shortcuts", async () => {
    await mount();
    await act(async () => button("Découvrir le Wrapped").props.onClick());
    const chapterButton = (index) => renderer.root.findAllByType("button").find((node) => node.props["aria-label"]?.startsWith(`Chapitre ${index + 1} :`));
    const figure = renderer.root.findByType("figure");
    expect(figure.findByProps({ "aria-label": "Chapitres du Wrapped" })).toBeTruthy();
    expect(figure.props.onKeyDown).toBeUndefined();
    expect(figure.findAllByType("button").some((node) => text(node) === "Suivant")).toBe(true);
    const preventDefault = vi.fn();
    await act(async () => chapterButton(0).props.onKeyDown({ key: "ArrowRight", preventDefault }));
    expect(chapterButton(1).props["aria-current"]).toBe("step");
    expect(chapterButton(1).props.tabIndex).toBe(0);
    expect(chapterButton(0).props.tabIndex).toBe(-1);
    expect(focusControl).toHaveBeenLastCalledWith("Chapitre 2 : Le champion signature");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await act(async () => chapterButton(1).props.onKeyDown({ key: "ArrowRight", altKey: true, preventDefault }));
    expect(chapterButton(1).props["aria-current"]).toBe("step");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    await act(async () => chapterButton(1).props.onKeyDown({ key: "End", preventDefault }));
    expect(chapterButton(4).props["aria-current"]).toBe("step");
    await act(async () => chapterButton(4).props.onKeyDown({ key: "Home", preventDefault }));
    expect(chapterButton(0).props["aria-current"]).toBe("step");
    await act(async () => chapterButton(0).props.onKeyDown({ key: "ArrowLeft", preventDefault }));
    expect(chapterButton(4).props["aria-current"]).toBe("step");
  });

  it("keeps enlarged chapter navigation synchronized and exposes dated comparison context", async () => {
    await mount();
    await act(async () => button("Découvrir le Wrapped").props.onClick());
    await act(async () => button("Agrandir").props.onClick());
    const dialog = () => renderer.root.findByType("dialog");
    const choose = (index) => dialog().findAllByType("button").find((node) => node.props["aria-label"]?.startsWith(`Chapitre ${index + 1} :`));
    await act(async () => choose(3).props.onClick());
    expect(text(renderer.toJSON())).toContain("01/10/2026 – 03/10/2026");
    expect(text(renderer.toJSON())).toContain("04/10/2026 – 06/10/2026");
    expect(renderer.root.findAllByType("canvas")).toHaveLength(2);
    for (const visual of renderer.root.findAllByType("canvas")) expect(visual.props["aria-label"]).toContain("Moyenne des 3 premières parties");
    await act(async () => choose(4).props.onClick());
    expect(text(renderer.toJSON())).toContain("L’effectif actuel ne permet pas d’établir qui a joué chaque partie.");
    await act(async () => dialog().props.onClose());
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    await act(async () => button("Exporter ce chapitre").props.onClick());
    expect(vi.mocked(pngDownloadPages).mock.calls[0][1]).toBe("nxt5-nova-wrapped-5.png");
  });

  it("shows empty and unavailable data without presenting a fictional edition", async () => {
    await mount(<ProfileShowcase {...props} rows={[]} />);
    expect(text(renderer.toJSON())).toContain("Aucune partie reliée");
    expect(renderer.root.findAllByType("canvas")).toHaveLength(0);
    expect(loadProfileShowcaseAssets).not.toHaveBeenCalled();
    await act(async () => renderer.update(<ProfileShowcase {...props} rows={[{ champion: "Jhin", match: { id: "unknown" } }]} />));
    expect(text(renderer.toJSON())).toContain("0 résultat connu sur 1 partie");
    expect(text(renderer.toJSON())).toContain("—");
    await act(async () => button("Découvrir le Wrapped").props.onClick());
    await act(async () => button("Suivant").props.onClick());
    await act(async () => button("Suivant").props.onClick());
    expect(text(renderer.toJSON())).toContain("Aucune partie avec éliminations");
    expect(renderer.root.findAllByType("a")).toHaveLength(0);
  });

  it("keeps failed exports recoverable and enables only the latest loaded champion", async () => {
    let finishOld;
    vi.mocked(loadProfileShowcaseAssets).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    await mount();
    expect(button("Exporter la carte").props.disabled).toBe(true);
    await act(async () => renderer.update(<ProfileShowcase {...props} rows={[{ ...rows[0], champion: "Ahri" }]} />));
    expect(button("Exporter la carte").props.disabled).toBe(false);
    await act(async () => finishOld({ art: null }));
    expect(text(renderer.toJSON())).not.toContain("Portrait indisponible");
    vi.mocked(pngDownloadPages).mockRejectedValueOnce(new Error("download failed"));
    await act(async () => button("Exporter la carte").props.onClick());
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("téléchargement a échoué");
    expect(button("Exporter la carte").props.disabled).toBe(false);
    await act(async () => button("Exporter la carte").props.onClick());
    expect(text(renderer.toJSON())).toContain("téléchargé en PNG");
  });
});
