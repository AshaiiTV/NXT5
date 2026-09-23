-- Personal account links never grant membership in a team or Discord server.
create table discord_user_links (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique check(discord_user_id ~ '^[0-9]{17,20}$'),
  user_id uuid not null unique references users(id) on delete cascade,
  discord_label text not null,
  created_at timestamptz not null default now()
);
create table discord_account_link_requests (
  token_hash text primary key,
  discord_user_id text not null,
  guild_id text not null,
  discord_label text not null,
  user_id uuid references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index discord_account_link_requests_expiry on discord_account_link_requests(expires_at);
create table discord_user_team_choices (
  link_id uuid not null references discord_user_links(id) on delete cascade,
  guild_id text not null,
  team_id uuid not null references teams(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key(link_id,guild_id)
);
create table discord_bot_pending (
  token_hash text primary key,
  link_id uuid not null references discord_user_links(id) on delete cascade,
  guild_id text not null,
  team_id uuid references teams(id) on delete cascade,
  command text not null,
  kind text not null check(kind in ('confirm','modal')),
  options jsonb not null default '{}'::jsonb,
  form jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index discord_bot_pending_expiry on discord_bot_pending(expires_at);
