import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { loadDiscordPreview } from './_lib/discord-preview';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    const params = new URL(request.url).searchParams;
    const { teamId, user } = await requireDiscordTeam(request, context, params.get('teamId'), 'staff');
    await assertSubjectRateLimit('discord-preview', user.id, { limit: 10, windowSeconds: 60 });
    const result = await loadDiscordPreview({ teamId, matchId: params.get('matchId') || '', routeId: params.get('routeId') || '' });
    return json({ message: result.message, snapshotRevision: result.snapshotRevision,
      imageDataUrl: result.image ? 'data:image/png;base64,' + result.image.bytes.toString('base64') : null });
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'GET' };
