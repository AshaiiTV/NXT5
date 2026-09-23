const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
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
  const responseHeaders = new Headers(SECURITY_HEADERS);
  new Headers(headers).forEach((value, name) => responseHeaders.set(name, value));
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders
  });
}

export function error(message: string, status = 400, code: string | null = null) {
  const payload: Record<string, unknown> = { error: message };
  if (code) payload.code = code;
  return json(payload, status);
}

export async function readJson(request: Request, maxBytes = DEFAULT_MAX_JSON_BYTES): Promise<any> {
  const tooLarge = () => Object.assign(new Error('Requête trop volumineuse.'), { status: 413, code: 'REQUEST_TOO_LARGE' });
  const invalidJson = () => Object.assign(new Error('Corps JSON invalide.'), { status: 400, code: 'INVALID_JSON' });
  const declaredBytes = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  } catch (err: any) {
    if (err?.code === 'REQUEST_TOO_LARGE') throw err;
    throw invalidJson();
  } finally {
    reader.releaseLock();
  }

  if (!bytes) return {};
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalidJson();
    return body;
  } catch {
    throw invalidJson();
  }
}

export function assertMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw Object.assign(new Error(`Méthode ${request.method} refusée. ${method} attendu.`), { status: 405 });
  }
  assertTrustedMutation(request);
}

export function handleError(err: any): Response {
  const failure = err && typeof err === 'object' ? err : {};
  const status = Number.isInteger(failure.status) && failure.status >= 400 && failure.status <= 599 ? failure.status : 500;
  const code = typeof failure.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(failure.code) ? failure.code : null;
  // Errors from database and HTTP clients can contain queries, parameters,
  // credentials or whole upstream responses. Only log bounded metadata.
  console.error('[http] Request failed.', { status, code: code || 'UNEXPECTED_ERROR' });
  const serverSideFailure = status >= 500;
  const message = serverSideFailure ? failure.publicMessage : failure.message;
  const payload: Record<string, unknown> = { error: typeof message === 'string' && message ? message : 'Erreur serveur.' };
  const headers: Record<string, string> = {};
  if (code) payload.code = code;
  if (typeof failure.retryAfter === 'number' && Number.isFinite(failure.retryAfter) && failure.retryAfter > 0) {
    payload.retryAfter = failure.retryAfter;
    headers['Retry-After'] = String(Math.ceil(failure.retryAfter));
  }
  if (Number.isInteger(failure.riotStatus) && failure.riotStatus >= 400 && failure.riotStatus <= 599) payload.riotStatus = failure.riotStatus;
  if (!serverSideFailure && failure.missing) payload.missing = failure.missing;
  if (!serverSideFailure && failure.details) payload.details = failure.details;
  return json(payload, status, headers);
}
