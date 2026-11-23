/** The V3 prefix is generated from match data; everything after it is staff text. */
export function staffNotesFromReport(content) {
  const text = String(content || "");
  const marker = /^\[NXT5_REPORT_V3\]\r?$/m.exec(text);
  if (!marker) {
    // V2 coaching text was editable, so it remains part of the note.
    return text.replace(/^\[NXT5_REPORT_V2\]\r?\n(?=Notes (?:précédentes|conservées|staff(?: conservées)?)[ \t]*:?(?:\r?\n|$))/m, "");
  }
  return text.slice(marker.index + marker[0].length)
    .replace(/^\r?\nNotes (?:précédentes|conservées|staff(?: conservées)?)[ \t]*:?(?:\r?\n|$)/i, "");
}

export function reportMatchIds(report) {
  let ids = report?.match_ids;
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  if (Array.isArray(ids) && ids.length) return [...new Set(ids.filter(Boolean).map(String))];
  return report?.match_id ? [String(report.match_id)] : [];
}

export function isTeamNote(report) {
  // The bootstrap may leave out an older content (content_omitted, content null;
  // an empty content is always sent). It is classified from its metadata; a
  // legacy V3 review is kept visible and its text is loaded when opened.
  if (report.content_omitted && report.content == null) return Boolean(report.original_debrief || report.is_team_note || report.source !== "auto");
  if (report.original_debrief) return Boolean(report.content?.trim());
  if (report.is_team_note) return true;
  if (/^\[NXT5_REPORT_V3\]\r?$/m.test(report.content || "")) return Boolean(staffNotesFromReport(report.content).trim());
  return report.source !== "auto";
}

export function noteBody(report) {
  return report.is_team_note || report.original_debrief ? String(report.content || "") : staffNotesFromReport(report.content);
}

// A legacy report is frozen on its first change from Notes. Its original match
// links and text stay readable even after the team edits, unlinks or removes the note.
export function savedDebrief(report) {
  if (report.is_team_note) return null;
  return report.original_debrief ? { ...report, ...report.original_debrief } : report;
}
