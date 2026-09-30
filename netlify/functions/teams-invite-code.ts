import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import crypto from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { cleanText } from './_lib/text';

function makeInviteCode() {
  return `NXT5-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await assertRateLimit(request, 'team-invite-manage', { limit: 20, windowSeconds: 60 });
    await assertSubjectRateLimit('team-invite-manage', user.id, { limit: 10, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    const teamId = cleanText(body.teamId, 80);
    const action = body.action || 'create';
    if (!['create', 'revoke'].includes(action)) throw Object.assign(new Error('Action invalide.'), { status: 400 });

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });
    await assertSchemaReady();

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'manager'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu ne peux pas générer de code pour cette team.'), { status: 403 });

    const code = action === 'create' ? makeInviteCode() : null;
    // Serialize rotation/revocation for this team. The authorization is checked
    // again under the lock; every statement sees the preceding committed state.
    const result = await sql.transaction([
      sql(`select 1 / case when exists (
        select 1 from teams t left join team_members tm on tm.team_id=t.id and tm.user_id=$2
        where t.id=$1 and (t.owner_id=$2 or tm.role in ('captain','manager')) for update of t
      ) then 1 else 0 end`, [teamId, user.id]),
      sql('delete from team_invite_codes where team_id=$1', [teamId]),
      sql(`insert into team_invite_codes (team_id, created_by, code, expires_at)
        select $1, $2, $3, now() + interval '1 hour' where $3::text is not null returning *`, [teamId, user.id, code]),
      sql(`update teams set invite_code=$2, invite_expires_at=case when $2::text is null then null else now()+interval '1 hour' end,
        updated_at=now() where id=$1`, [teamId, code]),
      sql(`insert into audit_logs(user_id, action, entity_type, entity_id, metadata)
        values($1,$2,'team',$3,$4::jsonb)`, [user.id, action === 'create' ? 'team.invite_code' : 'team.invite_revoked', teamId, JSON.stringify({ rotated: action === 'create' })])
    ]);
    const invite = result[2][0];

    const activeCodes = await sql`
      select team_invite_codes.*, users.name as created_by_name
      from team_invite_codes
      left join users on users.id = team_invite_codes.created_by
      where team_invite_codes.team_id = ${teamId}
        and team_invite_codes.expires_at > now()
      order by team_invite_codes.expires_at asc
    `;

    return json({ code: invite?.code || null, expiresAt: invite?.expires_at || null, inviteCodes: activeCodes, revoked: action === 'revoke' });
  } catch (err) {
    return handleError(err);
  }
}
