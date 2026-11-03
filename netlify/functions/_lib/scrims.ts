import { sql } from "./db";
import { cleanText } from "./text";
import { TEAM_STAFF_ROLES } from "./teams";
import { logFailure } from "./safe-log";

export const SCRIM_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master"] as const;
export const SCRIM_TIER_LABELS: Record<string, string> = {
  iron: "Fer", bronze: "Bronze", silver: "Argent", gold: "Or", platinum: "Platine", emerald: "Émeraude", diamond: "Diamant", master: "Maître et plus",
};
const MAX_OPEN_OFFERS_PER_TEAM = 10;
const MAX_HORIZON_DAYS = 60;
const PENDING_STATES = ["pending"];

type Scrim = { message: string; status?: number; code?: string };
export function scrimError(message: string, status = 400, code = "SCRIM_INVALID"): never {
  throw Object.assign(new Error(message), { status, code });
}
function uuid(value: unknown, label = "Identifiant"): string {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) scrimError(`${label} invalide.`);
  return id;
}

/** Any member reads; the owner and staff roles publish, answer and confirm. */
export async function scrimMembership(userId: string, teamIdValue: unknown) {
  const teamId = uuid(teamIdValue, "Team");
  const rows = await sql`
    select teams.id, teams.name, teams.tag, teams.owner_id, team_members.role
    from teams
    left join team_members on team_members.team_id = teams.id and team_members.user_id = ${userId}
    where teams.id = ${teamId} and (teams.owner_id = ${userId} or team_members.user_id = ${userId})
    limit 1`;
  const team = rows[0];
  if (!team) scrimError("Tu ne fais pas partie de cette équipe.", 403, "SCRIM_FORBIDDEN");
  const canManage = team.owner_id === userId || TEAM_STAFF_ROLES.includes(String(team.role || "").toLowerCase());
  return { teamId, team, canManage };
}
function assertManager(membership: { canManage: boolean }) {
  if (!membership.canManage) scrimError("Seul le staff de l’équipe peut gérer les scrims.", 403, "SCRIM_FORBIDDEN");
}

function offerView(row: any, viewerTeamId: string) {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    teamTag: row.team_tag,
    region: row.team_region,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    games: row.games,
    levelMin: row.level_min,
    levelMax: row.level_max,
    note: row.note,
    status: row.status,
    matchedTeamId: row.matched_team_id,
    matchedTeamName: row.matched_team_name || null,
    matchedAt: row.matched_at,
    revision: row.revision,
    createdAt: row.created_at,
    mine: row.team_id === viewerTeamId,
    requestCount: Number(row.request_count || 0),
    myRequest: row.my_request_id ? { id: row.my_request_id, status: row.my_request_status, message: row.my_request_message } : null,
  };
}
function requestView(row: any) {
  return {
    id: row.id,
    offerId: row.offer_id,
    teamId: row.team_id,
    teamName: row.team_name,
    teamTag: row.team_tag,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    createdByName: row.created_by_name || null,
  };
}

