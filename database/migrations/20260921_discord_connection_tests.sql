-- Explicit synthetic connection tests are separate from real game publications.
-- Retain request and destination identities even if a route is subsequently removed.
create table discord_connection_tests (
  team_id uuid not null references teams(id) on delete cascade,
  request_id uuid not null,
  route_id uuid not null,
  guild_id text not null,
  channel_id text not null,
  config_version bigint not null,
  status text not null check (status in ('sending','succeeded','failed','uncertain')),
  message_id text,
  error_code text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (team_id, request_id),
  check (status <> 'succeeded' or (message_id is not null and completed_at is not null))
);
create index discord_connection_tests_latest on discord_connection_tests(team_id, created_at desc);
-- A new UUID cannot bypass an unconfirmed send to the same destination.
create unique index discord_connection_tests_unconfirmed
  on discord_connection_tests(team_id, guild_id, channel_id) where status in ('sending','uncertain');
