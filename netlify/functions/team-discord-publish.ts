import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json, readJson } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, uuid, auditDiscord } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { claimPublicationJob, enqueueManualPublication } from './_lib/discord-queue';
import { isDiscordEnabled } from './_lib/discord-config';
import { wakeDiscordPublications } from './_lib/discord-wake';
import { processPublicationJob } from './_lib/discord-worker';
import { readDiscordPublicationReceipts } from './_lib/discord-publication-receipt';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['POST']);
    const body = await readJson(request, 12_000);
    const { teamId, user } = await requireDiscordTeam(request, context, body.teamId, 'staff');
    await assertSubjectRateLimit('discord-publish', teamId, { limit: 15, windowSeconds: 60 });
    if (!isDiscordEnabled()) throw discordError('Les envois Discord sont suspendus sur cet environnement.', 409, 'DISCORD_PUBLISHING_DISABLED');
    if (!Number.isSafeInteger(body.snapshotRevision) || body.snapshotRevision < 0) throw discordError('Affiche un aperçu avant de publier.', 409, 'DISCORD_PREVIEW_REQUIRED');
    const requestId = body.requestId == null ? null : uuid(body.requestId, 'Demande');
    const jobs = await enqueueManualPublication({ teamId, matchId: uuid(body.matchId, 'Game'), routeId: uuid(body.routeId, 'Destination'), expectedRevision: body.snapshotRevision });
    try {
      await auditDiscord(user.id, teamId, 'discord.publish_requested', {
        matchId: body.matchId, routeId: body.routeId, requestId, jobIds: jobs.map((job) => job.id),
      });
      // Claim only this requested publication, sharing the same durable mutex
      // as background workers. A double click cannot create a second message.
      for (const requested of jobs) {
        if (!isDiscordEnabled()) break;
        const claimed = await claimPublicationJob({ teamId, jobId: requested.id });
        if (claimed) await processPublicationJob(claimed);
      }
      const receipts = await readDiscordPublicationReceipts(teamId, jobs.map((job) => job.id));
      const pending = receipts.some((job) => ['queued', 'preparing', 'sending', 'retry_wait'].includes(job.status));
      return json({ ok: true, requestId, jobs: receipts }, pending ? 202 : 200);
    } finally {
      // Rate limits, an existing lease or interrupted requests retain their
      // durable job and scheduled/background fallback.
      wakeDiscordPublications(context);
    }
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'POST' };
