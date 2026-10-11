-- Opponents are private to a NXT5 team. A composite foreign key prevents a
-- draft from being attached to another team's opponent, even outside the API.
create table if not exists team_opponents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null check (char_length(normalized_name) between 1 and 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, normalized_name),
  unique (team_id, id)
);

create table if not exists opponent_drafts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  opponent_id uuid not null,
  ally_side text not null check (ally_side in ('blue', 'red')),
  source_id text not null check (source_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  game_number integer not null check (game_number between 1 and 99),
  source_url text not null check (char_length(source_url) <= 500),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 32768),
  imported_by uuid references users(id) on delete set null,
  imported_at timestamptz not null default now(),
  foreign key (team_id, opponent_id) references team_opponents(team_id, id) on delete cascade,
  unique (team_id, source_id, game_number)
);

create index if not exists opponent_drafts_opponent_idx on opponent_drafts(team_id, opponent_id, imported_at desc);
