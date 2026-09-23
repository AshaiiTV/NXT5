-- Team-scoped bot workflows; no existing connection is activated and no history is queued.
create table discord_bot_settings (
  team_id uuid primary key references teams(id) on delete cascade,
  timezone text not null default 'Europe/Paris',
  channels jsonb not null default '{}'::jsonb check(jsonb_typeof(channels)='object'),
  reminders_enabled boolean not null default false,
  reminder_minutes integer not null default 30 check(reminder_minutes between 0 and 10080),
  weekly_enabled boolean not null default false,
  weekly_day integer not null default 1 check(weekly_day between 0 and 6),
  weekly_hour text not null default '18:00' check(weekly_hour ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at timestamptz not null default now()
);
create table discord_team_events (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  title text not null, event_type text not null check(event_type in ('scrim','match','review')),
  starts_at timestamptz not null, duration_minutes integer not null check(duration_minutes between 1 and 1440),
  details text not null default '', status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
  cancellation_reason text, created_by uuid references users(id) on delete set null,
  revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,team_id)
);
create index discord_team_events_due on discord_team_events(team_id,starts_at) where status='scheduled';
create table discord_event_responses (
  event_id uuid not null references discord_team_events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check(status in ('present','absent','retard')),
  delay_minutes integer not null default 0 check(delay_minutes between 0 and 1440),
  updated_at timestamptz not null default now(), primary key(event_id,user_id)
);
create table discord_team_goals (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade, title text not null,
  status text not null default 'active' check(status in ('active','completed')), due_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,team_id)
);
create table discord_goal_updates (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  goal_id uuid not null, user_id uuid references users(id) on delete set null,
  note text not null, created_at timestamptz not null default now(),
  foreign key(goal_id,team_id) references discord_team_goals(id,team_id) on delete cascade
);
create table discord_draft_notes (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  event_id uuid not null, author_id uuid references users(id) on delete set null,
  note text not null, created_at timestamptz not null default now(),
  foreign key(event_id,team_id) references discord_team_events(id,team_id) on delete cascade
);
create table discord_player_goal_updates (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  goal_id uuid not null references player_goals(id) on delete cascade, user_id uuid references users(id) on delete set null,
  note text not null, created_at timestamptz not null default now()
);
alter table reports add column discord_status text not null default 'published' check(discord_status in ('draft','published'));
alter table reports add column discord_version integer not null default 1;
alter table reports add column discord_summary text not null default '';
alter table reports add column discord_summary_stale boolean not null default false;
alter table reports add constraint reports_discord_team_identity unique(id,team_id);
create function nxt5_report_discord_version() returns trigger language plpgsql as $$
begin
  if row(old.title,old.content) is distinct from row(new.title,new.content)
    and old.discord_summary is not distinct from new.discord_summary then
    new.discord_summary_stale := true;
  end if;
  if row(old.title,old.content,old.discord_summary) is distinct from row(new.title,new.content,new.discord_summary) then
    new.discord_version := old.discord_version + 1;
  end if;
  return new;
end $$;
create trigger reports_discord_version before update on reports for each row execute function nxt5_report_discord_version();
create table discord_review_reads (
  team_id uuid not null references teams(id) on delete cascade, report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade, report_version integer not null,
  read_at timestamptz not null default now(), primary key(report_id,user_id,report_version),
  foreign key(report_id,team_id) references reports(id,team_id) on delete cascade
);
create table discord_review_recipients (
  team_id uuid not null references teams(id) on delete cascade, report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade, report_version integer not null,
  primary key(report_id,user_id,report_version),
  foreign key(report_id,team_id) references reports(id,team_id) on delete cascade
);
create table discord_bot_outbox (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references teams(id) on delete cascade,
  guild_id text not null, channel_id text not null, channel_kind text not null,
  kind text not null check(kind in ('reminder','weekly','review','presence','event_update')),
  dedupe_key text not null unique, payload jsonb not null default '{}'::jsonb,
  schedule_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(schedule_snapshot)='object'),
  expires_at timestamptz,
  event_id uuid references discord_team_events(id) on delete cascade, event_revision integer,
  report_id uuid references reports(id) on delete cascade, report_version integer,
  config_version bigint not null, state text not null default 'queued' check(state in ('queued','sending','sent','uncertain','cancelled','failed')),
  attempts integer not null default 0, available_at timestamptz not null default now(),
  message_id text, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(event_id,team_id) references discord_team_events(id,team_id) on delete cascade,
  foreign key(report_id,team_id) references reports(id,team_id) on delete cascade
);
create index discord_bot_outbox_due on discord_bot_outbox(available_at) where state='queued';
create index discord_bot_outbox_reconcile on discord_bot_outbox(available_at) where state='uncertain';
create index discord_bot_outbox_retired on discord_bot_outbox(updated_at) where state in ('sent','cancelled','failed');
