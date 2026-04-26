export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export function error(message, status = 400, code = null) {
  return json(code ? { error: message, code } : { error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function assertMethod(request, method) {
  if (request.method !== method) {
    throw Object.assign(new Error(`Méthode ${request.method} refusée. ${method} attendu.`), { status: 405 });
  }
}

export function handleError(err) {
  console.error(err);
  return error(err.message || 'Erreur serveur.', err.status || 500, err.code || null);
}
