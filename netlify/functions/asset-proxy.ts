import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

const ALLOWED_HOSTS = new Set([
  'ddragon.leagueoflegends.com',
  'raw.communitydragon.org',
  'raw.githubusercontent.com'
]);

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
];

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const GITHUB_IMAGE_PATH_RE = /\.(png|jpe?g|webp)$/i;
const RUNE_CATALOG_PATH_RE = /^\/cdn\/[1-9]\d?\.[1-9]\d?\.[1-9]\/data\/fr_FR\/runesReforged\.json$/;
const MAX_RUNE_CATALOG_BYTES = 512 * 1024;

// The only JSON exception: a versioned French rune catalogue, never arbitrary
// JSON or SVG. Bound the streamed body, including when Content-Length is absent.
async function runeCatalog(target: URL): Promise<HandlerResponse> {
  const upstream = await fetch(target.toString(), {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  });
  if (!upstream.ok) return response(upstream.status, 'Rune catalogue unavailable');
  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return response(415, 'Unsupported catalogue type');
  if (Number(upstream.headers.get('content-length')) > MAX_RUNE_CATALOG_BYTES) {
    await upstream.body?.cancel();
    return response(413, 'Rune catalogue too large');
  }
  const reader = upstream.body?.getReader();
  if (!reader) return response(502, 'Empty rune catalogue');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RUNE_CATALOG_BYTES) {
        await reader.cancel();
        return response(413, 'Rune catalogue too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks).toString('utf8');
  try {
    if (!Array.isArray(JSON.parse(body))) return response(502, 'Invalid rune catalogue');
  } catch {
    return response(502, 'Invalid rune catalogue');
  }
  return response(200, body, { 'Content-Type': 'application/json; charset=utf-8' });
}

function response(statusCode: number, body: string, headers: Record<string, string> = {}, isBase64Encoded = false): HandlerResponse {
  return {
    statusCode,
    isBase64Encoded,
    headers: {
      'Cache-Control': statusCode === 200 ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    },
    body
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    const rawUrl = event.queryStringParameters?.url || '';
    const target = new URL(rawUrl);
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
      return response(400, 'Asset host not allowed');
    }
    if (/\.json$/i.test(target.pathname)) {
      if (target.hostname !== 'ddragon.leagueoflegends.com' || !RUNE_CATALOG_PATH_RE.test(target.pathname)
        || target.port || target.username || target.password || target.search || target.hash) {
        return response(400, 'Catalogue path not allowed');
      }
      return await runeCatalog(target);
    }
    if (target.hostname === 'raw.githubusercontent.com' && !GITHUB_IMAGE_PATH_RE.test(target.pathname)) {
      return response(400, 'GitHub asset path not allowed');
    }

    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*'
      }
    });

    if (!upstream.ok) {
      return response(upstream.status, `Asset unavailable: ${upstream.statusText || upstream.status}`);
    }

    const contentType = (upstream.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return response(415, 'Unsupported asset type');
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > MAX_ASSET_BYTES) {
      return response(413, 'Asset too large');
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_ASSET_BYTES) {
      return response(413, 'Asset too large');
    }
    return response(200, bytes.toString('base64'), {
      'Content-Type': contentType
    }, true);
  } catch (error) {
    return response(400, error instanceof Error ? error.message : 'Invalid asset request');
  }
};
