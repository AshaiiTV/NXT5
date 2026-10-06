import { ROLES, canonicalRole } from "../../shared/roles.js";
import { playerRosterStatus } from "./roster.js";

/** One stable representative per position: starter first, then an active substitute.
 * This is a display lineup, not the list of profiles allowed to edit availability.
 */
export function planningRoleSlots(players = []) {
  const candidates = players.filter((player) => player?.id != null && String(player.id) !== ""
    && canonicalRole(player.role) && playerRosterStatus(player) !== "INACTIVE")
    .sort((left, right) => Number(playerRosterStatus(left) !== "MAIN") - Number(playerRosterStatus(right) !== "MAIN")
      || String(left.name || "").localeCompare(String(right.name || ""))
      || String(left.id).localeCompare(String(right.id)));
  const selectedIds = new Set();
  return ROLES.map((role) => {
    const player = candidates.find((candidate) => canonicalRole(candidate.role) === role && !selectedIds.has(String(candidate.id))) || null;
    if (player) selectedIds.add(String(player.id));
    return { role, player };
  });
}

/** Count the same representatives shown by the five position icons, never extra substitutes. */
export function countAvailablePlanningRoles(roleSlots, availableIds = []) {
  const available = new Set(Array.from(availableIds, String));
  const countedIds = new Set();
  const countedRoles = new Set();
  for (const { role, player } of roleSlots) {
    const id = player?.id == null ? "" : String(player.id);
    if (!ROLES.includes(role) || !id || countedIds.has(id) || !available.has(id)) continue;
    countedIds.add(id);
    countedRoles.add(role);
  }
  return countedRoles.size;
}
