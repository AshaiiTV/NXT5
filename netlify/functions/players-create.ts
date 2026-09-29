import { randomUUID } from 'node:crypto';
import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensurePlayerRosterSchema, isPlayerRosterStatus } from './_lib/player-roster';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB', ...STAFF_ROLES]);
const LANE_ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);
const MANAGE_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];

async function ensurePlayerRoleConstraint() {
  await assertSchemaReady();
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

    const automatic = !staffRole && role !== 'SUB' && !requestedRosterStatus;
    const rosterStatus = staffRole ? 'INACTIVE' : role === 'SUB' ? 'SUB' : requestedRosterStatus || 'MAIN';
    const promotingToMain = !automatic && rosterStatus === 'MAIN' && LANE_ROLES.has(role);
    const playerId = randomUUID();
    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
         where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
           select 1 from team_members where team_id = t.id and user_id = ${user.id} and role = any(${MANAGE_ROLES})))`,
      ...(promotingToMain ? [tx`update players set roster_status = 'SUB', updated_at = now()
         where team_id = ${teamId} and role = ${role} and roster_status = 'MAIN'`] : []),
      tx`insert into players (id, team_id, name, riot_id, opgg_url, role, roster_status)
         values (${playerId}, ${teamId}, ${name}, ${riotId}, ${opggUrl}, ${role},
           case when ${automatic} and exists (select 1 from players where team_id = ${teamId} and role = ${role} and roster_status = 'MAIN')
             then 'SUB' else ${rosterStatus} end)`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         select ${user.id}, 'player.create', 'player', id,
           jsonb_build_object('teamId', team_id, 'riotId', riot_id, 'role', role, 'rosterStatus', roster_status)
         from players where id = ${playerId}`,
      tx`select * from players where id = ${playerId}`
    ]);
    const player = results[results.length - 1][0];

    return json({ player });
  } catch (err) {
    if (err.constraint === 'idx_players_one_main_per_role') {
      err.status = 409;
      err.message = 'Un titulaire occupe déjà ce poste. Recharge l’équipe puis réessaie.';
    } else if (err.code === '23505') {
      err.status = 409;
      err.code = 'PLAYER_RIOT_ID_EXISTS';
      err.message = 'Ce Riot ID existe déjà dans cette team.';
    } else if (err.code === '22012') {
      err.status = 409;
      err.message = 'Les accès ont changé. Recharge l’équipe puis réessaie.';
    }
    return handleError(err);
  }
}
