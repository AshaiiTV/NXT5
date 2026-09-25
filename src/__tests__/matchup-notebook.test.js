import { describe, expect, it } from "vitest";
import { buildMatchups, championKey, normalizeMatchupRole, notebookStats, participantRunes, skillOrder, strictOpponent } from "../utils/matchup-notebook.js";

function duel({ role = "MID", enemyRole = role, opponent = "Syndra", result = "Victoire", frames, summary, duration, playerId = "player-1" } = {}) {
  const enemy = { team_key: "ENEMY", champion: opponent, role: enemyRole, raw: { participantId: 8 } };
  const row = { team_key: "ALLY", player_id: playerId, champion: "Orianna", role, raw: { participantId: 3 } };
  const match = { id: "match-1", result, participants: [row, enemy], raw: {} };
  if (frames !== undefined) match.raw.timeline = { info: { frames } };
  if (summary !== undefined) match.raw.nxt5 = { timelineSummary: { csMilestones: summary } };
  if (duration !== undefined) match.duration_seconds = duration;
  return { ...row, match };
}

function frame(minute, own = {}, enemy = {}) {
  return { timestamp: minute * 60_000, participantFrames: { 3: own, 8: enemy } };
}

function metric(row, minute = 10) {
  return notebookStats([row]).milestones.find((item) => item.minute === minute);
}

const completeFrame = (minute) => frame(minute,
  { minionsKilled: 80, jungleMinionsKilled: 3, totalGold: 4000, xp: 6000 },
  { minionsKilled: 70, jungleMinionsKilled: 1, totalGold: 4200, xp: 5700 });

describe("matchup identity and grouping", () => {
  it("normalizes champion keys and role aliases without assuming unknown positions", () => {
    expect(championKey(" Kha'Zix ")).toBe("khazix");
    expect(championKey("Kai’Sa")).toBe("kaisa");
    expect(championKey(null)).toBe("");
    expect(normalizeMatchupRole(" jungle ")).toBe("JGL");
    expect(normalizeMatchupRole("MIDDLE")).toBe("MID");
    expect(normalizeMatchupRole("BOTTOM")).toBe("ADC");
    expect(normalizeMatchupRole("UTILITY")).toBe("SUP");
    expect(normalizeMatchupRole("NONE")).toBe("");
  });

  it("requires exactly one enemy in the normalized recorded role", () => {
    const row = duel({ role: "MID", enemyRole: "MIDDLE" });
    expect(strictOpponent(row)).toBe(row.match.participants[1]);
    row.match.participants.push({ team_key: "ENEMY", role: "MID", champion: "Ahri" });
    expect(strictOpponent(row)).toBeNull();
    expect(strictOpponent(duel({ enemyRole: "TOP" }))).toBeNull();
    expect(strictOpponent(duel({ role: "NONE" }))).toBeNull();
    expect(strictOpponent(duel({ opponent: "" }))).toBeNull();
    expect(strictOpponent({ role: "MID", match: { participants: "invalid" } })).toBeNull();
  });

  it("never substitutes participant ID offset or array position for the opponent's role", () => {
    const row = duel({ enemyRole: "" });
    expect(row.match.participants[1].raw.participantId).toBe(row.raw.participantId + 5);
    expect(strictOpponent(row)).toBeNull();
    expect(buildMatchups([row])).toEqual([]);
  });

  it("groups aliases, preserves role identity, and sorts by volume then opponent name", () => {
    const rows = [duel({ role: "TOP" }), duel({ opponent: "Ahri" }), duel({ role: "MIDDLE" }), duel(), duel({ enemyRole: "TOP" })];
    const groups = buildMatchups(rows);
    expect(groups.map(({ key, games }) => ({ key, games }))).toEqual([
      { key: "MID|syndra", games: 2 }, { key: "MID|ahri", games: 1 }, { key: "TOP|syndra", games: 1 },
    ]);
    expect(groups[0].rows).toEqual([rows[2], rows[3]]);
    expect(groups[0]).toMatchObject({ opponentChampion: "Syndra", opponentKey: "syndra", role: "MID", cs10: { value: null, count: 0 } });
    expect(rows).toHaveLength(5);
  });

  it("keeps calls scoped to the supplied player's rows", () => {
    const first = duel({ playerId: "first", result: "Victoire" });
    const second = duel({ playerId: "second", result: "Défaite" });
    expect(buildMatchups([first])[0].results.rate).toBe(100);
    expect(buildMatchups([second])[0].results.rate).toBe(0);
  });

  it("excludes unknown outcomes from the winrate denominator", () => {
    const rows = [duel(), duel({ result: "Défaite" }), duel({ result: "Remake" }), duel({ result: null })];
    expect(notebookStats(rows).results).toEqual({ wins: 1, losses: 1, count: 2, rate: 50 });
    expect(buildMatchups(rows)[0]).toMatchObject({ games: 4, results: { wins: 1, losses: 1, count: 2, rate: 50 } });
    expect(notebookStats([duel({ result: "inconnu" })]).results).toEqual({ wins: 0, losses: 0, count: 0, rate: null });
  });
});

