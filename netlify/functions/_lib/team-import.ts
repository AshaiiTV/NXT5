import crypto from "node:crypto";
import { sql } from "./db";
import { cleanText } from "./text";
import { TEAM_STAFF_ROLES } from "./teams";
import { assertImportMatch } from "./import-validation";
import { persistAnalyzedMatch } from "./analytics";
import { seedDefaultMatchCategories } from "./match-categories";

export const TEAM_IMPORT_MAX_BODY = 5 * 1024 * 1024;
export const TEAM_IMPORT_LINK_DAYS = 90;
const CODE_MINUTES = 15;
const MAX_ACTIVE_LINKS = 5;
const MAX_SUBMISSIONS_PER_LINK = 500;
/** Roster members that must play on one side for a game to belong to the team. */
export const AUTO_IMPORT_MIN_ROSTER = 4;
const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"] as const;
const PLAYING_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const POSITIONS: Record<string, string> = { TOP: "TOP", JUNGLE: "JGL", JGL: "JGL", MIDDLE: "MID", MID: "MID", BOTTOM: "ADC", BOT: "ADC", ADC: "ADC", UTILITY: "SUP", SUPPORT: "SUP", SUP: "SUP" };
const SMITE = 11;

export function importError(message: string, status = 400, code = "TEAM_IMPORT_INVALID"): never {
  throw Object.assign(new Error(message), { status, code });
}
function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function uuid(value: unknown, label = "Identifiant"): string {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) importError(`${label} invalide.`);
  return id;
}
export function normalizeRiotId(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace("#", "-");
}
function participantRiotId(p: any) {
  const name = p?.riotIdGameName || p?.summonerName || "";
  const tag = p?.riotIdTagline || p?.riotIdTagLine || "";
  return tag ? `${name}#${tag}` : name;
}

/** Any member reads; the owner and staff roles create and revoke links. */
export async function teamImportMembership(userId: string, teamIdValue: unknown) {
  const teamId = uuid(teamIdValue, "Team");
  const rows = await sql`
    select teams.id, teams.name, teams.tag, teams.owner_id, team_members.role
    from teams
    left join team_members on team_members.team_id = teams.id and team_members.user_id = ${userId}
    where teams.id = ${teamId} and (teams.owner_id = ${userId} or team_members.user_id = ${userId})
    limit 1`;
  const team = rows[0];
  if (!team) importError("Tu ne fais pas partie de cette équipe.", 403, "TEAM_IMPORT_FORBIDDEN");
  const canManage = team.owner_id === userId || TEAM_STAFF_ROLES.includes(String(team.role || "").toLowerCase());
  return { teamId, team, canManage };
}
function assertManager(membership: { canManage: boolean }) {
  if (!membership.canManage) importError("Seul le staff de l’équipe gère la liaison de l’Importer.", 403, "TEAM_IMPORT_FORBIDDEN");
}

export function linkView(row: any) {
  const active = !row.revoked_at && Date.parse(row.expires_at) > Date.now();
  return {
    id: row.id,
    label: row.label || "",
    categoryId: row.category_id || null,
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    status: row.revoked_at ? "revoked" : Date.parse(row.expires_at) <= Date.now() ? "expired" : row.connected_at ? "connected" : Date.parse(row.code_expires_at) > Date.now() ? "waiting" : "unused",
    active,
  };
}
const RECEIVING_STALE_MINUTES = 10;
export function submissionView(row: any) {
  return { id: row.id, gameId: row.game_id, status: row.status, reason: row.reason || "", matchId: row.match_id, createdAt: row.created_at, updatedAt: row.updated_at, linkId: row.link_id };
}

export async function listTeamImport(userId: string, teamIdValue: unknown) {
  const membership = await teamImportMembership(userId, teamIdValue);
  const [links, pending, recent] = await Promise.all([
    sql`select * from team_import_links where team_id = ${membership.teamId} and created_at > now() - interval '120 days' order by created_at desc limit 20`,
    // Every game still waiting for the staff stays reachable, whatever arrived since.
    sql`select id, link_id, game_id, status, reason, match_id, created_at, updated_at from team_import_submissions where team_id = ${membership.teamId} and status = 'pending' order by created_at desc limit 100`,
    sql`select id, link_id, game_id, status, reason, match_id, created_at, updated_at from team_import_submissions where team_id = ${membership.teamId} and status <> 'pending' order by created_at desc limit 40`,
  ]);
  return {
    canManage: membership.canManage,
    minRoster: AUTO_IMPORT_MIN_ROSTER,
    links: links.map(linkView).filter((link) => link.status !== "unused"),
    submissions: [...pending, ...recent].map(submissionView),
  };
}

