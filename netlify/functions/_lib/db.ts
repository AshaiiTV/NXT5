import { neon } from '@neondatabase/serverless';

function configurationError() {
  return Object.assign(
    new Error('Service compte temporairement indisponible.'),
    { status: 503, code: 'DB_NOT_CONFIGURED' }
  );
}

export const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : async () => {
      throw configurationError();
    };
