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