/** A single-use code the staff pastes in NXT5 Importer. */
export async function createTeamImportCode(userId: string, body: any) {
  const membership = await teamImportMembership(userId, body.teamId);
  assertManager(membership);
  const categoryId = body.categoryId ? uuid(body.categoryId, "Tag") : null;
  if (categoryId && !(await sql`select id from match_categories where id = ${categoryId} and team_id = ${membership.teamId}`)[0]) importError("Ce tag n’appartient pas à l’équipe.", 404);
  const code = crypto.randomBytes(12).toString("hex").toUpperCase();
  const linkId = crypto.randomUUID();
  const rows = await sql`
    insert into team_import_links (id, team_id, created_by, category_id, code_hash, code_expires_at, expires_at)
    select ${linkId}, ${membership.teamId}, ${userId}, ${categoryId}, ${hash(code)}, now() + (${CODE_MINUTES} || ' minutes')::interval, now() + (${TEAM_IMPORT_LINK_DAYS} || ' days')::interval
    where (select count(*) from team_import_links where team_id = ${membership.teamId} and revoked_at is null and expires_at > now() and (token_hash is not null or code_expires_at > now())) < ${MAX_ACTIVE_LINKS}
    returning *`;
  if (!rows[0]) importError("Cinq liaisons sont déjà actives pour cette équipe. Révoque-en une avant d’en créer une autre.", 409, "TEAM_IMPORT_LIMIT");
  await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${userId}, 'team_import.link.create', 'team_import_link', ${linkId}, ${JSON.stringify({ teamId: membership.teamId })}::jsonb)`;
  return { code: code.match(/.{1,4}/g)!.join("-"), expiresAt: rows[0].code_expires_at, link: linkView(rows[0]) };
}

export async function revokeTeamImportLink(userId: string, body: any) {
  const membership = await teamImportMembership(userId, body.teamId);
  assertManager(membership);
  const linkId = uuid(body.linkId, "Liaison");
  const rows = await sql`update team_import_links set revoked_at = coalesce(revoked_at, now()), code_hash = null where id = ${linkId} and team_id = ${membership.teamId} returning id`;
  if (!rows[0]) importError("Liaison introuvable.", 404);
  await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${userId}, 'team_import.link.revoke', 'team_import_link', ${linkId}, ${JSON.stringify({ teamId: membership.teamId })}::jsonb)`;
  return { ok: true };
}

async function activeRoster(teamId: string) {
  return sql`select id, name, riot_id, role, roster_status from players where team_id = ${teamId} and roster_status in ('MAIN','SUB') and riot_id is not null and riot_id <> '' order by role, name`;
}
function binding(link: any, team: any, roster: any[]) {
  return {
    linkId: link.id,
    teamId: team.id,
    teamName: team.name,
    teamTag: team.tag,
    expiresAt: link.expires_at,
    minRoster: AUTO_IMPORT_MIN_ROSTER,
    roster: roster.map((player) => ({ riotId: player.riot_id, role: player.role, status: player.roster_status })),
  };
}

/** The desktop app exchanges the code once for a long-lived, revocable token. */
export async function connectTeamImport(codeValue: unknown, labelValue: unknown) {
  const code = String(codeValue || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-F0-9]{24}$/.test(code)) importError("Code de liaison invalide.", 401, "TEAM_IMPORT_CODE_INVALID");
  const label = cleanText(labelValue, 80);
  const token = `ti_${crypto.randomBytes(32).toString("hex")}`;
  const rows = await sql`
    update team_import_links set token_hash = ${hash(token)}, connected_at = now(), last_seen_at = now(), code_hash = null, label = ${label}
    where code_hash = ${hash(code)} and token_hash is null and revoked_at is null and code_expires_at > clock_timestamp() and expires_at > clock_timestamp()
    returning *`;
  const link = rows[0];
  if (!link) importError("Code expiré, déjà utilisé ou révoqué. Génère un nouveau code dans NXT5.", 401, "TEAM_IMPORT_CODE_INVALID");
  const team = (await sql`select id, name, tag from teams where id = ${link.team_id}`)[0];
  if (!team) importError("Équipe indisponible.", 401, "TEAM_IMPORT_UNAUTHORIZED");
  return { token, binding: binding(link, team, await activeRoster(team.id)), schemaVersion: 1 };
}

