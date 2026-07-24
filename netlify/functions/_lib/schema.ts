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
