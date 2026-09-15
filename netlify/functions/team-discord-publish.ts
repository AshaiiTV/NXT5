import type { Config, Context } from '@netlify/functions';
import { json, readJson } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, uuid, auditDiscord } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { enqueueManualPublication } from './_lib/discord-queue';
import { isDiscordEnabled } from './_lib/discord-config';
import { wakeDiscordPublications } from './_lib/discord-wake';

export default async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['POST']);
    const body = await readJson(request, 12_000);
    const { teamId, user } = await requireDiscordTeam(request, context, body.teamId, 'staff');
    await assertSubjectRateLimit('discord-publish', teamId, { limit: 15, windowSeconds: 60 });
    if (!isDiscordEnabled()) throw discordError('Les envois Discord sont suspendus sur cet environnement.', 409, 'DISCORD_PUBLISHING_DISABLED');
    if (!Number.isSafeInteger(body.snapshotRevision) || body.snapshotRevision < 0) throw discordError('Affiche un aperçu avant de publier.', 409, 'DISCORD_PREVIEW_REQUIRED');
    const jobs = await enqueueManualPublication({ teamId, matchId: uuid(body.matchId, 'Game'), routeId: uuid(body.routeId, 'Destination'), expectedRevision: body.snapshotRevision });
    wakeDiscordPublications(context);
    await auditDiscord(user.id, teamId, 'discord.publish_requested', { matchId: body.matchId, routeId: body.routeId });
    return json({ ok: true, jobs: jobs.map((job) => ({ id: job.id, status: job.status })) }, 202);
  } catch (error) { return discordResponseError(error); }
}
export const config: Config = { method: 'POST' };