export function readTeamImportBearer(request: Request): string {
  const token = /^Bearer (ti_[a-f0-9]{64})$/.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) importError("Liaison NXT5 Importer requise.", 401, "TEAM_IMPORT_UNAUTHORIZED");
  return token;
}
export async function readTeamImportAuthorization(token: string) {
  const rows = await sql`
    update team_import_links l set last_seen_at = now()
    from teams t
    where l.team_id = t.id and l.token_hash = ${hash(token)} and l.revoked_at is null and l.expires_at > clock_timestamp()
    returning to_jsonb(l) as link, to_jsonb(t) as team`;
  if (!rows[0]) importError("Liaison expirée ou révoquée. Génère un nouveau code dans NXT5.", 401, "TEAM_IMPORT_UNAUTHORIZED");
  return rows[0] as { link: any; team: any };
}
export async function teamImportSession(token: string) {
  const { link, team } = await readTeamImportAuthorization(token);
  return { valid: true, binding: binding(link, team, await activeRoster(team.id)), schemaVersion: 1 };
}

function positionOf(participant: any): string | null {
  for (const key of ["teamPosition", "individualPosition", "lane"]) {
    const role = POSITIONS[String(participant?.[key] || "").toUpperCase()];
    if (role) return role;
  }
  return null;
}
function hasSmite(participant: any) {
  return [participant?.summoner1Id, participant?.summoner2Id, participant?.spell1Id, participant?.spell2Id].map(Number).includes(SMITE);
}
/** Five distinct roles for one side, or null when Riot's positions do not settle them. */
function resolveSideRoles(participants: any[], preferred: (participant: any) => string | null) {
  const roles = new Map<number, string | null>(participants.map((p) => [Number(p.participantId), preferred(p) || positionOf(p)]));
  for (const p of participants) if (!roles.get(Number(p.participantId)) && hasSmite(p)) roles.set(Number(p.participantId), "JGL");
  const taken = [...roles.values()].filter(Boolean);
  if (new Set(taken).size !== taken.length) return null;
  const missing = participants.filter((p) => !roles.get(Number(p.participantId)));
  const free = ROLES.filter((role) => !taken.includes(role));
  if (missing.length === 1 && free.length === 1) roles.set(Number(missing[0].participantId), free[0]);
  if ([...roles.values()].some((role) => !role) || new Set(roles.values()).size !== 5) return null;
  return roles as Map<number, string>;
}

/** Side, roles and profiles the manual import form would ask for, or the reason it cannot be settled. */
export function resolveAutoAssignments(match: any, roster: any[]) {
  const byRiot = new Map(roster.map((player) => [normalizeRiotId(player.riot_id), player]));
  const sides = { 100: [] as any[], 200: [] as any[] };
  for (const p of match.info.participants) sides[p.teamId as 100 | 200]?.push(p);
  const matched = (participants: any[]) => participants.filter((p) => byRiot.has(normalizeRiotId(participantRiotId(p))));
  const blue = matched(sides[100]).length, red = matched(sides[200]).length;
  if (Math.max(blue, red) < AUTO_IMPORT_MIN_ROSTER) return { skipped: `Partie hors équipe : ${Math.max(blue, red)} joueur(s) de l’effectif reconnu(s), ${AUTO_IMPORT_MIN_ROSTER} requis.` };
  if (blue === red) return { skipped: "Les deux équipes contiennent autant de joueurs de l’effectif." };
  const allyTeamId = blue > red ? 100 : 200;
  const allies = sides[allyTeamId], enemies = sides[allyTeamId === 100 ? 200 : 100];
  const allyPlayer = (p: any) => byRiot.get(normalizeRiotId(participantRiotId(p)));
  const allyRoles = resolveSideRoles(allies, (p) => positionOf(p) || (PLAYING_ROLES.includes(String(allyPlayer(p)?.role)) ? String(allyPlayer(p).role) : null));
  if (!allyRoles) return { pending: "Les postes de ton équipe n’ont pas pu être reconnus automatiquement." };
  const enemyRoles = resolveSideRoles(enemies, () => null);
  if (!enemyRoles) return { pending: "Les postes de l’équipe adverse n’ont pas pu être reconnus automatiquement." };
  const unknownAlly = allies.find((p) => !allyPlayer(p));
  if (unknownAlly) return { pending: `${participantRiotId(unknownAlly)} n’est pas dans l’effectif : associe ce joueur à un profil.` };
  const laneAssignments: Record<string, string> = {}, enemyLaneAssignments: Record<string, string> = {}, playerAssignments: Record<string, string> = {};
  for (const p of allies) { const role = allyRoles.get(Number(p.participantId))!; laneAssignments[role] = `participant:${p.participantId}`; playerAssignments[role] = String(allyPlayer(p).id); }
  for (const p of enemies) enemyLaneAssignments[enemyRoles.get(Number(p.participantId))!] = `participant:${p.participantId}`;
  if (new Set(Object.values(playerAssignments)).size !== 5) return { pending: "Deux participants correspondent au même profil de l’effectif." };
  return { allyTeamSide: allyTeamId === 100 ? "BLUE" : "RED", laneAssignments, enemyLaneAssignments, playerAssignments };
}

