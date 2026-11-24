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
-- Changement d'adresse en attente de confirmation (20261123_email_change_confirmation.sql).
alter table users add column if not exists pending_email text default null;
alter table users add column if not exists pending_email_token text default null;
alter table users add column if not exists pending_email_expires_at timestamptz default null;
create index if not exists idx_users_pending_email_token
  on users(pending_email_token) where pending_email_token is not null;
-- Préférences de notification par user.
alter table users add column if not exists notif_match boolean default true;
alter table users add column if not exists notif_report boolean default true;
-- Suppression de compte : la ligne est conservée, anonymisée et datée
-- (20261124_account_deletion.sql). Ne jamais supprimer un compte par DELETE.
alter table users add column if not exists deleted_at timestamptz;

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
  is_team_note boolean not null default false,
  original_debrief jsonb,
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
create index if not exists idx_matches_team_recent on matches(team_id, created_at desc, id desc);
drop index if exists idx_matches_team;
create index if not exists idx_matches_created_at on matches(created_at);
create index if not exists idx_matches_team_review_status on matches(team_id, review_status, created_at desc);
create unique index if not exists idx_match_categories_team_name on match_categories(team_id, lower(name));
create index if not exists idx_match_categories_team on match_categories(team_id, created_at asc);
create index if not exists idx_matches_category on matches(category_id);
create index if not exists idx_participants_match on match_participants(match_id);
create index if not exists idx_participants_player on match_participants(player_id) where player_id is not null;
create index if not exists idx_match_raw_archives_team on match_raw_archives(team_id, created_at desc);
create index if not exists idx_match_raw_archives_match on match_raw_archives(match_id);
create index if not exists idx_match_archives_team on match_archives(team_id, created_at desc);
alter table champion_pool add column if not exists role text;
alter table champion_pool add column if not exists status text not null default 'work';
alter table champion_pool add column if not exists notes text;
alter table champion_pool add column if not exists source text not null default 'riot';

create index if not exists idx_champion_pool_team on champion_pool(team_id);
create index if not exists idx_improvements_team on improvements(team_id, rank asc);
create index if not exists idx_reports_team on reports(team_id, created_at desc);
create index if not exists idx_reports_match on reports(match_id) where match_id is not null;
create index if not exists idx_rate_limits_ip_endpoint on rate_limits(ip, endpoint, created_at);
alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb;
alter table reports add column if not exists created_by uuid references users(id) on delete set null;
alter table matches add column if not exists created_by uuid references users(id) on delete set null;
alter table matches add column if not exists category_id uuid references match_categories(id) on delete set null;
alter table matches add column if not exists category_ids jsonb not null default '[]'::jsonb;
update matches set category_ids = jsonb_build_array(category_id) where category_id is not null and (category_ids is null or category_ids = '[]'::jsonb);

-- Played date from raw (20261123_query_performance.sql): Discord reads filter
-- and sort by coalesce(nxt5_match_started_at(raw), created_at) through this index.
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
create index if not exists idx_matches_team_played
  on matches(team_id, (coalesce(nxt5_match_started_at(raw), created_at)) desc, id desc);
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
  tie_breakers jsonb not null default '[]'::jsonb constraint nexus_seasons_tie_breakers_check check (jsonb_typeof(tie_breakers) = 'array' and jsonb_array_length(tie_breakers) <= 4 and tie_breakers <@ '["headToHead","gameDifference","seriesWon","gamesWon"]'::jsonb),
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
  series text not null default 'fixed' check (series in ('fixed','bo3','bo5')),
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

-- Automatic imports: a team links NXT5 Importer once (single-use code, then a
-- revocable token); each custom observed by the desktop app is submitted here.
create table if not exists team_import_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  label text not null default '' check (length(label) <= 80),
  category_id uuid references match_categories(id) on delete set null,
  code_hash text unique,
  code_expires_at timestamptz not null,
  token_hash text unique,
  connected_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_import_links_team on team_import_links(team_id, created_at desc);

