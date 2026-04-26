import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function extractInviteCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('invite') || url.searchParams.get('code');
    if (fromQuery) return String(fromQuery).trim().toUpperCase();
  } catch {}

  const match = raw.match(/RIFT-[A-Z0-9]{4,12}/i);
  if (match) return match[0].toUpperCase();

  return raw.toUpperCase();
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const inviteCode = extractInviteCode(body.invite || body.inviteCode || body.link || body.code);

    if (!inviteCode) throw Object.assign(new Error('Lien ou code d’invitation requis.'), { status: 400 });

    const teams = await sql`
      select * from teams
      where upper(invite_code) = ${inviteCode}
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Aucune team ne correspond à cette invitation.'), { status: 404 });

    await sql`
      insert into team_members (team_id, user_id, role)
      values (${team.id}, ${user.id}, 'member')
      on conflict (team_id, user_id) do nothing
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.join', 'team', ${team.id}, ${JSON.stringify({ inviteCode })}::jsonb)
    `;

    return json({ team });
  } catch (err) {
    return handleError(err);
  }
}
