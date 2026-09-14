import type { Config, Context } from '@netlify/functions';
import { assertTrustedMutation, handleError, json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { getShopifyStatus, probeShopifyConnection, ShopifyError } from './_lib/shopify';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Méthode refusée.' }, 405, { Allow: 'GET, POST' });
    assertTrustedMutation(request);
    await requirePlatformAdmin(request, context);
    if (request.method === 'GET') return json(getShopifyStatus());
    return json(await probeShopifyConnection());
  } catch (error) {
    if (error instanceof ShopifyError) return json({ error: error.publicMessage, code: error.code }, error.status);
    return handleError(error);
  }
}

export const config: Config = { method: ['GET', 'POST'] };
