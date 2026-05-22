import crypto from 'node:crypto';
import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

function cleanText(value, max = 80) {
  return String(value || '').trim().slice(0, max);
}

function makeInviteCode() {
  return `NXT5-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureInviteExpiryColumn() {
  await sql`alter table teams add column if not exists invite_expires_at timestamptz`;
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const teamId = cleanText(body.teamId);

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });
    await ensureInviteExpiryColumn();

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach'))
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu ne peux pas générer de code pour cette team.'), { status: 403 });

    let team = null;
    for (let i = 0; i < 6; i += 1) {
      const code = makeInviteCode();
      try {
        const rows = await sql`
          update teams
          set invite_code = ${code},
              invite_expires_at = now() + interval '1 hour',
              updated_at = now()
          where id = ${teamId}
          returning id, invite_code, invite_expires_at
        `;
        team = rows[0];
        break;
      } catch (err) {
        if (!String(err.message || '').includes('invite')) throw err;
      }
    }
    if (!team) throw Object.assign(new Error('Impossible de générer un code unique.'), { status: 500 });

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'team.invite_code', 'team', ${teamId}, ${JSON.stringify({ expiresAt: team.invite_expires_at })}::jsonb)
    `;

    return json({ code: team.invite_code, expiresAt: team.invite_expires_at });
  } catch (err) {
    return handleError(err);
  }
}