export async function listScrims(userId: string, teamIdValue: unknown) {
  const membership = await scrimMembership(userId, teamIdValue);
  const { teamId } = membership;
  const [offers, mine, requests] = await Promise.all([
    sql`
      select o.*, t.name as team_name, t.tag as team_tag, t.region as team_region,
        (select count(*) from scrim_requests r where r.offer_id = o.id and r.status = 'pending') as request_count,
        r.id as my_request_id, r.status as my_request_status, r.message as my_request_message
      from scrim_offers o
      join teams t on t.id = o.team_id
      left join scrim_requests r on r.offer_id = o.id and r.team_id = ${teamId}
      where o.status = 'open' and o.team_id <> ${teamId} and o.starts_at > now()
      order by o.starts_at asc
      limit 200`,
    sql`
      select o.*, t.name as team_name, t.tag as team_tag, t.region as team_region, m.name as matched_team_name,
        (select count(*) from scrim_requests r where r.offer_id = o.id and r.status = 'pending') as request_count
      from scrim_offers o
      join teams t on t.id = o.team_id
      left join teams m on m.id = o.matched_team_id
      where o.team_id = ${teamId} and (o.status = 'open' or o.starts_at > now() - interval '7 days')
      order by o.starts_at asc
      limit 100`,
    sql`
      select r.*, t.name as team_name, t.tag as team_tag, u.name as created_by_name,
        o.team_id as offer_team_id, o.status as offer_status, o.starts_at as offer_starts_at
      from scrim_requests r
      join teams t on t.id = r.team_id
      join scrim_offers o on o.id = r.offer_id
      left join users u on u.id = r.created_by
      where (o.team_id = ${teamId} or r.team_id = ${teamId}) and o.starts_at > now() - interval '7 days'
      order by r.created_at asc
      limit 500`,
  ]);
  const byOffer = new Map<string, any[]>();
  for (const row of requests) {
    const list = byOffer.get(row.offer_id) || [];
    list.push(row);
    byOffer.set(row.offer_id, list);
  }
  const matchedOffers = await sql`
    select o.*, t.name as team_name, t.tag as team_tag, t.region as team_region, m.name as matched_team_name
    from scrim_offers o
    join teams t on t.id = o.team_id
    left join teams m on m.id = o.matched_team_id
    where o.matched_team_id = ${teamId} and o.starts_at > now() - interval '7 days'
    order by o.starts_at asc
    limit 100`;
  return {
    tiers: SCRIM_TIERS,
    canManage: membership.canManage,
    offers: offers.map((row) => offerView(row, teamId)),
    mine: mine.map((row) => ({ ...offerView(row, teamId), requests: (byOffer.get(row.id) || []).map(requestView) })),
    // Answers this team gave to other teams, with the offer they target.
    requests: requests.filter((row) => row.team_id === teamId).map((row) => ({
      ...requestView(row),
      offer: { id: row.offer_id, teamId: row.offer_team_id, status: row.offer_status, startsAt: row.offer_starts_at },
    })),
    matched: matchedOffers.map((row) => ({
      ...offerView(row, teamId),
      requests: (byOffer.get(row.id) || []).filter((r) => r.status === "accepted").map(requestView),
    })),
  };
}

function normalizeOffer(body: any) {
  const starts = Date.parse(String(body.startsAt || ""));
  if (!Number.isFinite(starts)) scrimError("Date et heure du scrim requises.");
  if (starts <= Date.now() + 30 * 60_000) scrimError("Le scrim doit commencer dans au moins 30 minutes.");
  if (starts > Date.now() + MAX_HORIZON_DAYS * 86_400_000) scrimError("Le scrim doit avoir lieu dans les 60 prochains jours.");
  const durationMinutes = Number(body.durationMinutes ?? 120);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 360) scrimError("Durée invalide (30 à 360 minutes).");
  const games = Number(body.games ?? 3);
  if (!Number.isInteger(games) || games < 1 || games > 10) scrimError("Nombre de games invalide (1 à 10).");
  const levelMin = String(body.levelMin || "");
  const levelMax = String(body.levelMax || "");
  if (!SCRIM_TIERS.includes(levelMin as any) || !SCRIM_TIERS.includes(levelMax as any)) scrimError("Niveau invalide.");
  if (SCRIM_TIERS.indexOf(levelMin as any) > SCRIM_TIERS.indexOf(levelMax as any)) scrimError("Le niveau minimum dépasse le niveau maximum.");
  const note = cleanText(body.note, 500);
  return { startsAt: new Date(starts).toISOString(), durationMinutes, games, levelMin, levelMax, note };
}

