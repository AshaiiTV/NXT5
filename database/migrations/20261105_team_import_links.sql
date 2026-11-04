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
