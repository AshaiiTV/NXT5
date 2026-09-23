import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { readSessionCookie, requireAuth, sha256 } from './auth';
import { sql } from './db';
import { json } from './http';
import { SOCIAL_PROVIDERS, type SocialProvider, type VerifiedSocialIdentity } from './social-auth-protocol';

export const SOCIAL_BROWSER_COOKIE = '__Host-nxt5_social_flow';
export const SOCIAL_TICKET_COOKIE = '__Host-nxt5_social_ticket';
export const SOCIAL_SECONDS = 300;
export { LEGAL_VERSION } from '../../../shared/legal.js';
export const randomSocialValue = () => crypto.randomBytes(32).toString('base64url');
export const isSocialSecret = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export function socialError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code });
}

export function parseSocialProvider(value: unknown): SocialProvider {
  if (!SOCIAL_PROVIDERS.includes(value as SocialProvider)) throw socialError(400, 'SOCIAL_PROVIDER', 'Méthode de connexion inconnue.');
  return value as SocialProvider;
}

export function socialOrigin(): string {
  const origin = (globalThis as any).Netlify?.env?.get?.('SOCIAL_AUTH_SITE_ORIGIN') || process.env.SOCIAL_AUTH_SITE_ORIGIN || 'https://nxt5.org';
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'https:' && parsed.origin === origin && !parsed.username && !parsed.password) return origin;
  } catch { /* Refuse incomplete server configuration. */ }
  throw socialError(503, 'SOCIAL_ORIGIN_CONFIG', 'Connexion temporairement indisponible.');
}

export function assertSocialOrigin(request: Request, mutation = false) {
  const origin = socialOrigin();
  if (new URL(request.url).origin !== origin || (mutation && request.headers.get('origin') !== origin)) {
    throw socialError(403, 'SOCIAL_ORIGIN', 'Origine de la requête refusée.');
  }
  if (mutation && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw socialError(400, 'SOCIAL_CONTENT_TYPE', 'Une requête JSON est requise.');
  }
}

export function socialFailure(err: any): Response {
  // Never log raw errors: an upstream response or SQL error can contain secrets.
  const status = [400, 401, 403, 405, 409, 413, 429, 503].includes(err?.status) ? err.status : 503;
  const known = /^(SOCIAL_|SCHEMA_MIGRATION_REQUIRED|RATE_LIMIT_UNAVAILABLE|EMAIL_VERIFY_RATE_LIMIT|LEGAL_ACCEPTANCE_REQUIRED)/.test(String(err?.code || ''));
  return json({ error: status < 500 && known ? err.message : 'Connexion temporairement indisponible. Réessaie.',
    ...(known ? { code: err.code } : {}), ...(err?.retryAfter ? { retryAfter: err.retryAfter } : {}) }, status,
  err?.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
}

export function socialCookie(context: Context, name: string): string {
  const value = context.cookies.get(name) as string | { value?: string } | null | undefined;
  return (typeof value === 'string' ? value : value?.value) || '';
}

export function setSocialCookie(context: Context, name: string, value: string, crossSitePost = false) {
  context.cookies.set({ name, value, httpOnly: true, secure: true, sameSite: crossSitePost ? 'None' : 'Lax', path: '/', maxAge: value ? SOCIAL_SECONDS : 0 });
}

export async function optionalSocialUser(request: Request, context: Context) {
  return readSessionCookie(context) ? requireAuth(request, context) : null;
}

export function socialDestination(next: unknown, invite?: unknown, registration = false): string {
  if (typeof invite === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(invite)) return `/equipes?invite=${encodeURIComponent(invite)}`;
  if (typeof next === 'string' && next.length <= 1024 && /^\/[A-Za-z0-9]/.test(next)
    && !/[\\\s\u0000-\u001f\u007f]/.test(next) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(next)) {
    const url = new URL(next, 'https://nxt5.invalid');
    const routes = ['/equipes', '/profil', '/mon-profil', '/parametres', '/games', '/draft', '/champion-pool', '/compositions-types', '/rapports', '/tendances', '/gestion-equipe', '/planning', '/integration', '/statistiques', '/guide', '/bot-discord', '/admin'];
    if (url.origin === 'https://nxt5.invalid' && routes.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))) return `${url.pathname}${url.search}${url.hash}`;
  }
  return registration ? '/equipes?create=1' : '/equipes';
}

