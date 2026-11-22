import { draftSpotlight, spotlightWidths } from '../../shared/draft-spotlight.js';
import championIds from '../../shared/riot-champion-ids.json';
import type { Config } from '@netlify/functions';

const ALLOWED_HOSTS = new Set([
  'ddragon.leagueoflegends.com',
  'raw.communitydragon.org',
  'raw.githubusercontent.com'
]);

const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]);

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const VOICE_IDS = new Map(championIds.map(([id, name]) => [String(name), Number(id)]));
const VOICE_LOCALES = new Map([['fr', 'fr_fr'], ['en', 'default'], ['es', 'es_es']]);
const VOICE_TYPES = new Set(['audio/ogg']);
const ASSET_TIMEOUT_MS = 10_000;
const GITHUB_IMAGE_PATH_RE = /\.(png|jpe?g|webp)$/i;
const RUNE_CATALOG_PATH_RE = /^\/cdn\/[1-9]\d?\.[1-9]\d?\.[1-9]\/data\/(?:fr_FR|en_US|es_ES)\/runesReforged\.json$/;
const MAX_RUNE_CATALOG_BYTES = 512 * 1024;
const RUNE_CATALOG_TIMEOUT_MS = 4000;

function response(status: number, body: string | Uint8Array<ArrayBuffer>, headers: Record<string, string> = {}): Response {
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

function contentTypeOf(upstream: Response): string {
  return (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
}

function unavailable(upstream: Response): Response {
  return response(upstream.status === 404 ? 404 : 502, 'Asset unavailable');
}

// Reads at most maxBytes, including when Content-Length is absent or wrong.
// Returns null once the limit is exceeded, after cancelling the upstream body.
async function readBounded(upstream: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(upstream.headers.get('content-length')) > maxBytes) {
    await upstream.body?.cancel();
    return null;
  }
  if (!upstream.body) return new Uint8Array(0);
  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks, size));
}

// One deadline covers the upstream connection and the streamed body. Network
// and upstream details never reach the browser.
async function fetchUpstream(target: URL, init: { accept: string; redirect: RequestRedirect; timeoutMs: number },
  handle: (upstream: Response) => Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: init.accept },
      redirect: init.redirect,
      signal: controller.signal
    });
    return await handle(upstream);
  } catch {
    return response(controller.signal.aborted ? 504 : 502, 'Asset unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

// The only JSON exception: a versioned rune catalogue in a supported language, never arbitrary
// JSON or SVG.
function runeCatalog(target: URL): Promise<Response> {
  return fetchUpstream(target, { accept: 'application/json', redirect: 'error', timeoutMs: RUNE_CATALOG_TIMEOUT_MS }, async (upstream) => {
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return unavailable(upstream);
    }
    if (contentTypeOf(upstream) !== 'application/json') {
      await upstream.body?.cancel();
      return response(415, 'Unsupported catalogue type');
    }
    const bytes = await readBounded(upstream, MAX_RUNE_CATALOG_BYTES);
    if (!bytes) return response(413, 'Rune catalogue too large');
    const body = Buffer.from(bytes).toString('utf8');
    try {
      if (!Array.isArray(JSON.parse(body))) return response(502, 'Invalid rune catalogue');
    } catch {
      return response(502, 'Invalid rune catalogue');
    }
    return response(200, body, { 'Content-Type': 'application/json; charset=utf-8' });
  });
}

function binaryAsset(target: URL, types: Set<string>, maxBytes: number): Promise<Response> {
  // Following a redirect would bypass the destination allowlist.
  return fetchUpstream(target, { accept: [...types].join(','), redirect: 'manual', timeoutMs: ASSET_TIMEOUT_MS }, async (upstream) => {
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return unavailable(upstream);
    }
    const contentType = contentTypeOf(upstream);
    if (!types.has(contentType)) {
      await upstream.body?.cancel();
      return response(415, 'Unsupported asset type');
    }
    const bytes = await readBounded(upstream, maxBytes);
    if (!bytes) return response(413, 'Asset too large');
    if (!bytes.byteLength) return response(502, 'Asset unavailable');
    return response(200, bytes, { 'Content-Type': contentType });
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return response(405, 'Method not allowed', { Allow: 'GET' });
  const params = new URL(request.url).searchParams;
  if (params.has('voice')) {
    const id = VOICE_IDS.get(params.get('voice') || '');
    const locale = VOICE_LOCALES.get(params.get('lang') || '');
    const kind = params.get('kind');
    if (!id || !locale || (kind !== 'pick' && kind !== 'ban')) return response(400, 'Invalid champion voice');
    const directory = kind === 'pick' ? 'champion-choose-vo' : 'champion-ban-vo';
    const source = new URL(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${locale}/v1/${directory}/${id}.ogg`);
    const clip = await binaryAsset(source, VOICE_TYPES, 256 * 1024);
    if (clip.ok) {
      clip.headers.set('Netlify-CDN-Cache-Control', 'public, durable, max-age=86400, stale-while-revalidate=604800');
      clip.headers.set('Netlify-Vary', 'query');
    }
    return clip;
  }
  if (params.has('spotlight')) {
    const art = draftSpotlight(params.get('spotlight'));
    const width = Number(params.get('w'));
    if (!art || !spotlightWidths(art).includes(width)) return response(400, 'Invalid spotlight');
    const source = new URL('https://cmsassets.rgpub.io/sanity/images/dsfx7636/' + art.asset);
    source.search = new URLSearchParams({ w: String(width), fm: 'webp', q: '89' }).toString();
    return binaryAsset(source, ALLOWED_CONTENT_TYPES, MAX_ASSET_BYTES);
  }
  let target: URL;
  try {
    target = new URL(params.get('url') || '');
  } catch {
    return response(400, 'Invalid asset request');
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)
    || target.port || target.username || target.password) {
    return response(400, 'Asset host not allowed');
  }
  if (/\.json$/i.test(target.pathname)) {
    if (target.hostname !== 'ddragon.leagueoflegends.com' || !RUNE_CATALOG_PATH_RE.test(target.pathname)
      || target.search || target.hash) {
      return response(400, 'Catalogue path not allowed');
    }
    return runeCatalog(target);
  }
  if (target.hostname === 'raw.githubusercontent.com' && !GITHUB_IMAGE_PATH_RE.test(target.pathname)) {
    return response(400, 'GitHub asset path not allowed');
  }
  return binaryAsset(target, ALLOWED_CONTENT_TYPES, MAX_ASSET_BYTES);
}

export const config: Config = { method: 'GET' };
