-- Multiple NXT5 teams may use one Discord server. Each team still has exactly
-- one connection, enforced by discord_connections(team_id)'s primary key.
drop index if exists discord_connections_active_guild;
create index if not exists discord_connections_by_guild
  on discord_connections(guild_id, team_id)
  where guild_id is not null and status <> 'disconnected';
