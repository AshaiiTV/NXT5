-- Consolidates runtime schema changes without deleting user categories.
-- Applied once under the deployment migration lock, together with schema.sql.

-- Previously applied at runtime by netlify/functions/_lib/analytics.ts

alter table matches add column if not exists region text not null default 'EUROPE';

alter table matches add column if not exists opponent text;

alter table matches add column if not exists result text;

alter table matches add column if not exists side text;

alter table matches add column if not exists duration_seconds integer;

alter table matches add column if not exists duration text;

alter table matches add column if not exists patch text;

alter table matches add column if not exists objective_score text;

alter table matches add column if not exists vision_score text;

alter table matches add column if not exists impact_score text;

alter table matches add column if not exists primary_focus text;

alter table matches add column if not exists main_issue text;

alter table matches add column if not exists raw jsonb not null default '{}'::jsonb;

alter table match_participants add column if not exists player_id uuid references players(id) on delete set null;

alter table match_participants add column if not exists team_key text;

alter table match_participants add column if not exists summoner_name text;

alter table match_participants add column if not exists riot_id text;

alter table match_participants add column if not exists champion text;

alter table match_participants add column if not exists role text;

alter table match_participants add column if not exists kills integer not null default 0;

alter table match_participants add column if not exists deaths integer not null default 0;

alter table match_participants add column if not exists assists integer not null default 0;

alter table match_participants add column if not exists cs integer not null default 0;

alter table match_participants add column if not exists gold integer not null default 0;

alter table match_participants add column if not exists damage integer not null default 0;

alter table match_participants add column if not exists damage_to_turrets integer not null default 0;

alter table match_participants add column if not exists vision integer not null default 0;

alter table match_participants add column if not exists kp numeric;

alter table match_participants add column if not exists kda text;

alter table match_participants add column if not exists cs_per_min numeric;

alter table match_participants add column if not exists gold_per_min numeric;

alter table match_participants add column if not exists kill_participation text;

alter table match_participants add column if not exists grade text;

alter table match_participants add column if not exists raw jsonb not null default '{}'::jsonb;

alter table reports add column if not exists match_id uuid references matches(id) on delete set null;

create index if not exists idx_matches_created_by on matches(created_by);


-- Previously applied at runtime by netlify/functions/_lib/auth.ts

alter table users add column if not exists name text not null default 'Compte NXT5';

alter table users add column if not exists password_hash text not null default '';

alter table users add column if not exists created_at timestamptz not null default now();

alter table sessions add column if not exists revoked_at timestamptz;

alter table sessions add column if not exists user_agent text;

alter table sessions add column if not exists ip text;

alter table sessions add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_sessions_token_hash on sessions(token_hash);

create index if not exists idx_sessions_user_active on sessions(user_id, expires_at desc) where revoked_at is null;

alter table users add column if not exists legal_accepted_at timestamptz;

alter table users add column if not exists legal_version text;

alter table sessions add column if not exists last_seen_at timestamptz;

create index if not exists idx_sessions_last_seen_at on sessions(last_seen_at desc);


-- Previously applied at runtime by netlify/functions/_lib/engagement.ts

alter table users add column if not exists last_active_at timestamptz;

alter table users add column if not exists inactivity_email_sent_at timestamptz;

alter table users add column if not exists inactivity_email_claimed_at timestamptz;

alter table users add column if not exists inactivity_notice_pending boolean not null default false;

alter table users add column if not exists notif_inactivity boolean not null default true;

update users
      set last_active_at = coalesce(
        (select max(coalesce(sessions.last_seen_at, sessions.created_at)) from sessions where sessions.user_id = users.id),
        users.updated_at,
        users.created_at,
        now()
      )
      where last_active_at is null;

alter table users alter column last_active_at set default now();

alter table users alter column last_active_at set not null;

create index if not exists idx_users_inactivity_reminder
      on users(last_active_at)
      where email_verified is true and notif_inactivity is true;

create table if not exists inactivity_reminder_deliveries (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id) on delete cascade,
        recipient_email text not null,
        inactive_since_at timestamptz not null,
        sent_at timestamptz not null default now(),
        unique(user_id, sent_at)
      );

create index if not exists idx_inactivity_deliveries_sent_at on inactivity_reminder_deliveries(sent_at desc);

insert into inactivity_reminder_deliveries (user_id, recipient_email, inactive_since_at, sent_at)
      select id, lower(email), last_active_at, inactivity_email_sent_at
      from users
      where inactivity_email_sent_at is not null
        and email is not null
        and email <> ''
      on conflict (user_id, sent_at) do nothing;


-- Previously applied at runtime by netlify/functions/_lib/rate-limit.ts

alter table rate_limits add column if not exists rate_key text;

alter table rate_limits add column if not exists attempts integer not null default 0;

alter table rate_limits add column if not exists window_start timestamptz not null default now();

alter table rate_limits add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_rate_limits_rate_key on rate_limits(rate_key);


-- Previously applied at runtime by netlify/functions/_lib/schema.ts

alter table composition_types add column if not exists created_by uuid references users(id) on delete set null;

alter table composition_types add column if not exists notes text;

alter table composition_types add column if not exists slots jsonb not null default '{}'::jsonb;

alter table composition_types add column if not exists updated_at timestamptz not null default now();


-- Previously applied at runtime by netlify/functions/bootstrap.ts

create table if not exists player_coaching_notes (
        id uuid primary key default gen_random_uuid(),
        team_id uuid not null references teams(id) on delete cascade,
        player_id uuid not null references players(id) on delete cascade,
        content text not null default '',
        updated_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique(team_id, player_id)
      );
