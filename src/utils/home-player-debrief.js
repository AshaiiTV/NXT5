import { canonicalRole } from "../../shared/roles.js";

const rows = (value) => Array.isArray(value) ? value : [];
const id = (value) => ["string", "number"].includes(typeof value) ? String(value).trim() : "";
const sameId = (a, b) => Boolean(id(a)) && id(a) === id(b);
const key = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const fold = (value) => key(value).normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘]/g, "'");
const fullRiotId = (value) => /^.+#[^#]+$/.test(String(value || "").trim());
const V3 = /^\[NXT5_REPORT_V3\]\r?$/m;

function teamRows(value, teamId) {
  return rows(value).filter((row) => row && id(row.id) && sameId(row.team_id, teamId));
}

function createdAt(row) {
  if (row.created_at == null || row.created_at === "") return -Infinity;
  const time = new Date(row.created_at).getTime();
  return Number.isFinite(time) ? time : -Infinity;
}

function newestFirst(a, b) {
  const aDate = createdAt(a);
  const bDate = createdAt(b);
  return aDate !== bDate ? (aDate > bDate ? -1 : 1) : id(b.id).localeCompare(id(a.id));
}

function linkedIds(row, legacy = false) {
  let value = row?.match_ids;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (Array.isArray(value)) {
    // Invalid entries must not turn a wider, malformed group into a matching subset.
    return value.every((entry) => id(entry)) ? [...new Set(value.map(id))] : [];
  }
  return legacy && id(row?.match_id) ? [id(row.match_id)] : [];
}

function aliases(record, participant = false) {
  const values = participant ? [record?.player_name, record?.summoner_name, record?.riot_id] : [record?.name, record?.riot_id];
  if (fullRiotId(record?.riot_id)) values.push(String(record.riot_id).split("#")[0]);
  return new Set(values.map(key).filter(Boolean));
}

function playerAliases(data, teamId, player, matchIds) {
  const own = aliases(player);
  const blocked = new Set();
  const roster = teamRows(data.players, teamId);
  for (const other of roster) {
    if (!sameId(other.id, player.id)) for (const alias of aliases(other)) blocked.add(alias);
  }
  const riot = fullRiotId(player.riot_id) ? key(player.riot_id) : "";
  const name = key(player.name);
  const participants = teamRows(data.matches, teamId)
    .filter((match) => matchIds.includes(id(match.id)))
    .flatMap((match) => rows(match.participants).filter((row) => row && (!id(row.match_id) || sameId(row.match_id, match.id))));
  for (const row of participants) {
    // A persisted assignment always wins over a matching name or Riot ID.
    const identityMatches = id(row.player_id) ? sameId(row.player_id, player.id)
      : fullRiotId(row.riot_id) && riot ? key(row.riot_id) === riot
        : Boolean(name && !blocked.has(name) && [row.player_name, row.summoner_name].some((value) => key(value) === name));
    const belongs = row.team_key === "ALLY" && identityMatches;
    for (const alias of aliases(row, true)) (belongs ? own : blocked).add(alias);
  }
  // Never attribute the generic fallback of an anonymous participant to a person.
  for (const value of ["Joueur", "Joueur inconnu", "Player", "Unknown player"]) blocked.add(key(value));
  return new Set([...own].filter((alias) => !blocked.has(alias)));
}

function headingIdentity(heading) {
  const roleHeading = /^(.+?)\s*[·|]\s*(.+)$/.exec(heading);
  if (roleHeading && (canonicalRole(roleHeading[1]) || ["sub", "role inconnu"].includes(fold(roleHeading[1])))) return roleHeading[2];
  const explicit = /^(?:joueur|player|notes? pour|pour)\s*:?\s+(.+)$/i.exec(heading);
  return explicit ? explicit[1] : heading;
}

const sectionHeadings = new Set([
  "VERDICT COACH", "CAUSE RACINE", "PISTES DE REVIEW", "STANDARD ATTENDU", "À GARDER", "À CORRIGER",
  "CHECKPOINT VOD", "CHECKPOINTS VOD", "PLAN D'EXÉCUTION", "VALIDATION", "QUESTION COACH", "QUESTIONS COACH",
  "LECTURE PAR JOUEUR", "NOTES STAFF", "NOTES STAFF CONSERVÉES", "NOTES CONSERVÉES", "NOTES PRÉCÉDENTES",
  "NOTES DE L’ÉQUIPE", "REPÈRES", "POINTS FORTS", "FOCUS", "OBJECTIF PRINCIPAL", "AXES DE TRAVAIL",
].map(fold));

