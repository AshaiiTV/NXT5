import { createHash, randomUUID } from 'node:crypto';
import { sql } from './db';
import { buildGamePublicationSnapshot } from '../../../shared/publications/game-publication.js';
import { getOrRenderPublicationImage } from './publication-image';
import { buildDiscordMessage, discordRequest, findDiscordMessage, getDiscordBotUserId } from './discord-client';
import { isDiscordEnabled, signDiscordInternalRequest, getDiscordConfig } from './discord-config';
import { assertDiscordSchemaReady, claimPublicationJob, classifyPublicationFailure, recoverPublicationJobs, retryDelaySeconds, PUBLICATION_LEASE_SECONDS } from './discord-queue';

type Row = Record<string, any>;

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])]));
  return value;
}
export function publicationContentHash(snapshot: any, route: {include_hints?: boolean; mention_role_id?: string | null}) {
  const {generatedAt,sourceRevision,...content} = snapshot;
  return createHash('sha256').update(JSON.stringify(stable({content,includeHints:Boolean(route.include_hints),mentionRoleId:route.mention_role_id || null}))).digest('hex');
}
export function publicationReference(publicationId: string, revision: number | string) {
  return `nxt5:${publicationId}:${revision}`;
}

async function loadSource(job: Row) {
  // One PostgreSQL statement provides one consistent view of match and players.
  const rows = await sql`select to_jsonb(p) as publication,to_jsonb(c) as connection,to_jsonb(r) as route,to_jsonb(t) as team,
    to_jsonb(m) || jsonb_build_object('participants',coalesce((select jsonb_agg(mp order by mp.team_key,mp.role,mp.summoner_name)
      from match_participants mp where mp.match_id=m.id),'[]'::jsonb)) as match,
    coalesce((select jsonb_agg(mc order by mc.name) from match_categories mc where mc.team_id=m.team_id
      and (m.category_ids ? mc.id::text or mc.id=m.category_id)),'[]'::jsonb) as categories
    from discord_publications p join discord_connections c on c.team_id=p.team_id
    join discord_routes r on r.id=p.route_id join teams t on t.id=p.team_id
    join matches m on m.id=p.entity_id and m.team_id=p.team_id
    where p.id=${job.publication_id}`;
  return rows[0];
}

function sourceGuard(job: Row, source: any) {
  if (!source || !['active','paused'].includes(source.connection.status) || !source.route.enabled || source.route.guild_id !== source.connection.guild_id
    || source.publication.channel_id !== source.route.channel_id || String(source.connection.config_version) !== String(job.config_version)
    || source.publication.source_deleted_at || ['deleted','withdrawn','uncertain','blocked'].includes(source.publication.state)) return 'cancelled';
  const selected = new Set([...(source.match.category_ids || []),source.match.category_id].filter(Boolean).map(String));
  if (source.route.category_ids?.length && !source.route.category_ids.some((id:any) => selected.has(String(id)))) return 'cancelled';
  if (Number(source.match.publication_revision) !== Number(job.source_revision) || Number(source.publication.desired_revision) > Number(job.source_revision)) return 'superseded';
  if (source.connection.status==='paused' || !isDiscordEnabled()) return 'retry_wait';
  return null;
}

async function stopPreparation(job: Row, status: string, code: string) {
  await sql.transaction(tx => [
    tx`update publication_jobs set status=${status},last_error_code=${code},
      last_error=case when ${status}='retry_wait' then 'Publication conservée en attente de la reprise du service ou de la connexion.' else last_error end,
      available_at=case when ${status}='retry_wait' then now() else available_at end,
      retry_base_attempts=case when ${status}='retry_wait' then retry_base_attempts+1 else retry_base_attempts end,
      lease_token=null,lease_expires_at=null,updated_at=now()
      where id=${job.id} and lease_token=${job.lease_token}::uuid and status='preparing'`,
    tx`update discord_publications set lease_token=null,lease_expires_at=null,updated_at=now()
      where id=${job.publication_id} and lease_token=${job.lease_token}::uuid and state in ('pending','published')`
  ]);
}