export async function createScrimOffer(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const offer = normalizeOffer(body);
  const rows = await sql`
    with open_count as (select count(*) as total from scrim_offers where team_id = ${membership.teamId} and status = 'open' and starts_at > now())
    insert into scrim_offers (team_id, created_by, starts_at, duration_minutes, games, level_min, level_max, note)
    select ${membership.teamId}, ${userId}, ${offer.startsAt}, ${offer.durationMinutes}, ${offer.games}, ${offer.levelMin}, ${offer.levelMax}, ${offer.note}
    from open_count where total < ${MAX_OPEN_OFFERS_PER_TEAM}
    returning *`;
  if (!rows[0]) scrimError("Ton équipe a déjà dix propositions ouvertes. Annule-en une avant d’en publier une autre.", 409, "SCRIM_LIMIT");
  await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${userId}, 'scrim.offer.create', 'scrim_offer', ${rows[0].id}, ${JSON.stringify({ teamId: membership.teamId })}::jsonb)`;
  return { offer: offerView({ ...rows[0], team_name: membership.team.name, team_tag: membership.team.tag }, membership.teamId) };
}

export async function cancelScrimOffer(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const offerId = uuid(body.offerId, "Proposition");
  const results = await sql.transaction((tx) => [
    tx`select id from scrim_offers where id = ${offerId} for update`,
    tx`update scrim_offers set status = 'cancelled', revision = revision + 1, updated_at = now()
       where id = ${offerId} and team_id = ${membership.teamId} and status = 'open' returning id`,
    tx`update scrim_requests set status = 'declined', updated_at = now()
       where offer_id = ${offerId} and status = 'pending'
         and exists (select 1 from scrim_offers o where o.id = ${offerId} and o.team_id = ${membership.teamId} and o.status = 'cancelled')`,
    tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
       select ${userId}, 'scrim.offer.cancel', 'scrim_offer', id, ${JSON.stringify({ teamId: membership.teamId })}::jsonb
       from scrim_offers where id = ${offerId} and team_id = ${membership.teamId} and status = 'cancelled'`,
  ]);
  if (!results[1][0]) scrimError("Cette proposition n’est plus ouverte.", 409, "SCRIM_STATE");
  return { ok: true };
}

