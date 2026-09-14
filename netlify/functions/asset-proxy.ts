const ALLOWED_HOSTS = new Set([
  'ddragon.leagueoflegends.com',
  'raw.communitydragon.org',
  'raw.githubusercontent.com'
]);
const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const ASSET_TIMEOUT_MS = 10_000;
const GITHUB_IMAGE_PATH_RE = /\.(png|jpe?g|webp)$/i;

function response(status: number, body: BodyInit, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...headers
    }
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return response(405, 'Method not allowed', { Allow: 'GET' });
  let target: URL;
  try {
    target = new URL(new URL(request.url).searchParams.get('url') || '');
  } catch {
    return response(400, 'Invalid asset request');
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname) || target.username || target.password || target.port) {
    return response(400, 'Asset host not allowed');
  }
  if (target.hostname === 'raw.githubusercontent.com' && !GITHUB_IMAGE_PATH_RE.test(target.pathname)) {
    return response(400, 'GitHub asset path not allowed');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      // Following a redirect would bypass the destination allowlist above.
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'image/webp,image/png,image/jpeg' }
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return response(upstream.status === 404 ? 404 : 502, 'Asset unavailable');
    }
    const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      await upstream.body?.cancel();
      return response(415, 'Unsupported asset type');
    }
    if (Number(upstream.headers.get('content-length')) > MAX_ASSET_BYTES) {
      await upstream.body?.cancel();
      return response(413, 'Asset too large');
    }
    if (!upstream.body) return response(502, 'Asset unavailable');

    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_ASSET_BYTES) {
          await reader.cancel();
          return response(413, 'Asset too large');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (!size) return response(502, 'Asset unavailable');
    return response(200, new Uint8Array(Buffer.concat(chunks, size)), { 'Content-Type': contentType });
  } catch {
    return response(controller.signal.aborted ? 504 : 502, 'Asset unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
