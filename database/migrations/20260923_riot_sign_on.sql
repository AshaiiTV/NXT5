-- Additive RSO migration: existing credentials, roster Riot IDs and team rights
-- remain unchanged. Run through tools/migrate.mjs before enabling Riot login.
alter table users add column if not exists riot_link_revision bigint not null default 0
  constraint users_riot_link_revision_check check (riot_link_revision >= 0);

create table if not exists riot_identities (
  user_id uuid primary key references users(id) on delete cascade,
  puuid text not null unique check (char_length(puuid) between 1 and 128),
  game_name text check (char_length(game_name) <= 100),
  tag_line text check (char_length(tag_line) <= 32),
  linked_at timestamptz not null default now()
);

-- Short-lived, single-use server state. No Riot access/refresh token is stored.
create table if not exists riot_auth_flows (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[0-9a-f]{64}$'),
  flow text not null check (flow in ('login', 'link')),
  user_id uuid references users(id) on delete cascade,
  session_hash text check (session_hash ~ '^[0-9a-f]{64}$'),
  link_revision bigint check (link_revision >= 0),
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{43,128}$'),
  code_verifier text not null check (code_verifier ~ '^[A-Za-z0-9_-]{43,128}$'),
  remember boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint riot_auth_flows_context_check check (
    (flow = 'login' and user_id is null and session_hash is null and link_revision is null)
    or (flow = 'link' and user_id is not null and session_hash is not null and link_revision is not null)
  ),
  constraint riot_auth_flows_expiry_check check (
    expires_at > created_at and expires_at <= created_at + interval '5 minutes'
  )
);

create index if not exists idx_riot_auth_flows_expiry on riot_auth_flows(expires_at);
create index if not exists idx_riot_auth_flows_user on riot_auth_flows(user_id) where user_id is not null;

-- Hold the same user-row lock as Riot session creation. Separate commands are
-- deliberate: after a competing session creation commits, the revocation sees
-- that session; later creations must fail the incremented revision guard.
create or replace function unlink_riot_identity(
  target_user uuid,
  verified_password_hash text,
  current_session_hash text
) returns boolean
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  current_session_expires_at timestamptz;
begin
  perform 1 from users
    where id = target_user
      and password_hash = verified_password_hash
      and nullif(btrim(account_name), '') is not null
      and nullif(btrim(password_hash), '') is not null
    for update;
  if not found then return false; end if;

  select expires_at into current_session_expires_at from sessions
    where user_id = target_user and token_hash = current_session_hash
      and revoked_at is null and expires_at > clock_timestamp()
    for update;
  -- A locker may roll back without creating a row version to requalify. Check
  -- expiry again only after our lock is held, using wall-clock time.
  if not found or current_session_expires_at <= clock_timestamp() then return false; end if;

  update users set riot_link_revision = riot_link_revision + 1 where id = target_user;
  delete from riot_identities where user_id = target_user;
  delete from riot_auth_flows where user_id = target_user;
  update sessions set revoked_at = now()
    where user_id = target_user and token_hash <> current_session_hash and revoked_at is null;
  return true;
end;
$$;
