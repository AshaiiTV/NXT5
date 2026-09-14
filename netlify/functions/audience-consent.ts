import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { sha256 } from './_lib/auth';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { AUDIENCE_VERSION, CONSENT_SECONDS, COOKIE, assertAudienceOrigin, assertAudienceReady, audienceFailure, browserDimensions, clearAudienceCookies, cookieOptions, readCookie, receiptHash, setOptout, storedConsent, token } from './_lib/audience';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (request.method === 'GET') {
      if (readCookie(context, COOKIE.optout) === '1') return json({ choice: 'rejected', version: AUDIENCE_VERSION, expiresAt: null });
      if (!receiptHash(context)) return json({ choice: null, version: AUDIENCE_VERSION, expiresAt: null });
      await assertAudienceReady();
      const choice = await storedConsent(context);
      return json({ choice: choice ? choice.analytics ? 'accepted' : 'rejected' : null, version: AUDIENCE_VERSION, expiresAt: choice ? new Date(choice.expires_at).toISOString() : null });
    }
    if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, 405, { Allow: 'GET, POST' });
    assertAudienceOrigin(request);
    const body = await readJson(request, 1024);
    if (Object.keys(body).length !== 1 || typeof body.analytics !== 'boolean') return json({ error: 'Un choix explicite est requis.' }, 400);
    if (!body.analytics) {
      // Withdrawal remains effective in this browser even during a DB outage.
      setOptout(request, context, true);
      clearAudienceCookies(request, context);
    }
    await assertAudienceReady();
    const oldHash = receiptHash(context);
    if (!body.analytics && oldHash) {
      // The safety update must still run when repeated choices exhaust the
      // persistence budget. Withdrawal itself is never prevented by a quota.
      await sql`update audience_consents set revoked_at = coalesce(revoked_at,now()) where receipt_hash = ${oldHash}`;
    }
    await assertSubjectRateLimit('audience-consent', context.ip || 'unknown', { limit: 30, windowSeconds: 60 });
    const rawReceipt = token();
    const newHash = sha256(rawReceipt);
    const visitor = body.analytics ? crypto.randomUUID() : null;
    const rawSession = token();
    const dimensions = browserDimensions(request, context);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + CONSENT_SECONDS * 1000).toISOString();
    // One statement: a previous receipt is revoked before the new proof is saved.
    await sql`
      with revoked as (
        update audience_consents set revoked_at = coalesce(revoked_at, now())
        where receipt_hash = ${oldHash} returning receipt_hash
      ), inserted as (
        insert into audience_consents(receipt_hash,analytics,version,visitor_id,created_at,expires_at)
        values(${newHash},${body.analytics},${AUDIENCE_VERSION},${visitor},${createdAt.toISOString()},${expiresAt})
        returning receipt_hash,visitor_id,analytics
      )
      insert into audience_sessions(id,token_hash,consent_hash,visitor_id,device,browser,country)
      select ${crypto.randomUUID()}::uuid,${sha256(rawSession)},receipt_hash,visitor_id,${dimensions.device},${dimensions.browser},${dimensions.country}
      from inserted where analytics
    `;
    context.cookies.set({ name: COOKIE.receipt, value: rawReceipt, maxAge: CONSENT_SECONDS, ...cookieOptions(request) });
    if (body.analytics) {
      context.cookies.set({ name: COOKIE.visitor, value: visitor!, maxAge: CONSENT_SECONDS, ...cookieOptions(request) });
      // An empty session is bound now but enters reports only at its first view.
      context.cookies.set({ name: COOKIE.session, value: rawSession, maxAge: 1800, ...cookieOptions(request) });
      setOptout(request, context, false);
    }
    return json({ choice: body.analytics ? 'accepted' : 'rejected', version: AUDIENCE_VERSION, expiresAt });
  } catch (err) { return audienceFailure(err); }
}