create table if not exists team_import_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  link_id uuid not null references team_import_links(id) on delete cascade,
  game_id text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('receiving','imported','pending','skipped')),
  reason text not null default '' check (length(reason) <= 300),
  match_id uuid references matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, game_id),
  unique (link_id, idempotency_key)
);
create index if not exists team_import_submissions_team on team_import_submissions(team_id, created_at desc);

create table if not exists draft_rooms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  creation_key uuid not null,
  ally_side text not null check (ally_side in ('blue','red')),
  blue_name text not null check (length(blue_name) between 1 and 80),
  red_name text not null check (length(red_name) between 1 and 80),
  moves jsonb not null default '[]' check (jsonb_typeof(moves) = 'array' and jsonb_array_length(moves) <= 20),
  created_at timestamptz not null default now(),
  unique(team_id, creation_key)
);
create index if not exists draft_rooms_team_recent on draft_rooms(team_id, created_at desc);
alter table draft_rooms
  add column if not exists series_root uuid references draft_rooms(id) on delete cascade,
  add column if not exists game_number smallint not null default 1 check (game_number between 1 and 5),
  add column if not exists series_length smallint not null default 1 check (series_length between 1 and 5),
  add column if not exists draft_mode text not null default 'standard' check (draft_mode in ('standard','fearless')),
  add column if not exists turn_seconds smallint not null default 0 check (turn_seconds in (0,30,60)),
  add column if not exists turn_started_at timestamptz,
  add column if not exists first_pick text not null default 'blue' check (first_pick in ('blue','red'));
create unique index if not exists draft_rooms_series_game on draft_rooms(series_root, game_number);
alter table draft_rooms
  add column if not exists host_ready_at timestamptz,
  add column if not exists guest_ready_at timestamptz;

-- ---------------------------------------------------------------------------
-- Suppression de compte en libre-service (20261124_account_deletion.sql,
-- account-deletion-20261124-v1), reprise ici sous forme rejouable. La migration
-- reste la source appliquée en production ; ce bloc tient la référence à jour.
-- Les déclencheurs ne sont posés que sur les tables présentes dans ce schéma.
-- Toute future instruction « update users » doit filtrer « deleted_at is null » :
-- un compte supprimé est immuable (trg_deleted_account_immutable).
-- ---------------------------------------------------------------------------

-- Parcours social « reauth » (tables créées par 20260923_social_auth.sql,
-- absentes de ce schéma de référence partiel : bloc ignoré si elles manquent).
do $$
declare item record;
begin
  if to_regclass('social_auth_flows') is null or to_regclass('social_auth_tickets') is null then return; end if;
  for item in select conrelid::regclass as table_name, conname from pg_constraint
    where conrelid in ('social_auth_flows'::regclass, 'social_auth_tickets'::regclass)
      and contype = 'c' and pg_get_constraintdef(oid) like '%flow%'
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;
  alter table social_auth_flows add constraint social_auth_flows_flow_check
    check (flow in ('login', 'register', 'link', 'reauth'));
  alter table social_auth_flows add constraint social_auth_flows_check check (
    (flow in ('link', 'reauth') and user_id is not null and session_hash is not null and link_revision is not null)
    or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null));
  alter table social_auth_tickets add constraint social_auth_tickets_flow_check
    check (flow in ('login', 'register', 'link', 'reauth'));
  alter table social_auth_tickets add constraint social_auth_tickets_check check (
    (flow in ('link', 'reauth') and user_id is not null and session_hash is not null and link_revision is not null and purpose = 'callback')
    or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null));
end $$;

-- Preuve de reconnexion valable dix minutes pour une seule session.
create table if not exists account_reauthentications (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'discord', 'apple', 'riot')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create index if not exists idx_account_reauthentications_user on account_reauthentications(user_id);
create index if not exists idx_account_reauthentications_expiry on account_reauthentications(expires_at);

