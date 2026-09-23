import type { Config } from '@netlify/functions';
import { withDiscordRuntime, getDiscordDeployContext } from './_lib/discord-runtime';
import { getDiscordConfig, signDiscordInternalRequest } from './_lib/discord-config';
import { json } from './_lib/http';
async function handler() {
  // The same tick cleans expired personal forms even when publication is off.
  if(getDiscordDeployContext()!=='production'||!getDiscordConfig().configured)return json({enabled:false});
  const body=JSON.stringify({operation:'bot-workflows'});
  const response=await fetch(new URL('/.netlify/functions/discord-bot-workflows-background',getDiscordConfig().siteUrl),{method:'POST',body,
    headers:{'Content-Type':'application/json',...signDiscordInternalRequest(body)},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('DISCORD_BOT_WORKFLOWS_DISPATCH_FAILED');
  return json({dispatched:true});
}
export default withDiscordRuntime(handler);
export const config:Config={schedule:'*/5 * * * *'};
