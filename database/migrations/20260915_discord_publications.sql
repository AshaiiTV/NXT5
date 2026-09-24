-- Discord V1. No historical backfill and no connection enabled by this migration.
create table discord_connections (
  team_id uuid primary key references teams(id) on delete cascade,
  guild_id text,
  status text not null default 'pending' check (status in ('pending','active','paused','disconnected')),
  enabled_at timestamptz,
  config_version bigint not null default 1,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Pilot contract: one connected NXT5 team per Discord server. A unique index
-- protects concurrent links even when each request holds a different team lock.
create unique index discord_connections_active_guild on discord_connections(guild_id)
  where guild_id is not null and status <> 'disconnected';
create table discord_interaction_receipts (
  interaction_id text primary key, guild_id text not null, discord_user_id text not null, command_name text not null,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  response_text text, error_code text, created_at timestamptz not null default now(), completed_at timestamptz
);
create table discord_link_codes (
  id uuid primary key default gen_random_uuid(), code_hash text not null unique,
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete cascade,
  expires_at timestamptz not null, consumed_at timestamptz, guild_id text,
  created_at timestamptz not null default now()
);
create table discord_routes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references discord_connections(team_id) on delete cascade,
  guild_id text not null, channel_id text not null, channel_name text not null default '',
  category_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(category_ids) = 'array'),
  publication_kind text not null default 'game' check (publication_kind = 'game'),
  include_hints boolean not null default false, mention_role_id text,
  enabled boolean not null default true, automatic boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (team_id,channel_id,publication_kind)
);
create table discord_publications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  -- Deliberately retained after match deletion so known messages can be withdrawn.
  entity_id uuid not null, publication_kind text not null default 'game',
  route_id uuid references discord_routes(id) on delete set null,
  channel_id text not null, guild_id text not null, message_id text,
  published_revision bigint not null default 0, published_hash text,
  desired_revision bigint not null default 0,
  state text not null default 'pending' check (state in ('pending','published','sending','uncertain','blocked','withdrawn','deleted')),
  lease_token uuid, lease_expires_at timestamptz, uncertain_since timestamptz,
  source_deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (team_id,entity_id,publication_kind,channel_id)
);
create table publication_jobs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references discord_publications(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade, entity_id uuid not null,
  source_revision bigint not null, config_version bigint not null,
  status text not null default 'queued' check (status in ('queued','preparing','retry_wait','sending','uncertain','succeeded','superseded','blocked','cancelled')),
  attempts integer not null default 0, retry_base_attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid, lease_expires_at timestamptz, last_error_code text, last_error text,
  trigger_kind text not null default 'automatic' check (trigger_kind in ('automatic','manual')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (publication_id,source_revision)
);
create index publication_jobs_due on publication_jobs(available_at) where status in ('queued','retry_wait');
create index publication_jobs_team on publication_jobs(team_id,created_at desc);
create table discord_worker_leases (
  id text primary key, lease_token uuid, expires_at timestamptz
);
insert into discord_worker_leases(id) values ('publisher');
create table publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references discord_publications(id) on delete cascade,
  source_revision bigint not null, content_hash text not null, body jsonb not null,
  asset_key text, created_at timestamptz not null default now(),
  unique (publication_id,source_revision)
);
create table discord_deliveries (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references discord_publications(id) on delete cascade,
  job_id uuid not null references publication_jobs(id) on delete cascade,
  snapshot_id uuid references publication_snapshots(id) on delete set null,
  source_revision bigint not null, attempt integer not null, message_id text,
  status text not null check (status in ('sending','succeeded','retry_wait','uncertain','blocked','withdrawn')),
  error_code text, error_message text, created_at timestamptz not null default now(), completed_at timestamptz,
  unique(job_id,attempt)
);
alter table matches add column publication_revision bigint not null default 0;
alter table matches add column publication_content_hash text;

-- A deferred row trigger sees the final match AND final participants. Its first
-- invocation records that content; subsequent invocations in this transaction
-- observe the same hash. Rolled-back imports never leave a publication job.
create function nxt5_enqueue_discord_match(target_match uuid, manual_route uuid default null, expected_revision bigint default null)
returns setof publication_jobs language plpgsql as $$
declare m matches%rowtype; c discord_connections%rowtype; r discord_routes%rowtype;
  publication_row discord_publications%rowtype; content_fingerprint text; actual_revision bigint; had_publications boolean;
