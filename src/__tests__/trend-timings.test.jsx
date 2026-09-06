import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { csAtMinute } from "../utils/match-timeline.js";
import { TrendsPage } from "../pages/workspace/TrendsPage.jsx";

function timelineRow(frames) {
  return { participantId: 1, match: { raw: { timeline: { info: { frames } } } } };
}

function frame(minute, minionsKilled, jungleMinionsKilled = 0) {
  return { timestamp: minute * 60_000, participantFrames: { "1": { minionsKilled, jungleMinionsKilled } } };
}

function summaryRow(summary) {
  return { raw: { participantId: 1 }, match: { raw: { nxt5: { timelineSummary: { csMilestones: { "1": summary } } } } } };
}

function gameWithoutTimeline(id) {
  const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
  const champions = ["Ornn", "Sejuani", "Orianna", "Jinx", "Lulu"];
  return {
    id,
    game_id: id,
    team_id: "team-1",
    result: "Victoire",
    game_date: "2026-08-01T12:00:00Z",
    duration: "30:00",
    duration_seconds: 1800,
    side: "Blue Side",
    raw: {},
    participants: ["ALLY", "ENEMY"].flatMap((team, teamIndex) => roles.map((role, index) => ({
      team_key: team,
      role,
      champion: champions[index],
      gold: 12000,
      damage: role === "ADC" ? 30000 : 12000,
      vision: 30,
      deaths: 2,
      kills: 3,
      assists: 8,
      kp: 0.6,
      cs_per_min: 7,
      raw: { teamId: teamIndex ? 200 : 100, participantId: teamIndex * 5 + index + 1 },
    }))),
  };
}

describe("CS timing observations", () => {
  it("does not reuse the last frame when a game ended before twenty minutes", () => {
    const row = timelineRow([frame(10, 75, 3), frame(15, 112, 4), frame(18, 134, 5)]);
    row.match.duration_seconds = 18 * 60;
    expect(csAtMinute(row, 20)).toBeNull();
    expect(csAtMinute(row, 10)).toBe(78);
  });

  it.each([null, undefined, ""])("keeps an unavailable summary observation (%s) null", (value) => {
    expect(csAtMinute(summaryRow({ cs10: 80, cs20: value }), 20)).toBeNull();
  });

  it("keeps explicit zero CS observations in summaries and timeline frames", () => {
    expect(csAtMinute(summaryRow({ cs20: 0 }), 20)).toBe(0);
    expect(csAtMinute(timelineRow([frame(20, 0, 0)]), 20)).toBe(0);
  });

  it("adds lane and jungle CS from the twenty-minute observation", () => {
    expect(csAtMinute(timelineRow([frame(19, 115, 6), frame(20, 123, 7), frame(21, 129, 8)]), 20)).toBe(130);
  });

  it("keeps absent participant observations unavailable", () => {
    expect(csAtMinute({ match: { raw: {} } }, 20)).toBeNull();
    expect(csAtMinute(timelineRow([{ timestamp: 20 * 60_000, participantFrames: {} }]), 20)).toBeNull();
  });
});

describe("trend coach data confidence", () => {
  it("shows unavailable timing when imported games have no timeline", () => {
    const html = renderToStaticMarkup(<TrendsPage selectedTeamId="team-1" data={{ matches: [gameWithoutTimeline("game-1")] }} />);
    expect(html).toContain("Timing indisponible");
    expect(html).not.toContain("0% avant 9:30");
    expect(html).not.toContain("0% early");
  });

  it("does not call a pattern validated after two wins", () => {
    const games = [gameWithoutTimeline("game-1"), gameWithoutTimeline("game-2")];
    const html = renderToStaticMarkup(<TrendsPage selectedTeamId="team-1" data={{ matches: games }} />);
    expect(html).toContain("Petit échantillon");
    expect(html).toContain("les patterns restent à confirmer");
    expect(html.toLowerCase()).not.toContain("levier validé");
  });
});
