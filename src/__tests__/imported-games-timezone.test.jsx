import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { DemoExplorer } from "../pages/public/DemoExperience.jsx";

let renderer;
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.unstubAllEnvs(); });

const matches = [
  { id: "winter", game_id: "winter", game_date: "2026-01-23T23:30:00.000Z", duration_seconds: 1800, result: "Victoire", participants: [] },
  { id: "summer", game_id: "summer", game_date: "2026-09-23T23:30:00.000Z", duration_seconds: 1800, result: "Défaite", participants: [] },
];
function dates(props = {}) {
  const html = renderToStaticMarkup(<ImportedGames matches={matches} {...props} />);
  return [...html.matchAll(/<time dateTime="([^"]+)">([^<]+)<\/time><span>([^<]+)/g)].map(([, iso, date, time]) => ({ iso, date, time }));
}

it("renders the same Paris dates in raw server HTML under different process time zones", () => {
  const output = [];
  for (const timeZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    vi.stubEnv("TZ", timeZone);
    // Verify the test actually changes Intl's local default, not just the env.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
    output.push(dates({ dateTimeZone: "Europe/Paris" }));
  }
  expect(output[0]).toEqual([
    { iso: matches[1].game_date, date: "24 sept. 2026", time: "01:30 · 30:00" },
    { iso: matches[0].game_date, date: "24 janv. 2026", time: "00:30 · 30:00" },
  ]);
  expect(output[1]).toEqual(output[0]);
  expect(output[2]).toEqual(output[0]);
});

it("keeps local time by default for private game lists", () => {
  vi.stubEnv("TZ", "UTC");
  expect(dates()).toEqual([
    { iso: matches[1].game_date, date: "23 sept. 2026", time: "23:30 · 30:00" },
    { iso: matches[0].game_date, date: "23 janv. 2026", time: "23:30 · 30:00" },
  ]);
  vi.stubEnv("TZ", "America/Los_Angeles");
  expect(dates().map(item => item.time)).toEqual(["16:30 · 30:00", "15:30 · 30:00"]);
});

it("sets the time zone only for the demo and explains it next to its introduction", () => {
  act(() => { renderer = TestRenderer.create(<DemoExplorer />); });
  const list = renderer.root.findByType(ImportedGames);
  expect(list.props.dateTimeZone).toBe("Europe/Paris");
  expect(list.props.description).toContain("Horaires affichés à l’heure de Paris.");
  expect(renderer.root.findAllByType("time").map(node => node.props.dateTime)).toEqual([
    "2026-09-23T18:00:00.000Z", "2026-09-22T18:00:00.000Z", "2026-09-21T18:00:00.000Z",
  ]);
});
