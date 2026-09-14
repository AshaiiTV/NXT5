import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertSessionSecret, requireAuth, sha256, verifyPassword } from './_lib/auth';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertSchemaReady } from './_lib/migrations';

const SCHEMA_VERSION = 'account-deletion-20260914-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
let ready: Promise<void> | undefined;

async function ensureDeletionSchema() {
  if (!ready) ready = (async () => {
    await assertSchemaReady();
    const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${SCHEMA_VERSION}`;
    if (!rows.length) throw new Error('Missing account deletion migration');
  })().catch(() => {
    ready = undefined;
    throw Object.assign(new Error('Account deletion schema unavailable'), { status: 503, code: 'SCHEMA_MIGRATION_REQUIRED', publicMessage: 'La suppression de compte sera disponible après la mise à jour du service.' });
  });
  await ready;
}

function clearCookie(context: Context, request: Request) {
  context.cookies.set({ name: 'rb_session', value: '', path: '/', httpOnly: true,
    secure: new URL(request.url).protocol === 'https:', sameSite: 'Lax', maxAge: 0 });
}

async function ownedTeams(userId: string) {
  return sql`
    select teams.id, teams.name, coalesce((
      select jsonb_agg(jsonb_build_object('id', users.id, 'name', users.name) order by users.name, users.id)
      from team_members join users on users.id = team_members.user_id
      where team_members.team_id = teams.id and users.id <> ${userId} and users.deleted_at is null
    ), '[]'::jsonb) as members
    from teams where owner_id = ${userId} order by teams.id
  `;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertSessionSecret();
    const body = await readJson(request, 16384);
    if (!['inspect', 'prepare', 'delete', 'status'].includes(body.action)) {
      return json({ error: 'Action de suppression invalide.', code: 'INVALID_DELETION_ACTION' }, 400);
    }
    await ensureDeletionSchema();
    await assertRateLimit(request, 'auth-delete-account', { limit: 20, windowSeconds: 60 });
    const token = typeof body.confirmationToken === 'string' ? body.confirmationToken : '';
    // A high-entropy receipt capability allows recovery after a lost response,
    // even though the operation has already removed the session cookie.
    if (body.action === 'status' || body.action === 'delete') {
      if (!TOKEN.test(token)) return json({ error: 'Recommence la première confirmation.', code: 'DELETION_CONFIRMATION_EXPIRED' }, 400);
      const receipts = await sql`
        select jsonb_build_object('reference', id, 'completedAt', completed_at, 'summary', summary) as receipt
        from account_deletion_receipts where token_hash = ${sha256(token)}
          and completed_at > now() - interval '24 hours' limit 1
      `;
      if (receipts[0]) {
        // Status lookups must not log out a different account signed in meanwhile.
        return json({ ok: true, receipt: receipts[0].receipt });
      }
      if (body.action === 'status') return json({ ok: false, pending: true });
    }

    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('account-deletion-account', user.id, { limit: 10, windowSeconds: 300 });
    if (body.action === 'inspect') return json({ teams: await ownedTeams(user.id) });

    const sessionHash = sha256(String(context.cookies.get('rb_session') || ''));
    if (body.action === 'prepare') {
      if (body.acknowledged !== true || !body.teamPlan || typeof body.teamPlan !== 'object' || Array.isArray(body.teamPlan)) {
        return json({ error: 'Confirme les conséquences avant de continuer.', code: 'DELETION_ACKNOWLEDGEMENT_REQUIRED' }, 400);
      }
      const teams = await ownedTeams(user.id);
      const plan: Record<string, string> = {};
      for (const team of teams) {
        const choice = body.teamPlan[team.id];
        if (!team.members.length && choice === 'delete' && body.deleteEmptyTeams === true) plan[team.id] = 'delete';
        else if (typeof choice === 'string' && UUID.test(choice) && team.members.some((member: any) => member.id === choice)) plan[team.id] = choice;
        else return json({ error: 'Choisis un nouveau propriétaire pour chaque équipe partagée et confirme la suppression des équipes sans autre membre.', code: 'DELETION_TEAM_PLAN_REQUIRED' }, 400);
      }
      const confirmationToken = crypto.randomBytes(32).toString('base64url');
      // Bounded retention, also run on every subsequent prepare operation.
      await sql`delete from account_deletion_confirmations where expires_at <= now() or user_id = ${user.id}`;
      await sql`delete from account_deletion_receipts where completed_at < now() - interval '12 months'`;
      await sql`insert into account_deletion_confirmations(token_hash, user_id, session_hash, team_plan)
        values (${sha256(confirmationToken)}, ${user.id}, ${sessionHash}, ${JSON.stringify(plan)}::jsonb)`;
      return json({ confirmationToken, expiresInSeconds: 600 });
    }

    if (body.confirmation !== 'SUPPRIMER' || body.acknowledged !== true) {
      return json({ error: 'Saisis SUPPRIMER pour confirmer définitivement.', code: 'DELETION_CONFIRMATION_REQUIRED' }, 400);
    }
    await assertSubjectRateLimit('account-deletion-password', user.id, { limit: 5, windowSeconds: 300 });
    const password = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const accounts = await sql`select password_hash from users where id = ${user.id} and deleted_at is null`;
    if (!password || password.length > 128 || !accounts[0] || !await verifyPassword(password, accounts[0].password_hash)) {
      return json({ error: 'Mot de passe actuel incorrect. Ton compte est inchangé.', code: 'DELETION_PASSWORD_INVALID' }, 401);
    }
    const rows = await sql`select nxt5_delete_account(${user.id}::uuid, ${accounts[0].password_hash}, ${sessionHash}, ${sha256(token)}) as receipt`;
    // The commit is complete. Cookie cleanup must never turn it into a false failure.
    try { clearCookie(context, request); } catch { console.warn('Account deletion completed; cookie cleanup unavailable.'); }
    return json({ ok: true, receipt: rows[0].receipt });
  } catch (error: any) {
    if (error.code === '23505') return json({
      error: 'Le propriétaire choisi possède déjà une équipe de ce nom. Renomme ton équipe ou choisis un autre membre, puis recommence les confirmations. Aucune suppression effectuée.',
      code: 'DELETION_TEAM_CHANGED'
    }, 409);
    const messages: Record<string, string> = {
      DELETION_CONFIRMATION_EXPIRED: 'La confirmation a expiré ou la session a changé. Recommence les deux étapes.',
      DELETION_TEAM_CHANGED: 'La composition de tes équipes a changé. Aucune suppression effectuée : recommence les confirmations.',
      ACCOUNT_CHANGED: 'Ton compte a changé. Reconnecte-toi avant de recommencer.',
      ACCOUNT_DELETED: 'Ce compte est désactivé. Vérifie le résultat de ta demande.'
    };
    if (messages[error.message]) return json({ error: messages[error.message], code: error.message }, 409);
    // Never log SQL parameters, passwords or the confirmation capability.
    return handleError(Object.assign(new Error(error.status < 500 ? error.message : 'Account deletion unavailable'), {
      status: error.status || 503, code: error.status ? error.code : 'ACCOUNT_DELETION_UNAVAILABLE',
      retryAfter: error.retryAfter,
      publicMessage: error.publicMessage || 'Impossible de confirmer le résultat. Vérifie le statut de ta demande avant de recommencer.'
    }));
  }
}
