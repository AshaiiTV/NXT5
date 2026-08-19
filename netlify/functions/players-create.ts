import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensurePlayerRosterSchema, isPlayerRosterStatus, type PlayerRosterStatus } from './_lib/player-roster';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', ...STAFF_ROLES]);
const LANE_ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);
const MANAGE_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];

async function ensurePlayerRoleConstraint() {
  await sql`alter table players drop constraint if exists players_role_check`;
  await sql`
    alter table players add constraint players_role_check
    check (role in ('TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', 'COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD'))
  `;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const name = String(body.name || '').trim();
    let riotId = String(body.riotId || '').trim() || null;
    let opggUrl = String(body.opggUrl || '').trim() || null;
    const role = String(body.role || '').trim().toUpperCase();
    const staffRole = STAFF_ROLES.has(role);
    const requestedRosterStatus = String(body.rosterStatus || '').trim().toUpperCase();

    if (!teamId || !name) throw Object.assign(new Error('Team et nom requis.'), { status: 400 });
    if (!ROLES.has(role)) throw Object.assign(new Error('Rôle invalide.'), { status: 400 });
    if (requestedRosterStatus && !isPlayerRosterStatus(requestedRosterStatus)) throw Object.assign(new Error('Statut d’effectif invalide.'), { status: 400 });
    if (!staffRole && !riotId) throw Object.assign(new Error('Riot ID requis pour un joueur.'), { status: 400 });
    if (staffRole) {
      riotId = null;
      opggUrl = null;
    }

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = any(${MANAGE_ROLES}))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut ajouter un profil.'), { status: 403 });

    await ensurePlayerRoleConstraint();
    await ensurePlayerRosterSchema();

    let rosterStatus: PlayerRosterStatus;
    if (staffRole) {
      rosterStatus = 'INACTIVE';
    } else if (role === 'SUB') {
      rosterStatus = 'SUB';
    } else if (requestedRosterStatus) {
      rosterStatus = requestedRosterStatus as PlayerRosterStatus;
    } else {
      const currentMain = await sql`
        select id
        from players
        where team_id = ${teamId}
          and role = ${role}
          and roster_status = 'MAIN'
        limit 1
      `;
      rosterStatus = currentMain[0] ? 'SUB' : 'MAIN';
    }

    const promotingToMain = rosterStatus === 'MAIN' && LANE_ROLES.has(role);
    const insertStatus: PlayerRosterStatus = promotingToMain ? 'SUB' : rosterStatus;

    const inserted = await sql`
      insert into players (team_id, name, riot_id, opgg_url, role, roster_status)
      values (${teamId}, ${name}, ${riotId}, ${opggUrl}, ${role}, ${insertStatus})
      returning *
    `;
    let player = inserted[0];

    if (promotingToMain) {
      await sql`
        update players
        set roster_status = 'SUB', updated_at = now()
        where team_id = ${teamId}
          and role = ${role}
          and id <> ${player.id}
          and roster_status = 'MAIN'
      `;
      const promoted = await sql`
        update players
        set roster_status = 'MAIN', updated_at = now()
        where id = ${player.id}
          and team_id = ${teamId}
        returning *
      `;
      player = promoted[0];
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.create', 'player', ${player.id}, ${JSON.stringify({ teamId, riotId, role, rosterStatus })}::jsonb)
    `;

    return json({ player });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Ce Riot ID existe déjà dans cette team.';
    return handleError(err);
  }
}
