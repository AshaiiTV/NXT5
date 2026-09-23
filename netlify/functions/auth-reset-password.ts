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
      select password_reset_tokens.id
      from password_reset_tokens
      where token_hash = ${tokenHash}
        and used_at is null
        and expires_at > now()
      limit 1
    `;
    if (!rows[0]) {
      throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré.'), { status: 400 });
    }

    const passwordHash = await hashPassword(nextPassword);
    const [schema] = await sql`
      select to_regprocedure('public.nxt5_reset_password(text,text)') is not null as recovery_ready,
             to_regclass('public.social_identities') is not null as social_ready
    `;
    // Keep email/password recovery available before the additive social migration,
    // but never use the legacy path if social connections could exist.
    if (schema.social_ready && !schema.recovery_ready) {
      throw Object.assign(new Error('Migration de récupération du compte requise.'), {
        status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'Service en cours de mise à jour.'
      });
    }
    const recovered = schema.recovery_ready
      ? await sql`select user_id from nxt5_reset_password(${tokenHash}, ${passwordHash})`
      : await sql`
          with consumed as (
            update password_reset_tokens set used_at = now()
            where token_hash = ${tokenHash} and used_at is null and expires_at > now()
            returning user_id
          ), changed as (
            update users set password_hash = ${passwordHash}, updated_at = now()
            where id in (select user_id from consumed) returning id
          ), revoked as (
            update sessions set revoked_at = now()
            where user_id in (select id from changed) and revoked_at is null
          ), invalidated as (
            update password_reset_tokens set used_at = now()
            where user_id in (select id from changed) and used_at is null and token_hash <> ${tokenHash}
          ), audited as (
            insert into audit_logs (user_id, action, entity_type, metadata)
            select id, 'auth.password_reset_complete', 'user', '{}'::jsonb from changed
          )
          select id as user_id from changed
        `;
    if (!recovered.length) {
      throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré.'), { status: 400 });
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
