const completeRiotId = value => typeof value === "string" && /^[^#\r\n]{1,100}#[^#\s]{1,16}$/.test(value.trim())
  ? value.trim().toLowerCase() : "";

/** A suggestion needs five exact identities; names and partial rosters are not evidence. */
export function suggestImportSide(preview, roster) {
  const teams = preview?.teams || [];
  if (teams.length !== 2 || new Set(teams.map(team => team.side)).size !== 2
    || teams.some(team => !["BLUE", "RED"].includes(team.side) || team.participants?.length !== 5)) return "";
  const profiles = new Map();
  for (const player of roster) {
    const key = completeRiotId(player.riot_id);
    if (!key || !player.id) continue;
    const ids = profiles.get(key) || new Set();
    ids.add(player.id);
    profiles.set(key, ids);
  }
  const candidates = teams.filter(team => {
    const keys = team.participants.map(participant => completeRiotId(participant.riotId));
    if (keys.some(key => !key) || new Set(keys).size !== 5) return false;
    const participantIds = team.participants.map(participant => participant.participantId);
    if (participantIds.some(id => id == null) || new Set(participantIds).size !== 5) return false;
    if (keys.some(key => profiles.get(key)?.size !== 1)) return false;
    return new Set(keys.map(key => [...profiles.get(key)][0])).size === 5;
  });
  return candidates.length === 1 ? candidates[0].side : "";
}

/** Preserve supplied names; the validated preview ID is a usable, editable fallback. */
export function suggestedImportLabel(payload, preview) {
  return [payload?.label, payload?.metadata?.label, payload?.opponent, payload?.metadata?.opponent, preview?.gameId]
    .find(value => typeof value === "string" && value.trim())?.trim() || "";
}
