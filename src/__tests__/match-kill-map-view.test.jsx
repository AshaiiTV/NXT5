import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchKillMap } from "../components/games/MatchKillMap.jsx";
import { setLanguage } from "../i18n/locale.js";
import { t } from "../i18n/translate.js";
import "./helpers/i18n.js";

const event = (overrides = {}) => ({ type: "CHAMPION_KILL", timestamp: 60000, killerId: 1, victimId: 6, assistingParticipantIds: [2], position: { x: 3000, y: 12000 }, ...overrides });
const game = (events = [event(), event({ timestamp: 150000, killerId: 6, victimId: 1, assistingParticipantIds: [], position: { x: 11000, y: 4000 } })], overrides = {}) => ({
  id: "map-a", side: "Blue Side", participants: [
    { champion: "Ahri", team_key: "ALLY", raw: { participantId: 1, teamId: 100 } },
    { champion: "Lux", team_key: "ENEMY", raw: { participantId: 6, teamId: 200 } },
    { champion: "Vi", team_key: "ALLY", raw: { participantId: 2, teamId: 100 } },
  ], raw: { info: { mapId: 11 }, timeline: { info: { frames: [{ timestamp: 60000, events }] } } }, ...overrides,
});
const renderers = [];
const rect = { left: 100, top: 50, width: 512, height: 512 };
const mount = (match = game(), props = {}) => {
  let renderer;
  act(() => { renderer = TestRenderer.create(<MatchKillMap match={match} {...props} />, {
    createNodeMock: (element) => element.props.className === "mkm-plot" ? { getBoundingClientRect: () => rect } : null,
  }); });
  renderers.push(renderer);
  return renderer;
};
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const plot = (r) => r.root.findByProps({ className: "mkm-plot" });
const readout = (r) => r.root.findByProps({ className: "mkm-readout" });
const button = (r, label) => r.root.findAllByType("button").find((node) => node.props["aria-label"] === t(label));
const filters = (r) => r.root.findByProps({ role: "group", "aria-label": t("Filtrer les éliminations") });
const filterButton = (r, label) => filters(r).findAllByType("button").find((node) => text(node) === t(label));
const chooseFilter = (r, label) => act(() => filterButton(r, label).props.onClick());
const visiblePoints = (r) => r.root.findByProps({ className: "mkm-points" }).children.filter((node) => node.type === "circle" && node.props.className === "mkm-point");
const legendTeams = (r) => r.root.findByProps({ className: "mkm-legend" }).children.map((node) => node.props["data-team"]);
const pointEvent = (x, y, pointerType = "mouse") => ({ clientX: rect.left + ((x + 120) / 14990) * rect.width, clientY: rect.top + (1 - ((y + 120) / 15100)) * rect.height, pointerType });
const key = (r, value) => {
  const preventDefault = vi.fn();
  act(() => plot(r).props.onKeyDown({ key: value, preventDefault }));
  return preventDefault;
};
afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  act(() => { setLanguage("fr", { persist: false }); });
});

