/** Stable import identity, including the tag and spaces within the game name. */
export const completeRiotId = value => typeof value === "string" && /^[^#\r\n]{1,100}#[^#\s]{1,16}$/.test(value.trim())
  ? value.trim().replace(/\s+#/, "#").normalize("NFC").toLowerCase() : "";

/** The legacy importer also accepts spacing variants when nobody else can claim that ID. */
export function findImportProfile(riotId, roster, gameIds) {
  const key = completeRiotId(riotId);
  if (!key) return undefined;
  const exact = roster.filter(player => completeRiotId(player.riot_id) === key);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const compact = key.replace(/\s/g, "");
  const candidates = roster.filter(player => completeRiotId(player.riot_id).replace(/\s/g, "") === compact);
  if (!candidates.length) return undefined;
  const claimants = gameIds.filter(value => completeRiotId(value).replace(/\s/g, "") === compact);
  return candidates.length === 1 && claimants.length === 1 ? candidates[0] : null;
}

export function participantRiotId(participant) {
  const name = participant?.riotIdGameName || participant?.summonerName || "";
  const tag = participant?.riotIdTagline || participant?.riotIdTagLine || "";
  return tag ? `${name}#${tag}` : name;
}
