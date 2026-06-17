import { sql } from './db.mjs';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;

function requestIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = request.headers.get('client-ip');
  return String(forwarded || clientIp || 'unknown').split(',')[0].trim() || 'unknown';
}

export async function assertRateLimit(request, endpoint) {
  const ip = requestIp(request);

  await sql`
    create table if not exists rate_limits (
      id serial primary key,
      ip text not null,
      endpoint text not null,
      created_at timestamptz default now()
    )
  `;
  await sql`
    create index if not exists idx_rate_limits_ip_endpoint
    on rate_limits(ip, endpoint, created_at)
  `;
  await sql`delete from rate_limits where created_at < now() - interval '15 minutes'`;

  const rows = await sql`
    select count(*)::int as attempts
    from rate_limits
    where ip = ${ip}
      and endpoint = ${endpoint}
      and created_at >= now() - interval '15 minutes'
  `;

  if (Number(rows[0]?.attempts || 0) > MAX_ATTEMPTS) {
    throw Object.assign(new Error('Trop de tentatives. Réessaie dans 15 minutes.'), { status: 429 });
  }

  await sql`
    insert into rate_limits (ip, endpoint)
    values (${ip}, ${endpoint})
  `;
}
