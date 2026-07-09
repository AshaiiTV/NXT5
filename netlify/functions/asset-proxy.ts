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
