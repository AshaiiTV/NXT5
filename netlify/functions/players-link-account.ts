import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const MANAGE_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];
const STAFF_MEMBER_ROLE = {
  COACH: 'coach',
  ASSISTANT: 'assistant',
  ANALYST: 'analyst',
  MANAGER: 'manager',
  BOARD: 'board',
};

async function ensureTeamMemberRoleConstraint() {
  await assertSchemaReady();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const userId = String(body.userId || '').trim() || null;

    if (!teamId || !playerId) throw Object.assign(new Error('Team et joueur requis.'), { status: 400 });

    await ensureTeamMemberRoleConstraint();

    const allowed = await sql`
      select teams.id, teams.owner_id, team_members.role as actor_role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role = any(${MANAGE_ROLES}))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut lier ou délier un compte.'), { status: 403 });

    const player = await sql`
      select id, role
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!player[0]) throw Object.assign(new Error('Joueur introuvable dans cette team.'), { status: 404 });

    let linkedUser: any = null;
    if (userId) {
      const member = await sql`
        select team_members.user_id, team_members.role, users.name
        from team_members
        join users on users.id = team_members.user_id
        where team_id = ${teamId}
          and team_members.user_id = ${userId}
        limit 1
      `;
      if (!member[0]) throw Object.assign(new Error('Ce compte ne fait pas partie de la team.'), { status: 400 });
      linkedUser = member[0];
    }

    const profileRole = String(player[0].role || '').toUpperCase();
    const targetIsOwner = userId === String(allowed[0].owner_id);
    const promotesMember = userId && !targetIsOwner && linkedUser?.role === 'player' && STAFF_ROLES.has(profileRole);
    const canManageRoles = String(allowed[0].owner_id) === user.id || allowed[0].actor_role === 'captain';
    if (promotesMember && !canManageRoles) {
      throw Object.assign(new Error('Seul le propriétaire ou un capitaine peut attribuer des droits staff en liant un compte.'), { status: 403 });
    }

    const linkedName = linkedUser?.name || null;
    const rows = await sql`
      update players
      set user_id = ${userId},
          name = coalesce(${linkedName}, name),
          updated_at = now()
      where id = ${playerId}
        and team_id = ${teamId}
      returning *
    `;

    if (promotesMember) {
      await sql`
        update team_members
        set role = ${STAFF_MEMBER_ROLE[profileRole] || 'coach'}
        where team_id = ${teamId}
          and user_id = ${userId}
          and role = 'player'
          and exists (
            select 1 from teams
            left join team_members actor on actor.team_id = teams.id and actor.user_id = ${user.id}
            where teams.id = ${teamId}
              and teams.owner_id <> ${userId}
              and (teams.owner_id = ${user.id} or actor.role = 'captain')
          )
      `;
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, ${userId ? 'player.link_account' : 'player.unlink_account'}, 'player', ${playerId}, ${JSON.stringify({ teamId, linkedUserId: userId })}::jsonb)
    `;

    return json({ player: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
