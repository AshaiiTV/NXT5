import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { ensureAccessRequestsSchema } from './_lib/schema';
import { ACCESS_REQUEST_CONSENT_VERSION, ACCESS_REQUEST_MAX_BYTES, validateAccessRequest } from './_lib/access-requests';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    const ip = context.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
    // The existing subject limiter stores a hash, never the clear IP address.
    await assertSubjectRateLimit('access-requests-ip', ip, { limit: 5, windowSeconds: 600 });
    const body = validateAccessRequest(await readJson(request, ACCESS_REQUEST_MAX_BYTES));
    if (!body) return json({ ok: true });
    await ensureAccessRequestsSchema();
    await sql`
      insert into access_requests (contact_name, email, team_name, team_key, role, plan_code, payer, purchase_intent, message, consent_version)
      values (${body.contactName}, ${body.email}, ${body.teamName}, ${body.teamKey}, ${body.role}, ${body.planCode}, ${body.payer}, ${body.purchaseIntent}, ${body.message}, ${ACCESS_REQUEST_CONSENT_VERSION})
      on conflict (email, team_key) do nothing
    `;
    // No row/id/count in the response: a duplicate cannot reveal or overwrite an existing request.
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export const config: Config = { method: 'POST' };
