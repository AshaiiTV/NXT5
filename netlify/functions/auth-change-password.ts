import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, hashPassword, readSessionCookie, requireAuth, sha256, verifyPassword } from './_lib/auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request, 4096);
    const currentPassword = String(body.currentPassword || '');
    const nextPassword = String(body.nextPassword || '');

    if (!currentPassword || !nextPassword) {
      throw Object.assign(new Error('Mot de passe actuel et nouveau mot de passe requis.'), { status: 400 });
    }
    if (nextPassword.length < 8) {
      throw Object.assign(new Error('Le nouveau mot de passe doit faire au moins 8 caractères.'), { status: 400 });
    }
    if (currentPassword.length > 128 || nextPassword.length > 128) {
      throw Object.assign(new Error('Mot de passe invalide.'), { status: 400 });
    }
    if (currentPassword === nextPassword) {
      throw Object.assign(new Error('Le nouveau mot de passe doit être différent de l’ancien.'), { status: 400 });
    }

    const rows = await sql`select password_hash, xmin::text as account_version from users where id = ${user.id} limit 1`;
    const passwordHash = rows[0]?.password_hash;
    const passwordOk = passwordHash ? await verifyPassword(currentPassword, passwordHash) : false;
    if (!passwordOk) {
      throw Object.assign(new Error('Mot de passe actuel incorrect.'), { status: 401 });
    }

    const nextPasswordHash = await hashPassword(nextPassword);
    const currentToken = readSessionCookie(context);
    const currentTokenHash = currentToken ? sha256(currentToken) : '';
    // Credentials, recovery links, sessions and audit history commit together.
    // Reject reauthentication made stale by another account/recovery change.
    const changed = await sql`
      with changed_account as (
        update users
        set password_hash = ${nextPasswordHash}, updated_at = now()
        where id = ${user.id}
          and password_hash = ${passwordHash}
          and xmin = ${rows[0].account_version}::xid
        returning id
      ), invalidated_tokens as (
        update password_reset_tokens set used_at = now()
        where user_id in (select id from changed_account) and used_at is null
      ), revoked_sessions as (
        update sessions set revoked_at = now()
        where user_id in (select id from changed_account)
          and revoked_at is null and token_hash <> ${currentTokenHash}
      ), logged_change as (
        insert into audit_logs (user_id, action, entity_type, metadata)
        select id, 'auth.password_change', 'user', '{}'::jsonb from changed_account
      )
      select id from changed_account
    `;
    if (!changed[0]) {
      throw Object.assign(new Error('Ton compte a changé pendant la modification. Recharge la page puis réessaie.'), {
        status: 409, code: 'ACCOUNT_CHANGED'
      });
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