export function socialRedirect(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' } });
}

export function socialNotice(flow: string, status: string, provider?: SocialProvider): Response {
  const params = new URLSearchParams({ social: status });
  if (provider) params.set('provider', provider);
  return socialRedirect(`${flow === 'link' ? '/parametres' : '/connexion'}?${params}`);
}

export type SocialFlow = {
  provider: SocialProvider; flow: 'login' | 'register' | 'link'; user_id: string | null;
  session_hash: string | null; link_revision: number | string | null;
  nonce: string; code_verifier: string; remember: boolean; destination: string;
};
export type SocialTicket = SocialFlow & {
  subject: string; email: string | null; email_verified: boolean; display_name: string | null;
};

export async function consumeSocialFlow(state: string, browser: string): Promise<SocialFlow | null> {
  if (!isSocialSecret(state) || !isSocialSecret(browser)) return null;
  const rows = await sql`delete from social_auth_flows where state_hash = ${sha256(state)}
    and browser_hash = ${sha256(browser)} and expires_at > clock_timestamp() returning *`;
  return rows[0] as SocialFlow || null;
}

export async function issueSocialTicket(pending: SocialFlow, identity: VerifiedSocialIdentity, browser: string, purpose: 'callback' | 'signup'): Promise<string> {
  const token = randomSocialValue();
  await sql`insert into social_auth_tickets (token_hash, browser_hash, purpose, provider, subject, email, email_verified,
    display_name, flow, user_id, session_hash, link_revision, remember, destination)
    values (${sha256(token)}, ${sha256(browser)}, ${purpose}, ${pending.provider}, ${identity.subject}, ${identity.email}, ${identity.emailVerified},
      ${identity.name?.slice(0, 100) || null}, ${pending.flow}, ${pending.user_id}, ${pending.session_hash}, ${pending.link_revision}, ${pending.remember}, ${pending.destination})`;
  return token;
}

export async function socialTicket(context: Context, purpose: 'callback' | 'signup', consume = false): Promise<SocialTicket | null> {
  const token = socialCookie(context, SOCIAL_TICKET_COOKIE);
  const browser = socialCookie(context, SOCIAL_BROWSER_COOKIE);
  if (!isSocialSecret(token) || !isSocialSecret(browser)) return null;
  const rows = consume
    ? await sql`delete from social_auth_tickets where token_hash = ${sha256(token)} and browser_hash = ${sha256(browser)}
        and purpose = ${purpose} and expires_at > clock_timestamp() returning *`
    : await sql`select * from social_auth_tickets where token_hash = ${sha256(token)} and browser_hash = ${sha256(browser)}
        and purpose = ${purpose} and expires_at > clock_timestamp()`;
  return rows[0] as SocialTicket || null;
}

export async function linkSocialIdentity(pending: SocialTicket): Promise<boolean> {
  const rows = await sql`
    with authorized_user as materialized (
      select id from users where id = ${pending.user_id} and social_link_revision = ${pending.link_revision} for update
    ), authorized_session as materialized (
      select sessions.user_id from sessions join authorized_user on authorized_user.id = sessions.user_id
      where token_hash = ${pending.session_hash} and revoked_at is null and expires_at > clock_timestamp() for update of sessions
    ), linked as (
      insert into social_identities (user_id, provider, subject, display_name)
      select authorized_session.user_id, ${pending.provider}, ${pending.subject}, ${pending.display_name} from authorized_session
      on conflict (user_id, provider) do update set display_name = excluded.display_name
        where social_identities.subject = excluded.subject
      returning user_id
    ), logged as (
      insert into audit_logs (user_id, action, entity_type, metadata)
      select user_id, 'auth.social_link', 'user', jsonb_build_object('provider', ${pending.provider}::text) from linked
    )
    select user_id from linked
  `;
  return rows.length > 0;
}
