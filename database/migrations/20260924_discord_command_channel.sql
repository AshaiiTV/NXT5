-- A command channel belongs to exactly one connected team in a server.
-- Publication routes remain independent and may still be shared.
alter table discord_connections add column command_channel_id text;
alter table discord_connections add constraint discord_command_channel_id_format
  check (command_channel_id is null or (guild_id is not null and command_channel_id ~ '^[0-9]{17,20}$'));
create unique index discord_connections_command_channel_unique
  on discord_connections(guild_id, command_channel_id)
  where guild_id is not null and command_channel_id is not null and status <> 'disconnected';

-- A signed button interaction can be tied to its original published message.
create index discord_bot_outbox_button_message
  on discord_bot_outbox(guild_id, channel_id, message_id)
  where state='sent' and message_id is not null and kind in ('reminder','presence','review');
