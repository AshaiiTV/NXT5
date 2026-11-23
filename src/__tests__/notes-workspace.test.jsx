import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotesWorkspace from "../pages/workspace/NotesWorkspace.jsx";
import { isTeamNote, noteBody, staffNotesFromReport, savedDebrief } from "../../shared/report-notes.js";

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

  it("preserves the stored analysis on edit and keeps note-format text literal for new notes", () => {
    const prefix = "Verdict enregistré\r\n[NXT5_REPORT_V3]\r\nNotes staff\r\n";
    const original = { title: "Avant", content: prefix + "Ancienne note", match_ids: ["a", "b"] };
    const changed = { id: "1", title: "Après", content: "Correction", match_ids: ["c"], original_debrief: original };
    expect(savedDebrief(changed)).toMatchObject(original);
    expect(noteBody(changed)).toBe("Correction");
    expect(isTeamNote({ ...changed, content: "" })).toBe(false);
    expect(savedDebrief({ ...changed, content: "" })).toMatchObject(original);
    expect(isTeamNote({ source: "auto", content: prefix })).toBe(false);
    expect(isTeamNote({ source: "auto", content: prefix + "Commentaire" })).toBe(true);
    expect(noteBody({ is_team_note: true, content: prefix })).toBe(prefix);
  });

  it("classifies a note whose content was left out of the bootstrap without crashing", () => {
    expect(isTeamNote({ content: null, content_omitted: true, is_team_note: true })).toBe(true);
    expect(isTeamNote({ content: null, content_omitted: true, original_debrief: { title: "Avant" } })).toBe(true);
    expect(isTeamNote({ content: "", content_omitted: true, original_debrief: { title: "Avant" } })).toBe(false);
    expect(isTeamNote({ content: null, content_omitted: true, source: "auto" })).toBe(false);
    expect(noteBody({ content: null, content_omitted: true })).toBe("");
  });
});
