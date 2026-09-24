import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, uuid } from './_lib/discord-access';
import { assertDiscordGroupSchemaReady, listDiscordGroupExports } from './_lib/discord-group-export';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    const params = new URL(request.url).searchParams;
    const { teamId } = await requireDiscordTeam(request, context, params.get('teamId'), 'staff');
    await assertDiscordGroupSchemaReady();
    return json({ publications: await listDiscordGroupExports(teamId.toLowerCase(), uuid(params.get('archiveId'), 'Groupe').toLowerCase()) });
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'GET' };
