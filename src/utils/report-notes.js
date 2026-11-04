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
