import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { readSessionCookie, requireAuth, sha256 } from './auth';
import { sql } from './db';
import { json } from './http';
import { riotRsoEnv } from './riot-rso-env';
import type { RiotRsoConfig, VerifiedRiotIdentity } from './riot-rso-protocol';

export const RIOT_FLOW_COOKIE = '__Host-nxt5_riot_flow';
export const RIOT_FLOW_SECONDS = 300;
export const randomRiotValue = () => crypto.randomBytes(32).toString('base64url');

export function riotError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}

// Deliberately never log request URLs, upstream errors or SQL parameters here.
export function riotFailure(err: any): Response {
  const known = typeof err?.code === 'string' && /^(RIOT_|SCHEMA_MIGRATION_REQUIRED|SESSION_SECRET_MISCONFIGURED|CROSS_SITE_REQUEST|UNTRUSTED_ORIGIN|REQUEST_TOO_LARGE|INVALID_JSON|RATE_LIMIT_UNAVAILABLE)/.test(err.code);
  const status = [400, 401, 403, 405, 409, 413, 429, 503].includes(err?.status) ? err.status : 503;
  return json({ error: status < 500 ? (err?.message || 'Action Riot impossible.') : 'Connexion Riot temporairement indisponible.', ...(known ? { code: err.code } : {}), ...(err?.retryAfter ? { retryAfter: err.retryAfter } : {}) }, status,
    err?.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
}

export function localRiotOrigin(): { siteOrigin: string } {
  const siteOrigin = riotRsoEnv('RIOT_RSO_SITE_ORIGIN') || 'https://nxt5.org';
  try {
    const url = new URL(siteOrigin);
    if (url.protocol === 'https:' && url.origin === siteOrigin && !url.username && !url.password) return { siteOrigin };
  } catch { /* Fail closed on a malformed local origin. */ }
  throw riotError(503, 'RIOT_ORIGIN_CONFIG', 'Origine du site indisponible.');
}

export function assertRiotOrigin(request: Request, config: Pick<RiotRsoConfig, 'siteOrigin'>, mutation = false): void {
  if (new URL(request.url).origin !== config.siteOrigin || (mutation && request.headers.get('origin') !== config.siteOrigin)) {
    throw riotError(403, 'RIOT_ORIGIN', 'Origine de la requête refusée.');
  }
  if (mutation && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw riotError(400, 'RIOT_CONTENT_TYPE', 'Une requête JSON est requise.');
  }
}

export function setRiotCookie(context: Context, value: string): void {
  context.cookies.set({ name: RIOT_FLOW_COOKIE, value, httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: value ? RIOT_FLOW_SECONDS : 0 });
}

export function readRiotCookie(context: Context): string {
  const cookie = context.cookies.get(RIOT_FLOW_COOKIE) as string | { value?: string } | undefined;
  return (typeof cookie === 'string' ? cookie : cookie?.value) || '';
}

export async function optionalRiotUser(request: Request, context: Context) {
  return readSessionCookie(context) ? requireAuth(request, context) : null;
}

export type RiotFlow = {
  flow: 'login' | 'link'; user_id: string | null; session_hash: string | null;
  link_revision: string | number | null; nonce: string; code_verifier: string; remember: boolean;
};

export async function consumeRiotFlow(state: string, browser: string): Promise<RiotFlow | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(browser)) return null;
  // DELETE is the claim: only one concurrent callback can receive the secrets.
  const rows = await sql`
    delete from riot_auth_flows
    where state_hash = ${sha256(state)} and browser_hash = ${sha256(browser)}
    returning flow, user_id, session_hash, link_revision, nonce, code_verifier, remember,
      expires_at > clock_timestamp() as usable
  `;
  // RETURNING is evaluated after acquiring the row lock: a state that expires
  // while this DELETE waits is discarded, including after a competing rollback.
  return rows[0]?.usable ? rows[0] as RiotFlow : null;
}

export async function linkRiotIdentity(pending: RiotFlow, identity: VerifiedRiotIdentity): Promise<boolean> {
  if (pending.flow !== 'link' || !pending.user_id || !pending.session_hash || pending.link_revision == null) {
    throw riotError(400, 'RIOT_FLOW', 'Parcours Riot invalide.');
  }
  // Lock both account and session: revocation while waiting for the account
  // lock must be rechecked against the latest session row, not an old snapshot.
  // Unique constraints arbitrate concurrent claims without roster involvement.
  const rows = await sql`
    with authorized_user as materialized (
      select id from users
      where id = ${pending.user_id} and riot_link_revision = ${pending.link_revision}
        and password_hash <> '' and account_name <> ''
      for update
    ), authorized_session as materialized (
      select sessions.user_id, sessions.expires_at from sessions
      join authorized_user on authorized_user.id = sessions.user_id
      where token_hash = ${pending.session_hash} and revoked_at is null and expires_at > clock_timestamp()
      for update of sessions
    )
    insert into riot_identities (user_id, puuid, game_name, tag_line)
    select authorized_session.user_id, ${identity.puuid}, ${identity.gameName}, ${identity.tagLine}
    from authorized_session
    where authorized_session.expires_at > clock_timestamp()
    on conflict (user_id) do update set game_name = excluded.game_name, tag_line = excluded.tag_line
    where riot_identities.puuid = excluded.puuid
    returning user_id
  `;
  return rows.length > 0;
}

export function riotRedirect(flow: 'login' | 'link', result: string): Response {
  const path = result === 'success' ? '/equipes' : `${flow === 'link' ? '/parametres' : '/connexion'}?riot=${encodeURIComponent(result)}`;
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' } });
}
