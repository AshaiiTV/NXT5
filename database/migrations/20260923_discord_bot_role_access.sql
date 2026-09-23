-- Optional Discord role allowlist, scoped to the team's currently linked guild.
-- No row preserves the existing NXT5 membership and role checks.
create table discord_bot_role_access (
  team_id uuid primary key references teams(id) on delete cascade,
  guild_id text not null,
  role_ids text[] not null,
  updated_at timestamptz not null default now(),
  constraint discord_bot_role_access_guild_id check (guild_id ~ '^[0-9]{17,20}$'),
  constraint discord_bot_role_access_role_count check (cardinality(role_ids) between 1 and 25),
  constraint discord_bot_role_access_role_values check (array_position(role_ids, null) is null)
);
