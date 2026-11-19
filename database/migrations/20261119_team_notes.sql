alter table reports
  add column if not exists is_team_note boolean not null default false,
  add column if not exists original_debrief jsonb;
