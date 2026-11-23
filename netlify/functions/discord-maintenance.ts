import type { Config } from '@netlify/functions';
import { withDiscordRuntime, getDiscordDeployContext } from './_lib/discord-runtime';
import { getDiscordConfig, signDiscordInternalRequest } from './_lib/discord-config';
import { json } from './_lib/http';

async function handler() {
  const config = getDiscordConfig();
  if (!config.configured || getDiscordDeployContext() !== 'production') return json({ enabled: false });
  const body = JSON.stringify({ operation: 'maintenance' });
  const target = new URL('/.netlify/functions/discord-maintenance-background', config.siteUrl);
  const response = await fetch(target, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...signDiscordInternalRequest(body, target) },
    body, signal: AbortSignal.timeout(8000), redirect: 'error',
  });
  if (!response.ok) throw new Error('DISCORD_MAINTENANCE_DISPATCH_FAILED');
  return json({ dispatched: true });
}
export default withDiscordRuntime(handler);
export const config: Config = { schedule: '17 3 * * *' };