-- Première confirmation : choix pour chaque équipe possédée, lié à la session.
create table if not exists account_deletion_confirmations (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null check (session_hash ~ '^[0-9a-f]{64}$'),
  team_plan jsonb not null check (jsonb_typeof(team_plan) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index if not exists idx_account_deletion_confirmations_user on account_deletion_confirmations(user_id);
create index if not exists idx_account_deletion_confirmations_expiry on account_deletion_confirmations(expires_at);

-- Les reçus contiennent des nombres, jamais l'identifiant, le nom, l'e-mail ou la session.
create table if not exists account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz not null default now(),
  summary jsonb not null
);
create index if not exists idx_account_deletion_receipts_completed on account_deletion_receipts(completed_at);

-- Un retrait de référence d'auteur n'est pas une modification du contenu :
-- la suppression de compte conserve les dates de modification des équipes.
create or replace function set_updated_at()
returns trigger as $$
begin
  if coalesce(current_setting('nxt5.preserve_updated_at', true), '') = 'on' then
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Un compte supprimé ne peut plus être modifié ni réactivé.
create or replace function nxt5_deleted_account_immutable() returns trigger language plpgsql as $$
begin
  if old.deleted_at is not null then
    raise exception 'ACCOUNT_DELETED' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_deleted_account_immutable on users;
create trigger trg_deleted_account_immutable before update on users
  for each row execute function nxt5_deleted_account_immutable();

-- Filet de sécurité : teams.owner_id est en ON DELETE CASCADE. Un DELETE
-- manuel du propriétaire d'une équipe partagée effacerait l'équipe et les
-- données des autres membres ; il est refusé. Seule la suppression décidée par
-- l'administration (admin-account-lifecycle, inventaire des équipes confirmé)
-- lève ce garde, pour sa propre transaction, avec nxt5.admin_account_delete.
create or replace function nxt5_guard_account_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('nxt5.admin_account_delete', true), '') = 'on' then
    return old;
  end if;
  if exists (select 1 from teams where teams.owner_id = old.id and exists (
    select 1 from team_members where team_members.team_id = teams.id and team_members.user_id <> old.id))
  then
    raise exception 'ACCOUNT_OWNS_SHARED_TEAM' using errcode = '23503',
      hint = 'Utiliser nxt5_delete_account : ce DELETE supprimerait les équipes partagées et les données des autres membres.';
  end if;
  return old;
end $$;
drop trigger if exists trg_guard_account_delete on users;
create trigger trg_guard_account_delete before delete on users
  for each row execute function nxt5_guard_account_delete();

-- Les liens qui donnent un accès ou rattachent une personne refusent un compte
-- supprimé, y compris une requête déjà en cours : le verrou est celui de la clé
-- étrangère, qui attend la suppression puis relit la ligne. Un compte inexistant
-- reste signalé par la clé étrangère elle-même (23503).
create or replace function nxt5_require_active_account() returns trigger language plpgsql as $$
declare
  account_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  removed_at timestamptz;
begin
  if account_id is null then return new; end if;
  select deleted_at into removed_at from users where id = account_id for key share;
  if removed_at is not null then raise exception 'ACCOUNT_DELETED' using errcode = '23514'; end if;
  return new;
end $$;

