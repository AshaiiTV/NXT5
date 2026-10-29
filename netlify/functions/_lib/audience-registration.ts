import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './db';
import { COOKIE, UUID, assertAudienceOrigin, assertAudienceReady, browserDimensions, isAudienceAdmin, readCookie, receiptHash, sessionHash } from './audience';
import { canonicalAudiencePath } from '../../../src/app/audience-paths.js';
import { logFailure } from './safe-log';

/** Called only after a new account is saved, never for an accepted duplicate request. */
export async function recordRegistrationSignup(request: Request, context: Context): Promise<void> {
  try {
    const receipt = receiptHash(context);
    const visitor = readCookie(context, COOKIE.visitor);
    const session = sessionHash(context);
    if (readCookie(context, COOKIE.optout) === '1' || !receipt || !UUID.test(visitor) || !session) return;
    assertAudienceOrigin(request);
    const dimensions = browserDimensions(request, context);
    if (dimensions.bot || await isAudienceAdmin(context)) return;
    await assertAudienceReady();

    // Reuse an already measured page. No account identifier, fabricated page,
    // renewed session or acquisition metadata is introduced by registration.
    const pages = await sql`
      select p.page_id, p.path from audience_pages p
      join audience_sessions s on s.id = p.session_id
      where s.token_hash = ${session} and s.consent_hash = ${receipt} and s.visitor_id = ${visitor}::uuid
        and s.last_seen_at > now() - interval '30 minutes'
      order by p.last_seen_at desc, p.viewed_at desc, p.page_id desc limit 1
    `;
    const page = pages[0];
    if (!page || canonicalAudiencePath(page.path) !== page.path) return;

    // The collector rechecks consent under its withdrawal lock and deduplicates
    // the goal. An event cannot create a session or revive an expired one.
    await sql`
      select * from audience_record_event(
        ${receipt},${visitor}::uuid,${session},${session},${crypto.randomUUID()}::uuid,
        ${crypto.randomUUID()}::uuid,${page.page_id}::uuid,'event',${page.path},'signup',
        0,0,'direct','','',${dimensions.device},${dimensions.browser},${dimensions.country}
      )
    `;
  } catch (err) {
    // Measurement failure must not change the private registration response.
    logFailure('[audience] Registration measurement unavailable.', err, { code: 'AUDIENCE_SIGNUP_FAILED' });
  }
}