describe("Match kill map interactions", () => {
  it("shows the allied and enemy kill details by hovering their locations", () => {
    const r = mount(game(), { allyName: "Atlas", enemyName: "Rivals" });
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    act(() => plot(r).props.onPointerMove(pointEvent(3000, 12000)));
    expect(readout(r).props["data-team"]).toBe("ALLY");
    expect(text(readout(r))).toContain("Atlas");
    expect(text(readout(r))).toContain("Ahri");
    expect(text(readout(r))).toContain("Lux");
    expect(text(readout(r))).toContain("Assistances : Vi");
    expect(text(r.root.findByType("time"))).toBe("1:00");
    expect(plot(r).props["aria-valuetext"]).toBe("À 1:00 : Ahri → Lux. Atlas.");
    act(() => plot(r).props.onPointerMove(pointEvent(11000, 4000)));
    expect(readout(r).props["data-team"]).toBe("ENEMY");
    expect(text(r.root.findByType("time"))).toBe("2:30");
    expect(plot(r).props["aria-valuetext"]).toBe("À 2:30 : Lux → Ahri. Rivals.");
    expect(r.root.findAllByProps({ className: "mkm-assists" })).toHaveLength(0);
  });

  it("accepts a nearby tap and ignores empty space and invalid pointer coordinates", () => {
    const r = mount();
    act(() => plot(r).props.onPointerMove({ clientX: 0, clientY: 0 }));
    act(() => plot(r).props.onPointerMove({ clientX: NaN, clientY: 50 }));
    expect(r.root.findAllByType("time")).toHaveLength(0);
    const touch = pointEvent(11000, 4000, "touch");
    act(() => plot(r).props.onPointerDown({ ...touch, clientX: touch.clientX + 12 }));
    expect(readout(r).props["data-team"]).toBe("ENEMY");
    expect(text(r.root.findByType("time"))).toBe("2:30");
  });

  it("reaches overlapping events with arrows, Home, End and previous/next controls", () => {
    const events = [event(), event({ timestamp: 120000, killerId: 6, victimId: 1 }), event({ timestamp: 180000 })];
    const r = mount(game(events));
    act(() => plot(r).props.onFocus());
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    expect(button(r, "Élimination précédente").props["aria-disabled"]).toBe(true);
    expect(button(r, "Élimination précédente").props.disabled).not.toBe(true);
    act(() => button(r, "Élimination précédente").props.onClick());
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    expect(key(r, "ArrowRight")).toHaveBeenCalledOnce();
    expect(plot(r).props["aria-valuenow"]).toBe(1);
    expect(text(r.root.findByType("time"))).toBe("2:00");
    expect(readout(r).props["data-team"]).toBe("ENEMY");
    key(r, "End");
    expect(plot(r).props["aria-valuenow"]).toBe(2);
    expect(button(r, "Élimination suivante").props["aria-disabled"]).toBe(true);
    expect(button(r, "Élimination suivante").props.disabled).not.toBe(true);
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(plot(r).props["aria-valuenow"]).toBe(2);
    key(r, "ArrowUp");
    expect(plot(r).props["aria-valuenow"]).toBe(2);
    act(() => button(r, "Élimination précédente").props.onClick());
    expect(plot(r).props["aria-valuenow"]).toBe(1);
    key(r, "Home");
    key(r, "ArrowLeft");
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(plot(r).props["aria-valuenow"]).toBe(1);
    key(r, "ArrowDown");
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    key(r, "Escape");
    expect(r.root.findAllByProps({ className: "mkm-selection" })).toHaveLength(0);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    expect(key(r, "Tab")).not.toHaveBeenCalled();
  });

  it("can start chronological exploration from the previous/next controls", () => {
    const r = mount();
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(text(r.root.findByType("time"))).toBe("1:00");
    key(r, "Escape");
    act(() => button(r, "Élimination précédente").props.onClick());
    expect(text(r.root.findByType("time"))).toBe("1:00");
  });

  it("announces button and keyboard navigation without announcing pointer exploration", () => {
    const r = mount(game(), { allyName: "Atlas", enemyName: "Rivals" });
    const status = () => r.root.findByProps({ role: "status", "aria-live": "polite" });
    expect(text(status())).toBe("");
    act(() => plot(r).props.onPointerMove(pointEvent(3000, 12000)));
    expect(text(status())).toBe("");
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(text(status())).toBe("À 2:30 : Lux → Ahri. Rivals.");
    act(() => button(r, "Élimination précédente").props.onClick());
    expect(text(status())).toBe("À 1:00 : Ahri → Lux. Atlas.");
    act(() => plot(r).props.onPointerMove(pointEvent(11000, 4000)));
    expect(text(status())).toBe("");
    key(r, "Home");
    expect(text(status())).toBe("À 1:00 : Ahri → Lux. Atlas.");
    key(r, "Escape");
    expect(text(status())).toBe("");
  });

  it.each(["different-id", "updated-snapshot"])("removes a stale selected event when the match changes (%s)", (kind) => {
    const r = mount();
    key(r, "End");
    expect(text(r.root.findByType("time"))).toBe("2:30");
    const next = game([event({ timestamp: 0 })], { id: kind === "different-id" ? "map-b" : "map-a" });
    act(() => r.update(<MatchKillMap match={next} />));
    expect(r.root.findAllByType("time")).toHaveLength(0);
    expect(r.root.findAllByProps({ className: "mkm-selection" })).toHaveLength(0);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("0:00");
    expect(plot(r).props["aria-valuemax"]).toBe(0);
  });

  it.each([
    ["loading", () => game(), { loading: true }, "Chargement de la carte…"],
    ["error", () => game(), { error: "Network error" }, "Impossible de charger les éliminations."],
    ["absent", () => game(undefined, { raw: {} }), {}, "Chronologie indisponible"],
    ["unsupported", () => game(undefined, { raw: { info: { mapId: 12 } } }), {}, "Carte disponible pour la Faille de l’invocateur."],
    ["unplaced", () => game([event({ position: null })]), {}, "Positions des éliminations indisponibles"],
  ])("renders %s without an interactive map", (kind, fixture, props, message) => {
    const r = mount(fixture(), props);
    expect(text(r.root)).toContain(message);
    expect(r.root.findAllByProps({ className: "mkm-plot" })).toHaveLength(0);
    expect(r.root.findAllByType("button")).toHaveLength(0);
    expect(r.root.findByType("section").props["aria-busy"]).toBe(kind === "loading" ? true : undefined);
    if (kind === "loading") expect(r.root.findByProps({ className: "mkm-empty" }).props.role).toBe("status");
    expect(text(r.root)).not.toContain("Network error");
  });

  it("shows a known empty timeline without implying the map could be navigated", () => {
    const r = mount(game([]));
    expect(text(r.root)).toContain("Aucune élimination enregistrée");
    expect(plot(r).props.role).toBe("img");
    expect(plot(r).props.tabIndex).toBeUndefined();
    expect(plot(r).props["aria-valuenow"]).toBeUndefined();
    expect(r.root.findAllByProps({ className: "mkm-point" })).toHaveLength(0);
    expect(filters(r).findAllByType("button")).toHaveLength(3);
    expect(r.root.findAllByProps({ className: "mkm-navigation" })).toHaveLength(0);
  });

  it("announces a failed map image while keeping chronological event access", () => {
    const r = mount();
    act(() => r.root.findByProps({ className: "mkm-background" }).props.onError());
    expect(text(r.root)).toContain("Fond de carte indisponible");
    expect(r.root.findAllByProps({ className: "mkm-plot" })).toHaveLength(0);
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(text(r.root.findByType("time"))).toBe("1:00");
    expect(text(readout(r))).toContain("Ahri");
  });

  it("keeps executions neutral and names them in both the detail and accessible description", () => {
    const r = mount(game([event({ killerId: 0, assistingParticipantIds: [] })]));
    expect(r.root.findByProps({ className: "mkm-point" }).props["data-team"]).toBe("UNKNOWN");
    key(r, "Home");
    expect(readout(r).props["data-team"]).toBe("UNKNOWN");
    expect(text(readout(r))).toContain("Exécution");
    expect(text(readout(r))).toContain("Lux");
    expect(plot(r).props["aria-valuetext"]).toContain("Exécution → Lux. Équipe indéterminée.");
    expect(text(readout(r))).not.toContain("Champion inconnu");
  });

  it("distinguishes unlocatable recorded events from missing timeline events", () => {
    const partial = mount(game([event(), event({ timestamp: 120000, position: null })]));
    expect(text(partial.root.findByProps({ className: "mkm-incomplete" }))).toBe("1 élimination non localisable");
    expect(text(partial.root.findByProps({ className: "mkm-navigation" }))).toContain("1 élimination localisée");
    const missing = game([event()]); missing.participants[0].kills = 3;
    const r = mount(missing);
    expect(text(r.root.findByProps({ className: "mkm-incomplete" }))).toBe("Événements incomplets");
  });

  it.each(["fr", "en", "es"])("translates headings, controls and accessible details in %s", (language) => {
    act(() => { setLanguage(language, { persist: false }); });
    const r = mount(game([event({ killerId: 0, assistingParticipantIds: [] })]));
    const title = text(r.root.findByType("h4"));
    expect(title).toBe(t("Carte des éliminations"));
    if (language !== "fr") expect(title).not.toBe("Carte des éliminations");
    expect(button(r, "Élimination suivante")).toBeTruthy();
    key(r, "Home");
    expect(text(readout(r))).toContain(t("Exécution"));
    expect(plot(r).props["aria-valuetext"]).toBe(t("À {0} : {1} → {2}. {3}.", ["1:00", t("Exécution"), "Lux", t("Équipe indéterminée")]));
    expect(text(r.root)).not.toContain("{0}");
  });

  it.each(["en", "es"])("translates French fallback team names supplied as props in %s", (language) => {
    act(() => { setLanguage(language, { persist: false }); });
    const r = mount(game(), { allyName: "Notre équipe", enemyName: "Adversaires" });
    const legend = text(r.root.findByProps({ className: "mkm-legend" }));
    expect(legend).toContain(t("Notre équipe"));
    expect(legend).toContain(t("Adversaires"));
    expect(legend).not.toContain("Notre équipe");
    expect(legend).not.toContain("Adversaires");
    key(r, "Home");
    expect(text(readout(r))).toContain(t("Notre équipe"));
    expect(plot(r).props["aria-valuetext"]).toBe(t("À {0} : {1} → {2}. {3}.", ["1:00", "Ahri", "Lux", t("Notre équipe")]));
    key(r, "End");
    expect(text(readout(r))).toContain(t("Adversaires"));
    expect(plot(r).props["aria-valuetext"]).toBe(t("À {0} : {1} → {2}. {3}.", ["2:30", "Lux", "Ahri", t("Adversaires")]));
  });
});

