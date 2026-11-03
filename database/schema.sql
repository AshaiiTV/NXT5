create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  account_name text not null unique,
  email text,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration v16 : conserve un identifiant technique interne pour les anciens comptes.
alter table users add column if not exists account_name text;
update users
set account_name = lower(regexp_replace(coalesce(nullif(name, ''), 'compte') || '-' || substr(id::text, 1, 8), '[^a-z0-9._-]', '', 'g'))
where account_name is null or account_name = '';
alter table users alter column account_name set not null;
create unique index if not exists idx_users_account_name on users(account_name);
alter table users add column if not exists email text;
create unique index if not exists idx_users_email_lower on users (lower(email)) where email is not null and email <> '';
alter table users add column if not exists email_verified boolean default false;
alter table users add column if not exists email_verify_token text default null;
alter table users add column if not exists email_verify_expires_at timestamptz default null;
-- Préférences de notification par user.
alter table users add column if not exists notif_match boolean default true;
alter table users add column if not exists notif_report boolean default true;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  tag text not null,
  region text not null default 'EUW',
  invite_code text,
  invite_expires_at timestamptz,
  avatar_data_url text,
  avatar_zoom numeric not null default 1,
  avatar_x numeric not null default 0,
  avatar_y numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

alter table teams add column if not exists invite_code text;
alter table teams add column if not exists invite_expires_at timestamptz;
alter table teams add column if not exists avatar_data_url text;
alter table teams add column if not exists avatar_zoom numeric not null default 1;
alter table teams add column if not exists avatar_x numeric not null default 0;
alter table teams add column if not exists avatar_y numeric not null default 0;
update teams
set invite_code = 'RIFT-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6))
where invite_code is null;
create unique index if not exists idx_teams_invite_code on teams(invite_code);

create table if not exists team_invite_codes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invite_codes_team on team_invite_codes(team_id, expires_at desc);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'captain', 'coach', 'assistant', 'analyst', 'manager', 'board', 'player', 'viewer', 'member')),
  created_at timestamptz not null default now(),
  unique(team_id, user_id)
);

insert into team_members (team_id, user_id, role)
select id, owner_id, 'captain'
from teams
on conflict (team_id, user_id) do nothing;

update team_members
set role = 'captain'
from teams
where team_members.team_id = teams.id
  and team_members.user_id = teams.owner_id
  and team_members.role = 'owner';

alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role in ('owner', 'captain', 'coach', 'assistant', 'analyst', 'manager', 'board', 'player', 'viewer', 'member'));

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  riot_id text,
  opgg_url text,
  role text not null check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', 'COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD')),
  roster_status text not null default 'MAIN' check (roster_status in ('MAIN', 'SUB', 'INACTIVE')),
  most_played jsonb not null default '[]'::jsonb,
  performance_score numeric,
  status text default 'Non analysé',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, riot_id)
);

alter table players add column if not exists user_id uuid references users(id) on delete set null;
alter table players alter column riot_id drop not null;
alter table players add column if not exists most_played jsonb not null default '[]'::jsonb;
alter table players add column if not exists roster_status text;
with ranked as (
  select id, role, row_number() over (partition by team_id, role order by created_at asc, id asc) as role_rank
  from players
  where roster_status is null
)
update players
set roster_status = case
  when ranked.role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP') and ranked.role_rank = 1 then 'MAIN'
  when ranked.role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB') then 'SUB'
  else 'INACTIVE'
end
from ranked
where players.id = ranked.id;
alter table players alter column roster_status set default 'MAIN';
alter table players alter column roster_status set not null;
with duplicate_mains as (
  select id, row_number() over (partition by team_id, role order by created_at asc, id asc) as main_rank
  from players
  where roster_status = 'MAIN'
    and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP')
)
update players
set roster_status = 'SUB', updated_at = now()
from duplicate_mains
where players.id = duplicate_mains.id
  and duplicate_mains.main_rank > 1;
alter table players drop constraint if exists players_roster_status_check;
alter table players add constraint players_roster_status_check check (roster_status in ('MAIN', 'SUB', 'INACTIVE'));
create index if not exists idx_players_team_roster_status on players(team_id, roster_status, role);
create unique index if not exists idx_players_one_main_per_role on players(team_id, role) where roster_status = 'MAIN' and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP');
alter table players drop constraint if exists players_role_check;
alter table players add constraint players_role_check check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', 'COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD'));

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  game_id text not null,
  region text not null default 'EUROPE',
  opponent text,
  result text check (result in ('Victoire', 'Défaite', 'Analyse')),
  side text check (side in ('Blue Side', 'Red Side')),
  duration_seconds integer,
  duration text,
  patch text,
  objective_score text,
  vision_score text,
  impact_score text,
  primary_focus text,
  main_issue text,
  created_by uuid references users(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(team_id, game_id)
);

