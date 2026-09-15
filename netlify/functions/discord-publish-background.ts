import { verifyDiscordInternalRequest } from './_lib/discord-config';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { runPublicationBatch } from './_lib/discord-worker';
import { json, handleError } from './_lib/http';

async function handler(request: Request) {
  try {
    if (request.method !== 'POST') return json({error:'Méthode refusée.'},405);
    const body = await request.text();
    if (body.length>4096 || !verifyDiscordInternalRequest(request,body)) return json({error:'Authentification interne requise.'},401);
    let notBefore=0;
    try {notBefore=Number(JSON.parse(body).notBefore || 0);} catch {return json({error:'Corps invalide.'},400);}
    // Debounce corrections only in the background function. The importing user
    // receives their response immediately and the scheduled worker is fallback.
    const delay=Math.max(0,Math.min(8000,Number.isFinite(notBefore) ? notBefore-Date.now() : 0));
    if (delay>0) await new Promise(resolve=>setTimeout(resolve,delay));
    return json(await runPublicationBatch(4));
  } catch (error) { return handleError(error); }
}
export default withDiscordRuntime(handler);
