import { json, readJson, handleError } from './_lib/http';
import { fetchRiotMatch, fetchRiotMatchTimeline } from './_lib/riot';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';

const EUROPE_PLATFORMS = ['EUW1', 'EUN1', 'TR1', 'RU'];
const EXPORT_LIMIT = { limit: 12, windowSeconds: 60 };
// NXT5 Importer calls this route without a session, so each upstream Riot lookup
// is charged to the caller's IP and to a platform-wide hourly budget: a single
// request with fallback can no longer cost several Riot calls for free.
const LOOKUP_LIMIT = { limit: 16, windowSeconds: 60 };
const DEFAULT_HOURLY_LOOKUPS = 1500;

function envValue(name: string): string {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name] || '';
}

function hourlyLookupLimit(): number {
  const value = Number.parseInt(envValue('RIOT_EXPORT_HOURLY_LIMIT'), 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_HOURLY_LOOKUPS;
}

async function chargeRiotLookup(request: Request): Promise<void> {
  await assertRateLimit(request, 'riot-match-export-lookup', LOOKUP_LIMIT);
  try {
    await assertSubjectRateLimit('riot-match-export-global', 'riot-api', { limit: hourlyLookupLimit(), windowSeconds: 3600 });
  } catch (err: any) {
    if (err?.status === 429) {
      err.code = 'NXT5_EXPORT_BUSY';
      err.message = 'Export Riot temporairement saturé. Réessaie plus tard ou importe le JSON depuis NXT5 Importer.';
    }
    throw err;
  }
}

function normalizePlatform(value) {
  const platform = String(value || 'EUW1').trim().toUpperCase();
  const aliases = { EUW: 'EUW1', EUNE: 'EUN1', EUN: 'EUN1', TR: 'TR1' };
  return aliases[platform] || platform || 'EUW1';
}

function readGameId(value, platform = 'EUW1', fallback = false) {
  const raw = String(value || '').trim().toUpperCase();
  const gameId = raw.includes('_') ? raw : `${normalizePlatform(platform)}_${raw}`;
  if (!/^([A-Z0-9]+)_\d+$/.test(gameId)) {
    throw Object.assign(new Error('Game ID invalide. Format attendu : 7123456789 ou EUW1_7123456789.'), {
      status: 400,
      code: 'NXT5_EXPORT_GAME_ID_INVALID'
    });
  }
  return { gameId, rawNumericId: raw.includes('_') ? gameId.split('_')[1] : raw, wasNumericOnly: !raw.includes('_') || fallback };
}

function candidateGameIds({ gameId, rawNumericId, wasNumericOnly }) {
  const primaryPlatform = gameId.split('_')[0];
  const platforms = wasNumericOnly
    ? [primaryPlatform, ...EUROPE_PLATFORMS.filter((platform) => platform !== primaryPlatform)]
    : [primaryPlatform];
  return [...new Set(platforms.map((platform) => `${platform}_${rawNumericId}`))];
}

async function fetchFirstAvailableMatch(request: Request, input) {
  const attempts: string[] = [];
  for (const candidate of candidateGameIds(input)) {
    await chargeRiotLookup(request);
    try {
      const match = await fetchRiotMatch(candidate);
      let timeline = null;
      try {
        timeline = await fetchRiotMatchTimeline(candidate);
      } catch {
        timeline = null;
      }
      return { gameId: candidate, match, timeline, attempts };
    } catch (err) {
      attempts.push(`${candidate}: ${err.message}`);
      if (err.status && err.status !== 404) throw err;
    }
  }

  throw Object.assign(
    new Error(`Game ID introuvable côté Riot. IDs testés : ${candidateGameIds(input).join(', ')}. Vérifie la région, attends quelques minutes si la game vient de finir, ou importe le JSON depuis le Game ID complet.`),
    {
      status: 404,
      code: 'NXT5_EXPORT_MATCH_NOT_FOUND',
      details: attempts
    }
  );
}

function optionalExportToken() {
  return envValue('RIOT_EXPORT_TOKEN');
}

function assertExportToken(request: Request, body: Record<string, any>) {
  const expected = optionalExportToken();
  if (!expected) return;
  // Header or JSON body only: a token in the query string would end up in access logs.
  const provided = request.headers.get('x-nxt5-export-token') || body.token || '';
  if (provided !== expected) {
    throw Object.assign(new Error('Export Riot non autorisé.'), { status: 401 });
  }
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (!['GET', 'POST'].includes(request.method)) {
      throw Object.assign(new Error(`Méthode ${request.method} refusée. GET ou POST attendu.`), { status: 405 });
    }

    const url = new URL(request.url);
    const body = request.method === 'POST' ? await readJson(request) : {};
    assertExportToken(request, body);
    await assertRateLimit(request, 'riot-match-export', EXPORT_LIMIT);
    const shouldFallback = url.searchParams.get('fallback') === '1' || body.fallback === true;
    const input = readGameId(url.searchParams.get('gameId') || body.gameId, url.searchParams.get('platform') || body.platform, shouldFallback);
    const { gameId, match, timeline } = await fetchFirstAvailableMatch(request, input);

    return json({
      source: 'nxt5-riot-match-export',
      version: 2,
      gameId,
      platform: gameId.split('_')[0],
      exportedAt: new Date().toISOString(),
      match,
      timeline
    });
  } catch (err) {
    return handleError(err);
  }
}