export async function respondToScrim(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const offerId = uuid(body.offerId, "Proposition");
  const message = cleanText(body.message, 300);
  const rows = await sql`
    insert into scrim_requests (offer_id, team_id, created_by, message)
    select ${offerId}, ${membership.teamId}, ${userId}, ${message}
    from scrim_offers o where o.id = ${offerId} and o.status = 'open' and o.starts_at > now() and o.team_id <> ${membership.teamId}
    on conflict (offer_id, team_id) do update set message = excluded.message, created_by = excluded.created_by, status = 'pending', updated_at = now()
      where scrim_requests.status in ('withdrawn', 'declined')
    returning *`;
  if (!rows[0]) scrimError("Cette proposition n’est plus disponible, ou ton équipe a déjà répondu.", 409, "SCRIM_STATE");
  await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${userId}, 'scrim.request.create', 'scrim_request', ${rows[0].id}, ${JSON.stringify({ teamId: membership.teamId, offerId })}::jsonb)`;
  return { request: requestView({ ...rows[0], team_name: membership.team.name, team_tag: membership.team.tag }) };
}

export async function withdrawScrimRequest(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const requestId = uuid(body.requestId, "Réponse");
  const rows = await sql`update scrim_requests set status = 'withdrawn', updated_at = now()
    where id = ${requestId} and team_id = ${membership.teamId} and status = 'pending' returning id`;
  if (!rows[0]) scrimError("Cette réponse ne peut plus être retirée.", 409, "SCRIM_STATE");
  return { ok: true };
}

export async function declineScrimRequest(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const requestId = uuid(body.requestId, "Réponse");
  const rows = await sql`update scrim_requests r set status = 'declined', updated_at = now()
    from scrim_offers o
    where r.id = ${requestId} and o.id = r.offer_id and o.team_id = ${membership.teamId} and o.status = 'open' and r.status = 'pending'
    returning r.id`;
  if (!rows[0]) scrimError("Cette réponse ne peut plus être refusée.", 409, "SCRIM_STATE");
  return { ok: true };
}

function sessionTitle(opponent: string, games: number) {
  return cleanText(`Scrim vs ${opponent} · ${games} game${games > 1 ? "s" : ""}`, 140);
}

/** The offering team's staff confirms one answer. Both teams receive a planning session. */
export async function acceptScrimRequest(userId: string, body: any) {
  const membership = await scrimMembership(userId, body.teamId);
  assertManager(membership);
  const requestId = uuid(body.requestId, "Réponse");
  const expectedRevision = Number(body.expectedRevision);
  const found = await sql`
    select r.id as request_id, r.team_id as guest_team_id, r.status as request_status, r.message, g.name as guest_name, o.*
    from scrim_requests r join scrim_offers o on o.id = r.offer_id join teams g on g.id = r.team_id
    where r.id = ${requestId} and o.team_id = ${membership.teamId}`;
  const target = found[0];
  if (!target) scrimError("Réponse introuvable.", 404);
  if (target.status !== "open") scrimError("Cette proposition n’est plus ouverte.", 409, "SCRIM_STATE");
  if (target.request_status !== "pending") scrimError("Cette réponse n’est plus en attente.", 409, "SCRIM_STATE");
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(target.revision)) scrimError("La proposition a changé. Recharge la page.", 409, "SCRIM_STATE");
  const hostTitle = sessionTitle(target.guest_name, target.games);
  const guestTitle = sessionTitle(membership.team.name, target.games);
  const details = cleanText(`${SCRIM_TIER_LABELS[target.level_min]} à ${SCRIM_TIER_LABELS[target.level_max]}. ${target.note || ""} ${target.message ? `Réponse : ${target.message}` : ""}`.trim(), 1500);
  let results: any[];
  try {
    results = await sql.transaction((tx) => [
      tx`select id from scrim_offers where id = ${target.id} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end as offer_still_open from scrim_offers
         where id = ${target.id} and team_id = ${membership.teamId} and status = 'open' and revision = ${target.revision} and starts_at > now()`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end as request_still_pending from scrim_requests where id = ${requestId} and offer_id = ${target.id} and status = 'pending'`,
      tx`update scrim_offers set status = 'matched', matched_team_id = ${target.guest_team_id}, matched_request_id = ${requestId}, matched_at = now(), revision = revision + 1, updated_at = now() where id = ${target.id}`,
      tx`update scrim_requests set status = 'accepted', updated_at = now() where id = ${requestId}`,
      tx`update scrim_requests set status = 'declined', updated_at = now() where offer_id = ${target.id} and id <> ${requestId} and status = 'pending'`,
      tx`insert into discord_team_events (team_id, title, event_type, starts_at, duration_minutes, details, created_by)
         values (${membership.teamId}, ${hostTitle}, 'scrim', ${target.starts_at}, ${target.duration_minutes}, ${details}, ${userId}),
                (${target.guest_team_id}, ${guestTitle}, 'scrim', ${target.starts_at}, ${target.duration_minutes}, ${details}, ${userId})
         returning *`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values
         (${userId}, 'scrim.offer.accept', 'scrim_offer', ${target.id}, ${JSON.stringify({ teamId: membership.teamId, guestTeamId: target.guest_team_id, requestId })}::jsonb)`,
    ]);
  } catch (err: any) {
    if (err?.code === "22012") scrimError("La proposition a changé entre-temps. Recharge la page.", 409, "SCRIM_STATE");
    throw err;
  }
  const events = results[6] as any[];
  await Promise.all(events.map((event) => announceScrimSession(event, event.team_id === membership.teamId ? target.guest_name : membership.team.name).catch((error) => {
    logFailure("[scrims] Discord announcement skipped.", { code: error?.code || "SCRIM_DISCORD_SKIPPED" });
  })));
  return { ok: true, events: events.map((event) => ({ id: event.id, teamId: event.team_id, title: event.title, startsAt: event.starts_at })) };
}

// Best effort: the bot outbox delivers within its five-minute tick when the team
// has an active connection and a planning channel. Nothing here blocks the match.
async function announceScrimSession(event: any, opponentName: string) {
  const { isDiscordEnabled } = await import("./discord-config");
  if (!isDiscordEnabled()) return;
  const { botSettings, queueBotMessage } = await import("./discord-bot-schedule");
  const { botText, botLink } = await import("./discord-bot-common");
  const settings = await botSettings(event.team_id);
  const channelId = settings.channels?.planning;
  if (!channelId) return;
  const connection = (await sql.query("select guild_id, config_version from discord_connections where team_id=$1 and status='active' order by created_at desc limit 1", [event.team_id]))[0];
  if (!connection) return;
  const team = (await sql.query("select name from teams where id=$1", [event.team_id]))[0];
  const when = new Date(event.starts_at).toLocaleString("fr-FR", { timeZone: settings.timezone || "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  await queueBotMessage({
    teamId: event.team_id, guildId: connection.guild_id, channelId, channelKind: "planning", kind: "event_update",
    key: `event:${event.id}:${event.revision}`, configVersion: Number(connection.config_version), eventId: event.id, eventRevision: event.revision,
    payload: { embeds: [{ title: botText(`${team?.name || "NXT5"} · Scrim confirmé`, 256), description: botText(`Contre ${opponentName} · ${when} · ${event.duration_minutes} min.\nLa séance est dans le planning NXT5 des deux équipes.`, 1000), url: botLink(`/planning?team=${event.team_id}`), color: 0xe879f9 }], allowed_mentions: { parse: [] } },
  });
}
