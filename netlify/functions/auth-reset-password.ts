import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, hashPassword, sha256 } from './_lib/auth';

export default async function handler(request: Request): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const body = await readJson(request, 4096);
    const token = String(body.token || '').trim();
    const nextPassword = String(body.nextPassword || '');

    if (!token || !nextPassword) {
      throw Object.assign(new Error('Lien de réinitialisation et nouveau mot de passe requis.'), { status: 400 });
    }
    if (nextPassword.length < 8) {
      throw Object.assign(new Error('Le nouveau mot de passe doit faire au moins 8 caractères.'), { status: 400 });
    }
    if (nextPassword.length > 128 || token.length > 128) {
      throw Object.assign(new Error('Lien ou mot de passe invalide.'), { status: 400 });
    }

    const tokenHash = sha256(token);
    const rows = await sql`
      select password_reset_tokens.id, password_reset_tokens.user_id,
             users.password_hash, users.xmin::text as account_version
      from password_reset_tokens
      join users on users.id = password_reset_tokens.user_id
      where password_reset_tokens.token_hash = ${tokenHash}
        and password_reset_tokens.used_at is null
        and password_reset_tokens.expires_at > now()
      limit 1
    `;
    const reset = rows[0];
    if (!reset) {
      throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré.'), { status: 400 });
    }

    const passwordHash = await hashPassword(nextPassword);
    const [schema] = await sql`
      select to_regprocedure('public.nxt5_reset_password(text,text)') is not null as recovery_ready,
             to_regclass('public.social_identities') is not null as social_ready
    `;
    // A partial migration must never silently preserve social account access.
    if (schema.social_ready && !schema.recovery_ready) {
      throw Object.assign(new Error('Migration de récupération du compte requise.'), {
        status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
      });
    }
    // The migrated function locks the user before rechecking mailbox ownership,
    // consuming tokens and removing sessions, OAuth identities and OAuth links
    // in progress. The Discord bot association is managed separately.
    // Before migration, retain the optimistic account-version protocol so a
    // pending redemption cannot use a snapshot replaced by another auth change.
    const changed = schema.recovery_ready
      ? await sql`select user_id from nxt5_reset_password(${tokenHash}, ${passwordHash})`
      : await sql`
      with changed_account as (
        update users
        set password_hash = ${passwordHash}, updated_at = now()
        where id = ${reset.user_id}
          and password_hash = ${reset.password_hash}
          and xmin = ${reset.account_version}::xid
          and exists (
            select 1 from password_reset_tokens
            where id = ${reset.id} and user_id = users.id
              and token_hash = ${tokenHash} and used_at is null and expires_at > now()
          )
        returning id
      ), invalidated_tokens as (
        update password_reset_tokens set used_at = now()
        where user_id in (select id from changed_account) and used_at is null
      ), revoked_sessions as (
        update sessions set revoked_at = now()
        where user_id in (select id from changed_account) and revoked_at is null
      ), logged_change as (
        insert into audit_logs (user_id, action, entity_type, metadata)
        select id, 'auth.password_reset_complete', 'user', '{}'::jsonb from changed_account
      )
      select id from changed_account
    `;
    if (!changed[0]) {
      throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré.'), { status: 400 });
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