do $$
declare item record;
begin
  for item in select * from (values
    ('sessions', 'user_id'), ('password_reset_tokens', 'user_id'),
    ('social_identities', 'user_id'), ('social_auth_flows', 'user_id'), ('social_auth_tickets', 'user_id'),
    ('account_reauthentications', 'user_id'), ('account_deletion_confirmations', 'user_id'),
    ('teams', 'owner_id'), ('team_members', 'user_id'), ('players', 'user_id'),
    ('account_subscriptions', 'user_id'), ('discord_user_links', 'user_id'),
    ('discord_account_link_requests', 'user_id'), ('discord_event_responses', 'user_id'),
    ('discord_review_recipients', 'user_id'), ('discord_review_reads', 'user_id'),
    ('inactivity_reminder_pending', 'user_id'), ('inactivity_reminder_deliveries', 'user_id')
  ) as refs(table_name, column_name)
  loop
    continue when to_regclass(item.table_name) is null;
    execute format('drop trigger if exists %I on %I', 'trg_active_account_' || item.column_name, item.table_name);
    execute format('create trigger %I before insert or update of %I on %I for each row execute function nxt5_require_active_account(%L)',
      'trg_active_account_' || item.column_name, item.column_name, item.table_name, item.column_name);
  end loop;
end $$;

