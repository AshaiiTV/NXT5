import { randomUUID } from 'node:crypto';
import { sql } from './db';

export const DISCORD_SCHEMA_VERSION = 'discord-publications-20260915-v1';
export const PUBLICATION_LEASE_SECONDS = 180;
export const MAX_PUBLICATION_ATTEMPTS = 8;

export async function assertDiscordSchemaReady() {
  try {
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${DISCORD_SCHEMA_VERSION}`;
    if (rows.length) return;
  } catch { /* Return a stable, public maintenance error. */ }
  throw Object.assign(new Error('La migration Discord doit être appliquée avant cette opération.'), {status: 503, code: 'DISCORD_SCHEMA_REQUIRED'});
}

export async function enqueueManualPublication({teamId, matchId, routeId, expectedRevision}: {teamId: string; matchId: string; routeId: string; expectedRevision?: number}) {
  const rows = await sql`select m.id from matches m join discord_routes r on r.team_id = m.team_id
    where m.team_id = ${teamId} and m.id = ${matchId} and r.id = ${routeId}`;
  if (!rows.length) throw Object.assign(new Error('Game ou destination introuvable pour cette équipe.'), {status: 404});
  let jobs;
  try { jobs = await sql`select * from nxt5_enqueue_discord_match(${matchId}::uuid,${routeId}::uuid,${expectedRevision ?? null}::bigint)`; }
  catch (error: any) {
    if (String(error?.message).includes('DISCORD_PREVIEW_OUTDATED')) {
      throw Object.assign(new Error('La game a changé depuis cet aperçu. Affiche un nouvel aperçu avant de publier.'),{status:409,code:'DISCORD_PREVIEW_OUTDATED'});
    }
    throw error;
  }
  if (!jobs.length) throw Object.assign(new Error('La connexion et la destination doivent être actives et compatibles avec les catégories de cette game.'), {status: 409});
  return jobs;
}

export async function retryPublicationJob({teamId, jobId}: {teamId: string; jobId: string}) {
  // Resume the publication mutex and its job in one PostgreSQL statement. A
  // failure cannot leave a queued job stranded behind a blocked publication.
  const rows = await sql`with eligible as (
    select p.id from discord_publications p join publication_jobs j on j.publication_id=p.id
      join discord_connections c on c.team_id=j.team_id join discord_routes r on r.id=p.route_id
    where j.id=${jobId} and j.team_id=${teamId}
      and c.status='active' and r.enabled and c.guild_id=r.guild_id and c.config_version=j.config_version
      and j.status in ('blocked','retry_wait') and p.state not in ('sending','uncertain','withdrawn','deleted')
      and p.source_deleted_at is null
      and j.source_revision=p.desired_revision
      and (p.lease_expires_at is null or p.lease_expires_at<now())
    for update of p,j
  ), resumed as (
    update discord_publications p set state=case when message_id is null then 'pending' else 'published' end,
      lease_token=null,lease_expires_at=null,updated_at=now() from eligible e where p.id=e.id returning p.id
  ) update publication_jobs j set status='queued',retry_base_attempts=attempts,available_at=now(),last_error=null,last_error_code=null,updated_at=now()
    from resumed p where j.id=${jobId} and j.publication_id=p.id returning j.*`;
  if (!rows.length) throw Object.assign(new Error('Cet envoi ne peut pas être relancé. Vérifie sa destination ou rapproche son état incertain.'), {status: 409});
  return rows;
}

// The publication row is the mutex shared by ALL revisions. SKIP LOCKED makes
// concurrent workers independent without holding a DB transaction over HTTP.
export async function claimPublicationJob() {
  const token = randomUUID();
  const rows = await sql`with candidate as (
    select p.id from discord_publications p join publication_jobs j on j.publication_id=p.id
      join discord_connections c on c.team_id=p.team_id join discord_routes r on r.id=p.route_id
    where j.status in ('queued','retry_wait') and j.available_at<=now() and j.source_revision=p.desired_revision
      and p.state in ('pending','published') and (p.lease_expires_at is null or p.lease_expires_at<now())
      and p.source_deleted_at is null
      and c.status='active' and r.enabled and r.guild_id=c.guild_id and r.channel_id=p.channel_id
      and j.config_version=c.config_version
    order by j.available_at,j.created_at for update of p skip locked limit 1
  ), locked as (
    update discord_publications p set lease_token=${token}::uuid,lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second',updated_at=now()
    from candidate where p.id=candidate.id returning p.id
  ) update publication_jobs j set status='preparing',lease_token=${token}::uuid,
      lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second',attempts=attempts+1,updated_at=now()
    from locked,discord_publications p where j.publication_id=locked.id and p.id=locked.id
      and j.source_revision=p.desired_revision and j.status in ('queued','retry_wait') returning j.*`;
  return rows[0] || null;
}

export async function recoverPublicationJobs() {
  // A process dying after it persisted 'sending' may have reached Discord.
  // Expiry never permits a second create: the logical publication is fenced.
  await sql.transaction(tx => [
    tx`update discord_publications p set state='uncertain',uncertain_since=coalesce(uncertain_since,now()),updated_at=now()
      where (state='sending' and lease_expires_at<now())
        or (source_deleted_at is not null and state='deleted' and (lease_expires_at is null or lease_expires_at<now())
          and exists(select 1 from discord_deliveries d join publication_jobs j on j.id=d.job_id
            where d.publication_id=p.id and d.attempt=j.attempts and d.status in ('sending','uncertain')
              and j.status in ('sending','cancelled','uncertain')))`,
    tx`update publication_jobs j set status='uncertain',last_error_code='SEND_LEASE_EXPIRED',updated_at=now()
      from discord_publications p where p.id=j.publication_id and p.state='uncertain'
        and (j.status='sending' or (j.status='cancelled' and p.source_deleted_at is not null
          and exists(select 1 from discord_deliveries d where d.job_id=j.id and d.attempt=j.attempts and d.status in ('sending','uncertain'))))`,
    tx`update discord_deliveries d set status='uncertain',error_code='SEND_LEASE_EXPIRED'
      from publication_jobs j,discord_publications p where d.job_id=j.id and p.id=j.publication_id
        and d.attempt=j.attempts and d.status='sending' and j.status='uncertain' and p.state='uncertain'`,
    tx`update publication_jobs j set status='retry_wait',available_at=now(),lease_token=null,lease_expires_at=null,
        last_error_code='PREPARE_LEASE_EXPIRED',updated_at=now()
      where j.status='preparing' and j.lease_expires_at<now()`,
    tx`update discord_publications set lease_token=null,lease_expires_at=null,updated_at=now()
      where state in ('pending','published') and lease_expires_at<now()`,
    tx`update publication_jobs j set status='superseded',updated_at=now() from discord_publications p
      where p.id=j.publication_id and j.status in ('queued','retry_wait') and j.source_revision<p.desired_revision`,
    tx`update publication_jobs j set status='cancelled',last_error_code='CONFIG_CHANGED',updated_at=now()
      from discord_publications p,discord_connections c
      where p.id=j.publication_id and c.team_id=p.team_id and j.status in ('queued','retry_wait')
        and (c.status='disconnected' or c.config_version<>j.config_version or p.state in ('deleted','withdrawn'))`
  ]);
}

export function retryDelaySeconds(attempt: number, retryAfterSeconds?: number, random = Math.random) {
  if (Number.isFinite(retryAfterSeconds) && Number(retryAfterSeconds) > 0) return Math.ceil(Number(retryAfterSeconds)) + 1;
  return Math.min(3600, 15 * (2 ** Math.max(0,attempt-1))) + Math.floor(random()*10);
}

export function classifyPublicationFailure(error: any, attemptedSend: boolean, attempt: number) {
  if (attemptedSend && (error?.ambiguous || error?.uncertain || (!error?.status && error?.name !== 'PublicationGuardError'))) return 'uncertain';
  if (Number(error?.status) === 429) return 'retry_wait';
  if ([400,401,403,404,413].includes(Number(error?.status))) return 'blocked';
  if (attemptedSend && Number(error?.status) >= 500) return 'uncertain';
  return attempt >= MAX_PUBLICATION_ATTEMPTS ? 'blocked' : 'retry_wait';
}
