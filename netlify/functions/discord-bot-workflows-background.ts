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
    const pruned=await pruneDiscordBotArtifacts();
    if(!isDiscordEnabled())return json({enabled:false,pruned});
    const queued=await enqueueScheduledBotMessages();
    return json({queued,pruned,...await deliverBotOutbox(10)});
  }catch(error){return discordResponseError(error);}
}
export default withDiscordRuntime(handler);
