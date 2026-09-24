-- Explicit group summaries retain their own delivery fence after a group/route is removed.
create table discord_group_exports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  request_id uuid not null,
  archive_id uuid not null,
  route_id uuid not null,
  application_id text not null,
  guild_id text not null,
  channel_id text not null,
  channel_name text not null,
  config_version bigint not null,
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  status text not null check(status in ('sending','succeeded','failed','uncertain')),
  message_id text,
  error_code text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(team_id,request_id),
  check(status <> 'succeeded' or (message_id is not null and completed_at is not null))
);
create index discord_group_exports_history on discord_group_exports(team_id,archive_id,created_at desc);
-- A definite rejection may be explicitly retried under a new request UUID.
create unique index discord_group_exports_content
  on discord_group_exports(team_id,archive_id,guild_id,channel_id,source_hash) where status <> 'failed';
-- Even changed data cannot bypass an unresolved send to the same destination.
create unique index discord_group_exports_unconfirmed
  on discord_group_exports(team_id,archive_id,guild_id,channel_id) where status in ('sending','uncertain');
