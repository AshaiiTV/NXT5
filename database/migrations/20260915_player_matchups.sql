-- This composite key prevents linking a notebook to a profile from another team.
create unique index players_team_id_id_matchups_key on players (team_id, id);

create table player_matchup_notebooks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null,
  champion text not null check (champion ~ '^[a-z0-9]{1,80}$'),
  opponent_champion text not null check (opponent_champion ~ '^[a-z0-9]{1,80}$'),
  role text not null check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP')),
  plan jsonb not null default '{"lanePlan":"","vigilance":"","toKeep":""}'::jsonb,
  experiments jsonb not null default '[]'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, player_id) references players(team_id, id) on delete cascade,
  unique (team_id, player_id, champion, opponent_champion, role),
  check (
    jsonb_typeof(plan) = 'object'
    and plan ?& array['lanePlan', 'vigilance', 'toKeep']
    and plan - array['lanePlan', 'vigilance', 'toKeep'] = '{}'::jsonb
    and jsonb_typeof(plan->'lanePlan') = 'string' and length(plan->>'lanePlan') <= 4000
    and jsonb_typeof(plan->'vigilance') = 'string' and length(plan->>'vigilance') <= 4000
    and jsonb_typeof(plan->'toKeep') = 'string' and length(plan->>'toKeep') <= 4000
  ),
  check (jsonb_typeof(experiments) = 'array' and jsonb_array_length(experiments) <= 20)
);

create index player_matchup_notebooks_profile_idx on player_matchup_notebooks (team_id, player_id, champion, updated_at desc);
