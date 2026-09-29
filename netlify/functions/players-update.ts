import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensurePlayerRosterSchema, isPlayerRosterStatus, normalizePlayerRosterStatus, type PlayerRosterStatus } from './_lib/player-roster';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const LANE_ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP']);

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const name = String(body.name || '').trim();
    let riotId = String(body.riotId || '').trim() || null;
    let opggUrl = String(body.opggUrl || '').trim() || null;
    const rosterStatusProvided = Object.prototype.hasOwnProperty.call(body, 'rosterStatus');
    const requestedRosterStatus = String(body.rosterStatus || '').trim().toUpperCase();

    if (!teamId || !playerId || !name) throw Object.assign(new Error('Team, profil et nom requis.'), { status: 400 });
    if (rosterStatusProvided && !isPlayerRosterStatus(requestedRosterStatus)) throw Object.assign(new Error('Statut d’effectif invalide.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut modifier un profil.'), { status: 403 });

    await ensurePlayerRosterSchema();

    const existing = await sql`
      select id, role, roster_status
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!existing[0]) throw Object.assign(new Error('Profil introuvable dans cette team.'), { status: 404 });

    const staffRole = STAFF_ROLES.has(String(existing[0].role || '').toUpperCase());
    const playerRole = String(existing[0].role || '').toUpperCase();
    let rosterStatus: PlayerRosterStatus = rosterStatusProvided
      ? requestedRosterStatus as PlayerRosterStatus
      : normalizePlayerRosterStatus(existing[0].roster_status, playerRole === 'SUB' ? 'SUB' : staffRole ? 'INACTIVE' : 'MAIN');
    if (staffRole) {
      riotId = null;
      opggUrl = null;
      rosterStatus = 'INACTIVE';
    } else if (playerRole === 'SUB') {
      rosterStatus = 'SUB';
    } else if (!riotId) {
      throw Object.assign(new Error('Riot ID requis pour un joueur.'), { status: 400 });
    }

    const promotingToMain = rosterStatus === 'MAIN' && LANE_ROLES.has(playerRole);
    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
         where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
           select 1 from team_members where team_id = t.id and user_id = ${user.id}
             and role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board')))`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from players
         where id = ${playerId} and team_id = ${teamId} and role = ${existing[0].role}
           and roster_status is not distinct from ${existing[0].roster_status}`,
      ...(promotingToMain ? [tx`update players set roster_status = 'SUB', updated_at = now()
         where team_id = ${teamId} and role = ${playerRole} and id <> ${playerId} and roster_status = 'MAIN'`] : []),
      tx`update players set name = ${name}, riot_id = ${riotId}, opgg_url = ${opggUrl},
           roster_status = ${rosterStatus}, updated_at = now()
         where id = ${playerId} and team_id = ${teamId}`,
      tx`update champion_pool set player_name = ${name} where player_id = ${playerId} and team_id = ${teamId}`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         values (${user.id}, 'player.update', 'player', ${playerId}, ${JSON.stringify({ teamId, riotId, role: playerRole, rosterStatus })}::jsonb)`,
      tx`select * from players where id = ${playerId} and team_id = ${teamId}`
    ]);
    const player = results[results.length - 1][0];

    return json({ player });
  } catch (err) {
    if (err.constraint === 'idx_players_one_main_per_role') {
      err.status = 409;
      err.message = 'Un titulaire occupe déjà ce poste. Recharge l’équipe puis réessaie.';
    } else if (err.code === '23505') {
      err.status = 409;
      err.message = 'Ce Riot ID existe déjà dans cette team.';
    } else if (err.code === '22012') {
      err.status = 409;
      err.message = 'Le profil ou les accès ont changé. Recharge l’équipe puis réessaie.';
    }
    return handleError(err);
  }
}
