-- A lease survives cold starts and concurrent Netlify instances. The token fences
-- stale workers; expiry recovers leases after a killed function invocation.
create table if not exists riot_sync_leases (
  team_id uuid primary key references teams(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);

create table if not exists player_riot_sync_state (
  player_id uuid primary key references players(id) on delete cascade,
  fingerprint text not null,
  synced_at timestamptz not null default now()
);
