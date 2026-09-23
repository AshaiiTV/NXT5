-- Additive shared identity model. Never match or merge accounts by email.
alter table users add column if not exists social_link_revision bigint not null default 0
  check (social_link_revision >= 0);

create table if not exists social_identities (
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'discord', 'apple', 'riot')),
  subject text not null check (char_length(subject) between 1 and 256),
  display_name text check (char_length(display_name) <= 100),
  linked_at timestamptz not null default now(),
  primary key (provider, subject),
  unique (user_id, provider)
);

create table if not exists social_auth_flows (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider in ('google', 'discord', 'apple', 'riot')),
  flow text not null check (flow in ('login', 'register', 'link')),
  user_id uuid references users(id) on delete cascade,
  session_hash text,
  link_revision bigint,
  nonce text not null,
  code_verifier text not null,
  remember boolean not null,
  destination text not null default '/equipes',
  expires_at timestamptz not null default now() + interval '5 minutes',
  check ((flow = 'link' and user_id is not null and session_hash is not null and link_revision is not null)
    or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null))
);

-- Contains a verified identity for up to 5 minutes, never provider tokens or codes.
-- The intermediate callback ticket lets Apple's cross-site POST return through
-- a same-origin GET before inspecting the existing SameSite=Lax NXT5 session.
create table if not exists social_auth_tickets (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('callback', 'signup')),
  provider text not null check (provider in ('google', 'discord', 'apple', 'riot')),
  subject text not null check (char_length(subject) between 1 and 256),
  email text,
  email_verified boolean not null default false,
  display_name text,
  flow text not null check (flow in ('login', 'register', 'link')),
  user_id uuid references users(id) on delete cascade,
  session_hash text,
  link_revision bigint,
  remember boolean not null,
  destination text not null,
  expires_at timestamptz not null default now() + interval '5 minutes',
  check ((flow = 'link' and user_id is not null and session_hash is not null and link_revision is not null and purpose = 'callback')
    or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null))
);
create index if not exists idx_social_flows_expiry on social_auth_flows(expires_at);
create index if not exists idx_social_flows_user on social_auth_flows(user_id);
create index if not exists idx_social_tickets_expiry on social_auth_tickets(expires_at);
create index if not exists idx_social_tickets_user on social_auth_tickets(user_id);

create or replace function complete_social_signup(
  ticket_hash text, browser_hash_value text, new_user_id uuid,
  chosen_email text, chosen_name text, accepted_version text,
  verification_hash text, verification_expires timestamptz
) returns jsonb
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare pending social_auth_tickets%rowtype; result users%rowtype; verified boolean;
begin
  select * into pending from social_auth_tickets
    where token_hash = ticket_hash and browser_hash = browser_hash_value
      and purpose = 'signup' and expires_at > clock_timestamp() for update;
  if not found then raise exception using errcode = 'P0001', message = 'SOCIAL_EXPIRED'; end if;
  if exists (select 1 from users where lower(email) = lower(chosen_email)) then
    raise exception using errcode = 'P0001', message = 'SOCIAL_EMAIL_EXISTS';
  end if;
  verified := pending.email_verified and lower(coalesce(pending.email, '')) = lower(chosen_email);
  insert into users(id, account_name, email, name, password_hash, email_verified,
    email_verify_token, email_verify_expires_at, legal_accepted_at, legal_version)
  values (new_user_id, 'compte-' || replace(new_user_id::text, '-', ''), lower(chosen_email), chosen_name, '', verified,
    case when verified then null else verification_hash end,
    case when verified then null else verification_expires end, now(), accepted_version)
  returning * into result;
  insert into social_identities(user_id, provider, subject, display_name)
    values (new_user_id, pending.provider, pending.subject, left(pending.display_name, 100));
  delete from social_auth_tickets where token_hash = ticket_hash;
  insert into audit_logs(user_id, action, entity_type, metadata)
    values (new_user_id, 'auth.social_register', 'user', jsonb_build_object('provider', pending.provider));
  return to_jsonb(result);
end;
$$;

-- User lock is shared by session creation and unlink. Revision prevents an
-- in-flight callback from restoring a removed connection.
create or replace function unlink_social_identity(
  target_user uuid, target_provider text, verified_password_hash text, current_session_hash text
) returns boolean
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform 1 from users where id = target_user and password_hash = verified_password_hash
    and nullif(btrim(password_hash), '') is not null for update;
  if not found then return false; end if;
  perform 1 from sessions where user_id = target_user and token_hash = current_session_hash
    and revoked_at is null and expires_at > clock_timestamp() for update;
  if not found then return false; end if;
  update users set social_link_revision = social_link_revision + 1 where id = target_user;
  delete from social_identities where user_id = target_user and provider = target_provider;
  delete from social_auth_flows where user_id = target_user;
  delete from social_auth_tickets where user_id = target_user;
  update sessions set revoked_at = now()
    where user_id = target_user and token_hash <> current_session_hash and revoked_at is null;
  insert into audit_logs(user_id, action, entity_type, metadata)
    values (target_user, 'auth.social_unlink', 'user', jsonb_build_object('provider', target_provider));
  return true;
end;
$$;

-- Bind recovery links to the mailbox that received them. Existing links have no
-- trustworthy address snapshot; expire them once and require a fresh request.
alter table password_reset_tokens add column if not exists email text;
update password_reset_tokens set used_at = now() where email is null and used_at is null;

create or replace function nxt5_reset_password(reset_token_hash text, new_password_hash text)
returns table(user_id uuid)
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare target_user uuid; current_email text; claimed_token uuid;
begin
  select reset.user_id into target_user from password_reset_tokens reset
    where reset.token_hash = reset_token_hash and reset.used_at is null
      and reset.expires_at > clock_timestamp();
  if not found then return; end if;

  -- Match the lock order of social linking/login/unlink. Subsequent statements
  -- see links committed while this call was waiting for the account lock.
  select account.email into current_email from users account
    where account.id = target_user for update;
  if not found then return; end if;
  update password_reset_tokens reset set used_at = now()
    where reset.token_hash = reset_token_hash and reset.user_id = target_user
      and reset.used_at is null and reset.expires_at > clock_timestamp()
      and reset.email is not null and lower(reset.email) = lower(current_email)
    returning reset.id into claimed_token;
  if not found then return; end if;

  update users account
    set password_hash = new_password_hash, email_verified = true,
        email_verify_token = null, email_verify_expires_at = null,
        social_link_revision = account.social_link_revision + 1, updated_at = now()
    where account.id = target_user;
  update password_reset_tokens reset set used_at = now()
    where reset.user_id = target_user and reset.used_at is null;
  update sessions set revoked_at = now()
    where sessions.user_id = target_user and sessions.revoked_at is null;
  delete from social_identities where social_identities.user_id = target_user;
  delete from social_auth_flows where social_auth_flows.user_id = target_user;
  delete from social_auth_tickets where social_auth_tickets.user_id = target_user;
  insert into audit_logs(user_id, action, entity_type, metadata)
    values (target_user, 'auth.password_reset_complete', 'user', '{"social_connections_reset":true}'::jsonb);
  return query select target_user;
end;
$$;
