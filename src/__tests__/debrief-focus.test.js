import { describe, expect, it } from "vitest";
import { debriefFocus, reviewResults } from "../utils/debrief-focus.js";

describe("staff focus highlights", () => {
  it("reads only explicitly labelled decisions and leaves the source untouched", () => {
    const notes = "  ## À GARDER\n- Notre premier dragon.\n- Autre précision\n\n## À CORRIGER\n- La vision\n## PROCHAINE PARTIE\n- Se regrouper 45 s avant le dragon.  \n";
    expect(debriefFocus(notes)).toEqual({ keep: "Notre premier dragon.", action: "Se regrouper 45 s avant le dragon." });
    expect(notes).toContain("- Autre précision");
  });
  it("does not turn arbitrary notes, commands or empty scaffolds into a decision", () => {
    expect(debriefFocus("Revoir la prochaine partie.\n/KDA ADC")).toEqual({ keep: "", action: "" });
    expect(debriefFocus("## À GARDER\n- \n## AUTRE RUBRIQUE\nDécision différente")).toEqual({ keep: "", action: "" });
    expect(debriefFocus("## À GARDER\n/KDA ADC")).toEqual({ keep: "", action: "" });
  });
  it("supports compact labels, multilingual templates and the first completed decision", () => {
    expect(debriefFocus("À garder : Notre rotation.\nProchaine partie : Jouer ensemble.")).toEqual({ keep: "Notre rotation.", action: "Jouer ensemble." });
    expect(debriefFocus("## KEEP\n- Vision\n## NEXT GAME\n- Group up")).toEqual({ keep: "Vision", action: "Group up" });
    expect(debriefFocus("## MANTENER\n- Visión\n## PRÓXIMA PARTIDA\n- Agruparnos")).toEqual({ keep: "Visión", action: "Agruparnos" });
    expect(debriefFocus("À garder:\n\n## À GARDER\n- Première décision\nÀ garder : Autre décision").keep).toBe("Première décision");
  });
  it("keeps unknown results separate from defeats", () => {
    expect(reviewResults([{ result: "Victoire" }, { result: "Défaite" }, { result: null }])).toEqual({ wins: 1, losses: 1, unknown: 1 });
  });
  it("never presents legacy generated advice as a staff decision, before or after V3 preservation", () => {
    const legacy = "VERDICT COACH\nAnalyse\nÀ GARDER\n- Conseil automatique\n[NXT5_REPORT_V2]\nNotes staff\n## À GARDER\n- Décision écrite\n";
    expect(debriefFocus(legacy)).toEqual({ keep: "Décision écrite", action: "" });
    expect(debriefFocus(legacy.replace("[NXT5_REPORT_V2]\n", ""))).toEqual({ keep: "Décision écrite", action: "" });
    expect(debriefFocus("VERDICT COACH\nÀ GARDER\n- Conseil automatique")).toEqual({ keep: "", action: "" });
  });
});
