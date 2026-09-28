alter table teams add column if not exists first_review_at timestamptz;

-- Existing teams with reviews are already active. Their old human-save audit
-- may have expired; conservatively avoid emitting a false first-review event.
update teams
set first_review_at = now()
where first_review_at is null
  and exists (select 1 from reports where reports.team_id = teams.id);

alter table teams add column if not exists first_import_at timestamptz;

update teams
set first_import_at = now()
where first_import_at is null
  and exists (select 1 from matches where matches.team_id = teams.id);
