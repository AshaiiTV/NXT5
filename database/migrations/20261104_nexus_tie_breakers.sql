-- Standings tie-breakers become an explicit season rule instead of being
-- inferred from the double elimination variant. Order matters: the first key
-- separates teams level on points, the next one the teams still level.
alter table nexus_seasons add column if not exists tie_breakers jsonb not null default '[]'::jsonb;
alter table nexus_seasons drop constraint if exists nexus_seasons_tie_breakers_check;
alter table nexus_seasons add constraint nexus_seasons_tie_breakers_check check (
  jsonb_typeof(tie_breakers) = 'array'
  and jsonb_array_length(tie_breakers) <= 4
  and tie_breakers <@ '["headToHead","gameDifference","seriesWon","gamesWon"]'::jsonb
);
-- Seasons already using a Nexus six-team bracket keep the rules the standings
-- previously applied to them. Every other season keeps teams level on points.
update nexus_seasons set tie_breakers = '["headToHead","gameDifference"]'::jsonb
where tie_breakers = '[]'::jsonb
  and double_variant <> 'standard'
  and (format = 'double_elimination' or (format in ('round_robin','groups','swiss','custom') and playoff_enabled and playoff_format = 'double_elimination'));
