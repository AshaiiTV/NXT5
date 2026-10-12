-- A scrim group has one persistent opponent. Matches keep their affiliation
-- when they leave a group, or when the group is unlinked/deleted.
do $$
declare needs_backfill boolean;
begin
  select not exists (select 1 from pg_attribute
    where attrelid = 'match_archives'::regclass and attname = 'opponent_id' and not attisdropped)
    into needs_backfill;
  alter table match_archives add column if not exists opponent_id uuid;
  if not exists (select 1 from pg_constraint
    where conrelid = 'match_archives'::regclass and conname = 'match_archives_opponent_team_fkey') then
    alter table match_archives add constraint match_archives_opponent_team_fkey
      foreign key (team_id, opponent_id) references team_opponents(team_id, id)
      on delete set null (opponent_id);
  end if;
  create index if not exists match_archives_opponent_team_idx
    on match_archives(team_id, opponent_id) where opponent_id is not null;

  -- Only exact, complete, unanimous associations are evidence for a group.
  -- Comparing IDs as text tolerates malformed legacy JSON without casting it.
  -- This only runs on column introduction, so replay never restores an unlink.
  if needs_backfill then
    update match_archives a set opponent_id = candidates.opponent_id
    from (
      select a.id, min(m.opponent_id::text)::uuid as opponent_id
      from match_archives a
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(a.match_ids) = 'array' then a.match_ids else '[]'::jsonb end
      ) ids(match_id)
      left join matches m on m.team_id = a.team_id and m.id::text = ids.match_id
      group by a.id
      having count(*) = count(m.opponent_id) and count(distinct m.opponent_id) = 1
    ) candidates where a.id = candidates.id;
  end if;
end $$;

create or replace function sync_match_archive_opponent() returns trigger language plpgsql as $$
begin
  if new.opponent_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.opponent_id is not distinct from old.opponent_id
    and new.match_ids is not distinct from old.match_ids and new.team_id = old.team_id then
    return new;
  end if;
  -- All application writers acquire this lock before touching group/match rows.
  perform id from teams where id = new.team_id for update;
  if jsonb_typeof(new.match_ids) <> 'array' then
    raise exception using errcode = 'P0G02', message = 'Invalid linked group matches';
  end if;
  if jsonb_array_length(new.match_ids) > 80 then
    raise exception using errcode = 'P0G02', message = 'Invalid linked group matches';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.match_ids) ids(value)
    where jsonb_typeof(ids.value) <> 'string' or not exists (
      select 1 from matches m where m.team_id = new.team_id and m.id::text = ids.value #>> '{}'
    )
  ) then
    raise exception using errcode = 'P0G02', message = 'Invalid linked group matches';
  end if;
  if exists (
    select 1 from match_archives a
    where a.team_id = new.team_id and a.id <> new.id and a.opponent_id is not null
      and a.opponent_id <> new.opponent_id
      and a.match_ids ?| array(select jsonb_array_elements_text(new.match_ids))
  ) then
    raise exception using errcode = 'P0G01', message = 'Conflicting group opponent';
  end if;
  update matches m set opponent_id = new.opponent_id
    where m.team_id = new.team_id and new.match_ids ? m.id::text
      and m.opponent_id is distinct from new.opponent_id;
  return new;
end $$;

drop trigger if exists match_archive_opponent_changed on match_archives;
create trigger match_archive_opponent_changed
  after insert or update of opponent_id, match_ids, team_id on match_archives
  for each row execute function sync_match_archive_opponent();
