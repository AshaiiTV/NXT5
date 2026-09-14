import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './db';
import { isPlatformAdmin, readSessionCookie, sha256 } from './auth';
import { assertTrustedMutation } from './http';
import { canonicalAudiencePath, sanitizeCampaignValue } from '../../../src/app/audience-paths.js';

export const AUDIENCE_VERSION = '2026-09-14';
export const AUDIENCE_SCHEMA_VERSION = 'audience-20260914-v1';
export const RETENTION_DAYS = 180;
export const CONSENT_SECONDS = RETENTION_DAYS * 86400;
export const COOKIE = { receipt: 'nxt5_audience_consent', visitor: 'nxt5_audience_visitor', session: 'nxt5_audience_session', optout: 'nxt5_audience_optout' };
export const GOALS = ['signup', 'login', 'access_request', 'pricing_view'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export async function assertAudienceReady(): Promise<void> {
  try {
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${AUDIENCE_SCHEMA_VERSION}`;
    if (rows.length) return;
  } catch {}
  throw Object.assign(new Error('La mesure de fréquentation attend sa migration.'), {
    status: 503, code: 'AUDIENCE_SCHEMA_MISSING', publicMessage: 'Les statistiques de fréquentation seront disponibles après la mise à jour de la base.'
  });
}

export function readCookie(context: Context, name: string): string {
  const cookie = context.cookies?.get?.(name) as string | { value?: string } | undefined;
  return typeof cookie === 'string' ? cookie : cookie?.value || '';
}

export function cookieOptions(request: Request) {
  return { path: '/', httpOnly: true, sameSite: 'Lax' as const, secure: new URL(request.url).protocol === 'https:' };
}

export function clearAudienceCookies(request: Request, context: Context) {
  for (const name of [COOKIE.visitor, COOKIE.session]) context.cookies.set({ name, value: '', maxAge: 0, ...cookieOptions(request) });
}

export function setOptout(request: Request, context: Context, rejected: boolean) {
  context.cookies.set({ name: COOKIE.optout, value: rejected ? '1' : '', maxAge: rejected ? CONSENT_SECONDS : 0, ...cookieOptions(request), httpOnly: false });
}

export function token(): string { return crypto.randomBytes(32).toString('base64url'); }
export function receiptHash(context: Context): string | null {
  const receipt = readCookie(context, COOKIE.receipt);
  return TOKEN.test(receipt) ? sha256(receipt) : null;
}
export function sessionHash(context: Context): string {
  const value = readCookie(context, COOKIE.session);
  return TOKEN.test(value) ? sha256(value) : '';
}

export async function storedConsent(context: Context) {
  const receipt = receiptHash(context);
  if (!receipt) return null;
  const rows = await sql`
    select analytics, expires_at, visitor_id from audience_consents
    where receipt_hash = ${receipt} and version = ${AUDIENCE_VERSION}
      and expires_at > now() and revoked_at is null limit 1
  `;
  return rows[0] || null;
}

export function assertAudienceOrigin(request: Request) {
  assertTrustedMutation(request);
  // Browsers send Origin on these POSTs; explicitly fail closed when absent.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw Object.assign(new Error('Origine de la requête refusée.'), { status: 403, code: 'UNTRUSTED_ORIGIN' });
  }
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Un corps JSON est attendu.'), { status: 415 });
  }
}

export async function isAudienceAdmin(context: Context): Promise<boolean> {
  const authToken = readSessionCookie(context);
  if (!authToken || authToken.length > 128) return false;
  // Authentication data is read only to exclude staff; it is never joined into
  // the analytics tables or returned by the audience API.
  const rows = await sql`
    select users.id, users.email, coalesce(users.email_verified,false) as email_verified
    from sessions join users on users.id = sessions.user_id
    where sessions.token_hash = ${sha256(authToken)} and sessions.revoked_at is null
      and sessions.expires_at > now() limit 1
  `;
  return isPlatformAdmin(rows[0]);
}

export function browserDimensions(request: Request, context: Context) {
  const ua = (request.headers.get('user-agent') || '').slice(0, 1024);
  const device = /ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'tablet'
    : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Autre';
  const countryCode = String(context.geo?.country?.code || '').toUpperCase();
  return { device, browser, country: /^[A-Z]{2}$/.test(countryCode) ? countryCode : '', bot: /bot|crawler|spider|headless|lighthouse|pagespeed|preview|facebookexternalhit/i.test(ua) };
}

export function validateAudienceEvent(body: any, request: Request) {
  const invalid = () => Object.assign(new Error('Événement de fréquentation invalide.'), { status: 400, code: 'INVALID_AUDIENCE_EVENT' });
  const allowed = ['type','eventId','pageId','path','referrer','source','medium','campaign','name','durationSeconds','scrollDepth'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw invalid();
  if (!['pageview','engagement','event'].includes(body.type) || !UUID.test(body.eventId || '') || !UUID.test(body.pageId || '')) throw invalid();
  const path = canonicalAudiencePath(body.path);
  if (!path) throw invalid();
  if (body.type === 'event' ? !GOALS.includes(body.name) : body.name !== undefined) throw invalid();
  for (const key of ['durationSeconds','scrollDepth']) {
    if (body[key] !== undefined && (typeof body[key] !== 'number' || !Number.isInteger(body[key]) || body[key] < 0 || body[key] > (key === 'scrollDepth' ? 100 : 86400))) throw invalid();
  }
  if (body.type !== 'engagement' && (body.durationSeconds !== undefined || body.scrollDepth !== undefined)) throw invalid();
  for (const key of ['source','medium','campaign','referrer']) if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 253)) throw invalid();
  const referrer = String(body.referrer || '').toLowerCase();
  // Accept a hostname only, never a URL/path, port, query, address or credentials.
  const validReferrer = referrer !== new URL(request.url).hostname && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(referrer)
    && !/\d{7,}/.test(referrer) ? referrer : '';
  return {
    type: body.type, eventId: body.eventId, pageId: body.pageId, path, name: body.name || '',
    durationSeconds: body.durationSeconds || 0, scrollDepth: body.scrollDepth || 0,
    source: sanitizeCampaignValue(body.source) || validReferrer || 'direct',
    medium: sanitizeCampaignValue(body.medium), campaign: sanitizeCampaignValue(body.campaign)
  };
}

export function audienceFailure(err: any) {
  // Do not log raw SQL query parameters (cookies/identifiers) on database errors.
  console.error('[audience] Request failed.', { code: err?.code || 'AUDIENCE_FAILED', status: err?.status || 500 });
  return new Response(JSON.stringify({ error: err?.status < 500 ? err.message : err.publicMessage || 'Fréquentation temporairement indisponible.', code: err?.code || 'AUDIENCE_FAILED' }), {
    status: err?.status || 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie, Origin', 'X-Content-Type-Options': 'nosniff', ...(err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {}) }
  });
}
