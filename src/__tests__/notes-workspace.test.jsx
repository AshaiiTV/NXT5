import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotesWorkspace from "../pages/workspace/NotesWorkspace.jsx";
import { staffNotesFromReport } from "../utils/report-notes.js";

describe("team notes", () => {
  it("shows staff writing from an existing V3 report without repeating its generated analysis", () => {
    const report = { id: "note-1", team_id: "team-1", title: "Notre prochaine séance", author_name: "Camille", content: "Graphique et chiffres générés\n[NXT5_REPORT_V3]\nNotes staff\nConserver le call avant l'objectif.", match_ids: ["match-1"], created_at: "2026-11-01T10:00:00Z" };
    const autoReport = { id: "auto", team_id: "team-1", title: "Review — chiffres calculés", source: "auto", content: "Statistiques déjà visibles dans Parties" };
    const html = renderToStaticMarkup(<NotesWorkspace data={{ reports: [report, autoReport], matches: [{ id: "match-1", team_id: "team-1", opponent: "Orbite" }] }} selectedTeamId="team-1" user={{ id: "user-1" }} route={{ path: "/notes", search: "?report=note-1" }} />);
    expect(html).toContain("Conserver le call avant l&#x27;objectif.");
    expect(html).toContain("/games?match=match-1");
    expect(html).not.toContain("Graphique et chiffres générés");
    expect(html).not.toContain("Review — chiffres calculés");
    expect(html).not.toContain("Moments clés");
  });

  it("preserves editable legacy text and separates only the V3 generated prefix", () => {
    expect(staffNotesFromReport("VERDICT COACH\nCorrection du staff\n[NXT5_REPORT_V2]\nNotes staff\nSuite")).toContain("Correction du staff");
    expect(staffNotesFromReport("Calcul généré\n[NXT5_REPORT_V3]\nNotes staff\nAction humaine")).toBe("Action humaine");
  });
});
