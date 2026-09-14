const DEFAULT_API_VERSION = '2026-07';
const SHOP_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;
const API_VERSION = /^20\d{2}-(01|04|07|10)$/;

export class ShopifyError extends Error {
  publicMessage: string;
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.publicMessage = message;
  }
}

function env(name: string): string {
  return String((globalThis as any).Netlify?.env?.get?.(name) ?? process.env[name] ?? '').trim();
}

function configuration() {
  const domain = env('SHOPIFY_SHOP_DOMAIN').toLowerCase();
  const clientId = env('SHOPIFY_CLIENT_ID');
  const clientSecret = env('SHOPIFY_CLIENT_SECRET');
  const apiVersion = env('SHOPIFY_API_VERSION') || DEFAULT_API_VERSION;
  const issues: string[] = [];
  if (!domain) issues.push('SHOPIFY_SHOP_DOMAIN manque.');
  else if (!SHOP_DOMAIN.test(domain)) issues.push('SHOPIFY_SHOP_DOMAIN doit être un domaine nom.myshopify.com, sans protocole ni chemin.');
  if (!clientId) issues.push('SHOPIFY_CLIENT_ID manque.');
  if (!clientSecret) issues.push('SHOPIFY_CLIENT_SECRET manque.');
  if (!API_VERSION.test(apiVersion)) issues.push('SHOPIFY_API_VERSION doit désigner une version trimestrielle stable (AAAA-MM).');
  return { domain, clientId, clientSecret, apiVersion, issues };
}

export function getShopifyStatus() {
  const config = configuration();
  return {
    configured: config.issues.length === 0,
    domain: SHOP_DOMAIN.test(config.domain) ? config.domain : null,
    apiVersion: API_VERSION.test(config.apiVersion) ? config.apiVersion : null,
    issues: config.issues,
    mode: 'client_credentials',
  };
}

type Configuration = ReturnType<typeof configuration>;
let cachedToken: { domain: string; clientId: string; clientSecret: string; value: string; expiresAt: number } | null = null;

async function requestShopify(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'error' });
  if (response.status === 429) throw new ShopifyError('Shopify limite temporairement les requêtes. Réessaie dans quelques instants.', 503, 'SHOPIFY_RATE_LIMITED');
  return response;
}

async function accessToken(config: Configuration, signal: AbortSignal): Promise<string> {
  if (cachedToken && cachedToken.domain === config.domain && cachedToken.clientId === config.clientId &&
      cachedToken.clientSecret === config.clientSecret && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const response = await requestShopify(`https://${config.domain}/admin/oauth/access_token`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret }),
  });
  if (!response.ok) {
    throw new ShopifyError('Authentification Shopify refusée ou indisponible. Vérifie les identifiants, l’installation et l’appartenance de la boutique et de l’application à la même organisation.', 502, 'SHOPIFY_AUTH_FAILED');
  }
  const payload = await response.json();
  if (typeof payload.access_token !== 'string' || !payload.access_token || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0) {
    throw new ShopifyError('Shopify a renvoyé un jeton invalide.', 502, 'SHOPIFY_INVALID_RESPONSE');
  }
  cachedToken = {
    domain: config.domain, clientId: config.clientId, clientSecret: config.clientSecret,
    value: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000,
  };
  return cachedToken.value;
}

export async function probeShopifyConnection() {
  const config = configuration();
  if (config.issues.length) throw new ShopifyError('La configuration Shopify est incomplète ou invalide.', 503, 'SHOPIFY_NOT_CONFIGURED');
  const signal = AbortSignal.timeout(12_000);
  try {
    const query = async () => requestShopify(`https://${config.domain}/admin/api/${config.apiVersion}/graphql.json`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await accessToken(config, signal) },
      body: JSON.stringify({ query: 'query Nxt5ShopConnection { shop { name myshopifyDomain currencyCode } }' }),
    });
    let response = await query();
    if (response.status === 401) {
      cachedToken = null;
      response = await query();
    }
    if (!response.ok) throw new ShopifyError('La boutique ne répond pas correctement. Vérifie l’installation et les autorisations de l’application Shopify.', 502, 'SHOPIFY_API_FAILED');
    const payload = await response.json();
    if (payload.errors?.length) {
      const throttled = payload.errors.some((error: any) => error?.extensions?.code === 'THROTTLED');
      throw new ShopifyError(throttled ? 'Shopify limite temporairement les requêtes. Réessaie plus tard.' : 'Shopify a refusé la lecture des informations de boutique. Vérifie les autorisations et la version API.', throttled ? 503 : 502, throttled ? 'SHOPIFY_RATE_LIMITED' : 'SHOPIFY_GRAPHQL_FAILED');
    }
    const shop = payload.data?.shop;
    if (!shop || typeof shop.name !== 'string' || typeof shop.myshopifyDomain !== 'string' ||
        !SHOP_DOMAIN.test(shop.myshopifyDomain) || typeof shop.currencyCode !== 'string') {
      throw new ShopifyError('La réponse Shopify ne contient pas les informations de boutique attendues.', 502, 'SHOPIFY_INVALID_RESPONSE');
    }
    return {
      connected: true,
      checkedAt: new Date().toISOString(),
      apiVersion: response.headers.get('x-shopify-api-version') || config.apiVersion,
      requestedApiVersion: config.apiVersion,
      shop: { name: shop.name, domain: shop.myshopifyDomain, currency: shop.currencyCode },
    };
  } catch (error) {
    if (error instanceof ShopifyError) throw error;
    if (signal.aborted) throw new ShopifyError('Shopify met trop longtemps à répondre. Réessaie dans quelques instants.', 504, 'SHOPIFY_TIMEOUT');
    // Never expose upstream bodies, request headers, credentials or raw errors.
    throw new ShopifyError('Impossible de joindre Shopify ou de lire sa réponse. Réessaie dans quelques instants.', 502, 'SHOPIFY_UNAVAILABLE');
  }
}
