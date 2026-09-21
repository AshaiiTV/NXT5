import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json, readJson } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, uuid } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { assertDiscordTestSchemaReady, loadDiscordTestPreview, sendDiscordConnectionTest } from './_lib/discord-test';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST']);
    const body = request.method === 'POST' ? await readJson(request, 4096) : {};
    const { teamId, user } = await requireDiscordTeam(request, context,
      body.teamId || new URL(request.url).searchParams.get('teamId'), request.method === 'POST' ? 'manage' : 'staff');
    await assertDiscordTestSchemaReady();
    if (request.method === 'GET') {
      await assertSubjectRateLimit('discord-test-preview', user.id, { limit: 20, windowSeconds: 60 });
      return json(await loadDiscordTestPreview(teamId));
    }
    const test = await sendDiscordConnectionTest({ teamId, userId: user.id,
      routeId: uuid(body.routeId, 'Destination'), requestId: uuid(body.requestId, 'Requête de test') });
    return json({ test }, test?.status === 'sending' ? 202 : 200);
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: ['GET', 'POST'] };
