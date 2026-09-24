import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, uuid } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { assertDiscordGroupSchemaReady, previewDiscordGroup } from './_lib/discord-group-export';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    const params = new URL(request.url).searchParams;
    const { teamId, user } = await requireDiscordTeam(request, context, params.get('teamId'), 'staff');
    await assertDiscordGroupSchemaReady();
    await assertSubjectRateLimit('discord-group-preview', user.id, { limit: 10, windowSeconds: 60 });
    return json(await previewDiscordGroup({ teamId: teamId.toLowerCase(), userId: user.id,
      archiveId: uuid(params.get('archiveId'), 'Groupe').toLowerCase(), routeId: uuid(params.get('routeId'), 'Destination').toLowerCase() }));
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'GET' };