create table if not exists match_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  name text not null,
  color text not null default 'cyan',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table matches add column if not exists category_id uuid references match_categories(id) on delete set null;
alter table matches add column if not exists category_ids jsonb not null default '[]'::jsonb;
alter table matches add column if not exists review_status text not null default 'todo';
alter table matches add column if not exists reviewed_at timestamptz;
alter table matches add column if not exists reviewed_by uuid references users(id) on delete set null;
update matches set category_ids = jsonb_build_array(category_id) where category_id is not null and (category_ids is null or category_ids = '[]'::jsonb);

create table if not exists match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  team_key text not null check (team_key in ('ALLY', 'ENEMY')),
  summoner_name text,
  riot_id text,
  champion text not null,
  role text,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  cs integer not null default 0,
  gold integer not null default 0,
  damage integer not null default 0,
  damage_to_turrets integer not null default 0,
  vision integer not null default 0,
  kp numeric,
  kda text,
  cs_per_min numeric,
  gold_per_min numeric,
  kill_participation text,
  grade text,
  raw jsonb not null default '{}'::jsonb
);

create table if not exists match_raw_archives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  game_id text not null,
  source text not null default 'import',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(team_id, game_id)
);

create table if not exists match_archives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  name text not null,
  description text,
  match_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists champion_pool (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  player_name text not null,
  champion text not null,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  winrate numeric not null default 0,
  kda numeric not null default 0,
  cs_per_min numeric not null default 0,
  impact_grade text not null default '—',
  verdict text not null default 'Données insuffisantes',
  updated_at timestamptz not null default now(),
  unique(team_id, player_id, champion)
);

