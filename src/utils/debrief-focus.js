// Highlight only decisions explicitly labelled by the staff. The complete notes
// remain the source of truth; arbitrary prose and generated advice are not inferred.
const labels = {
  keep: ["a garder", "ce qu'on garde", "ce qu’on garde", "keep", "what to keep", "mantener", "que mantener", "qué mantener"],
  action: ["prochaine partie", "prochaine game", "action pour la prochaine partie", "next game", "next match", "next action", "proxima partida", "siguiente partida"],
};
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const labelKey = (value) => Object.keys(labels).find((key) => labels[key].some((label) => normalize(label) === normalize(value)));

export function debriefFocus(notes) {
  const focus = { keep: "", action: "" };
  let text = String(notes || "");
  // Old fully editable reports can contain generated "À GARDER" advice.
  // It remains in the full notes, but must never be labelled as a staff decision.
  if (/^(?:\[NXT5_REPORT_V[23]\]|VERDICT COACH)\s*$/im.test(text)) {
    const boundaries = [...text.matchAll(/^Notes (?:précédentes|conservées|staff(?: conservées)?)[ \t]*:?[ \t]*\r?$/gim)];
    const boundary = boundaries.at(-1);
    if (!boundary) return focus;
    text = text.slice(boundary.index + boundary[0].length);
  }
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const plain = trimmed.replace(/^#{1,6}\s*/, "").replace(/^\*\*(.*?)\*\*:?$/, "$1").trim();
    const colon = plain.indexOf(":");
    const key = labelKey(colon < 0 ? plain : plain.slice(0, colon));
    if (key) {
      section = key;
      const inline = colon >= 0 ? plain.slice(colon + 1).trim() : "";
      if (inline && !focus[key] && !inline.startsWith("/")) { focus[key] = inline; section = null; }
      continue;
    }
    if (/^#/.test(trimmed)) { section = null; continue; }
    if (section && !focus[section]) {
      const decision = plain.replace(/^[-•*]\s*/, "").trim();
      if (decision && !decision.startsWith("/") && !decision.startsWith("[NXT5_REPORT_")) focus[section] = decision;
      section = null;
    }
  }
  return focus;
}

export function reviewResults(matches = []) {
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const losses = matches.filter((match) => match.result === "Défaite").length;
  return { wins, losses, unknown: matches.length - wins - losses };
}
