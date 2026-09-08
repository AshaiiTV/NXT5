-- Manual account assignments only. Team roles, quotas and billing are unchanged.
create table if not exists account_subscriptions (
  user_id uuid primary key references users(id) on delete cascade,
  plan_code text not null check (plan_code in ('free', 'team_monthly', 'team_season', 'structure')),
  starts_at timestamptz,
  ends_at timestamptz,
  revoked_at timestamptz,
  note text not null default '' check (char_length(note) <= 1000),
  updated_by uuid references users(id) on delete set null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint account_subscriptions_validity_check check (
    (plan_code = 'free' and starts_at is null and ends_at is null)
    or (plan_code <> 'free' and starts_at is not null and (ends_at is null or ends_at > starts_at))
  )
);

create index if not exists idx_account_subscription_audit_history
  on audit_logs(entity_id, created_at desc, id desc)
  where entity_type = 'account_subscription';