describe("paired timeline differences", () => {
  it("computes CS, gold and XP deltas at each milestone using both participants", () => {
    const row = duel({ frames: [completeFrame(10), completeFrame(15), completeFrame(20)] });
    for (const minute of [10, 15, 20]) {
      expect(metric(row, minute)).toEqual({ minute, cs: { value: 12, count: 1 }, gold: { value: -200, count: 1 }, xp: { value: 300, count: 1 } });
    }
    expect(buildMatchups([row])[0].cs10).toEqual({ value: 12, count: 1 });
  });

  it("averages paired observations with independent coverage for each metric", () => {
    const partial = duel({ frames: [frame(10, { totalGold: 1000 }, { totalGold: 500 })] });
    const stats = notebookStats([duel({ frames: [completeFrame(10)] }), partial, duel()]);
    expect(stats.milestones[0]).toMatchObject({ cs: { value: 12, count: 1 }, gold: { value: 150, count: 2 }, xp: { value: 300, count: 1 } });
  });

  it("selects the earliest available frame at or after the target, within sixty seconds", () => {
    const later = frame(11, { totalGold: 8000 }, { totalGold: 1000 });
    const row = duel({ frames: [later, completeFrame(10), frame(9.99)] });
    expect(metric(row).gold.value).toBe(-200);
    expect(metric(duel({ frames: [later] })).gold.value).toBe(7000);
    expect(metric(duel({ frames: [completeFrame(11.01), completeFrame(9.99)] })).gold).toEqual({ value: null, count: 0 });
  });

  it("does not pair different frames or use final totals to fill absent observations", () => {
    const row = duel({ frames: [frame(10, { totalGold: 1000 }, undefined)] });
    delete row.match.raw.timeline.info.frames[0].participantFrames[8];
    row.gold = 9000;
    row.cs = 250;
    row.match.participants[1].gold = 8000;
    row.match.participants[1].cs = 200;
    expect(metric(row)).toMatchObject({ cs: { value: null, count: 0 }, gold: { value: null, count: 0 }, xp: { value: null, count: 0 } });
  });

  it.each([null, undefined, "", " ", true, false, -1, Infinity, "invalid", {}, []])("treats invalid observation %s as missing", (value) => {
    const row = duel({ frames: [frame(10, { minionsKilled: 80, jungleMinionsKilled: value, totalGold: value, xp: value }, { minionsKilled: 70, jungleMinionsKilled: 0, totalGold: 1000, xp: 2000 })] });
    expect(metric(row)).toMatchObject({ cs: { value: null, count: 0 }, gold: { value: null, count: 0 }, xp: { value: null, count: 0 } });
  });

  it("retains real zero values and numeric strings", () => {
    const row = duel({ frames: [frame(10, { minionsKilled: "0", jungleMinionsKilled: 0, totalGold: "0", xp: 0 }, { minionsKilled: 0, jungleMinionsKilled: "0", totalGold: 0, xp: "0" })] });
    expect(metric(row)).toEqual({ minute: 10, cs: { value: 0, count: 1 }, gold: { value: 0, count: 1 }, xp: { value: 0, count: 1 } });
  });

  it("rejects observations after game end even if a stale summary or frame exists", () => {
    const summary = { 3: { cs20: 150 }, 8: { cs20: 100 } };
    expect(metric(duel({ duration: 1199, frames: [completeFrame(20)], summary }), 20).cs.count).toBe(0);
    expect(metric(duel({ duration: 1199, summary }), 20).cs.count).toBe(0);
    expect(metric(duel({ duration: 1200, frames: [completeFrame(20)] }), 20).cs.count).toBe(1);
    const textDuration = duel({ frames: [completeFrame(20)] });
    textDuration.match.duration = "19:59";
    expect(metric(textDuration, 20).cs.count).toBe(0);
    expect(metric(duel({ duration: 600, frames: [completeFrame(10.5)] })).cs.count).toBe(0);
  });

  it("uses paired CS10/20 summaries only when raw frames are absent", () => {
    const summary = { 3: { cs10: 75, cs15: 120, cs20: 140 }, 8: { cs10: 70, cs15: 100, cs20: 150 } };
    const row = duel({ summary });
    expect(metric(row).cs).toEqual({ value: 5, count: 1 });
    expect(metric(row, 15).cs).toEqual({ value: null, count: 0 });
    expect(metric(row, 20).cs).toEqual({ value: -10, count: 1 });
    expect(metric(row).gold).toEqual({ value: null, count: 0 });
    expect(metric(duel({ frames: [frame(1)], summary })).cs).toEqual({ value: null, count: 0 });
    expect(metric(duel({ summary: { 3: { cs10: 75 }, 8: { cs10: false } } })).cs.count).toBe(0);
  });

  it.each([
    (frames) => ({ metadata: { timeline: { info: { frames } } } }),
    (frames) => ({ timeline: { frames } }),
    (frames) => ({ timeline: { timeline: { info: { frames } } } }),
    (frames) => ({ timelineFrames: frames }),
  ])("supports retained importer timeline shapes", (rawFor) => {
    const row = duel();
    row.match.raw = rawFor([completeFrame(10)]);
    expect(metric(row).cs.value).toBe(12);
  });
});

