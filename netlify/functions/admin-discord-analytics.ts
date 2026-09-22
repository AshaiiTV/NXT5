import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertDiscordMethod } from './_lib/discord-access';
import { json, handleError } from './_lib/http';
import { discordAnalyticsDays, discordAnalyticsSchemaReady, readDiscordAnalytics } from './_lib/discord-analytics';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    await requirePlatformAdmin(request, context);
    const days = discordAnalyticsDays(new URL(request.url).searchParams.get('days'));
    if (!await discordAnalyticsSchemaReady()) {
      return json({ schemaReady: false, code: 'DISCORD_SCHEMA_REQUIRED', error: 'Les migrations Discord doivent être appliquées avant de consulter les statistiques.' });
    }
    return json(await readDiscordAnalytics(days));
  } catch (error) { return handleError(error); }
}

export default withDiscordRuntime(handler);
export const config: Config = { method: 'GET' };
