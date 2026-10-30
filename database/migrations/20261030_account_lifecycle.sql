alter table users add column if not exists suspended_at timestamptz;
-- All session issuers serialize against suspension, including social sign-in.
create or replace function enforce_active_session_account() returns trigger language plpgsql as $$
declare blocked timestamptz;
begin
  select suspended_at into blocked from users where id=new.user_id for update;
  if blocked is not null then raise exception 'Compte suspendu.' using errcode='42501'; end if;
  return new;
end $$;
drop trigger if exists sessions_active_account on sessions;
create trigger sessions_active_account before insert on sessions for each row execute function enforce_active_session_account();