-- Retire d'un document JSON les valeurs texte égales (sans casse) à l'une des
-- cibles, déjà en minuscules, à toute profondeur. Les autres valeurs et la
-- structure restent intactes : une sous-chaîne (joann@x.fr pour ann@x.fr) ne
-- correspond jamais.
create or replace function nxt5_scrub_json_values(doc jsonb, targets text[]) returns jsonb
language plpgsql immutable
set search_path = pg_catalog, public, pg_temp
as $$
begin
  case jsonb_typeof(doc)
    when 'string' then
      if lower(doc #>> '{}') = any(targets) then return 'null'::jsonb; end if;
      return doc;
    when 'object' then
      return coalesce((select jsonb_object_agg(entry.key, nxt5_scrub_json_values(entry.item, targets))
        from jsonb_each(doc) as entry(key, item)), '{}'::jsonb);
    when 'array' then
      return coalesce((select jsonb_agg(nxt5_scrub_json_values(entry.item, targets) order by entry.position)
        from jsonb_array_elements(doc) with ordinality as entry(item, position)), '[]'::jsonb);
    else
      return doc;
  end case;
end $$;

create or replace function nxt5_delete_account(
  account_id uuid, expected_password_hash text, session_hash_value text, confirmation_hash text
) returns jsonb
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  account users%rowtype;
  confirmation account_deletion_confirmations%rowtype;
  team record;
  choice text;
  successor uuid;
  player_ids uuid[];
  discord_ids text[];
  affected integer;
  teams_transferred integer := 0;
  teams_deleted integer := 0;
  memberships_removed integer;
  profiles_anonymized integer;
  scrub_targets text[];
  participants_anonymized integer;
  sessions_closed integer;
  connections_removed integer;
  discord_links_removed integer;
  receipt account_deletion_receipts%rowtype;
  result_summary jsonb;
begin
  -- Le compte et les successeurs prévus sont verrouillés ensemble, dans l'ordre des
  -- identifiants, avant les équipes : même ordre que le transfert administratif
  -- (admin-team-transfer), pour qu'un transfert concurrent ne crée pas d'interblocage.
  -- Le compte seul reste le premier verrou pris quand aucun successeur n'est prévu,
  -- comme pour la connexion sociale, la dissociation et la réinitialisation.
  perform 1 from users where id = account_id or id in (
    select plan.value::uuid from account_deletion_confirmations c
      cross join lateral jsonb_each_text(c.team_plan) as plan(key, value)
      where c.token_hash = confirmation_hash and c.user_id = account_id
        and plan.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    order by id for update;
  select * into account from users where id = account_id for update;
  if not found or account.deleted_at is not null then
    raise exception 'ACCOUNT_CHANGED' using errcode = 'P0001';
  end if;
  if nullif(btrim(account.password_hash), '') is not null then
    if expected_password_hash is null or account.password_hash <> expected_password_hash then
      raise exception 'ACCOUNT_CHANGED' using errcode = 'P0001';
    end if;
  else
    -- Compte sans mot de passe : reconnexion récente, sur cette session, avec un
    -- fournisseur encore associé ET associé avant l'ouverture de la session. Une
    -- identité ajoutée depuis la session (parcours « link ») ne prouve rien.
    delete from account_reauthentications proof
      where proof.user_id = account_id and proof.session_hash = session_hash_value
        and proof.expires_at > clock_timestamp()
        and exists (select 1 from social_identities identity
          join sessions on sessions.user_id = identity.user_id and sessions.token_hash = session_hash_value
          where identity.user_id = account_id and identity.provider = proof.provider
            and identity.linked_at < sessions.created_at);
    get diagnostics affected = row_count;
    if affected = 0 then raise exception 'DELETION_REAUTH_REQUIRED' using errcode = 'P0001'; end if;
  end if;

  select * into confirmation from account_deletion_confirmations
    where token_hash = confirmation_hash and user_id = account_id
      and session_hash = session_hash_value and expires_at > clock_timestamp() for update;
  if not found or not exists (select 1 from sessions where user_id = account_id
    and token_hash = session_hash_value and revoked_at is null and expires_at > clock_timestamp()) then
    raise exception 'DELETION_CONFIRMATION_EXPIRED' using errcode = 'P0001';
  end if;

  -- teams.owner_id : transfert au membre choisi, ou suppression d'une équipe sans
  -- autre membre avec l'accord explicite de la première confirmation.
  perform 1 from teams where owner_id = account_id order by id for update;
  if (select count(*) from teams where owner_id = account_id) <>
     (select count(*) from jsonb_object_keys(confirmation.team_plan)) then
    raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
  end if;
  for team in select id, name from teams where owner_id = account_id order by id loop
    choice := confirmation.team_plan ->> team.id::text;
    if choice is null then raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001'; end if;
    perform 1 from team_members where team_id = team.id order by id for update;
    if choice = 'delete' then
      if exists (select 1 from team_members where team_id = team.id and user_id <> account_id) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      -- Même règle que la suppression d'équipe : une inscription Nexus Rising
      -- active (non rejetée, saison non terminée) bloque la suppression.
      if exists (select 1 from nexus_registrations r join nexus_seasons s on s.id = r.season_id
        where r.team_id = team.id and r.status <> 'rejected' and s.status <> 'completed') then
        raise exception 'NEXUS_TEAM_ENGAGED' using errcode = 'P0001';
      end if;
      delete from teams where id = team.id;
      teams_deleted := teams_deleted + 1;
    else
      if choice !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      successor := choice::uuid;
      if successor = account_id or not exists (select 1 from team_members
        where team_id = team.id and user_id = successor) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      -- Mêmes conditions que le transfert administratif : compte actif, non
      -- suspendu, avec une adresse vérifiée (déjà verrouillé plus haut).
      perform 1 from users where id = successor and deleted_at is null and suspended_at is null
        and email_verified is true and nullif(email, '') is not null;
      if not found then raise exception 'DELETION_SUCCESSOR_INELIGIBLE' using errcode = 'P0001'; end if;
      -- unique(owner_id, name) : le successeur ne doit pas déjà posséder une équipe de ce nom.
      if exists (select 1 from teams other where other.owner_id = successor and other.name = team.name and other.id <> team.id) then
        raise exception 'DELETION_TEAM_NAME_TAKEN' using errcode = 'P0001';
      end if;
      update teams set owner_id = successor where id = team.id;
      update team_members set role = 'captain' where team_id = team.id and user_id = successor and role <> 'owner';
      teams_transferred := teams_transferred + 1;
    end if;
  end loop;

  -- players.user_id : les profils joueur ne sont PAS supprimés. Ils appartiennent
  -- aussi à l'équipe : leur suppression effacerait en cascade les notes de coaching,
  -- objectifs, mises à jour d'objectifs Discord, carnets de matchups et
  -- disponibilités écrits par les autres membres. Chaque profil est détaché du
  -- compte et anonymisé ; le poste, le statut et les données d'équipe liées restent.
  -- Les participations gardent leur lien au profil, sans nom ni identifiant Riot.
  select coalesce(array_agg(id), '{}'::uuid[]) into player_ids from players where user_id = account_id;
  update match_participants set summoner_name = 'Joueur supprimé', riot_id = null,
    raw = case when jsonb_typeof(raw) = 'object' then raw - array['puuid', 'summonerName', 'summonerId',
      'riotIdGameName', 'riotIdTagline', 'riotIdName', 'profileIcon', 'summonerLevel'] else raw end
    where player_id = any(player_ids);
  get diagnostics participants_anonymized = row_count;
  update champion_pool set player_name = 'Joueur supprimé' where player_id = any(player_ids);
  -- riot_id nul : l'unicité (team_id, riot_id) admet plusieurs valeurs nulles.
  update players set user_id = null, name = 'Joueur supprimé', riot_id = null, opgg_url = null,
    most_played = '[]'::jsonb
    where id = any(player_ids);
  get diagnostics profiles_anonymized = row_count;

  -- Liaisons Discord : suppression (cascade sur les choix d'équipe et commandes en attente)
  -- et des traces rattachées aux mêmes identifiants Discord.
  select coalesce(array_agg(discord_user_id), '{}'::text[]) into discord_ids
    from discord_user_links where user_id = account_id;
  delete from discord_user_links where user_id = account_id;
  get diagnostics discord_links_removed = row_count;
  delete from discord_account_link_requests where user_id = account_id or discord_user_id = any(discord_ids);
  delete from discord_interaction_receipts where discord_user_id = any(discord_ids);
  delete from discord_event_responses where user_id = account_id;
  delete from discord_review_reads where user_id = account_id;
  delete from discord_review_recipients where user_id = account_id;
  delete from discord_link_codes where created_by = account_id and consumed_at is null;

  -- Accès, connexions et données propres au compte : suppression physique.
  delete from team_members where user_id = account_id;
  get diagnostics memberships_removed = row_count;
  delete from sessions where user_id = account_id;
  get diagnostics sessions_closed = row_count;
  delete from password_reset_tokens where user_id = account_id;
  delete from social_identities where user_id = account_id;
  get diagnostics connections_removed = row_count;
  delete from social_auth_flows where user_id = account_id;
  delete from social_auth_tickets where user_id = account_id;
  delete from account_reauthentications where user_id = account_id;
  delete from inactivity_reminder_pending where user_id = account_id;
  delete from inactivity_reminder_deliveries where user_id = account_id;
  delete from account_subscriptions where user_id = account_id;
  delete from account_deletion_confirmations where user_id = account_id;
  -- Seule une adresse vérifiée établit que l'ancienne demande commerciale appartient au compte.
  if account.email_verified and account.email is not null then
    delete from access_requests where lower(email) = lower(account.email);
  end if;

  -- Contenus partagés conservés, auteur retiré (référence nulle).
  perform set_config('nxt5.preserve_updated_at', 'on', true);
  update discord_link_codes set created_by = null where created_by = account_id;
  update team_invite_codes set created_by = null where created_by = account_id;
  update matches set created_by = null where created_by = account_id;
  update matches set reviewed_by = null where reviewed_by = account_id;
  update match_categories set created_by = null where created_by = account_id;
  update match_archives set created_by = null where created_by = account_id;
  update reports set created_by = null where created_by = account_id;
  update composition_types set created_by = null where created_by = account_id;
  update player_goals set created_by = null where created_by = account_id;
  update player_availability set updated_by = null where updated_by = account_id;
  update player_coaching_notes set updated_by = null where updated_by = account_id;
  update player_matchup_notebooks set updated_by = null where updated_by = account_id;
  update discord_connections set created_by = null where created_by = account_id;
  update discord_connection_tests set created_by = null where created_by = account_id;
  update discord_routes set created_by = null where created_by = account_id;
  update discord_group_exports set created_by = null where created_by = account_id;
  update discord_team_events set created_by = null where created_by = account_id;
  update discord_team_goals set created_by = null where created_by = account_id;
  update discord_draft_notes set author_id = null where author_id = account_id;
  update discord_goal_updates set user_id = null where user_id = account_id;
  update discord_player_goal_updates set user_id = null where user_id = account_id;
  update discord_community_announcements set created_by = null where created_by = account_id;
  update discord_community_settings set updated_by = null where updated_by = account_id;
  update account_subscriptions set updated_by = null where updated_by = account_id;
  update access_requests set updated_by = null where updated_by = account_id;
  -- Clés ajoutées depuis #110 (octobre et novembre 2026).
  update team_opponents set created_by = null where created_by = account_id;
  update opponent_drafts set imported_by = null where imported_by = account_id;
  update nexus_registrations set registered_by = null where registered_by = account_id;
  update scrim_offers set created_by = null where created_by = account_id;
  update scrim_requests set created_by = null where created_by = account_id;
  update team_import_links set created_by = null where created_by = account_id;
  update draft_rooms set created_by = null where created_by = account_id;
  perform set_config('nxt5.preserve_updated_at', 'off', true);

  -- Journaux : l'auteur et la cible ne sont retirés que s'ils sont ce compte. Dans
  -- les métadonnées, seules les valeurs exactement égales à son UUID, son e-mail
  -- (sans casse) ou un de ses identifiants Discord deviennent nulles ; les journaux
  -- des autres comptes gardent leur auteur et le reste de leurs métadonnées.
  -- La recherche de sous-chaîne n'est qu'un préfiltre bon marché avant le parcours exact.
  -- Valeurs vides exclues : un compte avec email = '' ne doit pas effacer les "" des autres journaux.
  scrub_targets := array_remove(array_remove(array[lower(account_id::text), lower(nullif(btrim(account.email), '')),
    lower(nullif(btrim(account.pending_email), ''))] || discord_ids, null), '');
  update audit_logs set
    user_id = case when user_id = account_id then null else user_id end,
    entity_id = case when entity_id = account_id then null else entity_id end,
    metadata = nxt5_scrub_json_values(metadata, scrub_targets)
    where user_id = account_id or entity_id = account_id
      or (exists (select 1 from unnest(scrub_targets) as target where strpos(lower(metadata::text), target) > 0)
        and nxt5_scrub_json_values(metadata, scrub_targets) is distinct from metadata);

  update users set deleted_at = now(), account_name = 'deleted-' || id::text,
    name = 'Compte supprimé', email = null, password_hash = '!deleted',
    email_verified = false, email_verify_token = null, email_verify_expires_at = null,
    pending_email = null, pending_email_token = null, pending_email_expires_at = null,
    notif_match = false, notif_report = false, notif_inactivity = false,
    inactivity_notice_pending = false, inactivity_email_sent_at = null,
    inactivity_email_claimed_at = null, legal_accepted_at = null, legal_version = null,
    social_link_revision = social_link_revision + 1
    where id = account_id;

  result_summary := jsonb_build_object('policyVersion', '2026-11-24',
    'teamsTransferred', teams_transferred, 'teamsDeleted', teams_deleted,
    'membershipsRemoved', memberships_removed, 'profilesAnonymized', profiles_anonymized,
    'participantsAnonymized', participants_anonymized, 'sessionsClosed', sessions_closed,
    'externalConnectionsRemoved', connections_removed, 'discordLinksRemoved', discord_links_removed,
    'sharedHistoryRetained', true);
  insert into account_deletion_receipts(token_hash, summary) values (confirmation_hash, result_summary)
    returning * into receipt;
  insert into audit_logs(id, action, entity_type, metadata)
    values (receipt.id, 'auth.account_deleted', 'user', result_summary);
  return jsonb_build_object('reference', receipt.id, 'completedAt', receipt.completed_at, 'summary', receipt.summary);
end;
$$;
