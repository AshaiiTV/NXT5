import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { publicDiscordStatus } from './_lib/discord-config';
import { assertDiscordSchemaReady } from './_lib/discord-queue';
import { assertDiscordMethod, discordResponseError } from './_lib/discord-access';
export default async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    await requirePlatformAdmin(request, context);
    const status = publicDiscordStatus();
    try { await assertDiscordSchemaReady(); } catch {
      return json({ ...status, schemaReady: false, issues: [...status.issues, 'Migration Discord à appliquer.'], connectionsCount: 0, queuedCount: 0, failedCount: 0, unknownCount: 0, oldestPendingAt: null });
    }
    const rows = await sql("select (select count(*)::int from discord_connections where status='active') as connections_count,count(*) filter(where status in ('queued','retry_wait','preparing'))::int as queued_count,count(*) filter(where status='blocked')::int as failed_count,count(*) filter(where status='uncertain')::int as unknown_count,min(created_at) filter(where status in ('queued','retry_wait','preparing')) as oldest_pending_at from publication_jobs");
    const metrics = rows[0];
    return json({ ...status, schemaReady: true, connectionsCount: metrics.connections_count, queuedCount: metrics.queued_count,
      failedCount: metrics.failed_count, unknownCount: metrics.unknown_count, oldestPendingAt: metrics.oldest_pending_at });
  } catch (error) { return discordResponseError(error); }
}
export const config: Config = { method: 'GET' };
