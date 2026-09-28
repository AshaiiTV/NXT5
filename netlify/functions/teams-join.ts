import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { safeTeam } from './_lib/teams';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';

function extractInviteCode(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) return '';

  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('invite') || url.searchParams.get('code');
    if (fromQuery) return String(fromQuery).trim().toUpperCase();
  } catch {}

  const match = raw.match(/(?:NXT5|RIFT)-[A-Z0-9]{4,32}(?![A-Z0-9])/i);
  if (match) return match[0].toUpperCase();

  return raw.toUpperCase();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await assertRateLimit(request, 'teams-join', { limit: 10, windowSeconds: 300 });
    await assertSubjectRateLimit('teams-join', user.id, { limit: 10, windowSeconds: 300 });
    const body = await readJson(request, 4096);
    const inviteCode = extractInviteCode(body.invite || body.inviteCode || body.link || body.code);

    if (!inviteCode) throw Object.assign(new Error('Code d’invitation requis.'), { status: 400 });
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

    // Acquire the team lock before the invitation lock, matching rotation's
    // order. Otherwise the membership FK's implicit team KEY SHARE can deadlock
    // with a rotation holding team UPDATE while waiting to delete this code.
    const admission = await sql.transaction([
      sql`select id from teams where id = ${team.id} for key share`,
      // Recheck after acquiring the team lock: a rotation may have completed
      // since the initial lookup. Never admit from a stale/revoked invitation.
      sql`with invitation as materialized (
          select team_id from team_invite_codes
          where team_id = ${team.id} and upper(code) = ${inviteCode} and expires_at > clock_timestamp()
          for share
        )
        insert into team_members (team_id, user_id, role)
        select team_id, ${user.id}, 'member' from invitation
        on conflict (team_id, user_id) do update set role = team_members.role
        returning team_id`
    ]);
    const joined = admission[1];
    if (!joined[0]) throw Object.assign(new Error('Code d’invitation invalide ou expiré. Demande un nouveau code au staff.'), { status: 404 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.join', 'team', ${team.id}, ${JSON.stringify({ joinedWithInvitation: true })}::jsonb)
    `;

    return json({ team: safeTeam(team) });
  } catch (err) {
    return handleError(err);
  }
}
