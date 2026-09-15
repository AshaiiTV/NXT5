import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { sha256 } from './_lib/auth';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { COOKIE, UUID, assertAudienceOrigin, assertAudienceReady, audienceFailure, browserDimensions, cookieOptions, isAudienceAdmin, readCookie, receiptHash, sessionHash, storedConsent, token, validateAudienceEvent } from './_lib/audience';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, 405, { Allow: 'POST' });
    assertAudienceOrigin(request);
    const receipt = receiptHash(context);
    const visitor = readCookie(context, COOKIE.visitor);
    if (readCookie(context, COOKIE.optout) === '1' || !receipt || !UUID.test(visitor)) return json({ ok: false, code: 'CONSENT_REQUIRED' }, 403);
    await assertAudienceReady();
    const proof = await storedConsent(context);
    if (!proof?.analytics || proof.visitor_id !== visitor) return json({ ok: false, code: 'CONSENT_REQUIRED' }, 403);
    const dimensions = browserDimensions(request, context);
    if (dimensions.bot || await isAudienceAdmin(context)) return json({ ok: true, ignored: true });
    const event = validateAudienceEvent(await readJson(request, 4096), request);
    await assertSubjectRateLimit('audience-events-ip', context.ip || 'unknown', { limit: 300, windowSeconds: 60 });
    await assertSubjectRateLimit('audience-events-receipt', receipt, { limit: 120, windowSeconds: 60 });
    const newToken = token();
    const existingToken = readCookie(context, COOKIE.session);
    const result = await sql`
      select * from audience_record_event(
        ${receipt},${visitor}::uuid,${sessionHash(context)},${sha256(newToken)},${crypto.randomUUID()}::uuid,
        ${event.eventId}::uuid,${event.pageId}::uuid,${event.type},${event.path},${event.name},
        ${event.durationSeconds}::integer,${event.scrollDepth}::integer,${event.source},${event.medium},${event.campaign},
        ${dimensions.device},${dimensions.browser},${dimensions.country}
      )
    `;
    if (!result[0]?.accepted) return json({ ok: false, code: 'CONSENT_REQUIRED' }, 403);
    if (result[0]?.session_expired) return json({ ok: false, code: 'AUDIENCE_SESSION_EXPIRED' }, 409);
    const remaining = Math.max(0, Math.floor((new Date(proof.expires_at).getTime() - Date.now()) / 1000));
    if (result[0]?.new_session || sessionHash(context)) {
      context.cookies.set({ name: COOKIE.session, value: result[0]?.new_session ? newToken : existingToken, maxAge: Math.min(1800, remaining), ...cookieOptions(request) });
    }
    return json({ ok: true });
  } catch (err) { return audienceFailure(err); }
}
