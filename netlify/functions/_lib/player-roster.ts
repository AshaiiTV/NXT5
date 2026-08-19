import { sql } from './db';

export const PLAYER_ROSTER_STATUSES = ['MAIN', 'SUB', 'INACTIVE'] as const;
export type PlayerRosterStatus = (typeof PLAYER_ROSTER_STATUSES)[number];

export function isPlayerRosterStatus(value: unknown): value is PlayerRosterStatus {
  return PLAYER_ROSTER_STATUSES.includes(String(value || '').trim().toUpperCase() as PlayerRosterStatus);
}

export function normalizePlayerRosterStatus(value: unknown, fallback: PlayerRosterStatus = 'MAIN'): PlayerRosterStatus {
  const normalized = String(value || '').trim().toUpperCase();
  return isPlayerRosterStatus(normalized) ? normalized as PlayerRosterStatus : fallback;
}

export async function ensurePlayerRosterSchema() {
  await sql`alter table players add column if not exists roster_status text`;
  await sql`
    with ranked as (
      select
        id,
        role,
        row_number() over (partition by team_id, role order by created_at asc, id asc) as role_rank
      from players
      where roster_status is null
    )
    update players
    set roster_status = case
      when ranked.role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP') and ranked.role_rank = 1 then 'MAIN'
      when ranked.role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB') then 'SUB'
      else 'INACTIVE'
    end
    from ranked
    where players.id = ranked.id
  `;
  await sql`alter table players alter column roster_status set default 'MAIN'`;
  await sql`alter table players alter column roster_status set not null`;
  await sql`
    with duplicate_mains as (
      select
        id,
        row_number() over (partition by team_id, role order by created_at asc, id asc) as main_rank
      from players
      where roster_status = 'MAIN'
        and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP')
    )
    update players
    set roster_status = 'SUB', updated_at = now()
    from duplicate_mains
    where players.id = duplicate_mains.id
      and duplicate_mains.main_rank > 1
  `;
  await sql`alter table players drop constraint if exists players_roster_status_check`;
  await sql`
    alter table players add constraint players_roster_status_check
    check (roster_status in ('MAIN', 'SUB', 'INACTIVE'))
  `;
  await sql`create index if not exists idx_players_team_roster_status on players(team_id, roster_status, role)`;
  await sql`
    create unique index if not exists idx_players_one_main_per_role
    on players(team_id, role)
    where roster_status = 'MAIN'
      and role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP')
  `;
}
