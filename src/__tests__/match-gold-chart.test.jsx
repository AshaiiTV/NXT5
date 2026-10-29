import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";
import MatchGoldChart from "../components/games/MatchGoldChart.jsx";
import { buildMatchGoldSeries } from "../utils/match-gold-series.js";
import { setLanguage } from "../i18n/locale.js";
import "./helpers/i18n.js";

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const frame = (timestamp, ally = 1000, enemy = 1000) => ({ timestamp, participantFrames: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index + 1), { totalGold: index < 5 ? ally : enemy }])) });
const game = (frames = [], overrides = {}) => ({
  id: "gold-game", duration: "3:15", side: "Blue Side", result: "Défaite",
  participants: ["ALLY", "ENEMY"].flatMap((team, side) => roles.map((role, index) => ({ team_key: team, role, gold: side ? 2000 : 1000, raw: { participantId: side * 5 + index + 1, teamId: side ? 200 : 100 } }))),
  raw: { timeline: { info: { frameInterval: 60000, frames } } }, ...overrides,
});
const series = (match) => buildMatchGoldSeries(match, buildGamePublicationSnapshot({ match }));
let renderer;
const mount = (match, props = {}, rect = { left: 100, width: 560 }) => { act(() => { renderer = TestRenderer.create(<MatchGoldChart match={match} publication={buildGamePublicationSnapshot({ match })} teamName="NXT" {...props} />, { createNodeMock: (element) => element.type === "svg" ? { getBoundingClientRect: () => rect } : null }); }); return renderer; };
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const plot = (r) => r.root.findByProps({ className: "match-gold-chart-plot" });
const readout = (r) => r.root.findAllByProps({ className: "match-gold-chart-readout" });
const move = (r, clientX, clientY = 0) => act(() => plot(r).props.onPointerMove({ clientX, clientY, pointerType: "mouse" }));
const coordinates = (node) => node.props.points.trim().split(/\s+/).map((point) => point.split(",").map(Number));
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; setLanguage("fr", { persist: false }); });

