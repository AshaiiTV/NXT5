-- Match links remain optional: removing a played game must retain the opponent
-- dossier and the imported draft. The team column is never nulled by the FK.
-- Earlier backfills can update matches in this same migration transaction.
-- Drain their deferred publication events before changing the table's indexes;
-- the local prototype has no Discord trigger, so this step is conditional.
do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed immediate;
  end if;
end $$;

create unique index if not exists matches_team_id_id_key on matches(team_id, id);

alter table opponent_drafts add column if not exists match_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'opponent_drafts'::regclass and conname = 'opponent_drafts_match_team_fkey'
  ) then
    alter table opponent_drafts add constraint opponent_drafts_match_team_fkey
      foreign key (team_id, match_id) references matches(team_id, id)
      on delete set null (match_id);
  end if;
end $$;

create unique index if not exists opponent_drafts_match_key on opponent_drafts(match_id) where match_id is not null;

do $$ begin
  if exists (select 1 from pg_constraint
    where conrelid = 'matches'::regclass and conname = 'discord_match_changed' and condeferrable) then
    set constraints discord_match_changed deferred;
  end if;
end $$;
