import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requireAuth } from './_lib/auth';
import { assertMethod, handleError, json } from './_lib/http';
import { ensureAccountSubscriptionsSchema } from './_lib/schema';
import { serializeAccountSubscription } from './_lib/account-subscriptions';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    const user = await requireAuth(request, context);
    await ensureAccountSubscriptionsSchema();
    const rows = await sql`select plan_code, starts_at, ends_at, revoked_at, updated_at, revision
      from account_subscriptions where user_id = ${user.id}`;
    return json({ subscription: serializeAccountSubscription(rows[0]) });
  } catch (error) {
    return handleError(error);
  }
}

export const config: Config = { method: 'GET' };