describe("Match kill map team filter", () => {
  it("starts with both teams and keeps unassigned executions visible only in the combined view", () => {
    const r = mount(game([event(), event({ timestamp: 90000, killerId: 0 }), event({ timestamp: 120000, killerId: 6, victimId: 1 })]));
    expect(filters(r).findAllByType("button").map((node) => [text(node), node.props["aria-pressed"]])).toEqual([
      ["Les deux", true], ["Mon équipe", false], ["Adversaires", false],
    ]);
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ALLY", "UNKNOWN", "ENEMY"]);
    expect(legendTeams(r)).toEqual(["ALLY", "ENEMY", "UNKNOWN"]);
    expect(text(r.root.findByProps({ className: "mkm-navigation" }))).toContain("3 éliminations localisées");
    chooseFilter(r, "Mon équipe");
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ALLY"]);
    expect(legendTeams(r)).toEqual(["ALLY"]);
    chooseFilter(r, "Adversaires");
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ENEMY"]);
    expect(legendTeams(r)).toEqual(["ENEMY"]);
    chooseFilter(r, "Les deux");
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ALLY", "UNKNOWN", "ENEMY"]);
    expect(legendTeams(r)).toEqual(["ALLY", "ENEMY", "UNKNOWN"]);
  });

  it("clears a hidden selection on a new filter, retains it on the same filter and follows allegiance on red side", () => {
    const match = game(); match.side = "Red Side";
    for (const row of match.participants) row.raw.teamId = row.team_key === "ALLY" ? 200 : 100;
    const r = mount(match);
    key(r, "End");
    expect(readout(r).props["data-team"]).toBe("ENEMY");
    chooseFilter(r, "Mon équipe");
    expect(r.root.findAllByType("time")).toHaveLength(0);
    expect(r.root.findAllByProps({ className: "mkm-selection" })).toHaveLength(0);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    expect(text(r.root.findByProps({ role: "status", "aria-live": "polite" }))).toBe("");
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ALLY"]);
    expect(text(r.root.findByProps({ className: "mkm-navigation" }))).toContain("1 élimination localisée");
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("1:00");
    chooseFilter(r, "Mon équipe");
    expect(text(r.root.findByType("time"))).toBe("1:00");
    expect(readout(r).props["data-team"]).toBe("ALLY");
  });

  it("ignores hidden enemy points during hover or touch while retaining visible point interaction", () => {
    const r = mount();
    chooseFilter(r, "Mon équipe");
    act(() => plot(r).props.onPointerMove(pointEvent(11000, 4000)));
    act(() => plot(r).props.onPointerDown(pointEvent(11000, 4000, "touch")));
    expect(r.root.findAllByType("time")).toHaveLength(0);
    act(() => plot(r).props.onPointerMove(pointEvent(3000, 12000)));
    expect(text(r.root.findByType("time"))).toBe("1:00");
    expect(readout(r).props["data-team"]).toBe("ALLY");
    act(() => plot(r).props.onPointerMove(pointEvent(11000, 4000)));
    expect(text(r.root.findByType("time"))).toBe("1:00");
    expect(readout(r).props["data-team"]).toBe("ALLY");
  });

  it("limits keyboard and previous/next exploration to the filtered chronological sequence", () => {
    const r = mount(game([event(), event({ timestamp: 90000, killerId: 6, victimId: 1 }), event({ timestamp: 120000, killerId: 0 }), event({ timestamp: 180000 })]));
    chooseFilter(r, "Mon équipe");
    expect(plot(r).props["aria-valuemax"]).toBe(1);
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("1:00");
    key(r, "ArrowRight");
    expect(text(r.root.findByType("time"))).toBe("3:00");
    expect(readout(r).props["data-team"]).toBe("ALLY");
    expect(text(r.root.findByProps({ className: "mkm-navigation" }))).toContain("2 / 2");
    expect(button(r, "Élimination suivante").props["aria-disabled"]).toBe(true);
    act(() => button(r, "Élimination suivante").props.onClick());
    expect(text(r.root.findByType("time"))).toBe("3:00");
    act(() => button(r, "Élimination précédente").props.onClick());
    expect(text(r.root.findByType("time"))).toBe("1:00");
    key(r, "End");
    expect(text(r.root.findByType("time"))).toBe("3:00");
    chooseFilter(r, "Adversaires");
    expect(plot(r).props["aria-valuemax"]).toBe(0);
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("1:30");
    expect(readout(r).props["data-team"]).toBe("ENEMY");
    expect(text(r.root.findByProps({ className: "mkm-navigation" }))).toContain("1 / 1");
  });

  it("keeps the filters available when one team has no localized kills and can return to both", () => {
    const r = mount(game([event()]));
    chooseFilter(r, "Adversaires");
    expect(text(r.root)).toContain("Aucune élimination localisée pour cette équipe");
    expect(plot(r).props.role).toBe("img");
    expect(plot(r).props.tabIndex).toBeUndefined();
    expect(plot(r).props["aria-valuenow"]).toBeUndefined();
    expect(visiblePoints(r)).toHaveLength(0);
    expect(legendTeams(r)).toEqual(["ENEMY"]);
    expect(filters(r).findAllByType("button")).toHaveLength(3);
    expect(r.root.findAllByProps({ className: "mkm-navigation" })).toHaveLength(0);
    expect(r.root.findAllByProps({ className: "mkm-readout" })).toHaveLength(0);
    expect(key(r, "Home")).not.toHaveBeenCalled();
    act(() => plot(r).props.onPointerDown(pointEvent(3000, 12000, "touch")));
    expect(r.root.findAllByType("time")).toHaveLength(0);
    chooseFilter(r, "Les deux");
    expect(plot(r).props.role).toBe("slider");
    expect(visiblePoints(r)).toHaveLength(1);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
  });

  it.each(["match", "team"])("resets an uncontrolled filter when the %s identity changes", (identity) => {
    const match = game(undefined, { team_id: "team-a" });
    const r = mount(match);
    chooseFilter(r, "Mon équipe");
    key(r, "Home");
    const next = { ...match, ...(identity === "match" ? { id: "map-b" } : { team_id: "team-b" }) };
    act(() => r.update(<MatchKillMap match={next} />));
    expect(filterButton(r, "Les deux").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r)).toHaveLength(2);
    expect(r.root.findAllByType("time")).toHaveLength(0);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    act(() => r.update(<MatchKillMap match={{ ...match }} />));
    expect(filterButton(r, "Les deux").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r)).toHaveLength(2);
  });

  it("keeps the filter but clears the old event when the same match snapshot refreshes", () => {
    const r = mount(game(undefined, { team_id: "team-a" }));
    chooseFilter(r, "Adversaires");
    key(r, "Home");
    const next = game([event(), event({ timestamp: 210000, killerId: 6, victimId: 1 })], { team_id: "team-a" });
    act(() => r.update(<MatchKillMap match={next} />));
    expect(filterButton(r, "Adversaires").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ENEMY"]);
    expect(r.root.findAllByType("time")).toHaveLength(0);
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("3:30");
  });

  it("supports a controlled filter without overriding its parent and clears selection when the prop changes", () => {
    const match = game();
    const onTeamFilterChange = vi.fn();
    const r = mount(match, { teamFilter: "ENEMY", onTeamFilterChange });
    expect(filterButton(r, "Adversaires").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ENEMY"]);
    key(r, "Home");
    chooseFilter(r, "Mon équipe");
    expect(onTeamFilterChange).toHaveBeenCalledWith("ALLY");
    expect(filterButton(r, "Adversaires").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ENEMY"]);
    act(() => r.update(<MatchKillMap match={match} teamFilter="ALLY" onTeamFilterChange={onTeamFilterChange} />));
    expect(filterButton(r, "Mon équipe").props["aria-pressed"]).toBe(true);
    expect(visiblePoints(r).map((node) => node.props["data-team"])).toEqual(["ALLY"]);
    expect(r.root.findAllByType("time")).toHaveLength(0);
    expect(text(readout(r))).toContain("Survolez ou touchez un point.");
    key(r, "Home");
    expect(text(r.root.findByType("time"))).toBe("1:00");
  });

  it("keeps the global unlocatable-event note separate from either team's visible count", () => {
    const r = mount(game([event(), event({ timestamp: 150000, killerId: 6, victimId: 1, position: null })]));
    chooseFilter(r, "Mon équipe");
    expect(text(r.root.findByProps({ className: "mkm-navigation" }))).toContain("1 élimination localisée");
    expect(text(r.root.findByProps({ className: "mkm-incomplete" }))).toBe("Toute la partie · 1 élimination non localisable");
    chooseFilter(r, "Adversaires");
    expect(visiblePoints(r)).toHaveLength(0);
    expect(text(r.root.findByProps({ className: "mkm-incomplete" }))).toBe("Toute la partie · 1 élimination non localisable");
    expect(text(r.root.findByProps({ className: "mkm-legend" }))).toContain("0");
    chooseFilter(r, "Les deux");
    expect(text(r.root.findByProps({ className: "mkm-incomplete" }))).toBe("1 élimination non localisable");
  });

  it.each(["fr", "en", "es"])("translates the filters and filtered-empty message in %s", (language) => {
    act(() => { setLanguage(language, { persist: false }); });
    const r = mount(game([event()]));
    expect(filters(r).findAllByType("button").map(text)).toEqual([t("Les deux"), t("Mon équipe"), t("Adversaires")]);
    if (language !== "fr") {
      expect(filters(r).props["aria-label"]).not.toBe("Filtrer les éliminations");
      expect(text(filterButton(r, "Les deux"))).not.toBe("Les deux");
      expect(text(filterButton(r, "Mon équipe"))).not.toBe("Mon équipe");
    }
    chooseFilter(r, "Adversaires");
    expect(text(r.root)).toContain(t("Aucune élimination localisée pour cette équipe"));
    if (language !== "fr") expect(text(r.root)).not.toContain("Aucune élimination localisée pour cette équipe");
  });
});