async function finishPublication(job: Row, snapshot: Row, messageId: string | null) {
  // A deletion during the HTTP request must retain the returned message ID for
  // withdrawal, without resurrecting the game or the cancelled publication.
  await sql`with completed_publication as (
    update discord_publications set message_id=coalesce(${messageId},message_id),published_revision=${job.source_revision},
      published_hash=${snapshot.content_hash},state=case when state='withdrawn' then state when source_deleted_at is not null then 'deleted'
        when state='deleted' then state else 'published' end,
      lease_token=null,lease_expires_at=null,uncertain_since=null,updated_at=now()
      where id=${job.publication_id} and lease_token=${job.lease_token}::uuid returning id,source_deleted_at
  ), completed_job as (
    update publication_jobs j set status=case when p.source_deleted_at is not null or status='cancelled' then 'cancelled' else 'succeeded' end,
      lease_token=null,lease_expires_at=null,last_error=null,last_error_code=case when p.source_deleted_at is not null then 'MATCH_DELETED' else null end,updated_at=now()
      from completed_publication p where j.id=${job.id} and j.publication_id=p.id and j.lease_token=${job.lease_token}::uuid returning j.id
  ) update discord_deliveries d set status='succeeded',message_id=coalesce(${messageId},message_id),completed_at=now()
      from completed_job j where d.job_id=j.id and d.attempt=${job.attempts} and d.status in ('sending','uncertain')`;
}

async function recordFailure(job: Row, error: any, attemptedSend: boolean) {
  const status = classifyPublicationFailure(error,attemptedSend,Number(job.attempts)-Number(job.retry_base_attempts || 0));
  const code = String(error?.code || (status === 'uncertain' ? 'DISCORD_SEND_UNCERTAIN' : 'DISCORD_PUBLICATION_FAILED')).slice(0,100);
  // Do not persist raw requests, tokens or provider response bodies in history.
  const message = status === 'uncertain' ? 'La confirmation Discord manque. Un rapprochement est requis avant tout nouvel envoi.'
    : status === 'blocked' ? 'Envoi bloqué. Vérifie les permissions et la destination puis relance la publication.'
    : 'Incident temporaire. Une nouvelle tentative est planifiée.';
  const delay = retryDelaySeconds(Number(job.attempts),error?.retryAfter);
  await sql`with failed_publication as (
    update discord_publications set state=case when ${status}='uncertain' then 'uncertain' when source_deleted_at is not null then 'deleted' when ${status}='blocked' then 'blocked'
        when message_id is null then 'pending' else 'published' end,
      uncertain_since=case when ${status}='uncertain' then now() else null end,lease_token=null,lease_expires_at=null,updated_at=now()
      where id=${job.publication_id} and lease_token=${job.lease_token}::uuid and state<>'withdrawn' returning id,source_deleted_at
  ), failed_job as (
    update publication_jobs j set status=case when p.source_deleted_at is not null and ${status}<>'uncertain' then 'cancelled' else ${status} end,
      available_at=now()+${delay}*interval '1 second',lease_token=null,lease_expires_at=null,last_error_code=${code},last_error=${message},updated_at=now()
      from failed_publication p where j.id=${job.id} and j.publication_id=p.id and j.lease_token=${job.lease_token}::uuid
        and (j.status in ('preparing','sending') or (p.source_deleted_at is not null and ${attemptedSend}
          and j.status in ('cancelled','uncertain') and exists(select 1 from discord_deliveries d
            where d.job_id=j.id and d.attempt=${job.attempts} and d.status in ('sending','uncertain')))) returning j.id
  ) update discord_deliveries d set status=${status},error_code=${code},error_message=${message},completed_at=now()
      from failed_job j where d.job_id=j.id and d.attempt=${job.attempts} and d.status in ('sending','uncertain')`;
  return status;
}

