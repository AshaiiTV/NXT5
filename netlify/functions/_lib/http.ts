const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Vary': 'Cookie, Origin, Sec-Fetch-Site'
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_MAX_JSON_BYTES = 2 * 1024 * 1024;

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>([new URL(request.url).origin]);
  const configured = String(process.env.PUBLIC_SITE_URL || '').trim();
  if (configured) {
    try { origins.add(new URL(configured).origin); } catch {}
  }
  return origins;
}

export function assertTrustedMutation(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    throw Object.assign(new Error('Requête intersite refusée.'), { status: 403, code: 'CROSS_SITE_REQUEST' });
  }

  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins(request).has(origin)) {
    throw Object.assign(new Error('Origine de la requête refusée.'), { status: 403, code: 'UNTRUSTED_ORIGIN' });
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...headers
    }
  });
}

export function error(message: string, status = 400, code: string | null = null) {
  const payload: Record<string, unknown> = { error: message };
  if (code) payload.code = code;
  return json(payload, status);
}

export async function readJson(request: Request, maxBytes = DEFAULT_MAX_JSON_BYTES): Promise<any> {
  const declaredBytes = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw Object.assign(new Error('Requête trop volumineuse.'), { status: 413, code: 'REQUEST_TOO_LARGE' });
  }
  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return {};
  }
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw Object.assign(new Error('Requête trop volumineuse.'), { status: 413, code: 'REQUEST_TOO_LARGE' });
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}

export function assertMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw Object.assign(new Error(`Méthode ${request.method} refusée. ${method} attendu.`), { status: 405 });
  }
  assertTrustedMutation(request);
}

export function handleError(err: any): Response {
  console.error(err);
  const status = err.status || 500;
  const serverSideFailure = status >= 500;
  const payload: Record<string, unknown> = { error: serverSideFailure ? (err.publicMessage || 'Erreur serveur.') : (err.message || 'Erreur serveur.') };
  const headers: Record<string, string> = {};
  if (err.code) payload.code = err.code;
  if (err.retryAfter) {
    payload.retryAfter = err.retryAfter;
    headers['Retry-After'] = String(err.retryAfter);
  }
  if (err.riotStatus) payload.riotStatus = err.riotStatus;
  if (!serverSideFailure && err.missing) payload.missing = err.missing;
  if (!serverSideFailure && err.details) payload.details = err.details;
  return json(payload, status, headers);
}
