import crypto from "node:crypto";
import { sql } from "./db";
import {
  NEXUS_SCHEMA_VERSION,
  nexusError,
  nexusHash,
  normalizeFixture,
  nexusUuid,
  riotIdKey,
  validateSubmission,
} from "./nexus-domain";

export async function assertNexusSchema() {
  try {
    const rows =
      await sql`select migration_key from app_schema_migrations where migration_key = ${NEXUS_SCHEMA_VERSION}`;
    if (!rows.length) throw new Error("Missing Nexus migration");
  } catch {
    throw Object.assign(new Error("Nexus Rising en cours de mise à jour."), {
      status: 503,
      code: "NEXUS_SCHEMA_REQUIRED",
      publicMessage: "Nexus Rising en cours de mise à jour.",
    });
  }
}
export function fixtureView(row: any) {
  return {
    id: row.id,
    label: row.label,
    teamA: row.team_a,
    teamB: row.team_b,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    platform: row.platform,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    roster: row.roster,
    createdAt: row.created_at,
    seasonId: row.season_id || null,
    stage: row.stage || "legacy",
    fixtureKey: row.fixture_key,
    round: row.round,
    bestOf: row.best_of,
    bracketGroup: row.bracket_group,
    groupId: row.group_id,
    scheduled: Boolean(row.starts_at && row.ends_at),
    rosterReady: row.roster?.length === 10,
    playerIds: row.player_ids || [],
  };
}
export function pairingView(row: any) {
  return {
    id: row.id,
    fixtureId: row.fixture_id,
    uploaderRiotId: row.uploader_riot_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    connectedAt: row.connected_at,
  };
}
export function submissionView(row: any) {
  return {
    id: row.id,
    fixtureId: row.fixture_id,
    gameId: row.game_id,
    uploaderRiotId: row.uploader_riot_id,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    source: row.source,
  };
}
export function bindingView(pairing: any, fixture: any) {
  return {
    competitionId: "nexus-rising",
    fixtureId: fixture.id,
    tokenId: pairing.id,
    platform: fixture.platform,
    fixtureLabel: fixture.label,
    expiresAt: pairing.expires_at,
    roster: fixture.roster,
    startsAt: fixture.starts_at,
    endsAt: fixture.ends_at,
    uploaderRiotId: pairing.uploader_riot_id,
  };
}
export function readNexusBearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const token = /^Bearer (nr_[a-f0-9]{64})$/.exec(header)?.[1];
  if (!token) nexusError("Liaison Nexus requise.", 401, "NEXUS_UNAUTHORIZED");
  return token;
}
export async function readImportAuthorization(token: string) {
  const rows = await sql`
    select to_jsonb(p) as pairing, to_jsonb(f) as fixture
    from nexus_import_pairings p join nexus_fixtures f on f.id = p.fixture_id
    where p.token_hash = ${nexusHash(token)} and p.revoked_at is null and p.expires_at > clock_timestamp()
  `;
  if (!rows.length)
    nexusError(
      "Liaison expirée ou révoquée. Demande un nouveau code au staff.",
      401,
      "NEXUS_UNAUTHORIZED",
    );
  return rows[0] as { pairing: any; fixture: any };
}
export async function createNexusFixture(body: any) {
  nexusError(
    "Les rencontres sont générées depuis les équipes NXT5 inscrites à une saison.",
    410,
    "NEXUS_NATIVE_TEAMS_REQUIRED",
  );
}
export async function createNexusPairing(body: any) {
  const fixtureId = nexusUuid(body.fixtureId);
  const rows = await sql`select * from nexus_fixtures where id = ${fixtureId}`;
  const fixture = rows[0];
  if (!fixture) nexusError("Rencontre introuvable.", 404);
  if (!fixture.starts_at || !fixture.ends_at || fixture.roster?.length !== 10)
    nexusError(
      "Planifie la rencontre et ses dix profils NXT5 avant de créer une liaison.",
    );
  const uploader = fixture.roster.find(
    (id: string) => riotIdKey(id) === riotIdKey(body.uploaderRiotId),
  );
  if (!uploader) nexusError("Le capitaine doit figurer dans le roster.");
  if (Date.parse(fixture.ends_at) + 24 * 3600_000 <= Date.now())
    nexusError("Cette rencontre est trop ancienne pour créer une liaison.");
  const code = crypto.randomBytes(12).toString("hex").toUpperCase();
  let results: any[];
  try {
    results = await sql.transaction((tx) => [
      tx`select id from nexus_seasons where id=${fixture.season_id || null} for share`,
      tx`select id from nexus_fixtures where id=${fixtureId} for update`,
      tx`select 1/case when count(*)=1 then 1 else 0 end as fixture_unchanged from nexus_fixtures where id=${fixtureId} and roster=${JSON.stringify(fixture.roster)}::jsonb and starts_at=${fixture.starts_at} and ends_at=${fixture.ends_at} and (season_id is null or exists(select 1 from nexus_seasons where id=${fixture.season_id || null} and status <> 'completed'))`,
      tx`
    insert into nexus_import_pairings (fixture_id, uploader_riot_id, code_hash, code_expires_at, expires_at)
    values (${fixtureId}, ${uploader}, ${nexusHash(code)}, now() + interval '15 minutes', ${new Date(Date.parse(fixture.ends_at) + 24 * 3600_000).toISOString()})
    returning *
  `,
    ]);
  } catch (err: any) {
    if (err.code === "22012")
      nexusError(
        "La rencontre a changé ou sa saison est terminée. Recharge le calendrier.",
        409,
        "NEXUS_FIXTURE_CHANGED",
      );
    throw err;
  }
  const created = results[3];
  return {
    code,
    expiresAt: created[0].code_expires_at,
    pairing: pairingView(created[0]),
  };
}
export async function connectNexus(codeValue: unknown) {
  const code = String(codeValue || "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (!/^[A-F0-9]{24}$/.test(code))
    nexusError("Code de liaison invalide.", 401, "NEXUS_CODE_INVALID");
  const token = `nr_${crypto.randomBytes(32).toString("hex")}`;
  // The single conditional UPDATE consumes the code exactly once across requests.
  const rows = await sql`
    update nexus_import_pairings set token_hash = ${nexusHash(token)}, connected_at = now(), code_hash = null
    where code_hash = ${nexusHash(code)} and token_hash is null and revoked_at is null
      and code_expires_at > clock_timestamp() and expires_at > clock_timestamp()
    returning *
  `;
  if (!rows.length)
    nexusError(
      "Code expiré, déjà utilisé ou révoqué. Demande un nouveau code au staff.",
      401,
      "NEXUS_CODE_INVALID",
    );
  const fixture = (
    await sql`select * from nexus_fixtures where id = ${rows[0].fixture_id}`
  )[0];
  if (!fixture)
    nexusError("Rencontre indisponible.", 401, "NEXUS_UNAUTHORIZED");
  return { token, binding: bindingView(rows[0], fixture), schemaVersion: 1 };
}
export async function saveNexusSubmission(
  token: string,
  body: any,
  idempotencyKey: string,
) {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(idempotencyKey))
    nexusError("Clé de répétition invalide.");
  const { pairing, fixture } = await readImportAuthorization(token);
  if (nexusUuid(body.fixtureId) !== fixture.id)
    nexusError(
      "Cette liaison appartient à une autre rencontre.",
      403,
      "NEXUS_FIXTURE_MISMATCH",
    );
  const checked = validateSubmission(body.payload, fixture);
  const hash = nexusHash(token);
  let results: any[];
  try {
    results = await sql.transaction((tx) => [
      tx`select id from nexus_seasons where id = ${fixture.season_id || null} for share`,
      tx`select id from nexus_fixtures where id = ${fixture.id} for update`,
      tx`select id from nexus_import_pairings where id = ${pairing.id} for update`,
      // Recheck under the same lock used by revoke. No permission can disappear
      // between this check and the insert. clock_timestamp also covers lock waits.
      tx`select 1 / case when count(*) = 1 then 1 else 0 end as nexus_authorized
         from nexus_import_pairings where id = ${pairing.id} and fixture_id = ${fixture.id}
           and token_hash = ${hash} and revoked_at is null and expires_at > clock_timestamp()
           and (not exists(select 1 from nexus_fixtures f where f.id=${fixture.id} and f.season_id is not null)
             or exists(select 1 from nexus_fixtures f join nexus_seasons s on s.id=f.season_id where f.id=${fixture.id} and s.status='running'))`,
      tx`insert into nexus_submissions (fixture_id, pairing_id, game_id, idempotency_key, payload_hash, payload, summary, source)
         select ${fixture.id}, ${pairing.id}, ${checked.gameId}, ${idempotencyKey}, ${checked.hash}, ${JSON.stringify(checked.payload)}::jsonb, ${JSON.stringify(checked.summary)}::jsonb, ${checked.source}
         where (select count(*) from nexus_submissions where pairing_id = ${pairing.id}) < 20
         on conflict do nothing returning id`,
      tx`select id, game_id, payload_hash, idempotency_key, status from nexus_submissions
         where pairing_id = ${pairing.id} and (game_id = ${checked.gameId} or idempotency_key = ${idempotencyKey})`,
    ]);
  } catch (err: any) {
    if (err.code === "22012")
      nexusError("Liaison expirée ou révoquée.", 401, "NEXUS_UNAUTHORIZED");
    throw err;
  }
  const rows = results[5];
  if (!rows.length)
    nexusError(
      "Limite de parties atteinte pour cette liaison.",
      429,
      "NEXUS_SUBMISSION_LIMIT",
    );
  if (
    rows.length !== 1 ||
    rows[0].game_id !== checked.gameId ||
    rows[0].payload_hash !== checked.hash
  )
    nexusError(
      "Une contribution différente existe déjà. Le staff doit la vérifier.",
      409,
      "NEXUS_SUBMISSION_CONFLICT",
    );
  return {
    accepted: true,
    duplicate: results[4].length === 0,
    submissionId: rows[0].id,
    status: rows[0].status,
  };
}
export async function revokeNexusPairing(id: unknown) {
  const rows =
    await sql`update nexus_import_pairings set revoked_at = coalesce(revoked_at, now()), code_hash = null where id = ${nexusUuid(id)} returning id`;
  if (!rows.length) nexusError("Liaison introuvable.", 404);
  return { ok: true };
}
export async function reviewNexusSubmission(body: any) {
  if (!["accepted", "rejected"].includes(body.status))
    nexusError("Décision de validation invalide.");
  let rows;
  try {
    rows = await sql`
      update nexus_submissions set status = ${body.status}, reviewed_at = now()
      where id = ${nexusUuid(body.submissionId)} returning *
    `;
  } catch (err: any) {
    if (err.code === "23505")
      nexusError(
        "Une autre contribution de cette partie est déjà validée. Rejette-la avant de choisir une autre source.",
        409,
        "NEXUS_REVIEW_CONFLICT",
      );
    throw err;
  }
  if (!rows.length) nexusError("Contribution introuvable.", 404);
  return submissionView(rows[0]);
}
