-- Commercial validation only: no account access, billing or subscription changes.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 160 and email = lower(trim(email))),
  team_name text not null check (char_length(team_name) between 2 and 100),
  team_key text not null check (char_length(team_key) between 2 and 100 and team_key = lower(trim(team_key))),
  role text not null check (role in ('captain', 'manager', 'coach', 'player', 'other')),
  plan_code text not null check (plan_code in ('free', 'team_monthly', 'team_season')),
  payer text not null check (payer in ('self', 'team', 'association', 'unknown')),
  purchase_intent text not null check (purchase_intent in ('yes', 'maybe', 'discover')),
  message text not null default '' check (char_length(message) <= 2000),
  consent_version text not null,
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'declined')),
  admin_note text not null default '' check (char_length(admin_note) <= 4000),
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email, team_key)
);

create index if not exists idx_access_requests_created on access_requests(created_at desc, id desc);
create index if not exists idx_access_requests_status_created on access_requests(status, created_at desc, id desc);
