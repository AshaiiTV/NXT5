import { sql } from './db';

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
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
  await sql`
    create table if not exists rate_limits (
      rate_key text primary key,
      ip text not null,
      endpoint text not null,
      attempts integer not null default 0,
      window_start timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table rate_limits add column if not exists rate_key text`;
  await sql`alter table rate_limits add column if not exists attempts integer not null default 0`;
  await sql`alter table rate_limits add column if not exists window_start timestamptz not null default now()`;
  await sql`alter table rate_limits add column if not exists updated_at timestamptz not null default now()`;
  await sql`create unique index if not exists idx_rate_limits_rate_key on rate_limits(rate_key)`;
}

export async function assertRateLimit(request: Request, endpoint: string, options: RateLimitOptions = {}): Promise<void> {
  const ip = requestIp(request);
  const { limit, windowSeconds } = limitForEndpoint(endpoint, options);
  const rateKey = `${ip}:${endpoint}`;
  const resetBefore = new Date(Date.now() - windowSeconds * 1000).toISOString();

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
}