export async function processPublicationJob(job: Row) {
  let attemptedSend = false;
  try {
    const source = await loadSource(job);
    const stopped = sourceGuard(job,source);
    if (stopped) { await stopPreparation(job,stopped,stopped==='retry_wait' ? 'DISCORD_PAUSED' : 'SOURCE_OR_DESTINATION_CHANGED'); return stopped; }
    const snapshotBody = { ...buildGamePublicationSnapshot({team:source.team,match:source.match,categories:source.categories,sourceRevision:job.source_revision,generatedAt:new Date().toISOString()}),
      renderOptions: { includeHints: false } };
    const hash = publicationContentHash(snapshotBody,source.route);
    const snapshots = await sql`insert into publication_snapshots(publication_id,source_revision,content_hash,body)
      values(${job.publication_id},${job.source_revision},${hash},${JSON.stringify(snapshotBody)}::jsonb)
      on conflict(publication_id,source_revision) do update set source_revision=excluded.source_revision returning *`;
    const snapshot = snapshots[0];
    // Reimports with new source metadata but unchanged visible content are quiet.
    if (source.publication.message_id && source.publication.published_hash === snapshot.content_hash) {
      await finishPublication(job,snapshot,source.publication.message_id);
      return 'unchanged';
    }
    const rendered = await getOrRenderPublicationImage(job.team_id,{id:snapshot.id,body:snapshot.body});
    const reference = publicationReference(job.publication_id,job.source_revision);
    const payload = buildDiscordMessage(snapshot.body,{
      includeHints:source.route.include_hints,mentionRoleId:source.publication.message_id ? null : source.route.mention_role_id,reference,
      siteUrl:getDiscordConfig().siteUrl,hasImage:Boolean(rendered),filename:rendered?.filename
    });
    if (!rendered) payload.embeds[0].fields.push({name:'Visuel',value:'Visuel trop volumineux. Les détails restent accessibles dans NXT5.',inline:false});
    // Discord nonces are short-lived deduplication only; the durable publication
    // row and reconciliation handle lost acknowledgements beyond that window.
    if (!source.publication.message_id) {
      payload.nonce = createHash('sha256').update(reference).digest('hex').slice(0,24);
      payload.enforce_nonce = true;
    } else {
      // Updating statistics must not ping the role again. Nonce fields are for
      // message creation only and are deliberately absent from PATCH.
      delete (payload as any).nonce;
      delete (payload as any).enforce_nonce;
    }
    if (!isDiscordEnabled()) { await stopPreparation(job,'retry_wait','DISCORD_DISABLED'); return 'retry_wait'; }
    const sending = await sql`with permitted as (
      update discord_publications p set state='sending',lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second',updated_at=now()
      from discord_connections c,discord_routes r,matches m
      where p.id=${job.publication_id} and p.lease_token=${job.lease_token}::uuid and p.lease_expires_at>now()
        and p.state in ('pending','published') and p.desired_revision=${job.source_revision}
        and p.source_deleted_at is null
        and c.team_id=p.team_id and c.status='active' and c.config_version=${job.config_version}
        and r.id=p.route_id and r.enabled and r.guild_id=c.guild_id and r.channel_id=p.channel_id
        and m.id=p.entity_id and m.team_id=p.team_id and m.publication_revision=${job.source_revision}
        and (r.category_ids='[]'::jsonb or exists(select 1 from jsonb_array_elements_text(r.category_ids) selected(id)
          where coalesce(m.category_ids,'[]'::jsonb) ? selected.id or m.category_id::text=selected.id))
      returning p.id
    ), sending as (
      update publication_jobs j set status='sending',lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second',updated_at=now()
      from permitted where j.id=${job.id} and j.publication_id=permitted.id and j.lease_token=${job.lease_token}::uuid and j.status='preparing'
      returning j.*
    ) insert into discord_deliveries(publication_id,job_id,snapshot_id,source_revision,attempt,status)
      select publication_id,id,${snapshot.id}::uuid,source_revision,attempts,'sending' from sending returning id`;
    if (!sending.length) {
      // A pause is temporary. Preserve the already queued publication so a
      // resume can claim it; deleted sources and obsolete versions stay stopped.
      const stopped=sourceGuard(job,await loadSource(job)) || 'retry_wait';
      await stopPreparation(job,stopped,stopped==='retry_wait' ? 'DISCORD_PAUSED' : 'SEND_GUARD_CHANGED');
      return stopped;
    }
    attemptedSend = true;
    const method = source.publication.message_id ? 'PATCH' : 'POST';
    const path = `/channels/${source.publication.channel_id}/messages${source.publication.message_id ? `/${source.publication.message_id}` : ''}`;
    const message = await discordRequest(path,{method,body:payload,files:rendered ? [{name:rendered.filename,bytes:rendered.bytes}] : []});
    if (!message?.id) throw Object.assign(new Error('Confirmation Discord invalide.'),{ambiguous:true,code:'DISCORD_ACK_INVALID'});
    await finishPublication(job,snapshot,String(message.id));
    return 'succeeded';
  } catch (error) {
    return recordFailure(job,error,attemptedSend);
  }
}

