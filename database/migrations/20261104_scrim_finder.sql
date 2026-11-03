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
