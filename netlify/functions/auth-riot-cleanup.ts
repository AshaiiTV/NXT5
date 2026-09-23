import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { assertRiotSchemaReady } from './_lib/migrations';

// Runs even when RSO is disabled, so abandoned verifier/nonce data is purged.
export default async function handler(): Promise<Response> {
  try {
    await assertRiotSchemaReady();
    await sql`delete from riot_auth_flows where expires_at <= now()`;
    return json({ ok: true });
  } catch {
    return json({ error: 'Nettoyage Riot indisponible.' }, 503);
  }
}

export const config: Config = { schedule: '45 3 * * *' };
