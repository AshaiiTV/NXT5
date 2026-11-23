-- Query performance: indexes for the slowest read paths (see
-- docs/performance-requetes-2026-11-23.md). Every statement is idempotent.

-- Earlier backfills of the same deploy transaction may leave deferred Discord
-- publication events queued, and CREATE INDEX refuses a table with pending
-- trigger events: drain them first, as 20261012_match_opponents.sql does.
do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed immediate;
  end if;
  if exists (select 1 from pg_constraint
    where conrelid = 'match_participants'::regclass and conname = 'discord_participant_changed' and condeferrable) then
    set constraints discord_participant_changed immediate;
  end if;
end $$;

-- Date a game was played, from raw info.gameStartTimestamp then info.gameCreation
-- (bounded numeric timestamps only, seconds or milliseconds), otherwise null.
-- Same rule as the former inline Discord SQL expression. Immutable: only
-- immutable casts and to_timestamp(double precision) are used.
create or replace function nxt5_match_started_at(source jsonb) returns timestamptz
language plpgsql immutable as $fn$
declare
  info jsonb := source -> 'info';
  value text;
  key text;
begin
  foreach key in array array['gameStartTimestamp', 'gameCreation'] loop
    value := info ->> key;
    if value ~ '^[0-9]{9,13}$' then
      return to_timestamp(value::double precision / case when value::numeric < 100000000000 then 1 else 1000 end);
    end if;
  end loop;
  return null;
end $fn$;

-- Discord reads filter and sort a team's games by played date, then import
-- date. The index stores that value: filtering no longer reads raw (1–3 MB).
-- Building it reads every raw value once; see the documentation if this ever
-- has to be prepared beforehand with CREATE INDEX CONCURRENTLY.
create index if not exists idx_matches_team_played
  on matches(team_id, (coalesce(nxt5_match_started_at(raw), created_at)) desc, id desc);

-- History pages: order by created_at desc, id desc (the id tie-break was not indexed).
create index if not exists idx_matches_team_recent on matches(team_id, created_at desc, id desc);
drop index if exists idx_matches_team;
-- Platform statistics filter by import period.
create index if not exists idx_matches_created_at on matches(created_at);
create index if not exists idx_opponent_drafts_imported_at on opponent_drafts(imported_at);

-- Bootstrap Discord workflows: the existing events index only covers scheduled rows.
create index if not exists idx_discord_team_events_team_starts on discord_team_events(team_id, starts_at);
create index if not exists idx_discord_team_goals_team_status on discord_team_goals(team_id, status, created_at desc);

-- Foreign keys used by deletes and lookups without a leading index.
create index if not exists idx_participants_player on match_participants(player_id) where player_id is not null;
create index if not exists idx_match_raw_archives_match on match_raw_archives(match_id);
create index if not exists idx_reports_match on reports(match_id) where match_id is not null;

do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed deferred;
  end if;
  if exists (select 1 from pg_constraint
    where conrelid = 'match_participants'::regclass and conname = 'discord_participant_changed' and condeferrable) then
    set constraints discord_participant_changed deferred;
  end if;
end $$;
