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
  'image/webp',
  'image/svg+xml'
];

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

    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,*/*'
      }
    });

    if (!upstream.ok) {
      return response(upstream.status, `Asset unavailable: ${upstream.statusText || upstream.status}`);
    }

    const contentType = (upstream.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return response(415, 'Unsupported asset type');
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    return response(200, bytes.toString('base64'), {
      'Content-Type': contentType
    }, true);
  } catch (error) {
    return response(400, error instanceof Error ? error.message : 'Invalid asset request');
  }
};
