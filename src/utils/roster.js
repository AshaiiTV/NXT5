export const ROSTER_STATUS_OPTIONS = [
  { id: "MAIN", label: "Main Team", tone: "green" },
  { id: "SUB", label: "Sub", tone: "orange" },
  { id: "INACTIVE", label: "Hors roster", tone: "slate" },
];

const ROSTER_STATUS_IDS = new Set(ROSTER_STATUS_OPTIONS.map((item) => item.id));
const GAMEPLAY_ROLES = new Set(["TOP", "JGL", "MID", "ADC", "SUP", "SUB"]);
const STAFF_ROLES = new Set(["COACH", "ASSISTANT", "ANALYST", "MANAGER", "BOARD"]);

export function playerRosterStatus(player) {
  const role = String(player?.role || "").toUpperCase();
  const status = String(player?.roster_status || player?.rosterStatus || "").toUpperCase();
  if (STAFF_ROLES.has(role)) return "INACTIVE";
  if (role === "SUB") return "SUB";
  if (ROSTER_STATUS_IDS.has(status)) return status;
  return "MAIN";
}

export function rosterStatusMeta(playerOrStatus) {
  const status = typeof playerOrStatus === "string"
    ? String(playerOrStatus || "").toUpperCase()
    : playerRosterStatus(playerOrStatus);
  return ROSTER_STATUS_OPTIONS.find((item) => item.id === status) || ROSTER_STATUS_OPTIONS[0];
}

export function rosterPlayersByStatus(roster, status) {
  return (roster || []).filter((player) => GAMEPLAY_ROLES.has(String(player?.role || "").toUpperCase()) && playerRosterStatus(player) === status);
}

export function multiOpggUrlFromRoster(roster, region) {
  const summoners = (roster || [])
    .filter((player) => GAMEPLAY_ROLES.has(String(player?.role || "").toUpperCase()))
    .map((player) => {
      const [name, tag] = String(player?.riot_id || "").split("#").map((part) => part.trim());
      return name && tag ? `${name}#${tag}` : "";
    })
    .filter(Boolean);

  if (!summoners.length) return "";
  return `https://www.op.gg/lol/multisearch/${String(region || "EUW").toLowerCase()}?summoners=${encodeURIComponent(summoners.join(","))}`;
}
