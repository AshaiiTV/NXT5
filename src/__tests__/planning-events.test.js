import { describe, expect, it } from "vitest";
import { aggregatePlanningEvents } from "../utils/planning-events.js";

const KEY = "MON|20:00";
const event = (type, label) => ({ type, label });
const row = (playerId, events) => ({ player_id: playerId, slots: { _events: events } });
const one = (playerId, type, label) => row(playerId, { [KEY]: event(type, label) });

describe("shared planning sessions", () => {
  it("preserves distinct sessions with the same order for every row ordering", () => {
    const rows = [
      one("sup", "custom", "Brief"),
      one("mid", "review", "Review"),
      one("top", "scrim", "Scrim"),
      one("jgl", "match", "Match"),
      one("adc", "scrim", "Entraînement"),
      one("coach", "custom", "Brief"),
      one("manager", "custom", "brief"),
    ];
    const actual = aggregatePlanningEvents(rows);
    expect(actual).toEqual(aggregatePlanningEvents([...rows].reverse()));
    expect(actual[KEY]).toEqual({
      type: "mixed", conflict: true,
      events: [
        { type: "scrim", label: "Entraînement", playerIds: ["adc", "top"] },
        { type: "match", label: "Match", playerIds: ["jgl"] },
        { type: "review", label: "Review", playerIds: ["mid"] },
        { type: "custom", label: "Brief", playerIds: ["coach", "sup"] },
        { type: "custom", label: "brief", playerIds: ["manager"] },
      ],
    });
  });

  it("replaces a profile's saved session before applying a changed draft", () => {
    const rows = [one("top", "scrim", "Scrim"), one("jgl", "match", "Match")];
    const actual = aggregatePlanningEvents(rows, { playerId: "top", events: { [KEY]: event("review", "Review") } });
    expect(actual[KEY].events.map(item => item.type)).toEqual(["match", "review"]);
    expect(actual[KEY].events[1].playerIds).toEqual(["top"]);
  });

  it("removes only the edited profile's contribution when the draft is empty", () => {
    const rows = [one("top", "scrim", "Scrim"), one("jgl", "scrim", "Scrim")];
    expect(aggregatePlanningEvents(rows, { playerId: "top", events: {} })[KEY]).toEqual({
      type: "scrim", label: "Scrim", conflict: false,
      events: [{ type: "scrim", label: "Scrim", playerIds: ["jgl"] }],
    });
    expect(aggregatePlanningEvents([rows[0]], { playerId: "top", events: {} })).toEqual({});
  });

  it("adds the first draft before a profile has any saved row", () => {
    const actual = aggregatePlanningEvents([], { playerId: "top", events: { [KEY]: event("match", "Match") } });
    expect(actual[KEY].events).toEqual([{ type: "match", label: "Match", playerIds: ["top"] }]);
  });

  it("keeps the same collective view when any viewer supplies their unchanged saved events", () => {
    const rows = [one("top", "scrim", "Scrim"), one("jgl", "match", "Match"), one("mid", "review", "Review")];
    const expected = aggregatePlanningEvents(rows);
    for (const item of rows) {
      expect(aggregatePlanningEvents(rows, { playerId: item.player_id, events: item.slots._events })).toEqual(expected);
    }
    expect(aggregatePlanningEvents(rows.map(item => ({ ...item, updated_at: "2099-01-01", notes: "Changed only my note" })))).toEqual(expected);
  });

  it("reads legacy JSON and events maps while ignoring empty or invalid sessions", () => {
    const rows = [
      { player_id: "top", slots: JSON.stringify({ events: { [KEY]: event("custom", "  Brief vocal  ") } }) },
      row("jgl", { "TUE|20:00": event("match", "   "), "WED|20:00": null, "THU|20:00": [] }),
      { player_id: "mid", slots: "not JSON" },
      { player_id: "adc", slots: null },
      { player_id: "sup", slots: { _events: [] } },
    ];
    expect(aggregatePlanningEvents(rows)).toEqual({
      [KEY]: { type: "custom", label: "Brief vocal", conflict: false, events: [{ type: "custom", label: "Brief vocal", playerIds: ["top"] }] },
    });
  });

  it("does not mutate rows, drafts, or expose their objects through its result", () => {
    const rows = [one("top", "scrim", "Scrim")];
    const draft = { playerId: "jgl", events: { [KEY]: event("match", "Match") } };
    const freeze = value => {
      Object.freeze(value);
      Object.values(value).filter(item => item && typeof item === "object").forEach(freeze);
    };
    freeze(rows); freeze(draft);
    const originalRows = JSON.stringify(rows);
    const originalDraft = JSON.stringify(draft);
    const actual = aggregatePlanningEvents(rows, draft);
    actual[KEY].events[0].label = "Mutated output";
    actual[KEY].events[1].playerIds.push("other");
    expect(JSON.stringify(rows)).toBe(originalRows);
    expect(JSON.stringify(draft)).toBe(originalDraft);
  });
});
