import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Context } from '@netlify/functions';
import { sql } from './db';
import { ensureMigration } from './migrations';
import type { DbUser } from './types';

export const COOKIE_NAME = 'rb_session';
const REMEMBER_SESSION_DAYS = 30;
const SHORT_SESSION_HOURS = 12;
const MIN_SESSION_SECRET_LENGTH = 64;

type SessionRequest = Request | null;

function getEnv(name: string): string {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name] || '';
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isSecureRequest(request: SessionRequest = null): boolean {
  if (process.env.URL?.startsWith('https://') || process.env.DEPLOY_PRIME_URL?.startsWith('https://')) return true;
  if (!request) return process.env.APP_ENV === 'production';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.split(',')[0].trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

function sessionCookieOptions(request: SessionRequest = null) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'Lax' as const,
    path: '/'
  };
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function assertSessionSecret(): void {
  const secret = getEnv('SESSION_SECRET');
  if (secret.length >= MIN_SESSION_SECRET_LENGTH) return;
  throw Object.assign(new Error('SESSION_SECRET must be set and at least 64 characters long.'), {
    status: 500,
    code: 'SESSION_SECRET_MISCONFIGURED',
    publicMessage: 'Misconfigured server'
  });
}

export async function hashPassword(password: string): Promise<string> {
  const moduleName = 'argon2';
  const argon2 = await import(moduleName).catch(() => null) as any;
  if (argon2) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw Object.assign(new Error('Le mot de passe est trop long.'), { status: 400 });
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (String(hash || '').startsWith('$argon2')) {
      const moduleName = 'argon2';
      const argon2 = await import(moduleName).catch(() => null) as any;
      return argon2 ? argon2.verify(hash, password) : false;
    }
    return bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function normalizeAccountName(accountName: unknown): string {
  return String(accountName || '').trim().toLowerCase();
}

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

/** Returns false when platform administration has not been configured. */
export function isPlatformAdmin(user: Partial<DbUser> | null | undefined): boolean {
  const configuredUserId = getEnv('PLATFORM_ADMIN_USER_ID').trim().toLowerCase();
  const configuredEmail = normalizeEmail(getEnv('PLATFORM_ADMIN_EMAIL'));
  if (!user || (!configuredUserId && !configuredEmail)) return false;

  const userId = String(user.id || '').trim().toLowerCase();
  const email = normalizeEmail(user.email);
  const idMatches = !configuredUserId || timingSafeStringEqual(userId, configuredUserId);
  const emailMatches = !configuredEmail || (
    Boolean(user.email_verified) && timingSafeStringEqual(email, configuredEmail)
  );
  return idMatches && emailMatches;
}

export function isValidEmail(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export async function ensureAuthUserSchema(): Promise<void> {
  await ensureMigration('auth-runtime-2026-09-02-v1', async () => {
    await sql`create extension if not exists pgcrypto`;
    await sql`
      create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        account_name text,
        email text,
        name text not null default 'Compte NXT5',
        password_hash text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`alter table users add column if not exists account_name text`;
    await sql`alter table users add column if not exists email text`;
    await sql`alter table users add column if not exists name text not null default 'Compte NXT5'`;
    await sql`alter table users add column if not exists password_hash text not null default ''`;
    await sql`alter table users add column if not exists created_at timestamptz not null default now()`;
    await sql`alter table users add column if not exists updated_at timestamptz not null default now()`;
    await sql`alter table users add column if not exists email_verified boolean default false`;
    await sql`alter table users add column if not exists email_verify_token text default null`;
    await sql`alter table users add column if not exists email_verify_expires_at timestamptz default null`;
    await sql`alter table users add column if not exists notif_match boolean default true`;
    await sql`alter table users add column if not exists notif_report boolean default true`;
    await sql`
      update users
      set account_name = lower(regexp_replace(coalesce(nullif(name, ''), 'compte') || '-' || substr(id::text, 1, 8), '[^a-z0-9._-]', '', 'g'))
      where account_name is null or account_name = ''
    `;
    await sql`alter table users alter column account_name set not null`;
    await sql`create unique index if not exists idx_users_account_name on users(account_name)`;
    await sql`create unique index if not exists idx_users_email_lower on users (lower(email)) where email is not null and email <> ''`;
    await sql`
      create table if not exists sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        token_hash text not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        user_agent text,
        ip text,
        created_at timestamptz not null default now()
      )
    `;
    await sql`alter table sessions add column if not exists revoked_at timestamptz`;
    await sql`alter table sessions add column if not exists user_agent text`;
    await sql`alter table sessions add column if not exists ip text`;
    await sql`alter table sessions add column if not exists created_at timestamptz not null default now()`;
    await sql`create unique index if not exists idx_sessions_token_hash on sessions(token_hash)`;
    await sql`create index if not exists idx_sessions_user_active on sessions(user_id, expires_at desc) where revoked_at is null`;
  });
  await ensureMigration('legal-acceptance-2026-09-04-v1', async () => {
    await sql`alter table users add column if not exists legal_accepted_at timestamptz`;
    await sql`alter table users add column if not exists legal_version text`;
  });
}

export async function ensureEmailVerificationColumns(): Promise<void> {
  return ensureAuthUserSchema();
}

export async function ensureSessionSchema(): Promise<void> {
  await ensureAuthUserSchema();
  await ensureMigration('session-activity-2026-09-04-v1', async () => {
    await sql`alter table sessions add column if not exists last_seen_at timestamptz`;
    await sql`create index if not exists idx_sessions_last_seen_at on sessions(last_seen_at desc)`;
  });
}

export async function purgeExpiredAuthData(): Promise<void> {
  const cleanup = async (label: string, operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (err: any) {
      if (err?.code !== '42P01') console.warn(`Auth retention cleanup failed: ${label}`, { code: err?.code || null });
    }
  };

  await cleanup('sessions', () => sql`
    delete from sessions
    where expires_at < now() - interval '30 days'
       or (revoked_at is not null and revoked_at < now() - interval '30 days')
  `);
  await cleanup('password-reset-tokens', () => sql`
    delete from password_reset_tokens
    where expires_at < now() - interval '30 days'
       or (used_at is not null and used_at < now() - interval '30 days')
  `);
  await cleanup('email-verification-tokens', () => sql`
    update users
    set email_verify_token = null,
        email_verify_expires_at = null
    where email_verify_expires_at < now() - interval '30 days'
  `);
  await cleanup('audit-logs', () => sql`
    delete from audit_logs
    where created_at < now() - interval '12 months'
  `);
}

export function safeUser(user: Partial<DbUser> | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    account_name: user.account_name,
    email: user.email || '',
    email_verified: Boolean((user as any).email_verified),
    name: user.name || user.account_name,
    notif_match: user.notif_match ?? true,
    notif_report: user.notif_report ?? true,
    // Recompute this server-side for every user response. This prevents a
    // login/profile update response from temporarily dropping the admin UI.
    is_platform_admin: isPlatformAdmin(user),
    created_at: user.created_at
  };
}

export async function createSession({ userId, context, request, remember = true }: { userId: string; context: Context; request: Request; remember?: boolean }): Promise<void> {
  await ensureSessionSchema();
  await purgeExpiredAuthData();
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = sha256(rawToken);
  const maxAge = remember ? REMEMBER_SESSION_DAYS * 24 * 60 * 60 : SHORT_SESSION_HOURS * 60 * 60;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 512);
  const ip = String(request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

  await sql`
    insert into sessions (user_id, token_hash, expires_at, user_agent, ip)
    values (${userId}, ${tokenHash}, ${expiresAt.toISOString()}, ${userAgent}, ${ip})
  `;

  context.cookies.set({
    name: COOKIE_NAME,
    value: rawToken,
    ...sessionCookieOptions(request),
    maxAge
  });
}

export function readSessionCookie(context: Context): string | null {
  const value = context.cookies?.get?.(COOKIE_NAME) as string | { value?: string } | null | undefined;
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.value || null;
}

export async function requireAuth(request: Request, context: Context): Promise<DbUser> {
  await ensureEmailVerificationColumns();

  const token = readSessionCookie(context);
  if (!token) {
    throw Object.assign(new Error('Session absente.'), { status: 401 });
  }

  await ensureSessionSchema();
  const tokenHash = sha256(token);
  const rows = await sql`
    select
      sessions.id as session_id,
      users.id,
      users.account_name,
      users.email,
      coalesce(users.email_verified, false) as email_verified,
      users.name,
      users.created_at
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ${tokenHash}
      and sessions.revoked_at is null
      and sessions.expires_at > now()
    limit 1
  `;

  const user = rows[0] as DbUser | undefined;
  if (!user) {
    context.cookies.set({ name: COOKIE_NAME, value: '', ...sessionCookieOptions(request), maxAge: 0 });
    throw Object.assign(new Error('Session invalide ou expirée.'), { status: 401 });
  }

  // Keep platform activity metrics useful without writing on every request.
  // A session is refreshed at most once every five minutes.
  await sql`
    update sessions
    set last_seen_at = now()
    where id = ${(rows[0] as any).session_id}
      and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
  `;

  return user;
}

export async function revokeSession(context: Context, request: Request | null = null): Promise<void> {
  const token = readSessionCookie(context);
  if (token) {
    await ensureSessionSchema();
    await sql`update sessions set revoked_at = now() where token_hash = ${sha256(token)}`;
  }

  context.cookies.set({
    name: COOKIE_NAME,
    value: '',
    ...sessionCookieOptions(request),
    maxAge: 0
  });
}