const isOpponentHeading = (heading) => /^(?:adversaires?|enemy|enemies|opponents?|equipe adverse)(?:\s*[:·–—-].*)?$/.test(fold(heading));
const isAllyHeading = (heading) => /^(?:notre equipe|allies|ally|our team|equipe alliee)(?:\s*[:·–—-].*)?$/.test(fold(heading));

function isPlainHeading(line) {
  return sectionHeadings.has(fold(line.replace(/:$/, "")))
    || isOpponentHeading(line) || isAllyHeading(line)
    || /^(?:TOP|JGL|JUNGLE|MID|MIDDLE|ADC|BOTTOM|SUP|SUPPORT|UTILITY|SUB|Rôle inconnu)\s*[·|]\s*\S/i.test(line)
    || /^(?:joueur|player|notes? pour)\s*:\s*\S/i.test(line)
    || /^(?=.*\p{Lu})[\p{Lu}\d\s'’—–:()/]+$/u.test(line);
}

function extractSections(content, knownAliases) {
  const text = String(content || "");
  const hasBoundary = V3.test(text);
  // V2 and free text were fully editable; only V3 establishes generated provenance.
  let source = hasBoundary ? "analysis" : "notes";
  let current = null;
  let gameHeading = "";
  let ancestors = [];
  const sections = [];
  function finish() {
    if (current?.lines.length) sections.push(current);
    current = null;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[NXT5_REPORT_V[23]\]$/.test(line)) {
      finish();
      if (line === "[NXT5_REPORT_V3]") source = "notes";
      gameHeading = "";
      ancestors = [];
      continue;
    }
    const markdown = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(line);
    if (markdown || isPlainHeading(line)) {
      finish();
      const heading = (markdown ? markdown[2] : line).replace(/^\*\*(.+)\*\*$/, "$1");
      if (markdown) {
        const depth = markdown[1].length;
        ancestors = ancestors.filter((ancestor) => ancestor.depth < depth);
        ancestors.push({ depth, opponent: isOpponentHeading(heading) });
      } else if (isOpponentHeading(heading)) {
        // An unnumbered team heading remains the parent of subsequent player headings.
        ancestors.push({ depth: 1, opponent: true });
      }
      // Structural and player headings without Markdown do not end their parent team scope.
      if (isAllyHeading(heading)) ancestors = ancestors.filter((ancestor) => !ancestor.opponent);
      if (/^(?:GAME|PARTIE)\s+\d+\b/i.test(heading)) gameHeading = heading;
      const opponent = ancestors.some((ancestor) => ancestor.opponent);
      // A player's alias can itself be a collective heading (e.g. Focus).
      // Such names need an explicit player or role prefix to establish ownership.
      const structural = sectionHeadings.has(fold(heading.replace(/:$/, ""))) || isAllyHeading(heading) || isOpponentHeading(heading);
      if (!opponent && !structural && knownAliases.has(key(headingIdentity(heading)))) {
        current = { heading: gameHeading ? `${gameHeading} · ${heading}` : heading, lines: [], source };
      }
      continue;
    }
    if (current && line) current.lines.push(line.replace(/^(?:[-*•]|\d+[.)])\s+/, ""));
  }
  finish();
  return sections;
}

/** Saved observations about the linked player, from the newest group's published review only. */
export function getHomePlayerDebrief({ data = {}, teamId, player } = {}) {
  data = data || {};
  const group = teamRows(data.matchArchives, teamId).sort(newestFirst)[0] || null;
  if (!group) return { group: null, report: null, sections: [] };
  const matchIds = linkedIds(group);
  const report = matchIds.length ? teamRows(data.reports, teamId)
    .filter((row) => String(row.discord_status || "").toLowerCase() !== "draft")
    .filter((row) => {
      const reportIds = linkedIds(row, true);
      return reportIds.length === matchIds.length && reportIds.every((matchId) => matchIds.includes(matchId));
    }).sort(newestFirst)[0] || null : null;
  if (!report || !id(player?.id) || !sameId(player?.team_id, teamId)) return { group, report, sections: [] };
  return { group, report, sections: extractSections(report.content, playerAliases(data, teamId, player, matchIds)) };
}