export async function runPublicationBatch(limit = 4) {
  if (!isDiscordEnabled()) return {enabled:false,processed:0};
  await assertDiscordSchemaReady();
  const batchToken = randomUUID();
  const lease = await sql`update discord_worker_leases set lease_token=${batchToken}::uuid,expires_at=now()+interval '14 minutes'
    where id='publisher' and (expires_at is null or expires_at<now()) returning id`;
  if (!lease.length) return {enabled:true,processed:0,busy:true};
  const outcomes: string[] = [];
  try {
    await recoverPublicationJobs();
    for (let count=0;count<Math.min(Math.max(limit,1),10);count++) {
      if (!isDiscordEnabled()) break;
      const job = await claimPublicationJob();
      if (!job) break;
      outcomes.push(await processPublicationJob(job));
    }
  } finally {
    await sql`update discord_worker_leases set lease_token=null,expires_at=null where id='publisher' and lease_token=${batchToken}::uuid`;
  }
  return {enabled:true,processed:outcomes.length,outcomes};
}

export async function dispatchPublicationBatch({allowSoon=false}: {allowSoon?:boolean} = {}) {
  if (!isDiscordEnabled()) return {enabled:false,dispatched:false};
  await assertDiscordSchemaReady();
  const due = await sql`select j.id,ceil(extract(epoch from j.available_at)*1000)::double precision as not_before from publication_jobs j join discord_publications p on p.id=j.publication_id
    join discord_connections c on c.team_id=p.team_id join discord_routes r on r.id=p.route_id
    where c.status='active' and r.enabled and r.guild_id=c.guild_id and j.config_version=c.config_version
      and ((j.status in ('queued','retry_wait') and j.available_at<=now()+${allowSoon ? 8 : 0}*interval '1 second' and j.source_revision=p.desired_revision
        and p.state in ('pending','published') and (p.lease_expires_at is null or p.lease_expires_at<now()))
        or (j.status='preparing' and j.lease_expires_at<now()))
      and not exists(select 1 from discord_worker_leases where id='publisher' and expires_at>now()) order by j.available_at limit 1`;
  if (!due.length) return {enabled:true,dispatched:false};
  const base = new URL(getDiscordConfig().siteUrl);
  if (!['https:','http:'].includes(base.protocol)) throw new Error('URL Netlify invalide.');
  const notBefore = allowSoon ? Math.min(Date.now()+8000,Number(due[0].not_before)) : Date.now();
  const body = JSON.stringify({limit:4,notBefore});
  const response = await fetch(new URL('/.netlify/functions/discord-publish-background',base),{
    method:'POST',headers:{'Content-Type':'application/json',...signDiscordInternalRequest(body)},body,signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Le traitement Discord n’a pas été accepté (${response.status}).`);
  return {enabled:true,dispatched:true};
}

export async function reconcilePublications(limit = 1) {
  if (!isDiscordEnabled()) return {enabled:false,reconciled:0};
  await assertDiscordSchemaReady();
  await recoverPublicationJobs();
  const candidates = await sql`select p.*,j.id as job_id,j.source_revision,j.attempts,s.id as snapshot_id,s.content_hash
    from discord_publications p join publication_jobs j on j.publication_id=p.id and j.status='uncertain'
    join publication_snapshots s on s.publication_id=p.id and s.source_revision=j.source_revision
    where p.state='uncertain' and (p.lease_expires_at is null or p.lease_expires_at<now())
    order by p.uncertain_since limit ${Math.min(limit,1)}`;
  let reconciled = 0;
  for (const publication of candidates) {
    const token = randomUUID();
    const locked = await sql`update discord_publications set lease_token=${token}::uuid,
      lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second' where id=${publication.id} and state='uncertain'
      and (lease_expires_at is null or lease_expires_at<now()) returning id`;
    if (!locked.length) continue;
    try {
      const reference = publicationReference(publication.id,publication.source_revision);
      const message = publication.message_id
        ? await discordRequest(`/channels/${publication.channel_id}/messages/${publication.message_id}`,{method:'GET'})
        : await findDiscordMessage(publication.channel_id,{reference,after:new Date(new Date(publication.uncertain_since || publication.updated_at).getTime()-300_000)});
      const found = message?.embeds?.some((embed: any) => String(embed?.footer?.text || '') === `NXT5 · ${reference}`);
      if (message?.id && found) {
        await sql`update publication_jobs set lease_token=${token}::uuid where id=${publication.job_id} and status='uncertain'`;
        await finishPublication({...publication,id:publication.job_id,publication_id:publication.id,lease_token:token},
          {id:publication.snapshot_id,content_hash:publication.content_hash},String(message.id));
        reconciled++;
      } else {
        // Absence from a bounded history is not evidence that create failed.
        // Keep uncertain until an operator locates/removes the possible message.
        await sql`update discord_publications set lease_token=null,lease_expires_at=now()+interval '10 minutes',updated_at=now()
          where id=${publication.id} and lease_token=${token}::uuid`;
      }
    } catch {
      await sql`update discord_publications set lease_token=null,lease_expires_at=now()+interval '10 minutes',updated_at=now()
        where id=${publication.id} and lease_token=${token}::uuid`;
    }
  }
  return {enabled:true,reconciled};
}

export async function resolvePublicationJob({teamId,jobId,messageId}: {teamId:string;jobId:string;messageId:string}) {
  if (!/^\d{17,20}$/.test(messageId)) throw Object.assign(new Error('Identifiant du message Discord invalide.'),{status:400});
  const rows = await sql`select j.*,p.channel_id,p.state,p.uncertain_since,s.id as snapshot_id,s.content_hash
    from publication_jobs j join discord_publications p on p.id=j.publication_id
    join publication_snapshots s on s.publication_id=p.id and s.source_revision=j.source_revision
    where j.id=${jobId} and j.team_id=${teamId} and p.team_id=${teamId} and j.status='uncertain' and p.state='uncertain'`;
  const job=rows[0];
  if (!job) throw Object.assign(new Error('Aucun envoi incertain à rapprocher pour cette équipe.'),{status:409});
  const message=await discordRequest(`/channels/${job.channel_id}/messages/${messageId}`,{method:'GET'});
  const botId=await getDiscordBotUserId();
  const reference=publicationReference(job.publication_id,job.source_revision);
  if (String(message?.id)!==messageId || String(message?.channel_id)!==String(job.channel_id) || String(message?.author?.id)!==botId
    || !message?.embeds?.some((embed:any) => embed?.footer?.text===`NXT5 · ${reference}`)) {
    throw Object.assign(new Error('Ce message ne correspond pas à la publication NXT5 attendue dans ce salon.'),{status:409,code:'DISCORD_MESSAGE_MISMATCH'});
  }
  const token=randomUUID();
  const locked=await sql`with publication as (
    update discord_publications set lease_token=${token}::uuid,lease_expires_at=now()+${PUBLICATION_LEASE_SECONDS}*interval '1 second'
    where id=${job.publication_id} and state='uncertain' and (lease_token is null or lease_expires_at<now()) returning id
  ) update publication_jobs j set lease_token=${token}::uuid from publication p
    where j.id=${jobId} and j.publication_id=p.id and j.status='uncertain' returning j.id`;
  if (!locked.length) throw Object.assign(new Error('Un rapprochement est déjà en cours. Réessaie dans un instant.'),{status:409});
  await finishPublication({...job,lease_token:token},{id:job.snapshot_id,content_hash:job.content_hash},messageId);
  return {ok:true,messageId,publicationId:job.publication_id};
}
