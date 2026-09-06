import crypto from 'node:crypto';
import { sql } from './db';
import { assertSchemaReady } from './migrations';

const DEFAULT_WINDOW_SECONDS = 60;
const AUTH_LIMIT = { limit: 5, windowSeconds: 60 };
const IMPORT_LIMIT = { limit: 20, windowSeconds: 60 };

type RateLimitOptions = {
  limit?: number;
  windowSeconds?: number;
};

type RateLimitConfig = {
  limit: number;
  windowSeconds: number;
};

function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const netlifyIp = request.headers.get('x-nf-client-connection-ip');
  const clientIp = request.headers.get('client-ip');
  return String(netlifyIp || forwarded || clientIp || 'unknown').split(',')[0].trim() || 'unknown';
}

function limitForEndpoint(endpoint: string, options: RateLimitOptions = {}): RateLimitConfig {
  if (options.limit) return { limit: options.limit, windowSeconds: options.windowSeconds || DEFAULT_WINDOW_SECONDS };
  if (String(endpoint).startsWith('match-import')) return IMPORT_LIMIT;
  return AUTH_LIMIT;
}

async function ensureRateLimitTable(): Promise<void> {
  await assertSchemaReady();
}

export async function assertRateLimit(request: Request, endpoint: string, options: RateLimitOptions = {}): Promise<void> {
  const ip = requestIp(request);
  return assertLimit(`${ip}:${endpoint}`, ip, endpoint, options);
}

/** Shared budgets must not reset when a caller changes IP or uses another route. */
export async function assertSubjectRateLimit(endpoint: string, subject: string, options: RateLimitOptions = {}): Promise<void> {
  const digest = crypto.createHash('sha256').update(subject.trim().toLowerCase()).digest('hex');
  return assertLimit(`subject:${endpoint}:${digest}`, 'subject', endpoint, options);
}

export async function assertVerificationEmailRateLimit(userId: string, email: string): Promise<void> {
  try {
    // Check the account first: an already blocked account cannot consume the
    // recipient budgets of arbitrary addresses by changing its requested email.
    await assertSubjectRateLimit('email-verification-account', userId, { limit: 1, windowSeconds: 300 });
    await assertSubjectRateLimit('email-verification-recipient', email, { limit: 1, windowSeconds: 300 });
  } catch (err: any) {
    if (err?.status === 429) {
      err.code = 'EMAIL_VERIFY_RATE_LIMIT';
      err.message = 'Attends quelques minutes avant de demander un nouvel e-mail de vérification.';
    }
    throw err;
  }
}

async function assertLimit(rateKey: string, ip: string, endpoint: string, options: RateLimitOptions): Promise<void> {
  const { limit, windowSeconds } = limitForEndpoint(endpoint, options);
  const resetBefore = new Date(Date.now() - windowSeconds * 1000).toISOString();

  try {
    await ensureRateLimitTable();
    await sql`delete from rate_limits where updated_at < now() - interval '1 day'`;

    const rows = await sql`
      insert into rate_limits (rate_key, ip, endpoint, attempts, window_start, updated_at)
      values (${rateKey}, ${ip}, ${endpoint}, 1, now(), now())
      on conflict (rate_key)
      do update set
        attempts = case
          when rate_limits.window_start <= ${resetBefore} then 1
          else rate_limits.attempts + 1
        end,
        window_start = case
          when rate_limits.window_start <= ${resetBefore} then now()
          else rate_limits.window_start
        end,
        updated_at = now()
      returning attempts, window_start
    `;

    const attempts = Number(rows[0]?.attempts || 0);
    const windowStartMs = rows[0]?.window_start ? new Date(rows[0].window_start).getTime() : Date.now();
    const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowSeconds * 1000 - Date.now()) / 1000));
    if (attempts > limit) {
      throw Object.assign(new Error('Trop de tentatives. Réessaie dans quelques instants.'), {
        status: 429,
        retryAfter
      });
    }
  } catch (err: any) {
    if (err?.status === 429) throw err;
    console.error('Rate limit unavailable; blocking the protected endpoint.', err);
    throw Object.assign(new Error('Protection anti-abus temporairement indisponible.'), {
      status: 503,
      code: 'RATE_LIMIT_UNAVAILABLE',
      publicMessage: 'Service temporairement indisponible.'
    });
  }
}
