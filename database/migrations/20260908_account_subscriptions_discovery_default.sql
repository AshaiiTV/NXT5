-- Every account starts with Découverte. Existing assignments remain untouched.
-- Install the trigger before backfilling so registrations cannot fall between
-- the existing-account scan and activation of the default.
create or replace function assign_default_discovery_subscription()
returns trigger
language plpgsql
as $$
begin
  insert into account_subscriptions (user_id, plan_code)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_users_default_discovery_subscription on users;
create trigger trg_users_default_discovery_subscription
after insert on users
for each row execute function assign_default_discovery_subscription();

insert into account_subscriptions (user_id, plan_code)
select u.id, 'free'
from users u
where not exists (select 1 from account_subscriptions s where s.user_id = u.id)
on conflict (user_id) do nothing;
