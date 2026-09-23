import type { Context } from '@netlify/functions';
import { assertMethod, json } from './_lib/http';
import { assertSocialSchemaReady } from './_lib/migrations';
import { assertRateLimit } from './_lib/rate-limit';
import { socialProviderEnabled } from './_lib/social-auth-protocol';
import { assertSocialOrigin, optionalSocialUser, socialError, socialFailure, socialTicket } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    assertSocialOrigin(request);
    await assertSocialSchemaReady();
    await assertRateLimit(request, 'auth-social-pending', { limit: 20, windowSeconds: 60 });
    if (await optionalSocialUser(request, context)) throw socialError(409, 'SOCIAL_ACCOUNT_CHANGED', 'Tu es déjà connecté.');
    const pending = await socialTicket(context, 'signup');
    if (!pending || !socialProviderEnabled(pending.provider)) throw socialError(400, 'SOCIAL_EXPIRED', 'Cette inscription a expiré. Recommence la connexion.');
    return json({ provider: pending.provider, email: pending.email, emailVerified: pending.email_verified, name: pending.display_name, destination: pending.destination });
  } catch (err) { return socialFailure(err); }
}
