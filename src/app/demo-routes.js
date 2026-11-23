import { DEMO_MATCHES } from "../pages/public/demo-data.js";

// Public demo URLs: /demo (games), /demo/analyses (trends),
// /demo/partie/:id (game analysis) and /demo/partie/:id/debrief, with id = DEMO_1…3.
export const DEMO_PATH = "/demo";
const MATCH_PATH = /^\/demo\/partie\/([^/]+)(\/debrief)?$/;

const normalize = (path = "") => (String(path).split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/");

export function findDemoMatch(value) {
  if (!value) return null;
  return DEMO_MATCHES.find((match) => match.game_id === value || match.id === value) || null;
}

/** Section and match derived from the URL; `known` is false for an unknown or malformed demo URL. */
export function parseDemoPath(pathname = DEMO_PATH) {
  const path = normalize(pathname);
  if (path === DEMO_PATH) return { section: "parties", match: null, known: true };
  if (path === `${DEMO_PATH}/analyses`) return { section: "analyses", match: null, known: true };
  const found = MATCH_PATH.exec(path);
  const id = found ? decodeURIComponentSafe(found[1]) : "";
  const match = DEMO_MATCHES.find((item) => item.game_id === id);
  if (!match) return { section: "parties", match: null, known: false };
  return { section: found[2] ? "debrief" : "parties", match, known: true };
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); } catch { return ""; }
}

export function demoPath(section = "parties", match = null) {
  if (section === "analyses") return `${DEMO_PATH}/analyses`;
  if (!match) return section === "debrief" ? demoPath("debrief", DEMO_MATCHES[2]) : DEMO_PATH;
  return `${DEMO_PATH}/partie/${encodeURIComponent(match.game_id)}${section === "debrief" ? "/debrief" : ""}`;
}

/** Every URL handled by the demo page, including unknown match ids (redirected to /demo). */
export function isDemoPath(pathname = "") {
  const path = normalize(pathname);
  return path === DEMO_PATH || path === `${DEMO_PATH}/analyses` || path === `${DEMO_PATH}/partie` || MATCH_PATH.test(path);
}
