import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AlertTriangle } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerUltimateProfile } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { ProfileNavigation } from "../pages/workspace/ProfileNavigation.jsx";
import { TrendsOverview } from "../components/trends/TrendsOverview.jsx";
import { ProgressionObjectives } from "../components/trends/ProgressionObjectives.jsx";
import { SelectInput } from "../components/ui/Core.jsx";
import { analysisCopy } from "../components/trends/analysis-copy.js";

let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllGlobals(); });
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const mount = (element) => { act(() => { renderer = TestRenderer.create(element); }); return renderer; };

describe("profile and analyses reading order", () => {
  it("starts the profile with a next step, explains the first metrics, and retains scoped navigation", () => {
    vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil?player=p1") });
    const navigate = vi.fn();
    const player = { id: "p1", team_id: "t1", name: "Joueur test", role: "MID" };
    const match = { id: "source-1", team_id: "t1", result: "Victoire", game_date: "2026-09-20", participants: [{ id: "row", player_id: "p1", team_key: "ALLY", role: "MID", champion: "Ahri", kills: 4, deaths: 2, assists: 6, kill_participation: 60 }] };
    mount(<PlayerUltimateProfile data={{ players: [player], matches: [match], teams: [{ id: "t1" }] }} selectedTeamId="t1" user={{ id: "reader" }} route={{ path: "/mon-profil", search: "?player=p1" }} navigate={navigate} />);
    const panel = renderer.root.findByProps({ id: "profile-panel" });
    const content = text(panel);
    expect(content.indexOf("À essayer à la prochaine session")).toBeLessThan(content.indexOf("Les résultats en un regard"));
    expect(content).toContain("Part des éliminations de l’équipe");
    expect(content).toContain("Les CS comptent les sbires et monstres tués");
    expect(panel.findAllByType("details").every((detail) => !detail.props.open)).toBe(true);
    expect(panel.findAllByType("a").some((link) => link.props.href === "/games?match=source-1")).toBe(true);
    act(() => renderer.root.findByType(ProfileNavigation).props.onChange("history"));
    expect(navigate).toHaveBeenCalledWith("/mon-profil/historique?player=p1");
    expect(renderer.root.findByProps({ id: "profile-panel" }).props["aria-label"]).toBe("Historique");
  });

  it("keeps the profile mobile selector on the same route keys as the tabs", () => {
    const onChange = vi.fn();
    mount(<ProfileNavigation activeId="pool" onChange={onChange} />);
    expect(renderer.root.findByProps({ id: "profile-tab-pool" }).props["aria-selected"]).toBe(true);
    const select = renderer.root.findByType(SelectInput);
    expect(select.props.value).toBe("pool");
    act(() => select.props.onChange("coaching"));
    expect(onChange).toHaveBeenCalledWith("coaching");
  });

  it("discloses secondary analyses while preserving exact source objects and the objective action", () => {
    const sourceGames = Object.freeze([{ id: "source-1", title: "Game personnelle" }]);
    const objective = Object.freeze({ title: "Réduire les morts gratuites", why: "Les deaths montent trop haut pour transformer les bons plans en games contrôlées.", sourceGames });
    const plan = Object.freeze({ title: "Engage", value: "3 games", text: "Un pattern à revoir dans la review.", sourceGames, toneName: "cyan" });
    const onOpenSources = vi.fn();
    const onObjectives = vi.fn();
    mount(<TrendsOverview objective={objective} plan={plan} roles={[]} briefs={[{ label: "Objectifs", title: "Premier objectif", text: "3 games", sourceGames }]} alerts={[{ title: "Vision", text: "À vérifier", action: "Ouvrir la VOD", icon: AlertTriangle }]} onOpenSources={onOpenSources} onObjectives={onObjectives} />);
    expect(text(renderer.toJSON())).toContain("Revoir les situations de mort");
    expect(renderer.root.findAllByType("details").every((detail) => !detail.props.open)).toBe(true);
    const button = (label) => renderer.root.findAllByType("button").find((node) => text(node).includes(label));
    act(() => button("Vérifier les parties concernées").props.onClick());
    expect(onOpenSources.mock.calls[0][0].games).toBe(sourceGames);
    act(() => button("Examiner les parties de ce plan").props.onClick());
    expect(onOpenSources.mock.calls[1][0].games).toBe(sourceGames);
    act(() => button("Voir les objectifs par rôle").props.onClick());
    expect(onObjectives).toHaveBeenCalledOnce();
    expect(objective.title).toBe("Réduire les morts gratuites");
    expect(sourceGames[0].title).toBe("Game personnelle");
  });

  it("explains proposed objectives without changing targets or source selection", () => {
    const sourceGames = [{ id: "one" }];
    const onOpenSources = vi.fn();
    const onOpenContracts = vi.fn();
    mount(<ProgressionObjectives teamObjective={{ title: "Vision", why: "À vérifier", target: "<= 16 morts équipe par game", current: "18 morts/G", sourceGames }} roleObjectives={[]} gamesCount={3} onOpenSources={onOpenSources} onOpenContracts={onOpenContracts} />);
    expect(text(renderer.toJSON())).toContain("≤ 16 morts équipe par partie");
    expect(text(renderer.toJSON())).toContain("18 morts par partie");
    expect(text(renderer.toJSON())).toContain("Des cibles proposées à partir de la sélection");
    const buttons = renderer.root.findAllByType("button");
    act(() => buttons[0].props.onClick());
    expect(onOpenSources.mock.calls[0][0].games).toBe(sourceGames);
    act(() => buttons[1].props.onClick());
    expect(onOpenContracts).toHaveBeenCalledOnce();
  });

  it("distinguishes lane differences from individual CS counts and keeps French agreements", () => {
    const roleObjective = Object.freeze({ role: "MID", title: "Stabiliser la lane", target: "CS10 >= -3 pendant 3 games", current: "CS10 -8.0", why: "Les reviews doivent vérifier la lane." });
    mount(<ProgressionObjectives teamObjective={{ title: "Vision", why: "À vérifier", target: "Vision diff positive sur le prochain bloc", current: "-5", sourceGames: [] }} roleObjectives={[roleObjective]} gamesCount={3} />);
    const content = text(renderer.toJSON());
    expect(content).toContain("Écart de vision positif sur la prochaine session");
    expect(content).toContain("Les débriefs doivent vérifier la lane.");
    expect(content).toContain("écart de sbires à 10 min face au rôle adverse (CS10) ≥ -3 pendant 3 parties");
    expect(content).toContain("écart de sbires à 10 min face au rôle adverse (CS10) -8.0");
    expect(analysisCopy("CS10 >= 72 sur 2/3 games")).toBe("sbires à 10 min (CS10) >= 72 sur 2/3 parties");
    expect(analysisCopy("CS10 >= 70 sur 2/3 games")).toBe("sbires à 10 min (CS10) >= 70 sur 2/3 parties");
    expect(roleObjective.target).toBe("CS10 >= -3 pendant 3 games");
  });
});
