/** Stable import identity, including the tag and spaces within the game name. */
export const completeRiotId = value => typeof value === "string" && /^[^#\r\n]{1,100}#[^#\s]{1,16}$/.test(value.trim())
  ? value.trim().normalize("NFC").toLowerCase() : "";

export function participantRiotId(participant) {
  const name = participant?.riotIdGameName || participant?.summonerName || "";
  const tag = participant?.riotIdTagline || participant?.riotIdTagLine || "";
  return tag ? `${name}#${tag}` : name;
}
