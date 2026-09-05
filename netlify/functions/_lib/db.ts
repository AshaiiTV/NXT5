import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

function configurationError() {
  return Object.assign(
    new Error('Service compte temporairement indisponible.'),
    { status: 503, code: 'DB_NOT_CONFIGURED' }
  );
}

const unavailable = Object.assign(() => { throw configurationError(); }, {
  transaction: () => { throw configurationError(); }
}) as unknown as NeonQueryFunction<false, false>;

export const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : unavailable;
