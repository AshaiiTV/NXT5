const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Vary': 'Cookie'
};

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

export async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function assertMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw Object.assign(new Error(`Méthode ${request.method} refusée. ${method} attendu.`), { status: 405 });
  }
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