begin
  select * into m from matches where id = target_match for update;
  if not found then return; end if;
  if expected_revision is not null and m.publication_revision <> expected_revision then
    raise exception 'DISCORD_PREVIEW_OUTDATED' using errcode = 'P0001';
  end if;
  select md5(jsonb_build_object(
    'match', to_jsonb(m) - array['publication_revision','publication_content_hash','created_at','updated_at','created_by','reviewed_at','reviewed_by','review_status'],
    'participants', coalesce((select jsonb_agg(to_jsonb(mp) - array['id','created_at','updated_at'] order by mp.team_key, mp.role, mp.summoner_name, mp.champion)
      from match_participants mp where mp.match_id = m.id), '[]'::jsonb)
  )::text) into content_fingerprint;
  if m.publication_content_hash is distinct from content_fingerprint then
    update matches set publication_revision = publication_revision + 1, publication_content_hash = content_fingerprint
      where id = m.id returning publication_revision into actual_revision;
  else
    actual_revision := m.publication_revision;
    if manual_route is null then return; end if;
  end if;
  select * into c from discord_connections where team_id = m.team_id;
  if not found or c.status <> 'active' or c.guild_id is null or c.enabled_at is null then return; end if;
  -- The visible route policy is part of a version too. A manual publication
  -- after a policy edit must not reuse a cancelled job or immutable old snapshot.
  if manual_route is not null and exists(select 1 from publication_jobs j
    join discord_publications p on p.id=j.publication_id
    where p.entity_id=m.id and p.channel_id=(select channel_id from discord_routes where id=manual_route and team_id=m.team_id)
      and j.source_revision=actual_revision and j.config_version<>c.config_version)
  then
    update matches set publication_revision=publication_revision+1 where id=m.id returning publication_revision into actual_revision;
  end if;
  select exists(select 1 from discord_publications where team_id = m.team_id and entity_id = m.id) into had_publications;
  for r in select * from discord_routes where team_id = m.team_id and enabled and guild_id = c.guild_id
    and (manual_route is null or id = manual_route)
    and (manual_route is not null or automatic or exists(select 1 from discord_publications p
      where p.team_id=m.team_id and p.entity_id=m.id and p.channel_id=discord_routes.channel_id))
    and (category_ids = '[]'::jsonb or exists (
      select 1 from jsonb_array_elements_text(category_ids) selected(id)
      where coalesce(m.category_ids,'[]'::jsonb) ? selected.id or m.category_id::text = selected.id
    ))
  loop
    -- Changing categories never silently transfers an existing publication to a
    -- different channel. New destinations for an existing game are explicit.
    if manual_route is null and not exists (select 1 from discord_publications
      where team_id = m.team_id and entity_id = m.id and channel_id = r.channel_id)
      and (m.created_at < c.enabled_at or had_publications)
    then continue; end if;
    insert into discord_publications(team_id,entity_id,route_id,channel_id,guild_id,desired_revision)
      values(m.team_id,m.id,r.id,r.channel_id,r.guild_id,actual_revision)
      on conflict(team_id,entity_id,publication_kind,channel_id) do update
      set desired_revision = greatest(discord_publications.desired_revision,excluded.desired_revision),
        route_id=excluded.route_id,guild_id=excluded.guild_id,
        state = case when manual_route is not null and discord_publications.state='blocked'
          then case when discord_publications.message_id is null then 'pending' else 'published' end else discord_publications.state end,
        updated_at = now()
      returning * into publication_row;
    if publication_row.state in ('withdrawn','deleted') then continue; end if;
    return query insert into publication_jobs(publication_id,team_id,entity_id,source_revision,config_version,trigger_kind,available_at,status)
      values(publication_row.id,m.team_id,m.id,actual_revision,c.config_version,case when manual_route is null then 'automatic' else 'manual' end,
        now() + interval '8 seconds',case when publication_row.state='blocked' then 'blocked' else 'queued' end)
      on conflict(publication_id,source_revision) do update set
        status=case when manual_route is not null and publication_jobs.status in ('cancelled','superseded','blocked')
          and publication_row.state in ('pending','published') then 'queued' else publication_jobs.status end,
        available_at=case when manual_route is not null and publication_jobs.status in ('cancelled','superseded','blocked') then now() else publication_jobs.available_at end,
        retry_base_attempts=case when manual_route is not null and publication_jobs.status in ('cancelled','superseded','blocked') then publication_jobs.attempts else publication_jobs.retry_base_attempts end,
        updated_at = now()
      returning *;
  end loop;
end $$;
create function nxt5_discord_match_changed() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'matches' then
    -- Revision-only writes from enqueue do not recurse.
    if tg_op = 'UPDATE' and (to_jsonb(new) - array['publication_revision','publication_content_hash'])
      = (to_jsonb(old) - array['publication_revision','publication_content_hash']) then return null; end if;
    perform nxt5_enqueue_discord_match(new.id);
  elsif tg_op = 'DELETE' then
    perform nxt5_enqueue_discord_match(old.match_id);
  else
    perform nxt5_enqueue_discord_match(new.match_id);
  end if;
  return null;
end $$;
create constraint trigger discord_match_changed after insert or update on matches
  deferrable initially deferred for each row execute function nxt5_discord_match_changed();
create constraint trigger discord_participant_changed after insert or update or delete on match_participants
  deferrable initially deferred for each row execute function nxt5_discord_match_changed();
create function nxt5_discord_match_deleted() returns trigger language plpgsql as $$
begin
  -- A deleted source and an unconfirmed HTTP send are independent facts. Keep
  -- the send state until its message ID is known, then finish as deleted.
  update discord_publications set source_deleted_at=coalesce(source_deleted_at,now()),
    state=case when state in ('sending','uncertain','withdrawn') then state else 'deleted' end,updated_at=now()
    where entity_id=old.id and team_id=old.team_id;
  update publication_jobs set status = case when status in ('sending','uncertain') then status else 'cancelled' end,
    last_error_code = 'MATCH_DELETED',updated_at = now()
    where entity_id = old.id and team_id = old.team_id and status not in ('succeeded','superseded','cancelled');
  return old;
end $$;
create trigger discord_match_deleted before delete on matches for each row execute function nxt5_discord_match_deleted();
