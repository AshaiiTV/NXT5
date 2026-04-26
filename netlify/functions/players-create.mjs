import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';

const ROLES = new Set(['TOP', 'JGL', 'MID', 'ADC', 'SUP', 'SUB']);

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const name = String(body.name || '').trim();
    const riotId = String(body.riotId || '').trim();
    const opggUrl = String(body.opggUrl || '').trim() || null;
    const role = String(body.role || '').trim().toUpperCase();

    if (!teamId || !name || !riotId) throw Object.assign(new Error('Team, nom et Riot ID requis.'), { status: 400 });
    if (!ROLES.has(role)) throw Object.assign(new Error('Rôle invalide.'), { status: 400 });

    const allowed = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Team introuvable ou non autorisée.'), { status: 403 });

    const rows = await sql`
      insert into players (team_id, name, riot_id, opgg_url, role)
      values (${teamId}, ${name}, ${riotId}, ${opggUrl}, ${role})
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player.create', 'player', ${rows[0].id}, ${JSON.stringify({ teamId, riotId, role })}::jsonb)
    `;

    return json({ player: rows[0] });
  } catch (err) {
    if (String(err.message || '').includes('duplicate key')) err.message = 'Ce Riot ID existe déjà dans cette team.';
    return handleError(err);
  }
}
