-- Keep the configured selection versioned as one unit: a preview approves the
-- exact server/channel set, and every delivery remains attached to that set.
alter table discord_community_settings add column destinations jsonb not null default '[]'::jsonb
  check (jsonb_typeof(destinations) = 'array' and jsonb_array_length(destinations) <= 10);
update discord_community_settings set destinations = jsonb_build_array(jsonb_build_object('guildId',guild_id,'channelId',channel_id));
-- Retain the original fields during the deployment transition. New code reads
-- destinations only; old settings and historical receipts remain intact.
alter table discord_community_settings alter column guild_id drop not null, alter column channel_id drop not null;

create table discord_community_batches (
  reference text primary key check (reference ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'),
  application_id text not null check (application_id ~ '^[0-9]{17,20}$'),
  bot_id text not null check (bot_id ~ '^[0-9]{17,20}$'),
  content text not null check (char_length(content) between 1 and 4096),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  destinations jsonb not null check (jsonb_typeof(destinations) = 'array' and jsonb_array_length(destinations) between 1 and 10),
  created_at timestamptz not null default now()
);
insert into discord_community_batches(reference,application_id,bot_id,content,content_hash,destinations,created_at)
  select reference,application_id,bot_id,content,content_hash,
    jsonb_build_array(jsonb_build_object('guildId',guild_id,'channelId',channel_id)),created_at
  from discord_community_announcements;

create function nxt5_community_batch_identity() returns trigger language plpgsql as $$
begin
  if row(old.reference,old.application_id,old.bot_id,old.content,old.content_hash,old.destinations)
    is distinct from row(new.reference,new.application_id,new.bot_id,new.content,new.content_hash,new.destinations) then
    raise exception 'The destinations and content of an announcement reference are immutable';
  end if;
  return new;
end $$;
create trigger discord_community_batch_identity before update on discord_community_batches
  for each row execute function nxt5_community_batch_identity();

alter table discord_community_announcements drop constraint discord_community_announcements_reference_key;
alter table discord_community_announcements add unique(reference,guild_id);
alter table discord_community_announcements add foreign key(reference) references discord_community_batches(reference);
alter table discord_community_announcements drop constraint discord_community_announcements_status_check;
alter table discord_community_announcements add check (status in ('queued','sending','sent','uncertain','failed'));
