import type { Config } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertSocialSchemaReady } from './_lib/migrations';

export default async function handler(): Promise<Response> {
  await assertSocialSchemaReady();
  await sql`delete from social_auth_flows where expires_at <= now()`;
  await sql`delete from social_auth_tickets where expires_at <= now()`;
  return new Response(null, { status: 204 });
}
export const config: Config = { schedule: '45 3 * * *' };
