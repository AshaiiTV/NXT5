import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { safeTeam } from './_lib/teams';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { extractInviteCode } from './_lib/team-invites';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    // Both budgets include malformed and unsuccessful attempts. Changing IP
    // cannot reset an account's budget; changing accounts cannot reset an IP's.
    await assertSubjectRateLimit('team-join-account', user.id, { limit: 10, windowSeconds: 900 });
    await assertSubjectRateLimit('team-join-ip', context.ip || 'unknown', { limit: 30, windowSeconds: 900 });
    const body = await readJson(request, 4096);
    const inviteCode = extractInviteCode(body.invite || body.inviteCode || body.link || body.code);

    if (!inviteCode) throw Object.assign(new Error('Code ou lien d’invitation invalide.'), { status: 400, code: 'INVITE_CODE_INVALID' });
    await sql`delete from team_invite_codes where expires_at <= now()`;

    const teams = await sql`
      select teams.*
      from team_invite_codes
      join teams on teams.id = team_invite_codes.team_id
      where upper(team_invite_codes.code) = ${inviteCode}
        and team_invite_codes.expires_at > now()
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Code d’invitation invalide ou expiré. Demande un nouveau code au staff.'), { status: 404 });

    await sql`
      insert into team_members (team_id, user_id, role)
      values (${team.id}, ${user.id}, 'member')
      on conflict (team_id, user_id) do nothing
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.join', 'team', ${team.id}, ${JSON.stringify({ inviteCode })}::jsonb)
    `;

    return json({ team: safeTeam(team) });
  } catch (err) {
    return handleError(err);
  }
}
