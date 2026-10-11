-- Opponent affiliation belongs to a played match independently of its draft.
-- Drain publication events from earlier backfills before altering matches.
do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed immediate;
  end if;
end $$;

do $$
declare needs_backfill boolean;
begin
  select not exists (select 1 from pg_attribute
    where attrelid = 'matches'::regclass and attname = 'opponent_id' and not attisdropped)
    into needs_backfill;
  alter table matches add column if not exists opponent_id uuid;
  alter table opponent_drafts alter column opponent_id drop not null;

  if not exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'matches_opponent_team_fkey') then
    alter table matches add constraint matches_opponent_team_fkey
      foreign key (team_id, opponent_id) references team_opponents(team_id, id)
      on delete set null (opponent_id);
  end if;

  -- Preserve the legacy column for compatibility, but deleting a dossier must
  -- never delete a snapshot that is now independent of that dossier.
  if exists (select 1 from pg_constraint where conrelid = 'opponent_drafts'::regclass
    and conname = 'opponent_drafts_team_id_opponent_id_fkey' and confdeltype <> 'n') then
    alter table opponent_drafts drop constraint opponent_drafts_team_id_opponent_id_fkey;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'opponent_drafts'::regclass
    and conname = 'opponent_drafts_team_id_opponent_id_fkey') then
    alter table opponent_drafts add constraint opponent_drafts_team_id_opponent_id_fkey
      foreign key (team_id, opponent_id) references team_opponents(team_id, id)
      on delete set null (opponent_id);
  end if;

  create index if not exists matches_opponent_team_date_idx
    on matches(team_id, created_at desc, id desc) where opponent_id is not null;

  -- Execute only on introduction of the column. Replaying this migration must
  -- not restore an affiliation that a user subsequently cleared deliberately.
  if needs_backfill then
    update matches m set opponent_id = d.opponent_id from opponent_drafts d
      where d.team_id = m.team_id and d.match_id = m.id
        and d.opponent_id is not null and m.opponent_id is null;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed deferred;
  end if;
end $$;