describe("runes and skill order", () => {
  const riotPerks = {
    styles: [
      { description: "primaryStyle", style: 8200, selections: [{ perk: 8214 }, { perk: 8226 }, { perk: 8210 }, { perk: 8237 }] },
      { description: "subStyle", style: 8300, selections: [{ perk: 8304 }, { perk: 8345 }] },
    ],
    statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  };

  it("reads Match-v5 pages, secondary selections and shards in their recorded order", () => {
    expect(participantRunes({ raw: { perks: riotPerks } })).toEqual({ primaryStyle: 8200, secondaryStyle: 8300, selections: [8214, 8226, 8210, 8237, 8304, 8345], shards: [5008, 5008, 5011] });
    expect(participantRunes({ raw: { participant: { perks: riotPerks } } }).selections).toHaveLength(6);
  });

  it("reads flat LCU fields in stats and accepts numeric strings", () => {
    const stats = { perkPrimaryStyle: "8200", perkSubStyle: 8300, perk0: "8214", perk1: 8226, perk2: 8210, perk3: 8237, perk4: 8304, perk5: 8345, statPerk0: 5008, statPerk1: 5008, statPerk2: 5011 };
    expect(participantRunes({ raw: { stats } })).toEqual(participantRunes({ raw: { perks: riotPerks } }));
    expect(participantRunes({ raw: JSON.stringify({ participant: { stats } }) }).primaryStyle).toBe(8200);
  });

  it("does not invent a primary tree from a lone secondary tree or repeat a reordered primary tree", () => {
    const [primary, secondary] = riotPerks.styles;
    expect(participantRunes({ raw: { perks: { styles: [secondary] } } })).toEqual({
      primaryStyle: null, secondaryStyle: 8300, selections: [8304, 8345], shards: [],
    });
    expect(participantRunes({ raw: { perks: { styles: [null, primary] } } })).toEqual({
      primaryStyle: 8200, secondaryStyle: null, selections: [8214, 8226, 8210, 8237], shards: [],
    });
    const legacy = riotPerks.styles.map(({ description, ...style }) => style);
    expect(participantRunes({ raw: { perks: { styles: legacy } } })).toMatchObject({ primaryStyle: 8200, secondaryStyle: 8300 });
  });

  it("keeps missing choices empty and ignores invalid rune IDs", () => {
    expect(participantRunes({})).toEqual({ primaryStyle: null, secondaryStyle: null, selections: [], shards: [] });
    expect(participantRunes({ raw: { stats: { perkPrimaryStyle: true, perkSubStyle: 0, perk0: -1, perk1: null, perk2: "", perk3: 2.5 } } })).toEqual({ primaryStyle: null, secondaryStyle: null, selections: [], shards: [] });
    expect(participantRunes({ raw: "not-json" }).selections).toEqual([]);
  });

  it("orders this participant's skill levels and omits evolutions and malformed events", () => {
    const event = (skillSlot, timestamp, overrides = {}) => ({ type: "SKILL_LEVEL_UP", participantId: 3, skillSlot, timestamp, ...overrides });
    const events = [event(2, 180000), event(1, 0), event(3, 250000, { participantId: 8 }), event(4, 300000, { levelUpType: "EVOLVE" }), event(0, 50), event(2, null), event(3, 120000, { levelUpType: "NORMAL" })];
    const row = duel({ frames: [{ timestamp: 300000, events }] });
    expect(skillOrder(row)).toEqual([{ slot: 1, timestamp: 0 }, { slot: 3, timestamp: 120000 }, { slot: 2, timestamp: 180000 }]);
    row.match.raw = { nxt5: { timelineEvents: events } };
    expect(skillOrder(row)).toHaveLength(3);
    expect(skillOrder({ match: row.match })).toEqual([]);
  });
});
