import crypto from 'node:crypto';
import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertSessionSecret, clearSessionCookie, isPlatformAdmin, readSessionCookie, requireAuth, sha256, verifyPassword } from './_lib/auth';
import { assertMethod, assertTrustedMutation, handleError, json, readJson } from './_lib/http';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import { assertAccountDeletionSchemaReady } from './_lib/migrations';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { socialProviderEnabled, type SocialProvider } from './_lib/social-auth-protocol';

const ACTIONS = new Set(['inspect', 'prepare', 'delete', 'status']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const CONFIRMATION_SECONDS = 15 * 60;

const CONFLICTS: Record<string, [number, string]> = {
  DELETION_CONFIRMATION_EXPIRED: [409, 'La confirmation a expiré ou ta session a changé. Aucune suppression effectuée : recommence les deux étapes.'],
  DELETION_TEAM_CHANGED: [409, 'La composition de tes équipes a changé. Aucune suppression effectuée : recommence les confirmations.'],
  DELETION_REAUTH_REQUIRED: [403, 'Confirme d’abord ton identité avec un service associé à ton compte. Aucune suppression effectuée.'],
  ACCOUNT_CHANGED: [409, 'Ton compte a changé pendant la demande. Aucune suppression effectuée : reconnecte-toi avant de recommencer.'],
  ACCOUNT_DELETED: [409, 'Ce compte est déjà supprimé. Vérifie le résultat de ta demande.'],
};

async function ownedTeams(userId: string) {
  return sql`
    select teams.id, teams.name, coalesce((
      select jsonb_agg(jsonb_build_object('id', users.id, 'name', users.name) order by users.name, users.id)
      from team_members join users on users.id = team_members.user_id
      where team_members.team_id = teams.id and users.id <> ${userId} and users.deleted_at is null
    ), '[]'::jsonb) as members
    from teams where owner_id = ${userId} order by teams.name, teams.id
  `;
}

async function receiptFor(token: string) {
  const rows = await sql`
    select jsonb_build_object('reference', id, 'completedAt', completed_at, 'summary', summary) as receipt
    from account_deletion_receipts where token_hash = ${sha256(token)}
      and completed_at > now() - interval '24 hours' limit 1
  `;
  return rows[0]?.receipt || null;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  let token = '';
  try {
    assertMethod(request, 'POST');
    // Explicit on purpose: this route must never accept a cross-site mutation.
    assertTrustedMutation(request);
    assertSessionSecret();
    const body = await readJson(request, 8192);
    if (!ACTIONS.has(body.action)) return json({ error: 'Action de suppression invalide.', code: 'INVALID_DELETION_ACTION' }, 400);
    await assertAccountDeletionSchemaReady();
    await assertRateLimit(request, 'auth-delete-account', { limit: 20, windowSeconds: 60 });
    token = typeof body.confirmationToken === 'string' ? body.confirmationToken : '';

    // The confirmation token is a high-entropy capability: it lets the browser
    // recover the receipt after a lost response, once the session is gone.
    if (body.action === 'status' || body.action === 'delete') {
      if (!TOKEN.test(token)) return json({ error: 'Recommence la première confirmation.', code: 'DELETION_CONFIRMATION_EXPIRED' }, 400);
      const receipt = await receiptFor(token);
      // A status lookup never logs out an account signed in meanwhile.
      if (receipt) return json({ ok: true, receipt });
      if (body.action === 'status') return json({ ok: false, pending: true });
    }

    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('account-deletion-account', user.id, { limit: 10, windowSeconds: 300 });
    if (isPlatformAdmin(user)) {
      return json({ error: 'Le compte d’administration de la plateforme ne peut pas être supprimé depuis Paramètres. Change d’abord l’administrateur configuré.', code: 'DELETION_PLATFORM_ADMIN' }, 409);
    }
    const sessionHash = sha256(readSessionCookie(context) || '');
    const account = (await sql`select password_hash from users where id = ${user.id} and deleted_at is null`)[0];
    if (!account) throw Object.assign(new Error('ACCOUNT_CHANGED'), { code: 'P0001' });
    const hasPassword = Boolean(String(account.password_hash || '').trim());

    if (body.action === 'inspect') {
      const [teams, identities, proof, discord] = await Promise.all([
        ownedTeams(user.id),
        // Seules les identités associées avant cette session peuvent confirmer la suppression.
        sql`select provider from social_identities join sessions on sessions.user_id = social_identities.user_id
          and sessions.token_hash = ${sessionHash}
          where social_identities.user_id = ${user.id} and social_identities.linked_at < sessions.created_at
          order by social_identities.linked_at`,
        sql`select provider from account_reauthentications where user_id = ${user.id}
          and session_hash = ${sessionHash} and expires_at > now()`,
        sql`select 1 from discord_user_links where user_id = ${user.id}`,
      ]);
      return json({
        teams,
        hasPassword,
        discordLinked: discord.length > 0,
        reauthentication: {
          providers: identities.map((row: any) => row.provider as SocialProvider).filter(socialProviderEnabled),
          verifiedWith: proof[0]?.provider || null,
        },
      });
    }

    // Team deletions and participant updates run the match publication triggers.
    assertMatchSourceMutationEnvironment(context);

    if (body.action === 'prepare') {
      if (body.acknowledged !== true || !body.teamPlan || typeof body.teamPlan !== 'object' || Array.isArray(body.teamPlan)) {
        return json({ error: 'Confirme les conséquences avant de continuer.', code: 'DELETION_ACKNOWLEDGEMENT_REQUIRED' }, 400);
      }
      const teams = await ownedTeams(user.id);
      const plan: Record<string, string> = {};
      for (const team of teams) {
        const choice = body.teamPlan[team.id];
        if (!team.members.length && choice === 'delete' && body.deleteEmptyTeams === true) plan[team.id] = 'delete';
        else if (typeof choice === 'string' && UUID.test(choice) && team.members.some((member: any) => member.id === choice)) plan[team.id] = choice.toLowerCase();
        else return json({ error: 'Choisis un nouveau propriétaire pour chaque équipe partagée et confirme la suppression des équipes sans autre membre.', code: 'DELETION_TEAM_PLAN_REQUIRED' }, 400);
      }
      const confirmationToken = crypto.randomBytes(32).toString('base64url');
      // Bounded retention, also applied by the daily cleanup.
      await sql`delete from account_deletion_confirmations where expires_at <= now() or user_id = ${user.id}`;
      await sql`delete from account_deletion_receipts where completed_at < now() - interval '12 months'`;
      await sql`insert into account_deletion_confirmations(token_hash, user_id, session_hash, team_plan, expires_at)
        values (${sha256(confirmationToken)}, ${user.id}, ${sessionHash}, ${JSON.stringify(plan)}::jsonb,
          now() + ${`${CONFIRMATION_SECONDS} seconds`}::interval)`;
      return json({ confirmationToken, expiresInSeconds: CONFIRMATION_SECONDS });
    }

    if (body.confirmation !== 'SUPPRIMER' || body.acknowledged !== true) {
      return json({ error: 'Saisis SUPPRIMER pour confirmer définitivement.', code: 'DELETION_CONFIRMATION_REQUIRED' }, 400);
    }
    let expectedPasswordHash: string | null = null;
    if (hasPassword) {
      await assertSubjectRateLimit('account-deletion-password', user.id, { limit: 5, windowSeconds: 300 });
      const password = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      if (!password || password.length > 128 || !await verifyPassword(password, account.password_hash)) {
        return json({ error: 'Mot de passe actuel incorrect. Ton compte est inchangé.', code: 'DELETION_PASSWORD_INVALID' }, 401);
      }
      expectedPasswordHash = account.password_hash;
    }
    // Without a password, the SQL function consumes a fresh provider reauthentication.
    const rows = await sql`select nxt5_delete_account(${user.id}::uuid, ${expectedPasswordHash}, ${sessionHash}, ${sha256(token)}) as receipt`;
    // The commit is complete. Cookie cleanup must never turn it into a false failure.
    try { clearSessionCookie(context, request); } catch { console.warn('Account deletion completed; cookie cleanup unavailable.'); }
    return json({ ok: true, receipt: rows[0].receipt });
  } catch (error: any) {
    // Aucune contrainte d'unicité connue n'est attendue ici : une écriture
    // concurrente a pu créer un doublon. Message générique, rien n'est appliqué.
    if (error?.code === '23505') return json({
      error: 'Une modification simultanée de ton compte ou de tes équipes a empêché la suppression. Aucune suppression effectuée : recharge la page puis recommence.',
      code: 'DELETION_CONFLICT'
    }, 409);
    const conflict = CONFLICTS[error?.message];
    if (conflict && ['P0001', '23514'].includes(error?.code)) {
      // A concurrent identical request may have completed first.
      if (TOKEN.test(token) && ['ACCOUNT_CHANGED', 'ACCOUNT_DELETED'].includes(error.message)) {
        const receipt = await receiptFor(token).catch(() => null);
        if (receipt) return json({ ok: true, receipt });
      }
      return json({ error: conflict[1], code: error.message }, conflict[0]);
    }
    // Never log SQL parameters, passwords or the confirmation capability.
    const status = Number.isInteger(error?.status) ? error.status : 503;
    return handleError(Object.assign(new Error(status < 500 ? error.message : 'Account deletion unavailable'), {
      status, code: status < 500 || error?.code === 'SCHEMA_MIGRATION_REQUIRED' || error?.code === 'RATE_LIMIT_UNAVAILABLE' ? error.code : 'ACCOUNT_DELETION_UNAVAILABLE',
      retryAfter: error?.retryAfter,
      publicMessage: error?.publicMessage || 'Impossible de confirmer le résultat. Vérifie le statut de ta demande avant de recommencer.'
    }));
  }
}
