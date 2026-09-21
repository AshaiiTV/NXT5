import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { makeInviteCode } from './_lib/team-invites';

function cleanText(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

async function ensureInviteExpiryColumn() {
  await assertSchemaReady();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('team-invite-create-account', user.id, { limit: 10, windowSeconds: 3600 });
    await assertSubjectRateLimit('team-invite-create-ip', context.ip || 'unknown', { limit: 30, windowSeconds: 3600 });
    const body = await readJson(request, 4096);
    const teamId = cleanText(body.teamId);

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });
    await ensureInviteExpiryColumn();

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'manager'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu ne peux pas générer de code pour cette team.'), { status: 403 });
    // Only authorized staff can consume a team's shared creation budget.
    await assertSubjectRateLimit('team-invite-create-team', teamId, { limit: 10, windowSeconds: 3600 });

    await sql`delete from team_invite_codes where expires_at <= now()`;

    let invite: any = null;
    for (let i = 0; i < 6; i += 1) {
      const code = makeInviteCode();
      try {
        const rows = await sql`
          insert into team_invite_codes (team_id, created_by, code, expires_at)
          values (${teamId}, ${user.id}, ${code}, now() + interval '1 hour')
          returning *
        `;
        invite = rows[0];
        break;
      } catch (err) {
        if (err?.code !== '23505') throw err;
      }
    }
    if (!invite) throw Object.assign(new Error('Impossible de générer un code unique.'), { status: 500 });

    await sql`
      update teams
      set invite_code = ${invite.code},
          invite_expires_at = ${invite.expires_at},
          updated_at = now()
      where id = ${teamId}
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.invite_code', 'team', ${teamId}, ${JSON.stringify({ code: invite.code, expiresAt: invite.expires_at })}::jsonb)
    `;

    const activeCodes = await sql`
      select team_invite_codes.*, users.name as created_by_name
      from team_invite_codes
      left join users on users.id = team_invite_codes.created_by
      where team_invite_codes.team_id = ${teamId}
        and team_invite_codes.expires_at > now()
      order by team_invite_codes.expires_at asc
    `;

    return json({ code: invite.code, expiresAt: invite.expires_at, inviteCodes: activeCodes });
  } catch (err) {
    return handleError(err);
  }
}
