import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertTrustedMutation, handleError, json, readJson } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { ensureAccountSubscriptionsSchema } from './_lib/schema';
import { invalidSubscription, serializeSubscriptionAccount, serializeSubscriptionHistory, subscriptionPage, subscriptionSearch, subscriptionUserId, validateSubscriptionMutation } from './_lib/account-subscriptions';

async function accountDetail(userId: string) {
  const [accounts, history] = await sql.transaction(tx => [
    tx`select u.id, u.name, u.account_name, u.email, to_jsonb(s) as subscription
       from users u left join account_subscriptions s on s.user_id = u.id where u.id = ${userId}`,
    tx`select a.id, a.action, a.metadata, a.created_at, coalesce(u.name, u.account_name) as actor_name
       from audit_logs a left join users u on u.id = a.user_id
       where a.entity_type = 'account_subscription' and a.entity_id = ${userId}
       order by a.created_at desc, a.id desc limit 10`
  ], { isolationLevel: 'RepeatableRead', readOnly: true });
  if (!accounts.length) throw Object.assign(new Error('Compte introuvable.'), { status: 404, code: 'ACCOUNT_NOT_FOUND' });
  return { account: serializeSubscriptionAccount(accounts[0]), history: history.map(serializeSubscriptionHistory) };
}

async function mutateAccount(body: ReturnType<typeof validateSubscriptionMutation>, adminId: string) {
  const { userId, expectedRevision, planCode, startsAt, endsAt, note } = body;
  const results = await sql.transaction(tx => [
    // Serialize first assignments and later edits using the existing user row.
    tx`select id from users where id = ${userId} for update`,
    body.action === 'assign' ? tx`
      with changed as (
        insert into account_subscriptions(user_id, plan_code, starts_at, ends_at, note, updated_by, revision, updated_at)
        select id, ${planCode}, ${startsAt}::timestamptz, ${endsAt}::timestamptz, ${note}, ${adminId}::uuid, 1, clock_timestamp()
        from users where id = ${userId}
          and coalesce((select revision from account_subscriptions where user_id = ${userId}), 0) = ${expectedRevision}
        on conflict(user_id) do update set plan_code = excluded.plan_code, starts_at = excluded.starts_at,
          ends_at = excluded.ends_at, revoked_at = null, note = excluded.note, updated_by = excluded.updated_by,
          revision = account_subscriptions.revision + 1, updated_at = clock_timestamp()
        where account_subscriptions.revision = ${expectedRevision}
        returning *
      ), logged as (
        insert into audit_logs(user_id, action, entity_type, entity_id, metadata, created_at)
        select ${adminId}, 'account_subscription.assign', 'account_subscription', user_id,
          jsonb_build_object('planCode', plan_code, 'startsAt', starts_at, 'endsAt', ends_at, 'note', note, 'revision', revision), clock_timestamp()
        from changed returning id
      ) select revision from changed`
    : tx`
      with changed as (
        update account_subscriptions set revoked_at = clock_timestamp(), note = coalesce(${note}, note), updated_by = ${adminId},
          revision = revision + 1, updated_at = clock_timestamp()
        where user_id = ${userId} and revision = ${expectedRevision}
        returning *
      ), logged as (
        insert into audit_logs(user_id, action, entity_type, entity_id, metadata, created_at)
        select ${adminId}, 'account_subscription.revoke', 'account_subscription', user_id,
          jsonb_build_object('planCode', plan_code, 'startsAt', starts_at, 'endsAt', ends_at, 'note', note, 'revision', revision), clock_timestamp()
        from changed returning id
      ) select revision from changed`,
    tx`select u.id, u.name, u.account_name, u.email, to_jsonb(s) as subscription
       from users u left join account_subscriptions s on s.user_id = u.id where u.id = ${userId}`,
    tx`select a.id, a.action, a.metadata, a.created_at, coalesce(u.name, u.account_name) as actor_name
       from audit_logs a left join users u on u.id = a.user_id
       where a.entity_type = 'account_subscription' and a.entity_id = ${userId}
       order by a.created_at desc, a.id desc limit 10`
  ]);
  if (!results[0].length) throw Object.assign(new Error('Compte introuvable.'), { status: 404, code: 'ACCOUNT_NOT_FOUND' });
  if (!results[1].length) throw Object.assign(new Error('L’abonnement a changé. Recharge le compte avant de réessayer.'), { status: 409, code: 'SUBSCRIPTION_CONFLICT' });
  return { ok: true, account: serializeSubscriptionAccount(results[2][0]), history: results[3].map(serializeSubscriptionHistory) };
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Méthode refusée.' }, 405, { Allow: 'GET, POST' });
    assertTrustedMutation(request);
    const admin = await requirePlatformAdmin(request, context);
    if (request.method === 'POST') {
      const body = validateSubscriptionMutation(await readJson(request, 8 * 1024));
      await ensureAccountSubscriptionsSchema();
      return json(await mutateAccount(body, admin.id));
    }
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => !['userId', 'q', 'page', 'pageSize'].includes(key))) invalidSubscription('Paramètre de recherche inconnu.');
    if (url.searchParams.has('userId')) {
      const userId = subscriptionUserId(url.searchParams.get('userId'));
      await ensureAccountSubscriptionsSchema();
      return json(await accountDetail(userId));
    }
    const page = subscriptionPage(url.searchParams.get('page'), 1, 1_000_000);
    const pageSize = subscriptionPage(url.searchParams.get('pageSize'), 10, 100);
    const search = subscriptionSearch(url.searchParams.get('q'));
    await ensureAccountSubscriptionsSchema();
    const [accounts, counts] = await sql.transaction(tx => [
      tx`select u.id, u.name, u.account_name, u.email, to_jsonb(s) as subscription
         from users u left join account_subscriptions s on s.user_id = u.id
         where concat_ws(' ', u.name, u.account_name, u.email) ilike ${search}
         order by u.created_at desc, u.id desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
      tx`select count(*)::integer as total from users u where concat_ws(' ', u.name, u.account_name, u.email) ilike ${search}`
    ], { isolationLevel: 'RepeatableRead', readOnly: true });
    const total = Number(counts[0].total);
    return json({ accounts: accounts.map(serializeSubscriptionAccount), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    return handleError(error);
  }
}

export const config: Config = { method: ['GET', 'POST'] };
