import { getDiscordConfig, verifyDiscordInternalRequest } from './_lib/discord-config';
import { withDiscordRuntime, getDiscordDeployContext } from './_lib/discord-runtime';
import { maintainDiscordPublications } from './_lib/discord-maintenance';
import { json } from './_lib/http';
import { discordResponseError } from './_lib/discord-access';

async function handler(request: Request) {
  try {
    if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, 405);
    const body = await request.text();
    if (body.length > 4096 || !verifyDiscordInternalRequest(request, body)) return json({ error: 'Authentification interne requise.' }, 401);
    if (!getDiscordConfig().configured || getDiscordDeployContext() !== 'production') return json({ enabled: false });
    return json(await maintainDiscordPublications());
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
