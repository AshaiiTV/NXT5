import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { json, readJson } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, uuid } from './_lib/discord-access';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { assertDiscordGroupSchemaReady, publishDiscordGroup, verifyDiscordGroup } from './_lib/discord-group-export';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['POST']);
    const body = await readJson(request, 12_000);
    const { teamId, user } = await requireDiscordTeam(request, context, body.teamId, 'staff');
    await assertDiscordGroupSchemaReady();
    const input = { teamId: teamId.toLowerCase(), archiveId: uuid(body.archiveId, 'Groupe').toLowerCase(),
      requestId: uuid(body.requestId, 'Envoi').toLowerCase() };
    await assertSubjectRateLimit('discord-group-publish', teamId, { limit: 15, windowSeconds: 60 });
    if (body.action && body.action !== 'verify') throw discordError('Action invalide.');
    const publication = body.action === 'verify' ? await verifyDiscordGroup({ ...input, ...(body.messageId === undefined || body.messageId === '' ? {} : { messageId: body.messageId }) })
      : await publishDiscordGroup({ ...input, userId: user.id, routeId: uuid(body.routeId, 'Destination').toLowerCase(), previewToken: body.previewToken });
    return json({ publication }, publication.status === 'sending' ? 202 : 200);
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'POST' };
