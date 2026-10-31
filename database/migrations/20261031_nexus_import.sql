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
