-- Tournament identities reuse users, teams and players. Existing captures remain isolated legacy records.
create table if not exists nexus_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','open','running','completed')),
  legs integer not null default 1 check (legs in (1,2)),
  regular_best_of integer not null default 1 check (regular_best_of in (1,3,5)),
  playoff_size integer not null default 4 check (playoff_size in (2,4,6,8,16)),
  format text not null default 'round_robin' check (format in ('round_robin','groups','single_elimination','double_elimination','swiss','custom')),
  playoff_enabled boolean not null default true,
  group_count integer not null default 2 check (group_count between 2 and 16),
  advance_per_group integer not null default 2 check (advance_per_group between 1 and 8),
  swiss_rounds integer not null default 3 check (swiss_rounds between 1 and 16),
  swiss_state jsonb not null default '{"rounds":[]}'::jsonb,
  double_variant text not null default 'standard' check (double_variant in ('standard','nexus_site','nexus_pdf')),
  upper_final_best_of integer not null default 3 check (upper_final_best_of in (1,3,5)),
  reset_final boolean not null default true,
  playoff_format text not null default 'single_elimination' check (playoff_format in ('single_elimination','double_elimination')),
  final_best_of integer not null default 5 check (final_best_of in (1,3,5)),
  rules_confirmed boolean not null default false,
  playoff_best_of integer not null default 3 check (playoff_best_of in (1,3,5)),
  schedule_generated boolean not null default false,
  playoff_bracket jsonb,
  tie_resolution_note text,
  revision integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists nexus_registrations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references nexus_seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete restrict,
  registered_by uuid references users(id) on delete set null,
  roster_player_ids jsonb not null default '[]'::jsonb,
  roster_riot_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (season_id,team_id)
);
create table if not exists nexus_season_players (
  season_id uuid not null references nexus_seasons(id) on delete cascade,
  riot_id_key text not null,
  registration_id uuid not null references nexus_registrations(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  primary key (season_id,riot_id_key)
);
alter table nexus_fixtures add column if not exists season_id uuid references nexus_seasons(id) on delete restrict;
alter table nexus_fixtures add column if not exists stage text not null default 'legacy' check (stage in ('legacy','regular','playoff'));
alter table nexus_fixtures add column if not exists fixture_key text;
alter table nexus_fixtures add column if not exists round integer not null default 1 check (round >= 1);
alter table nexus_fixtures add column if not exists best_of integer not null default 1 check (best_of in (1,3,5));
alter table nexus_fixtures add column if not exists player_ids jsonb not null default '[]'::jsonb;
alter table nexus_fixtures add column if not exists bracket_group text;
alter table nexus_fixtures add column if not exists group_id text;
alter table nexus_fixtures alter column starts_at drop not null;
alter table nexus_fixtures alter column ends_at drop not null;
alter table nexus_fixtures drop constraint if exists nexus_fixtures_roster_check;
alter table nexus_fixtures drop constraint if exists nexus_fixtures_check;
alter table nexus_fixtures add constraint nexus_fixture_native_teams check (
  stage = 'legacy' or (season_id is not null and team_a_id is not null and team_b_id is not null and team_a_id <> team_b_id and fixture_key is not null)
);
alter table nexus_fixtures add constraint nexus_fixture_roster_window check (
  jsonb_typeof(roster) = 'array' and (
    (stage <> 'legacy' and starts_at is null and ends_at is null and jsonb_array_length(roster) = 0)
    or (starts_at is not null and ends_at is not null and ends_at > starts_at and ends_at <= starts_at + interval '48 hours' and jsonb_array_length(roster) = 10)
  )
);
create unique index if not exists nexus_fixture_generation_key on nexus_fixtures(season_id,fixture_key);
-- Fail visibly on pre-existing double approval rather than silently deleting evidence.
create unique index if not exists nexus_accepted_game_once on nexus_submissions(game_id) where status = 'accepted';
