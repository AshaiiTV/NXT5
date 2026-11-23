import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, ensureEmailVerificationColumns, isValidEmail, normalizeEmail, readSessionCookie, requireAuth, safeUser, sha256, verifyReauthenticationPassword } from './_lib/auth';
import { sendEmailVerificationEmail } from './_lib/email';
import { ensureUserNotificationColumns } from './_lib/team-member-emails';
import { assertRateLimit, assertSubjectRateLimit, assertVerificationEmailRateLimit, DAILY_RECIPIENT_LIMITS } from './_lib/rate-limit';
import { notifyAccountSecurity } from './_lib/account-notices';

const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

async function assertEmailChangeBudget(userId: string): Promise<void> {
  try {
    await assertSubjectRateLimit('email-change-account', userId, DAILY_RECIPIENT_LIMITS.emailChangeAccount);
  } catch (err: any) {
    if (err?.status === 429) {
      err.code = 'EMAIL_CHANGE_RATE_LIMIT';
      err.message = 'Trop de demandes de changement d’adresse aujourd’hui. Réessaie demain.';
    }
    throw err;
  }
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'auth-update-profile', { limit: 20, windowSeconds: 60 });
    const user = await requireAuth(request, context, { allowUnverifiedEmail: true });
    const body = await readJson(request, 8192);
    await ensureUserNotificationColumns(sql);
    await ensureEmailVerificationColumns();

    if (body.cancelEmailChange === true) {
      // Cancelling only discards the pending address; nothing else changes.
      const rows = await sql`
        with cancelled as (
          update users
          set pending_email = null, pending_email_token = null, pending_email_expires_at = null, updated_at = now()
          where id = ${user.id}
          returning id, account_name, email, email_verified, pending_email, name, notif_match, notif_report,
                    notif_inactivity, inactivity_notice_pending, created_at
        ), logged_cancel as (
          insert into audit_logs (user_id, action, entity_type, metadata)
          select id, 'auth.email_change_cancel', 'user', '{}'::jsonb from cancelled
        )
        select * from cancelled
      `;
      if (!rows[0]) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
      return json({ user: safeUser(rows[0]) });
    }

    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(body.email);

    if (name.length < 3 || name.length > 32) {
      throw Object.assign(new Error('Le pseudo doit faire entre 3 et 32 caractères.'), { status: 400 });
    }
    if (!isValidEmail(email) || email.length > 160) {
      throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
    }

    const currentRows = await sql`
      select email, coalesce(email_verified, false) as email_verified, password_hash, xmin::text as account_version
      from users
      where id = ${user.id}
      limit 1
    `;
    const current = currentRows[0];
    if (!current) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
    const emailChanged = normalizeEmail(current.email) !== email;

    if (!emailChanged) {
      const rows = await sql`
        update users
        set name = ${name},
            updated_at = now()
        where id = ${user.id}
        returning id, account_name, email, email_verified, pending_email, name, notif_match, notif_report,
                  notif_inactivity, inactivity_notice_pending, created_at
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, metadata)
        values (${user.id}, 'auth.profile_update', 'user', ${JSON.stringify({ name, emailChanged: false })}::jsonb)
      `;
      return json({ user: safeUser(rows[0]) });
    }

    const currentPassword = String(body.currentPassword || '');
    if (!currentPassword) {
      throw Object.assign(new Error('Confirme ton mot de passe actuel pour changer ton adresse e-mail.'), {
        status: 401, code: 'EMAIL_CHANGE_REAUTH_REQUIRED'
      });
    }
    if (currentPassword.length > 128 || !await verifyReauthenticationPassword(user.id, currentPassword, current.password_hash)) {
      throw Object.assign(new Error('Mot de passe actuel incorrect.'), { status: 401, code: 'INVALID_PASSWORD' });
    }
    // The pending address reserves nothing: uniqueness is enforced again when
    // it is confirmed. This early answer only spares a useless e-mail.
    const taken = await sql`select 1 from users where lower(email) = ${email} and id <> ${user.id} limit 1`;
    if (taken.length) throw Object.assign(new Error('Cet e-mail est déjà utilisé.'), { status: 409, code: 'EMAIL_IN_USE' });
    await assertEmailChangeBudget(user.id);
    await assertVerificationEmailRateLimit(user.id, email);

    const verifyToken = crypto.randomBytes(32).toString('base64url');
    const verifyTokenHash = sha256(verifyToken);
    const verifyExpiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();
    const currentTokenHash = sha256(readSessionCookie(context) || '');

    // The address itself only changes once the new mailbox confirms the link
    // (verify-email). Recheck the browser session after password verification,
    // with the same user-then-session lock order and account version as
    // password changes and recovery.
    const rows = await sql`
      with changed_account as (
        with authorized_user as materialized (
          select id from users
          where id = ${user.id}
            and email is not distinct from ${current.email}
            and password_hash = ${current.password_hash}
            and xmin = ${current.account_version}::xid
          for update
        ), authorized_session as materialized (
          select sessions.user_id from sessions
          join authorized_user on authorized_user.id = sessions.user_id
          where sessions.token_hash = ${currentTokenHash}
            and sessions.revoked_at is null and sessions.expires_at > clock_timestamp()
          for update of sessions
        )
        update users
        set name = ${name},
            pending_email = ${email},
            pending_email_token = ${verifyTokenHash},
            pending_email_expires_at = ${verifyExpiresAt},
            updated_at = now()
        where id in (select user_id from authorized_session)
          and email is not distinct from ${current.email}
          and password_hash = ${current.password_hash}
          and xmin = ${current.account_version}::xid
        returning id, account_name, email, email_verified, pending_email, name, notif_match, notif_report,
                  notif_inactivity, inactivity_notice_pending, created_at
      ), logged_change as (
        insert into audit_logs (user_id, action, entity_type, metadata)
        select id, 'auth.profile_update', 'user', ${JSON.stringify({ name, emailChanged: true, pendingConfirmation: true })}::jsonb
        from changed_account
      )
      select * from changed_account
    `;

    if (!rows[0]) {
      throw Object.assign(new Error('Ton compte a changé pendant la modification. Recharge la page puis réessaie.'), {
        status: 409, code: 'ACCOUNT_CHANGED'
      });
    }

    try {
      await sendEmailVerificationEmail({ to: email, token: verifyToken, purpose: 'email-change' });
    } catch (emailError) {
      // Never leave a link that was not delivered; a newer request keeps its own.
      await sql`
        update users
        set pending_email = null, pending_email_token = null, pending_email_expires_at = null, updated_at = now()
        where id = ${user.id} and pending_email_token = ${verifyTokenHash}
      `;
      throw emailError;
    }
    // Warn the current mailbox only once it has been proven to belong to the
    // account; an unverified address may be a typo or somebody else's.
    if (current.email_verified === true) await notifyAccountSecurity(context, current.email, 'email-change-requested', email);

    return json({ user: safeUser(rows[0]), emailChangePending: true });
  } catch (err) {
    return handleError(err);
  }
}
