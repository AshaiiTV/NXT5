import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { sql } from './_lib/db';
import { json, readJson } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, uuid, auditDiscord, discordTeamWriteQueries } from './_lib/discord-access';
import { retryPublicationJob } from './_lib/discord-queue';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { discordRequest } from './_lib/discord-client';
import { isDiscordEnabled, getDiscordConfig } from './_lib/discord-config';
import { resolvePublicationJob } from './_lib/discord-worker';
import { wakeDiscordPublications } from './_lib/discord-wake';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['POST']);
    const body = await readJson(request, 12_000);
    const { teamId, user } = await requireDiscordTeam(request, context, body.teamId, 'staff');
    await assertSubjectRateLimit('discord-retry', teamId, { limit: 10, windowSeconds: 60 });
    const jobId = uuid(body.deliveryId, 'Publication');
    if (body.action === 'resolve') {
      if (!getDiscordConfig().configured) throw discordError('La connexion du bot est à rétablir.', 503, 'DISCORD_NOT_CONFIGURED');
      const result = await resolvePublicationJob({ teamId, jobId, userId: user.id, messageId: String(body.messageId || '') });
      wakeDiscordPublications(context);
      return json(result);
    }
    if (body.action === 'retry') {
      if (!isDiscordEnabled()) throw discordError('Les envois sont suspendus sur cet environnement.', 409);
      const rows = await retryPublicationJob({ teamId, jobId, userId: user.id });
      wakeDiscordPublications(context);
      return json({ ok: true, jobs: rows.map((row) => ({ id: row.id, status: row.status })) }, 202);
    }
    if (body.action !== 'remove') throw discordError('Action inconnue.');
    if (!getDiscordConfig().configured) throw discordError('La connexion du bot est à rétablir.', 503, 'DISCORD_NOT_CONFIGURED');
    // Withdraw first, before the network request. DELETE may safely be retried;
    // no newer revision can race this action or recreate a removed publication.
    const results = await sql.transaction([
      ...discordTeamWriteQueries(teamId, user.id, 'staff'),
      sql("with withdrawn as (update discord_publications p set state='withdrawn',updated_at=now() from publication_jobs j where j.id=$1 and j.team_id=$2 and j.publication_id=p.id and p.team_id=$2 and p.message_id is not null and p.state not in ('sending','uncertain') and (p.lease_expires_at is null or p.lease_expires_at<now()) returning p.*), cancelled as (update publication_jobs j set status=case when j.status in ('succeeded','superseded','cancelled') then j.status else 'cancelled' end,last_error_code='WITHDRAW_RETRY_REQUIRED',last_error='Retrait Discord à confirmer.',updated_at=now() from withdrawn p where j.publication_id=p.id and j.team_id=p.team_id returning j.id), logged as (insert into audit_logs(user_id,action,entity_type,entity_id,metadata) select $3,'discord.publication_withdraw_requested','team',$2,jsonb_build_object('jobId',$1::text,'publicationId',id) from withdrawn) select * from withdrawn", [jobId, teamId, user.id])
    ]);
    const rows = results[2];
    const publication = rows[0];
    if (!publication) throw discordError('Cette publication est en cours d’envoi ou doit être vérifiée avant son retrait.', 409);
    try { await discordRequest('/channels/' + publication.channel_id + '/messages/' + publication.message_id, { method: 'DELETE' }); }
    catch (error: any) {
      if (error?.status !== 404) {
        await sql("update publication_jobs set last_error_code='WITHDRAW_RETRY_REQUIRED',last_error='Retrait Discord à réessayer.',updated_at=now() where id=$1", [jobId]);
        throw error;
      }
    }
    await sql("update discord_deliveries set status='withdrawn',completed_at=now() where publication_id=$1 and message_id=$2", [publication.id, publication.message_id]);
    await sql("update publication_jobs set last_error_code='PUBLICATION_WITHDRAWN',last_error=null,updated_at=now() where publication_id=$1", [publication.id]);
    await auditDiscord(user.id, teamId, 'discord.publication_withdrawn', { publicationId: publication.id });
    return json({ ok: true });
  } catch (error: any) {
    if (error?.code === '22012') return discordResponseError(discordError('Ton rôle a changé. Recharge l’équipe.', 409, 'DISCORD_ROLE_CHANGED'));
    return discordResponseError(error);
  }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'POST' };
