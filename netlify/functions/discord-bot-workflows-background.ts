import { withDiscordRuntime } from './_lib/discord-runtime';
import { assertDiscordArtifactEnvironment, discordResponseError } from './_lib/discord-access';
import { isDiscordEnabled, verifyDiscordInternalRequest } from './_lib/discord-config';
import { json } from './_lib/http';
import { enqueueScheduledBotMessages, deliverBotOutbox, pruneDiscordBotArtifacts } from './_lib/discord-bot-schedule';
import { assertDiscordBotSchemaReady } from './_lib/discord-bot-common';
async function handler(request:Request) {
  try{
    assertDiscordArtifactEnvironment();
    const body=await request.text();
    if(request.method!=='POST'||!verifyDiscordInternalRequest(request,body))return json({error:'Accès refusé.'},401);
    await assertDiscordBotSchemaReady();
    if(!isDiscordEnabled())return json({enabled:false,pruned:await pruneDiscordBotArtifacts()});
    let pruned: Awaited<ReturnType<typeof pruneDiscordBotArtifacts>> | undefined;
    let queued=0;
    let schedulingError: unknown;
    try { pruned=await pruneDiscordBotArtifacts(); queued=await enqueueScheduledBotMessages(); } catch (error) { schedulingError=error; }
    const delivered=await deliverBotOutbox(10);
    if(schedulingError)throw schedulingError;
    return json({queued,pruned,...delivered});
  }catch(error){return discordResponseError(error);}
}
export default withDiscordRuntime(handler);