function matchGameId(match: any) {
  return String(match?.metadata?.matchId || match?.metadata?.gameId || "").trim().toUpperCase();
}

/** Receive one game from the desktop app. Imports it when everything resolves, otherwise keeps it for the staff. */
export async function submitTeamImport(token: string, body: any, idempotencyKey: string, signal?: AbortSignal) {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(idempotencyKey)) importError("Clé de répétition invalide.");
  const { link, team } = await readTeamImportAuthorization(token);
  const match = body?.payload?.match || body?.match;
  const timeline = body?.payload?.timeline ?? body?.timeline ?? null;
  if (!match || typeof match !== "object") importError("Partie absente de l’envoi.");
  const gameId = matchGameId(match);
  if (!/^[A-Z0-9]+_\d+$/.test(gameId)) importError("Identifiant de partie invalide.");
  if (timeline !== null && (typeof timeline !== "object" || Array.isArray(timeline))) importError("Chronologie invalide.");
  assertImportMatch(match);
  if (timeline) match.timeline = timeline;

  const repeated = await sql`select * from team_import_submissions where link_id = ${link.id} and idempotency_key = ${idempotencyKey} and status <> 'receiving' limit 1`;
  if (repeated[0]) return { duplicate: true, submission: submissionView(repeated[0]) };
  const count = await sql`select count(*)::int as total from team_import_submissions where link_id = ${link.id}`;
  if (Number(count[0]?.total || 0) >= MAX_SUBMISSIONS_PER_LINK) importError("Limite de parties atteinte pour cette liaison. Génère un nouveau code.", 429, "TEAM_IMPORT_LIMIT");

  // One reception per game and team: the first caller claims the row, a concurrent
  // computer gets the existing record, a reception stuck for ten minutes is taken over.
  const claimed = await sql`
    insert into team_import_submissions (team_id, link_id, game_id, idempotency_key, status, reason)
    values (${team.id}, ${link.id}, ${gameId}, ${idempotencyKey}, 'receiving', 'Réception en cours.')
    on conflict (team_id, game_id) do update set link_id = excluded.link_id, idempotency_key = excluded.idempotency_key, updated_at = now()
      where team_import_submissions.status = 'receiving' and team_import_submissions.updated_at < now() - (${RECEIVING_STALE_MINUTES} || ' minutes')::interval
    returning *`;
  if (!claimed[0]) {
    const existing = (await sql`select * from team_import_submissions where team_id = ${team.id} and game_id = ${gameId}`)[0];
    return { duplicate: true, submission: existing ? submissionView(existing) : { gameId, status: "receiving", reason: "Réception en cours sur un autre ordinateur." } };
  }
  const claim = claimed[0];
  const settle = (status: string, reason: string, extra: { matchId?: string | null; payload?: any } = {}) => recordSubmission({ claim, link, team, gameId, status, reason, ...extra });
  // The stored copy keeps one timeline so the staff can finalize it within the manual import limit.
  const stored = () => ({ match: { ...match, timeline: undefined }, timeline });
  try {
    const existing = await sql`select id from matches where team_id = ${team.id} and game_id = ${gameId}`;
    if (existing[0]) return { duplicate: true, submission: await settle("imported", "Partie déjà présente dans NXT5.", { matchId: existing[0].id }) };
    const roster = await sql`select * from players where team_id = ${team.id}`;
    const categoryIds = await importCategoryIds(team.id, link);
    if (!categoryIds.length) return { accepted: true, submission: await settle("pending", "Aucun tag de partie disponible : choisis-en un dans NXT5.", { payload: stored() }) };
    const plan = resolveAutoAssignments(match, roster);
    if ("skipped" in plan) return { accepted: true, submission: await settle("skipped", String(plan.skipped)) };
    if ("pending" in plan) return { accepted: true, submission: await settle("pending", String(plan.pending), { payload: stored() }) };
    let saved;
    try {
      saved = await persistAnalyzedMatch({ team, gameId, match, roster, userId: link.created_by, laneAssignments: plan.laneAssignments, enemyLaneAssignments: plan.enemyLaneAssignments, playerAssignments: plan.playerAssignments, allyTeamSide: plan.allyTeamSide, categoryIds, signal, guards: [
        (tx: any) => tx`select id from team_import_links where id = ${link.id} for update`,
        // A revocation or expiry completed before this transaction aborts the whole import.
        (tx: any) => tx`select 1 / case when count(*) = 1 then 1 else 0 end as link_still_valid from team_import_links
                   where id = ${link.id} and token_hash = ${hash(token)} and revoked_at is null and expires_at > clock_timestamp()`,
      ] });
    } catch (err: any) {
      if (err?.code === "NXT5_IMPORT_REFERENCE_CHANGED" && !(await linkStillValid(link.id, token))) {
        await sql`delete from team_import_submissions where id = ${claim.id} and status = 'receiving'`;
        importError("Liaison expirée ou révoquée. Génère un nouveau code dans NXT5.", 401, "TEAM_IMPORT_UNAUTHORIZED");
      }
      // A validation refusal is kept for the staff with the payload; anything else is a real failure.
      if (Number(err?.status) >= 400 && Number(err?.status) < 500) return { accepted: true, submission: await settle("pending", cleanText(err.message, 300), { payload: stored() }) };
      throw err;
    }
    const submission = await settle("imported", "", { matchId: saved.id });
    return { accepted: true, imported: true, inserted: saved.inserted === true, teamId: team.id, matchId: saved.id, warnings: saved.warnings || [], submission };
  } catch (err) {
    // An unexpected failure releases the claim so the desktop app can retry.
    await sql`delete from team_import_submissions where id = ${claim.id} and status = 'receiving'`.catch(() => {});
    throw err;
  }
}

