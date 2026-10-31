import crypto from "node:crypto";

export const NEXUS_SCHEMA_VERSION = "nexus-tournament-20261101-v1";
export const NEXUS_MAX_BODY = 5 * 1024 * 1024;
export function nexusError(
  message: string,
  status = 400,
  code = "NEXUS_INVALID",
): never {
  throw Object.assign(new Error(message), { status, code });
}
export function nexusHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
export function nexusUuid(value: unknown): string {
  const result = String(value || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    nexusError("Identifiant Nexus invalide.");
  return result.toLowerCase();
}
export function riotId(value: unknown): string {
  if (typeof value !== "string")
    nexusError("Riot ID complet requis (nom#tag).");
  const result = value.trim().normalize("NFC");
  if (result.length > 100 || !/^[^#\r\n\t]+#[^#\s]+$/u.test(result))
    nexusError("Riot ID complet requis (nom#tag).");
  const [name, tag] = result.split("#");
  if (!name.trim() || name !== name.trim() || !tag)
    nexusError("Riot ID invalide.");
  return result;
}
export function riotIdKey(value: unknown): string {
  return riotId(value).toLowerCase();
}
function boundedText(value: unknown, name: string): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > 120 || /[\r\n\x00-\x1f]/.test(result))
    nexusError(`${name} requis (120 caractères maximum).`);
  return result;
}
export function normalizeFixture(body: any) {
  const label = boundedText(body.label, "Nom de rencontre");
  const teamA = boundedText(body.teamA, "Équipe A");
  const teamB = boundedText(body.teamB, "Équipe B");
  const starts = Date.parse(body.startsAt);
  const ends = Date.parse(body.endsAt);
  if (
    !Number.isFinite(starts) ||
    !Number.isFinite(ends) ||
    ends - starts < 60_000 ||
    ends - starts > 48 * 3600_000
  )
    nexusError(
      "La fenêtre de rencontre doit durer entre 1 minute et 48 heures.",
    );
  if (body.platform !== "EUW1")
    nexusError("Seule la plateforme EUW1 est prise en charge.");
  if (!Array.isArray(body.roster) || body.roster.length !== 10)
    nexusError("Renseigne les dix Riot ID de la rencontre.");
  const roster = body.roster.map(riotId);
  if (new Set(roster.map(riotIdKey)).size !== 10)
    nexusError("Les dix Riot ID doivent être distincts.");
  const teamAId = body.teamAId ? nexusUuid(body.teamAId) : null;
  const teamBId = body.teamBId ? nexusUuid(body.teamBId) : null;
  if (teamAId && teamAId === teamBId)
    nexusError("Deux équipes NXT5 distinctes sont requises.");
  return {
    label,
    teamA,
    teamB,
    teamAId,
    teamBId,
    platform: "EUW1",
    startsAt: new Date(starts).toISOString(),
    endsAt: new Date(ends).toISOString(),
    roster,
  };
}
function participantRiotId(player: any): string {
  const name = player?.riotIdGameName;
  const tag = player?.riotIdTagline ?? player?.riotIdTagLine;
  if (typeof name === "string" && typeof tag === "string" && tag)
    return riotId(`${name}#${tag}`);
  // Never infer EUW or another tag for an incomplete identity.
  return riotId(player?.riotId || player?.summonerName);
}
function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}
export function validateSubmission(
  payload: any,
  fixture: any,
  now = Date.now(),
) {
  const match = payload?.match;
  const info = match?.info;
  const gameId = String(match?.metadata?.matchId || "");
  if (!/^EUW1_[1-9]\d{0,17}$/.test(gameId))
    nexusError("Identifiant de partie EUW1 invalide.");
  if (
    !info ||
    info.gameType !== "CUSTOM_GAME" ||
    Number(info.mapId) !== 11 ||
    (info.queueId != null && Number(info.queueId) !== 0)
  )
    nexusError(
      "Seules les parties personnalisées sur la Faille sont acceptées.",
    );
  if (info.gameId != null && String(info.gameId) !== gameId.slice(5))
    nexusError("Les identifiants de la partie ne correspondent pas.");
  if (
    !Array.isArray(info.participants) ||
    info.participants.length !== 10 ||
    !Array.isArray(info.teams) ||
    info.teams.length !== 2
  )
    nexusError("La partie doit contenir deux équipes de cinq joueurs.");
  const duration = Number(info.gameDuration);
  const source = String(payload?.source || "");
  if (!["lcu-match-history", "lcu-end-of-game"].includes(source))
    nexusError("Source de collecte Nexus invalide.");
  const start =
    source === "lcu-end-of-game"
      ? Number(info.gameEndTimestamp) - duration * 1000
      : Number(info.gameCreation);
  if (
    !Number.isSafeInteger(duration) ||
    duration < 1 ||
    duration > 6 * 3600 ||
    !Number.isSafeInteger(start) ||
    start < 1
  )
    nexusError("Horaires ou durée de partie absents.");
  const end = start + duration * 1000;
  if (
    start < Date.parse(fixture.starts_at) ||
    end > Date.parse(fixture.ends_at) ||
    end > now + 5 * 60_000
  )
    nexusError(
      "La partie ne correspond pas à la fenêtre de cette rencontre.",
      403,
      "NEXUS_FIXTURE_MISMATCH",
    );
  const teams = info.teams;
  if (
    new Set(teams.map((t: any) => t?.teamId)).size !== 2 ||
    !teams.every(
      (t: any) => [100, 200].includes(t?.teamId) && typeof t.win === "boolean",
    ) ||
    teams.filter((t: any) => t.win).length !== 1
  )
    nexusError("Résultat final absent ou invalide.");
  const rosterKeys = fixture.roster.map(riotIdKey);
  const participantIds = new Set();
  const observedIds = new Set();
  const teamRosters: Record<string, string[]> = { 100: [], 200: [] };
  for (const player of info.participants) {
    if (
      !player ||
      ![100, 200].includes(player.teamId) ||
      !Number.isInteger(player.participantId) ||
      player.participantId < 1 ||
      player.participantId > 10 ||
      participantIds.has(player.participantId)
    )
      nexusError("Participants de la partie invalides.");
    participantIds.add(player.participantId);
    const identity = riotIdKey(participantRiotId(player));
    if (!rosterKeys.includes(identity) || observedIds.has(identity))
      nexusError(
        "Le roster de la partie ne correspond pas aux dix joueurs inscrits.",
        403,
        "NEXUS_ROSTER_MISMATCH",
      );
    observedIds.add(identity);
    teamRosters[player.teamId].push(identity);
    if (
      !Number.isInteger(player.championId) ||
      player.championId < 1 ||
      typeof player.championName !== "string" ||
      !player.championName.trim() ||
      player.championName.length > 80
    )
      nexusError("Champion de participant absent.");
    for (const field of [
      "kills",
      "deaths",
      "assists",
      "totalMinionsKilled",
      "neutralMinionsKilled",
      "goldEarned",
      "totalDamageDealtToChampions",
      "visionScore",
      "item0",
      "item1",
      "item2",
      "item3",
      "item4",
      "item5",
      "item6",
    ]) {
      const value = player[field];
      if (
        value !== undefined &&
        value !== null &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 2_147_483_647)
      )
        nexusError(`Statistique invalide : ${field}.`);
    }
  }
  const expectedA = new Set(rosterKeys.slice(0, 5));
  const expectedB = new Set(rosterKeys.slice(5));
  const validSides = (a: string[], b: string[]) =>
    a.length === 5 &&
    b.length === 5 &&
    a.every((id) => expectedA.has(id)) &&
    b.every((id) => expectedB.has(id));
  if (
    !validSides(teamRosters[100], teamRosters[200]) &&
    !validSides(teamRosters[200], teamRosters[100])
  )
    nexusError(
      "La composition des équipes ne correspond pas à la rencontre.",
      403,
      "NEXUS_ROSTER_MISMATCH",
    );
  const timeline = payload.timeline ?? null;
  if (
    timeline !== null &&
    (typeof timeline !== "object" || Array.isArray(timeline))
  )
    nexusError("Chronologie invalide.");
  if (timeline?.metadata?.matchId && timeline.metadata.matchId !== gameId)
    nexusError("La chronologie appartient à une autre partie.");
  // Guard oversized nesting/nonfinite numeric values before canonicalization.
  const pending = [{ value: { match, timeline }, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++count > 250_000 || depth > 40)
      nexusError("Données de partie trop complexes.");
    if (typeof value === "number" && !Number.isFinite(value))
      nexusError("Nombre non fini dans la partie.");
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        pending.push({ value: child as any, depth: depth + 1 });
  }
  const clean = { match, timeline, source };
  const fields = [
    "participantId",
    "teamId",
    "championId",
    "championName",
    "kills",
    "deaths",
    "assists",
    "totalMinionsKilled",
    "neutralMinionsKilled",
    "goldEarned",
    "totalDamageDealtToChampions",
    "visionScore",
    "item0",
    "item1",
    "item2",
    "item3",
    "item4",
    "item5",
    "item6",
  ];
  const winningSide = teams.find((team: any) => team.win).teamId;
  const summary = {
    duration,
    gameStartedAt: start,
    winner: expectedA.has(teamRosters[winningSide][0]) ? "A" : "B",
    participants: info.participants.map((player: any) => ({
      ...Object.fromEntries(
        fields
          .filter((field) => player[field] !== undefined)
          .map((field) => [field, player[field]]),
      ),
      riotId: participantRiotId(player),
    })),
    teams: teams.map((team: any) => ({ teamId: team.teamId, win: team.win })),
  };
  return {
    gameId,
    source,
    payload: clean,
    summary,
    hash: nexusHash(JSON.stringify(stable(clean))),
  };
}
