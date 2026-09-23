import type { Context } from '@netlify/functions';
import { assertSessionSecret, createSession, readSessionCookie, sha256 } from './_lib/auth';
import { sql } from './_lib/db';
import { assertMethod } from './_lib/http';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit } from './_lib/rate-limit';
import { socialProviderEnabled, type SocialProvider } from './_lib/social-auth-protocol';
import { assertSocialOrigin, issueSocialTicket, linkSocialIdentity, optionalSocialUser, setSocialCookie, socialCookie, socialNotice, socialRedirect, socialTicket, SOCIAL_BROWSER_COOKIE, SOCIAL_TICKET_COOKIE } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  let flow = 'login'; let provider: SocialProvider | undefined;
  try {
    assertMethod(request, 'GET');
    assertSocialOrigin(request);
    assertSessionSecret();
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-finish', { limit: 20, windowSeconds: 60 });
    const pending = await socialTicket(context, 'callback', true);
    setSocialCookie(context, SOCIAL_TICKET_COOKIE, '');
    if (!pending) return socialNotice(flow, 'expired');
    flow = pending.flow; provider = pending.provider;
    if (!socialProviderEnabled(provider)) return socialNotice(flow, 'failed', provider);
    const user = await optionalSocialUser(request, context);
    if ((flow === 'link' && (!user || user.id !== pending.user_id || sha256(readSessionCookie(context) || '') !== pending.session_hash))
      || (flow !== 'link' && user)) return socialNotice(flow, 'account_changed', provider);
    if (flow === 'link') {
      if (!await linkSocialIdentity(pending)) return socialNotice(flow, 'account_changed', provider);
      setSocialCookie(context, SOCIAL_BROWSER_COOKIE, '');
      return socialNotice(flow, 'linked', provider);
    }
    const match = (await sql`select users.id, users.social_link_revision from social_identities
      join users on users.id = social_identities.user_id where provider = ${provider} and subject = ${pending.subject}`)[0];
    if (match) {
      await createSession({ userId: match.id, context, request, remember: pending.remember,
        socialIdentity: { provider, subject: pending.subject, revision: match.social_link_revision } });
      setSocialCookie(context, SOCIAL_BROWSER_COOKIE, '');
      return socialRedirect(pending.destination);
    }
    const browser = socialCookie(context, SOCIAL_BROWSER_COOKIE);
    const ticket = await issueSocialTicket(pending, { provider, subject: pending.subject, email: pending.email, emailVerified: pending.email_verified, name: pending.display_name }, browser, 'signup');
    setSocialCookie(context, SOCIAL_TICKET_COOKIE, ticket);
    setSocialCookie(context, SOCIAL_BROWSER_COOKIE, browser);
    return socialRedirect(`/inscription?${new URLSearchParams({ social: 'complete', next: pending.destination })}`);
  } catch (err: any) {
    return socialNotice(flow, err?.code === '23505' ? 'conflict' : err?.code === 'SOCIAL_ACCOUNT_CHANGED' || err?.status === 401 ? 'account_changed' : 'failed', provider);
  }
}