async function linkStillValid(linkId: string, token: string) {
  const rows = await sql`select id from team_import_links where id = ${linkId} and token_hash = ${hash(token)} and revoked_at is null and expires_at > clock_timestamp()`;
  return Boolean(rows[0]);
}

/** The tag chosen with the link, else the team's default tag (created when missing). */
async function importCategoryIds(teamId: string, link: any): Promise<string[]> {
  if (link.category_id) {
    const chosen = await sql`select id from match_categories where id = ${link.category_id} and team_id = ${teamId}`;
    if (chosen[0]) return [chosen[0].id];
  }
  let fallback = await sql`select id from match_categories where team_id = ${teamId} and is_default order by created_at limit 1`;
  if (!fallback[0]) {
    await seedDefaultMatchCategories([teamId], link.created_by || null);
    fallback = await sql`select id from match_categories where team_id = ${teamId} and is_default order by created_at limit 1`;
  }
  return fallback[0] ? [fallback[0].id] : [];
}

async function recordSubmission({ claim, link, team, gameId, status, reason, matchId = null, payload = null }: { claim: any; link: any; team: any; gameId: string; status: string; reason: string; matchId?: string | null; payload?: any }) {
  const rows = await sql`
    update team_import_submissions set status = ${status}, reason = ${reason}, match_id = ${matchId}, payload = ${JSON.stringify(payload || {})}::jsonb, updated_at = now()
    where id = ${claim.id} returning *`;
  await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${link.created_by}, ${`team_import.${status}`}, 'team_import_submission', ${claim.id}, ${JSON.stringify({ teamId: team.id, gameId, linkId: link.id })}::jsonb)`;
  return submissionView(rows[0]);
}

/** The staff finalizes a pending game with the usual import form. */
export async function pendingTeamImport(userId: string, body: any) {
  const membership = await teamImportMembership(userId, body.teamId);
  assertManager(membership);
  const rows = await sql`select id, game_id, reason, payload from team_import_submissions where id = ${uuid(body.submissionId, "Partie")} and team_id = ${membership.teamId} and status = 'pending'`;
  if (!rows[0]) importError("Cette partie n’est plus en attente.", 404);
  return { submissionId: rows[0].id, gameId: rows[0].game_id, reason: rows[0].reason, payload: rows[0].payload };
}
export async function dismissTeamImport(userId: string, body: any) {
  const membership = await teamImportMembership(userId, body.teamId);
  assertManager(membership);
  const rows = await sql`update team_import_submissions set status = 'skipped', reason = 'Ignorée par le staff.', payload = '{}'::jsonb, updated_at = now() where id = ${uuid(body.submissionId, "Partie")} and team_id = ${membership.teamId} and status = 'pending' returning id`;
  if (!rows[0]) importError("Cette partie n’est plus en attente.", 404);
  return { ok: true };
}
/** Called after a manual import so a pending reception stops asking for attention. */
export async function settleTeamImport(teamId: string, gameId: string, matchId: string) {
  await sql`update team_import_submissions set status = 'imported', match_id = ${matchId}, reason = '', payload = '{}'::jsonb, updated_at = now() where team_id = ${teamId} and game_id = ${gameId} and status in ('pending', 'skipped', 'receiving')`;
}
