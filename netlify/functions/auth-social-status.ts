import type { Context } from '@netlify/functions';
import { assertMethod, json } from './_lib/http';
import { sql } from './_lib/db';
import { assertSocialSchemaReady } from './_lib/migrations';
import { providerLabel, SOCIAL_PROVIDERS, socialProviderEnabled } from './_lib/social-auth-protocol';
import { optionalSocialUser, socialFailure } from './_lib/social-auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    const providers = SOCIAL_PROVIDERS.map(id => ({ id, label: providerLabel(id), enabled: socialProviderEnabled(id) }));
    // Public rendering works without a migration or any configured provider.
    // Configured providers are advertised only after their schema is ready.
    if (providers.some(provider => provider.enabled)) await assertSocialSchemaReady();
    const user = await optionalSocialUser(request, context);
    if (!user) return json({ providers });
    const account = (await sql`select password_hash from users where id = ${user.id}`)[0];
    const hasPassword = Boolean(account?.password_hash);
    try { await assertSocialSchemaReady(); }
    catch { return json({ providers: providers.map(provider => ({ ...provider, enabled: false })), linked: [], hasPassword }); }
    const linked = await sql`select provider, display_name as "displayName", linked_at as "linkedAt" from social_identities where user_id = ${user.id} order by linked_at`;
    return json({ providers, linked, hasPassword });
  } catch (err) { return socialFailure(err); }
}
