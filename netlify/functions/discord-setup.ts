import type { Config, Context } from '@netlify/functions';
import { getDiscordDeployContext, withDiscordRuntime } from './_lib/discord-runtime';
import { verifyDiscordInternalRequest } from './_lib/discord-config';
import { DiscordApiError } from './_lib/discord-client';
import { DiscordSetupError, setupDiscordApplication } from './_lib/discord-setup';
import { json } from './_lib/http';

async function readSignedBody(request: Request) {
  const limit = 4096;
  if (Number(request.headers.get('content-length') || 0) > limit) throw new DiscordSetupError(413, 'REQUEST_TOO_LARGE', 'Requête trop volumineuse.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw new DiscordSetupError(413, 'REQUEST_TOO_LARGE', 'Requête trop volumineuse.');
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, length));
  } finally { reader.releaseLock(); }
}

async function handler(request: Request, context: Context) {
  if (request.method !== 'POST') return json({ error: 'Méthode refusée.', code: 'METHOD_NOT_ALLOWED' }, 405);
  // Require invocation metadata, including in local tools: build variables and
  // request headers can never authorize changing the shared Discord application.
  if (getDiscordDeployContext() !== 'production' || context?.deploy?.context !== 'production') {
    return json({ error: 'La configuration Discord est réservée au déploiement de production.', code: 'DISCORD_SETUP_PRODUCTION_REQUIRED' }, 409);
  }
  try {
    const raw = await readSignedBody(request);
    if (!verifyDiscordInternalRequest(request, raw)) return json({ error: 'Authentification opérateur requise.', code: 'DISCORD_SETUP_UNAUTHORIZED' }, 401);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Corps JSON invalide.', code: 'INVALID_JSON' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !['inspect', 'configure'].includes(body.action)) {
      return json({ error: 'Choisis explicitement l’action inspect ou configure.', code: 'DISCORD_SETUP_INVALID_ACTION' }, 400);
    }
    return json(await setupDiscordApplication(body.action, body.expectedApplicationId));
  } catch (error) {
    // No raw upstream responses or exception messages from fetch are exposed/logged.
    if (error instanceof DiscordSetupError) return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof DiscordApiError) {
      const status = error.status === 429 ? 429 : 502;
      const retryAfter = error.retryAfter ? Math.min(86400, Math.ceil(error.retryAfter)) : undefined;
      return json({ error: error.message, code: error.code, ...(retryAfter ? { retryAfter } : {}) }, status, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
    }
    return json({ error: 'La configuration Discord ne peut pas être confirmée. Relance une inspection.', code: 'DISCORD_SETUP_UNAVAILABLE' }, 503);
  }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'POST' };
