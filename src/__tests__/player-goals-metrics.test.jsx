import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { goalMetricValue, evaluateGoal, PlayerGoalsPanel } from "../NextPhase.jsx";

let renderers = [];
afterEach(() => { act(() => renderers.forEach((r) => r.unmount())); renderers = []; });
const mount = (element) => { let r; act(() => { r = TestRenderer.create(element); }); renderers.push(r); return r; };
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");

describe("objectifs joueur — nouvelles mesures", () => {
  const match = { id: "m", created_at: "2026-11-20", game_duration: 1800 };

  it("lit les mesures Riot directes quand elles existent", () => {
    const row = { match, raw: { challenges: { teamDamagePercentage: 0.284, damagePerMinute: 712.4, goldPerMinute: 431, visionScorePerMinute: 2.1, controlWardsPlaced: 4 } } };
    expect(goalMetricValue(row, "damage_share")).toBeCloseTo(28.4);
    expect(goalMetricValue(row, "dpm")).toBe(712.4);
    expect(goalMetricValue(row, "gold_min")).toBe(431);
    expect(goalMetricValue(row, "vision_min")).toBe(2.1);
    expect(goalMetricValue(row, "control_wards")).toBe(4);
  });

  it("recalcule par minute à partir de la durée de la partie", () => {
    const row = { match, cs: 240, gold: 12000, damage: 18000, vision: 45 };
    expect(goalMetricValue(row, "cs_min")).toBe(8);
    expect(goalMetricValue(row, "gold_min")).toBe(400);
    expect(goalMetricValue(row, "dpm")).toBe(600);
    expect(goalMetricValue(row, "vision_min")).toBe(1.5);
    expect(goalMetricValue({ match: { duration: "25:00" }, cs_per_min: "7.2" }, "cs_min")).toBe(7.2);
    expect(goalMetricValue({ match: { duration: "25:00" }, raw: { totalMinionsKilled: 150, neutralMinionsKilled: 25 } }, "cs_min")).toBe(7);
  });

  it("marque une mesure absente comme indisponible", () => {
    for (const metric of ["cs15", "cs_min", "gold_min", "dpm", "damage_share", "vision_min", "control_wards"]) expect(goalMetricValue({}, metric)).toBeNull();
    const goal = { id: "g", player_id: "p", metric: "control_wards", operator: "gte", target_value: 3, sample_size: 5, required_successes: 3 };
    const rows = [4, 2, 5].map((value, i) => ({ match: { id: String(i), created_at: "2026-11-20" }, raw: { challenges: { controlWardsPlaced: value } } }));
    expect(evaluateGoal(goal, rows)).toMatchObject({ successes: 2, pending: 2, complete: false, impossible: false });
    const r = mount(<PlayerGoalsPanel goals={[goal]} rows={rows} player={{ id: "p" }} />);
    expect(r.root.findAllByProps({ className: "profile-goal-sample is-pending" })).toHaveLength(2);
    expect(text(r.toJSON())).toContain("Balises de contrôle posées");
  });

  it("propose des objectifs adaptés au poste quand le profil n’en a pas", () => {
    const r = mount(<PlayerGoalsPanel goals={[]} rows={[]} player={{ id: "p", role: "SUP" }} canManage />);
    const suggestions = r.root.findAll((node) => node.type === "button" && node.props.className === "profile-goal-suggestion");
    expect(suggestions).toHaveLength(3);
    expect(text(r.toJSON())).toContain("Éclairer la carte");
    act(() => suggestions[0].props.onClick());
    expect(r.root.findAll((node) => node.type === "form")).toHaveLength(1);
    expect(r.root.findByProps({ label: "Mesure à suivre" }).props.value).toBe("vision_min");
  });

  it("n’affiche pas les suggestions aux joueurs sans droit de gestion", () => {
    const r = mount(<PlayerGoalsPanel goals={[]} rows={[]} player={{ id: "p", role: "MID" }} />);
    expect(r.root.findAll((node) => node.props?.className === "profile-goal-suggestion")).toHaveLength(0);
  });
});
