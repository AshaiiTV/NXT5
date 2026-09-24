import type { Config, Context } from '@netlify/functions';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertDiscordMethod, discordError, discordResponseError } from './_lib/discord-access';
import { getDiscordDeployContext, withDiscordRuntime } from './_lib/discord-runtime';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { assertCommunityReady, communityOverview, configureCommunityChannel, previewCommunityAnnouncement, publishCommunityAnnouncement, recoverCommunityAnnouncement } from './_lib/discord-community-announcements';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST']);
    const user = await requirePlatformAdmin(request, context);
    if (getDiscordDeployContext() !== 'production' || context?.deploy?.context !== 'production') {
      throw discordError('Les annonces communautaires sont disponibles uniquement sur le déploiement de production.', 409, 'DISCORD_COMMUNITY_PRODUCTION_REQUIRED');
    }
    await assertCommunityReady();
    if (request.method === 'GET') return json(await communityOverview());
    await assertSubjectRateLimit('discord-community-announcements', user.id, { limit: 15, windowSeconds: 60 });
    const body = await readJson(request, 24_000);
    if (body.action === 'configure') return json(await configureCommunityChannel(body.channelId, user.id));
    if (body.action === 'preview') return json(await previewCommunityAnnouncement(body, user.id));
    if (body.action === 'publish') return json(await publishCommunityAnnouncement(body, user.id));
    if (body.action === 'recover') return json(await recoverCommunityAnnouncement(body.reference));
    throw discordError('Choisis l’action configure, preview, publish ou recover.', 400, 'DISCORD_ANNOUNCEMENT_ACTION_INVALID');
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: ['GET', 'POST'] };