describe("Match recap gold chart", () => {
  it("changes the fill exactly at zero and uses uniform stroke colors on each side", () => {
    const r = mount(game([frame(0, 1100, 1000), frame(60000, 700, 1000)], { duration: "1:00" }));
    const gradient = r.root.findByType("linearGradient");
    const baseline = r.root.findByProps({ className: "match-gold-chart-baseline" });
    expect(gradient.props.gradientUnits).toBe("userSpaceOnUse");
    expect(gradient.props.x1).toBe(gradient.props.x2);
    expect(Number(gradient.props.y1)).toBeLessThan(Number(gradient.props.y2));
    const stops = gradient.findAllByType("stop");
    expect(stops.map((stop) => stop.props.className)).toEqual(["match-gold-chart-stop-positive", "match-gold-chart-stop-negative"]);
    for (const stop of stops) {
      const offset = String(stop.props.offset).endsWith("%") ? parseFloat(stop.props.offset) / 100 : Number(stop.props.offset);
      expect(Number(gradient.props.y1) + offset * (Number(gradient.props.y2) - Number(gradient.props.y1))).toBe(baseline.props.y1);
    }
    const lines = r.root.findAllByProps({ className: "match-gold-chart-line" });
    expect(lines.map((line) => line.props["data-tone"])).toEqual(["positive", "negative"]);
    expect(lines.every((line) => !String(line.props.stroke || line.props.style?.stroke || "").includes("url("))).toBe(true);
    expect(r.root.findByProps({ className: "match-gold-chart-area" }).props.fill).toBe(`url(#${gradient.props.id})`);
    const [positive, negative] = lines.map(coordinates);
    expect(positive[0][1]).toBeLessThan(baseline.props.y1);
    // +500 to −1500 reaches zero after one quarter of the straight edge.
    expect(positive.at(-1)).toEqual([144, baseline.props.y1]);
    expect(negative[0]).toEqual(positive.at(-1));
    expect(negative.at(-1)[1]).toBeGreaterThan(baseline.props.y1);
    expect(r.root.findAllByProps({ className: "match-gold-chart-sample" })).toHaveLength(2);
    expect(r.root.findByType("tbody").findAllByType("tr")).toHaveLength(2);
  });

  it.each([[1001, "positive", 5], [999, "negative", -5]])("keeps a small constant lead uniformly colored even when the stroke straddles zero (%s)", (ally, tone, diff) => {
    const match = game([frame(0, ally), frame(60000, ally)], { duration: "1:00" });
    const r = mount(match);
    const lines = r.root.findAllByProps({ className: "match-gold-chart-line" });
    expect(lines).toHaveLength(1);
    expect(lines[0].props["data-tone"]).toBe(tone);
    expect(String(lines[0].props.stroke || lines[0].props.style?.stroke || "")).not.toContain("url(");
    const points = coordinates(lines[0]);
    expect(points).toHaveLength(2);
    expect(points[0][1]).toBe(points[1][1]);
    expect(series(match).points.map((point) => point.diff)).toEqual([diff, diff]);
    expect(r.root.findAllByProps({ className: "match-gold-chart-sample" }).map((sample) => sample.props["data-tone"])).toEqual([tone, tone]);
  });

  it("closes each measured segment's fill at zero and leaves missing intervals unconnected", () => {
    const missing = frame(120000);
    missing.participantFrames["7"].totalGold = null;
    const match = game([
      frame(0, 1100, 1000), frame(60000, 900, 1000), missing,
      frame(180000), frame(240000), frame(300000, 1200, 1000), frame(480000, 900, 1000),
    ], { duration: "8:00" });
    const r = mount(match);
    const baseline = r.root.findByProps({ className: "match-gold-chart-baseline" }).props.y1;
    const lines = r.root.findAllByProps({ className: "match-gold-chart-line" });
    const samples = r.root.findAllByProps({ className: "match-gold-chart-sample" }).map((sample) => [Number(sample.props.cx.toFixed(1)), Number(sample.props.cy.toFixed(1))]);
    const areas = r.root.findAllByProps({ className: "match-gold-chart-area" }).map(coordinates);
    expect(lines.map((line) => line.props["data-tone"])).toEqual(["positive", "negative", "neutral", "positive"]);
    expect(areas).toHaveLength(2);
    areas.forEach((area, index) => {
      const measured = index === 0 ? samples.slice(0, 2) : samples.slice(2, 5);
      expect(area).toEqual([[measured[0][0], baseline], ...measured, [measured.at(-1)[0], baseline]]);
    });
    expect(areas[0].at(-1)[0]).toBeLessThan(areas[1][0][0]);
    const neutralEdges = lines.filter((line) => line.props["data-tone"] === "neutral");
    expect(neutralEdges).toHaveLength(1);
    expect(coordinates(neutralEdges[0])).toEqual([samples[2], samples[3]]);
    expect(coordinates(neutralEdges[0]).every((point) => point[1] === baseline)).toBe(true);
    expect(r.root.findAllByProps({ className: "match-gold-chart-sample" })).toHaveLength(6);
    expect(r.root.findByType("tbody").findAllByType("tr")).toHaveLength(6);
  });

  it.each(["Blue Side", "Red Side"])("keeps our lead positive, the opponent lead negative, and measured zero neutral (%s)", (side) => {
    const r = mount(game([frame(0, 900, 1000), frame(60000, 1100, 1000), frame(120000)], { duration: "2:00", side }));
    const legend = r.root.findByProps({ className: "match-gold-chart-legend" }).findAllByType("span");
    expect(legend.map((node) => [node.props["data-tone"], text(node)])).toEqual([["positive", "+NXT"], ["negative", "−Adversaires"]]);
    expect(r.root.findAllByProps({ className: "match-gold-chart-sample" }).map((node) => node.props["data-tone"])).toEqual(["negative", "positive", "neutral"]);
    expect(r.root.findByProps({ className: "match-gold-chart-end" }).props["data-tone"]).toBe("neutral");
    expect(r.root.findAllByProps({ className: "match-gold-chart-line" }).filter((line) => line.props["data-tone"] === "neutral")).toHaveLength(0);
    act(() => plot(r).props.onFocus());
    for (const [key, tone] of [["Home", "negative"], ["ArrowRight", "positive"], ["End", "neutral"]]) {
      act(() => plot(r).props.onKeyDown({ key, preventDefault() {} }));
      expect(r.root.findByProps({ className: "match-gold-chart-selected" }).props["data-tone"]).toBe(tone);
      expect(r.root.findByProps({ className: "match-gold-chart-difference" }).findByType("strong").props["data-tone"]).toBe(tone);
    }
  });

  it("uses only measured totals and preserves a measured zero", () => {
    const match = game([frame(0, 500, 500), frame(60000, 1000, 900), frame(120000, 1100, 1500)]);
    const value = series(match);
    expect(value.points.map((point) => [point.timestamp, point.diff])).toEqual([[0, 0], [60000, 500], [120000, -2000]]);
    expect(value.lastTimestamp).toBe(120000);
    expect(value.domainEndMs).toBe(195000);
    expect(value.points.some((point) => point.timestamp === 195000 || point.diff === -5000)).toBe(false);
    expect(value.partial).toBe(true);
  });

  it("never creates a point from compact events, milestones or final participant gold", () => {
    const match = game([], { raw: { nxt5: { timelineEvents: [{ type: "CHAMPION_KILL", timestamp: 10000 }], timelineSummary: { available: true, csMilestones: {} } } } });
    expect(series(match)).toMatchObject({ status: "missing", points: [], segments: [] });
    const r = mount(match);
    expect(text(r.toJSON())).toContain("Courbe d’or indisponible");
    expect(r.root.findAll((node) => node.type === "svg" && node.props.role === "img")).toHaveLength(0);
    expect(text(r.toJSON())).not.toContain("0:00");
  });

  it.each([null, "", undefined, true, Number.NaN, -10])("breaks the path at an unavailable participant gold value (%s)", (missing) => {
    const gap = frame(60000);
    gap.participantFrames["7"].totalGold = missing;
    const value = series(game([frame(0), gap, frame(120000), frame(180000)]));
    expect(value.points.map((point) => point.timestamp)).toEqual([0, 120000, 180000]);
    expect(value.segments.map((segment) => segment.map((point) => point.timestamp))).toEqual([[0], [120000, 180000]]);
    expect(value.partial).toBe(true);
  });

  it("requires both five-player rosters with unique, known IDs", () => {
    const missingPlayer = game([frame(0)]);
    missingPlayer.participants.pop();
    expect(series(missingPlayer)).toMatchObject({ status: "participants", points: [] });
    const duplicate = game([frame(0)]);
    duplicate.participants[5].raw.participantId = 1;
    expect(series(duplicate)).toMatchObject({ status: "participants", points: [] });
    const unknown = game([frame(0)]);
    delete unknown.participants[2].raw.participantId;
    expect(series(unknown)).toMatchObject({ status: "participants", points: [] });
  });

  it("sorts samples and breaks across missing intervals without adding an origin", () => {
    const value = series(game([frame(180000, 3000), frame(60000, 1000), frame(120000, 2000), frame(360000, 4000)]));
    expect(value.points.map((point) => point.timestamp)).toEqual([60000, 120000, 180000, 360000]);
    expect(value.segments.map((segment) => segment.length)).toEqual([3, 1]);
    expect(value.points[0].timestamp).toBe(60000);
    expect(value.domainEndMs).toBe(360000);
    expect(value.partial).toBe(true);
  });

  it("deduplicates identical timestamps and rejects conflicting copies", () => {
    const same = frame(0, 500, 500);
    const value = series(game([same, same, frame(60000), frame(60000, 2000), frame(120000)]));
    expect(value.points.map((point) => point.timestamp)).toEqual([0, 120000]);
    expect(value.segments.map((segment) => segment.length)).toEqual([1, 1]);
    expect(value.partial).toBe(true);
  });

  it("keeps malformed frames unavailable and reads the supported nested payloads", () => {
    const match = game([], { raw: JSON.stringify({ timeline: { timeline: { info: { frames: [null, { timestamp: "" }, frame(0, 500, 500)] } } } }) });
    const publication = buildGamePublicationSnapshot({ match: game() });
    expect(buildMatchGoldSeries(match, publication)).toMatchObject({ status: "available", partial: true, points: [{ timestamp: 0, diff: 0 }] });
    expect(series(game([frame(0)], { raw: { metadata: { timeline: { info: { frames: [frame(0)] } } } } })).status).toBe("available");
  });

  it("labels the last actual sample and offers every observed value in an accessible table", () => {
    const r = mount(game([frame(0, 500, 500), frame(60000, 1000, 1500)], { duration: "1:11" }));
    const chart = r.root.find((node) => node.type === "svg" && node.props.role === "img");
    expect(chart.props["aria-labelledby"]).toBeTruthy();
    expect(text(r.toJSON())).toContain("2 relevés · dernier à 1:00");
    expect(text(r.toJSON())).toContain("1:11");
    expect(r.root.findByProps({ className: "match-gold-chart-end" }).props["data-tone"]).toBe("negative");
    expect(r.root.findByType("details").findByType("summary").props.children[0]).toBe("Voir les relevés");
    expect(r.root.findByType("tbody").findAllByType("tr").map(text)).toEqual(["0:000", "1:00−2 500"]);
    expect(r.root.findByProps({ "aria-label": "Relevés d’or" }).props.tabIndex).toBe(0);
    expect(text(r.root.findByProps({ className: "match-gold-chart-title" }))).toBe("Évolution de l’écart d’or");
  });

  it.each([
    ["en", "Gold difference over time", "Our team", "Opponents", "View samples"],
    ["es", "Evolución de la diferencia de oro", "Nuestro equipo", "Oponentes", "Ver registros"],
  ])("translates the visible title and default team names in %s", (language, title, ally, enemy, action) => {
    setLanguage(language, { persist: false });
    const r = mount(game([frame(0), frame(60000)]), { teamName: "Notre équipe" });
    expect(text(r.root.findByProps({ className: "match-gold-chart-title" }))).toBe(title);
    const legend = text(r.root.findByProps({ className: "match-gold-chart-legend" }));
    expect(legend).toContain(ally);
    expect(legend).toContain(enemy);
    expect(text(r.root.findByType("summary"))).toBe(action);
    expect(text(r.toJSON())).not.toContain("Notre équipe");
    expect(text(r.toJSON())).not.toContain("Adversaires");
  });

  it("preserves user-authored team names when changing language", () => {
    setLanguage("en", { persist: false });
    const match = game([frame(0), frame(60000)], { opponent: "Chronologie" });
    const r = mount(match, { teamName: "Récap" });
    expect(text(r.root.findByProps({ className: "match-gold-chart-legend" }))).toBe("+Récap−Chronologie");
    act(() => setLanguage("es", { persist: false }));
    expect(text(r.root.findByProps({ className: "match-gold-chart-legend" }))).toBe("+Récap−Chronologie");
  });

  it("reads both team totals anywhere vertically in the frame, without targeting the curve", () => {
    const r = mount(game([frame(0, 500, 500), frame(60000, 1000, 900), frame(120000, 1100, 1500)], { duration: "2:00" }));
    expect(readout(r)).toHaveLength(0);
    for (const clientY of [-500, 0, 180, 900]) {
      move(r, 380, clientY);
      expect(text(readout(r)[0])).toContain("1:00");
      expect(text(readout(r)[0])).toContain("+500");
      expect(text(readout(r)[0])).toContain("5 000");
      expect(text(readout(r)[0])).toContain("4 500");
      expect(text(readout(r)[0])).toContain("NXT");
      expect(r.root.findByProps({ className: "match-gold-chart-cursor" }).props.x1).toBe(280);
    }
    act(() => plot(r).props.onPointerLeave());
    expect(readout(r)).toHaveLength(0);
  });

  it("keeps pointer and keyboard inspection on the two real samples when the line crosses zero", () => {
    const match = game([frame(0, 1100, 1000), frame(60000, 900, 1000)], { duration: "1:00" });
    const r = mount(match);
    expect(series(match).points.map(({ timestamp, diff }) => [timestamp, diff])).toEqual([[0, 500], [60000, -500]]);
    expect(r.root.findAllByProps({ className: "match-gold-chart-sample" })).toHaveLength(2);
    expect(r.root.findByType("tbody").findAllByType("tr").map(text)).toEqual(["0:00+500", "1:00−500"]);
    expect(plot(r).props["aria-valuemax"]).toBe(1);

    // The visual crossing is at 0:30, but a tie still selects the earlier real sample.
    move(r, 380);
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    expect(text(readout(r)[0])).toContain("Relevé à 0:00");
    expect(text(readout(r)[0])).toContain("+500");
    expect(text(readout(r)[0])).not.toContain("0:30");
    move(r, 381);
    expect(plot(r).props["aria-valuenow"]).toBe(1);
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
    expect(text(readout(r)[0])).toContain("−500");

    act(() => plot(r).props.onFocus());
    act(() => plot(r).props.onKeyDown({ key: "Home", preventDefault() {} }));
    expect(plot(r).props["aria-valuenow"]).toBe(0);
    act(() => plot(r).props.onKeyDown({ key: "ArrowRight", preventDefault() {} }));
    expect(plot(r).props["aria-valuenow"]).toBe(1);
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
  });

  it("uses the rendered SVG offset and width after resizing, and clamps both outer edges", () => {
    const rect = { left: 140, width: 280 };
    const r = mount(game([frame(0), frame(60000, 1100), frame(120000, 1500)], { duration: "2:00" }), {}, rect);
    move(r, 280);
    expect(text(readout(r)[0])).toContain("1:00");
    rect.left = 35;
    rect.width = 1120;
    move(r, 595);
    expect(text(readout(r)[0])).toContain("1:00");
    move(r, 0);
    expect(text(readout(r)[0])).toContain("0:00");
    move(r, 2000);
    expect(text(readout(r)[0])).toContain("2:00");
    expect(text(readout(r)[0])).toContain("+2 500");
  });

  it("snaps gaps and the unrecorded game end to real samples, resolving a tie to the earlier one", () => {
    const r = mount(game([frame(0, 500, 500), frame(120000, 1500, 1200)], { duration: "4:00" }));
    // 1:00 is exactly between the two observed samples; there is no measured point there.
    move(r, 244);
    expect(text(readout(r)[0])).toContain("Relevé à 0:00");
    expect(text(readout(r)[0])).not.toContain("1:00");
    move(r, 650);
    expect(text(readout(r)[0])).toContain("Relevé à 2:00");
    expect(text(readout(r)[0])).toContain("+1 500");
    expect(text(readout(r)[0])).not.toContain("4:00");
    expect(r.root.findAllByType("polyline")).toHaveLength(0);
    expect(r.root.findAllByProps({ className: "match-gold-chart-area" })).toHaveLength(0);
  });

  it("provides the same measured values through keyboard navigation and keeps focus selection on pointer leave", () => {
    const r = mount(game([frame(0), frame(60000, 1100), frame(120000, 1500)], { duration: "2:00" }));
    expect(plot(r).props.role).toBe("slider");
    expect(plot(r).props.tabIndex).toBe(0);
    act(() => plot(r).props.onFocus());
    expect(readout(r)).toHaveLength(1);
    const key = (value) => act(() => plot(r).props.onKeyDown({ key: value, preventDefault() {} }));
    key("Home");
    expect(text(readout(r)[0])).toContain("Relevé à 0:00");
    key("ArrowRight");
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
    key("End");
    expect(text(readout(r)[0])).toContain("Relevé à 2:00");
    key("ArrowRight");
    expect(text(readout(r)[0])).toContain("Relevé à 2:00");
    key("ArrowLeft");
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
    act(() => plot(r).props.onPointerLeave());
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
    act(() => plot(r).props.onBlur());
    expect(readout(r)).toHaveLength(0);
  });

  it("supports touch selection and pointer cancellation without creating data for a single sample", () => {
    const r = mount(game([frame(60000, 500, 500)], { duration: "2:00" }));
    act(() => plot(r).props.onPointerDown({ clientX: 600, clientY: 30, pointerType: "touch" }));
    expect(text(readout(r)[0])).toContain("Relevé à 1:00");
    expect(text(readout(r)[0])).toContain("2 500");
    expect(r.root.findAllByType("polyline")).toHaveLength(0);
    expect(r.root.findAllByProps({ className: "match-gold-chart-area" })).toHaveLength(0);
    act(() => plot(r).props.onPointerCancel());
    expect(readout(r)).toHaveLength(0);
  });

  it("ignores pointer coordinates while the plot has no measurable width", () => {
    const r = mount(game([frame(0), frame(60000)]), {}, { left: 100, width: 0 });
    move(r, 200);
    expect(readout(r)).toHaveLength(0);
  });
});
