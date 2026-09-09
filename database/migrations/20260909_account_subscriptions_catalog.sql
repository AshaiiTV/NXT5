-- Align manual account grades with the two current offers. This migration
-- changes no workspace entitlements and starts no trial or payment.
alter table account_subscriptions drop constraint if exists account_subscriptions_plan_code_check;
alter table account_subscriptions drop constraint if exists account_subscriptions_validity_check;

-- Keep the original validity, revocation, note and assigning administrator.
-- Record the old plan separately without rewriting any historical audit row.
with previous as (
  select user_id, plan_code
  from account_subscriptions
  where plan_code in ('team_season', 'structure')
  for update
), changed as (
  update account_subscriptions as subscription
  set plan_code = 'team_monthly', revision = subscription.revision + 1, updated_at = clock_timestamp()
  from previous
  where subscription.user_id = previous.user_id
  returning subscription.*, previous.plan_code as previous_plan_code
)
insert into audit_logs(user_id, action, entity_type, entity_id, metadata, created_at)
select null, 'account_subscription.migrate', 'account_subscription', user_id,
  jsonb_build_object(
    'previousPlanCode', previous_plan_code, 'planCode', plan_code,
    'startsAt', starts_at, 'endsAt', ends_at, 'revokedAt', revoked_at,
    'note', note, 'previousRevision', revision - 1, 'revision', revision,
    'migrationKey', 'account-subscriptions-catalog-20260909-v1'
  ), clock_timestamp()
from changed;

alter table account_subscriptions add constraint account_subscriptions_plan_code_check
  check (plan_code in ('free', 'team_monthly'));
alter table account_subscriptions add constraint account_subscriptions_validity_check check (
  (plan_code = 'free' and (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at is not null and ends_at = starts_at + interval '336 hours')
  ))
  or (plan_code = 'team_monthly' and starts_at is not null and (ends_at is null or ends_at > starts_at))
);

-- The existing registration trigger still creates free with null dates:
-- Découverte is pending until an administrator explicitly supplies a start.
