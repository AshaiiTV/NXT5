-- Community announcements are independent of team destinations and game queues.
create table discord_community_settings (
  singleton boolean primary key default true check (singleton),
  guild_id text not null check (guild_id ~ '^[0-9]{17,20}$'),
  channel_id text not null check (channel_id ~ '^[0-9]{17,20}$'),
  config_version bigint not null default 1,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table discord_community_announcements (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'),
  application_id text not null check (application_id ~ '^[0-9]{17,20}$'),
  bot_id text not null check (bot_id ~ '^[0-9]{17,20}$'),
  guild_id text not null check (guild_id ~ '^[0-9]{17,20}$'),
  channel_id text not null check (channel_id ~ '^[0-9]{17,20}$'),
  content text not null check (char_length(content) between 1 and 4096),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('sending','sent','uncertain','failed')),
  message_id text check (message_id ~ '^[0-9]{17,20}$'),
  error_code text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'sent' or message_id is not null)
);
create index discord_community_announcements_recent on discord_community_announcements(created_at desc);

create function nxt5_community_announcement_identity() returns trigger language plpgsql as $$
begin
  if row(old.reference,old.application_id,old.bot_id,old.guild_id,old.channel_id,old.content,old.content_hash)
    is distinct from row(new.reference,new.application_id,new.bot_id,new.guild_id,new.channel_id,new.content,new.content_hash) then
    raise exception 'The destination and content of an announcement reference are immutable';
  end if;
  return new;
end $$;
create trigger discord_community_announcement_identity before update on discord_community_announcements
  for each row execute function nxt5_community_announcement_identity();
