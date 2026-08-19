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
    const updateStatus: PlayerRosterStatus = promotingToMain ? 'SUB' : rosterStatus;

    const updated = await sql`
      update players
      set name = ${name},
          riot_id = ${riotId},
          opgg_url = ${opggUrl},
          roster_status = ${updateStatus},
          updated_at = now()
      where id = ${playerId}
        and team_id = ${teamId}
      returning *
    `;
    let player = updated[0];

    if (promotingToMain) {
      await sql`
        update players
        set roster_status = 'SUB', updated_at = now()
        where team_id = ${teamId}
          and role = ${playerRole}
          and id <> ${playerId}
          and roster_status = 'MAIN'
      `;
      const promoted = await sql`
        update players
        set roster_status = 'MAIN', updated_at = now()
        where id = ${playerId}
          and team_id = ${teamId}
        returning *
      `;
      player = promoted[0];
    }

    await sql`
      update champion_pool
      set player_name = ${name}
      where player_id = ${playerId}
        and team_id = ${teamId}
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.update', 'player', ${playerId}, ${JSON.stringify({ teamId, riotId, role: player.role, rosterStatus })}::jsonb)
    `;

    return json({ player });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Ce Riot ID existe déjà dans cette team.';
    return handleError(err);
  }
}
