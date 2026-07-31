import { sql } from './db';

export async function ensureReportsSchema() {
  await sql`
    create table if not exists reports (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      match_id uuid references matches(id) on delete set null,
      match_ids jsonb not null default '[]'::jsonb,
      created_by uuid references users(id) on delete set null,
      title text not null,
      content text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table reports add column if not exists match_id uuid references matches(id) on delete set null`;
  await sql`alter table reports add column if not exists match_ids jsonb not null default '[]'::jsonb`;
  await sql`alter table reports add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`alter table reports add column if not exists updated_at timestamptz not null default now()`;
  await sql`create index if not exists idx_reports_team on reports(team_id, created_at desc)`;
}

export async function ensureCompositionTypesSchema() {
  await sql`
    create table if not exists composition_types (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      created_by uuid references users(id) on delete set null,
      title text not null,
      notes text,
      tags jsonb not null default '[]'::jsonb,
      slots jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table composition_types add column if not exists created_by uuid references users(id) on delete set null`;
  await sql`alter table composition_types add column if not exists notes text`;
  await sql`alter table composition_types add column if not exists tags jsonb not null default '[]'::jsonb`;
  await sql`alter table composition_types add column if not exists slots jsonb not null default '{}'::jsonb`;
  await sql`alter table composition_types add column if not exists updated_at timestamptz not null default now()`;
  await sql`create index if not exists idx_composition_types_team on composition_types(team_id, created_at desc)`;
}

export async function ensureAuditLogsSchema() {
  await sql`
    create table if not exists audit_logs (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete set null,
      action text not null,
      entity_type text,
      entity_id uuid,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
}

export async function ensureWorkflowSchema() {
  await sql`alter table matches add column if not exists review_status text not null default 'todo'`;
  await sql`alter table matches add column if not exists reviewed_at timestamptz`;
  await sql`alter table matches add column if not exists reviewed_by uuid references users(id) on delete set null`;
  await sql`create index if not exists idx_matches_team_review_status on matches(team_id, review_status, created_at desc)`;

  await sql`
    create table if not exists player_goals (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      player_id uuid not null references players(id) on delete cascade,
      created_by uuid references users(id) on delete set null,
      title text not null,
      metric text not null,
      operator text not null default 'gte',
      target_value numeric not null,
      sample_size integer not null default 3,
      required_successes integer not null default 2,
      status text not null default 'active',
      starts_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists idx_player_goals_team_player on player_goals(team_id, player_id, status, created_at desc)`;
}