create table if not exists improvements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  rank integer not null,
  title text not null,
  severity text not null default 'medium',
  proof text not null,
  action text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  match_ids jsonb not null default '[]'::jsonb,
  created_by uuid references users(id) on delete set null,
  -- Human saves use manual; legacy V3 data is classified by 20260929_report_source_v3.sql.
  source text not null default 'manual' check (source in ('manual', 'auto')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_reports_auto_match on reports(team_id, match_id) where source = 'auto';

create table if not exists composition_types (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  title text not null,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  slots jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_availability (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  week_start date not null default date_trunc('week', current_date)::date,
  slots jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, player_id, week_start)
);

create table if not exists player_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  title text not null,
  metric text not null,
  operator text not null default 'gte',
  target_value numeric not null,
  sample_size integer not null default 3,
  required_successes integer not null default 2,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  id serial primary key,
  ip text not null,
  endpoint text not null,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_token_hash on sessions(token_hash);
create index if not exists idx_teams_owner on teams(owner_id);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_players_team on players(team_id);
create index if not exists idx_matches_team on matches(team_id, created_at desc);
create index if not exists idx_matches_team_review_status on matches(team_id, review_status, created_at desc);
create unique index if not exists idx_match_categories_team_name on match_categories(team_id, lower(name));
create index if not exists idx_match_categories_team on match_categories(team_id, created_at asc);
create index if not exists idx_matches_category on matches(category_id);
create index if not exists idx_participants_match on match_participants(match_id);
create index if not exists idx_match_raw_archives_team on match_raw_archives(team_id, created_at desc);
create index if not exists idx_match_archives_team on match_archives(team_id, created_at desc);
alter table champion_pool add column if not exists role text;
alter table champion_pool add column if not exists status text not null default 'work';
alter table champion_pool add column if not exists notes text;
alter table champion_pool add column if not exists source text not null default 'riot';

create index if not exists idx_champion_pool_team on champion_pool(team_id);
create index if not exists idx_improvements_team on improvements(team_id, rank asc);
create index if not exists idx_reports_team on reports(team_id, created_at desc);
create index if not exists idx_rate_limits_ip_endpoint on rate_limits(ip, endpoint, created_at);
alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb;
alter table reports add column if not exists created_by uuid references users(id) on delete set null;
alter table matches add column if not exists created_by uuid references users(id) on delete set null;
alter table matches add column if not exists category_id uuid references match_categories(id) on delete set null;
alter table matches add column if not exists category_ids jsonb not null default '[]'::jsonb;
update matches set category_ids = jsonb_build_array(category_id) where category_id is not null and (category_ids is null or category_ids = '[]'::jsonb);
alter table reports add column if not exists updated_at timestamptz not null default now();
alter table users add column if not exists updated_at timestamptz not null default now();
alter table users add column if not exists notif_match boolean default true;
alter table users add column if not exists notif_report boolean default true;
alter table users add column if not exists email_verified boolean default false;
alter table users add column if not exists email_verify_token text default null;
alter table users add column if not exists email_verify_expires_at timestamptz default null;
alter table composition_types add column if not exists tags jsonb not null default '[]'::jsonb;
alter table player_availability add column if not exists week_start date not null default date_trunc('week', current_date)::date;
alter table player_availability drop constraint if exists player_availability_team_id_player_id_key;
create index if not exists idx_composition_types_team on composition_types(team_id, created_at desc);
create index if not exists idx_player_availability_team on player_availability(team_id);
create unique index if not exists idx_player_availability_week on player_availability(team_id, player_id, week_start);
create index if not exists idx_player_goals_team_player on player_goals(team_id, player_id, status, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_teams_updated_at on teams;
create trigger trg_teams_updated_at before update on teams
for each row execute function set_updated_at();

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at before update on players
for each row execute function set_updated_at();

drop trigger if exists trg_composition_types_updated_at on composition_types;
create trigger trg_composition_types_updated_at before update on composition_types
for each row execute function set_updated_at();

drop trigger if exists trg_player_availability_updated_at on player_availability;
create trigger trg_player_availability_updated_at before update on player_availability
for each row execute function set_updated_at();

drop trigger if exists trg_reports_updated_at on reports;
create trigger trg_reports_updated_at before update on reports
for each row execute function set_updated_at();

drop trigger if exists trg_match_archives_updated_at on match_archives;
create trigger trg_match_archives_updated_at before update on match_archives
for each row execute function set_updated_at();

-- player_matchup_notebooks is installed by 20260915_player_matchups.sql.
-- Full migrations create this backup table even when applying this baseline first.
do $$ begin
  if to_regclass('player_matchup_notebooks') is not null then
    create table if not exists player_matchup_canonical_backups (
      original_id uuid primary key,
      notebook_id uuid not null references player_matchup_notebooks(id) on delete cascade,
      team_id uuid not null references teams(id) on delete cascade,
      original jsonb not null,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

alter table users add column if not exists suspended_at timestamptz;
-- All session issuers serialize against suspension, including social sign-in.
create or replace function enforce_active_session_account() returns trigger language plpgsql as $$
declare blocked timestamptz;
begin
  select suspended_at into blocked from users where id=new.user_id for update;
  if blocked is not null then raise exception 'Compte suspendu.' using errcode='42501'; end if;
  return new;
end $$;
drop trigger if exists sessions_active_account on sessions;
create trigger sessions_active_account before insert on sessions for each row execute function enforce_active_session_account();

-- Separate league intake. Optional NXT5 team mapping grants read access; no publications.
create table if not exists nexus_fixtures (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  team_a text not null,
  team_b text not null,
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  platform text not null check (platform = 'EUW1'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  roster jsonb not null check (jsonb_typeof(roster) = 'array' and jsonb_array_length(roster) = 10),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '48 hours')
);

create table if not exists nexus_import_pairings (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references nexus_fixtures(id) on delete cascade,
  uploader_riot_id text not null,
  code_hash text unique,
  code_expires_at timestamptz not null,
  token_hash text unique,
  connected_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nexus_import_pairings_fixture on nexus_import_pairings(fixture_id);

create table if not exists nexus_submissions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references nexus_fixtures(id) on delete cascade,
  pairing_id uuid not null references nexus_import_pairings(id) on delete cascade,
  game_id text not null,
  idempotency_key text not null,
  payload_hash text not null,
  payload jsonb not null,
  summary jsonb not null,
  source text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'accepted', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pairing_id, game_id),
  unique (pairing_id, idempotency_key)
);
create index if not exists nexus_submissions_fixture on nexus_submissions(fixture_id, created_at);
-- Only one contribution can be the reviewed source of a public game result.
create unique index if not exists nexus_submissions_accepted_game on nexus_submissions(fixture_id, game_id) where status = 'accepted';

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
  team_id uuid not null references teams(id) on delete cascade,
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
  stage = 'legacy' or (season_id is not null and fixture_key is not null and (team_a_id is null or team_b_id is null or team_a_id <> team_b_id))
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

-- Scrim finder: a team publishes a slot, another team answers, the staff of the
-- offering team confirms one answer. Both teams then own a planning session.
create table if not exists scrim_offers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 120 check (duration_minutes between 30 and 360),
  games integer not null default 3 check (games between 1 and 10),
  level_min text not null check (level_min in ('iron','bronze','silver','gold','platinum','emerald','diamond','master')),
  level_max text not null check (level_max in ('iron','bronze','silver','gold','platinum','emerald','diamond','master')),
  note text not null default '' check (length(note) <= 500),
  status text not null default 'open' check (status in ('open','matched','cancelled')),
  matched_team_id uuid references teams(id) on delete set null,
  matched_request_id uuid,
  matched_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scrim_offers_open on scrim_offers(starts_at) where status = 'open';
create index if not exists scrim_offers_team on scrim_offers(team_id, starts_at);

create table if not exists scrim_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references scrim_offers(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  message text not null default '' check (length(message) <= 300),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, team_id)
);
create index if not exists scrim_requests_team on scrim_requests(team_id, created_at);
