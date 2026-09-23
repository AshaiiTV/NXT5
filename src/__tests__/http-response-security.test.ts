import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { error, handleError, json } from '../../netlify/functions/_lib/http';

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('function JSON response protections', () => {
  it('applies protections to success, validation and server error responses', () => {
    for (const response of [json({ ok: true }), error('Invalid request', 400), handleError(new Error('private upstream detail'))]) {
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
      expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  it.each([
    { 'Retry-After': '15' },
    new Headers({ 'Retry-After': '15' }),
    [['Retry-After', '15']] as [string, string][]
  ])('preserves supported custom header formats and protection defaults', (headers) => {
    const response = json({ error: 'Wait' }, 429, headers);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });
});

describe('safe error reporting', () => {
  it('keeps database queries, request credentials and upstream payloads out of logs and responses', async () => {
    const failure = Object.assign(new Error('password=private-password'), {
      code: '23505',
      query: 'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      params: ['private@example.test', 'private-password-hash'],
      request: { headers: { authorization: 'Bearer private-token' } },
      cause: new Error('postgres://private-user:private-secret@db.example/database'),
      details: { upstreamBody: 'private-upstream-response' },
      missing: ['private-configuration']
    });
    const response = handleError(failure);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Erreur serveur.', code: '23505' });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[http] Request failed.', { status: 500, code: '23505' });
  });

  it('preserves explicit public server messages without serializing internal details', async () => {
    const response = handleError(Object.assign(new Error('private query'), {
      status: 503,
      code: 'SCHEMA_MIGRATION_REQUIRED',
      publicMessage: 'Service en cours de mise à jour.',
      details: ['private table'],
      missing: ['private configuration']
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Service en cours de mise à jour.', code: 'SCHEMA_MIGRATION_REQUIRED' });
  });

  it('preserves client validation messages and numeric retry information', async () => {
    const response = handleError(Object.assign(new Error('Attends quelques instants.'), {
      status: 429,
      code: 'RIOT_RATE_LIMIT',
      retryAfter: 1.25,
      riotStatus: 429
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(await response.json()).toEqual({ error: 'Attends quelques instants.', code: 'RIOT_RATE_LIMIT', retryAfter: 1.25, riotStatus: 429 });
  });

  it('does not expose Riot response bodies in server failures', async () => {
    const response = handleError(Object.assign(new Error('private upstream response'), {
      status: 502, code: 'RIOT_API_ERROR', riotStatus: 503
    }));
    expect(await response.json()).toEqual({ error: 'Erreur serveur.', code: 'RIOT_API_ERROR', riotStatus: 503 });
  });

  it.each([null, undefined, 'private thrown string', { status: 200, message: 'private detail' }, { status: '400', message: 'private detail' }, { status: 600 }, { status: 400.5 }])('fails safely for malformed thrown values: %s', async (failure) => {
    const response = handleError(failure);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Erreur serveur.' });
  });

  it.each(['Bearer private-token', 'QUERY\nprivate-value', 'A'.repeat(81), { secret: 'private-secret' }])('omits codes that are not bounded machine identifiers', async (code) => {
    const response = handleError({ code, retryAfter: 'private-token', riotStatus: 'private-response', publicMessage: { secret: 'private-secret' } });
    expect(response.headers.has('retry-after')).toBe(false);
    expect(await response.json()).toEqual({ error: 'Erreur serveur.' });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[http] Request failed.', { status: 500, code: 'UNEXPECTED_ERROR' });
  });
});
