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

export function isValidEmail(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export async function ensureAuthUserSchema(): Promise<void> {
  return ensureMigration('auth-runtime-2026-09-02-v1', async () => {
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
}

export async function ensureEmailVerificationColumns(): Promise<void> {
  return ensureAuthUserSchema();
}

export async function ensureSessionSchema(): Promise<void> {
  return ensureAuthUserSchema();
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
    created_at: user.created_at
  };
}

export async function createSession({ userId, context, request, remember = true }: { userId: string; context: Context; request: Request; remember?: boolean }): Promise<void> {
  await ensureSessionSchema();
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = sha256(rawToken);
  const maxAge = remember ? REMEMBER_SESSION_DAYS * 24 * 60 * 60 : SHORT_SESSION_HOURS * 60 * 60;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || '';

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
