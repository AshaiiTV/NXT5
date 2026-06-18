import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

const COACHING_ROLES = ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'];
const MAX_CONTENT_LENGTH = 4000;

function cleanText(value, max = MAX_CONTENT_LENGTH) {
  return String(value || '').trim().slice(0, max);
}

async function ensureCoachingNotesTable() {
  await sql`
    create table if not exists player_coaching_notes (
      id uuid primary key default gen_random_uuid(),
      team_id uuid not null references teams(id) on delete cascade,
      player_id uuid not null references players(id) on delete cascade,
      content text not null default '',
      updated_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(team_id, player_id)
    )
  `;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const teamId = cleanText(body.teamId, 80);
    const playerId = cleanText(body.playerId, 80);
    const content = cleanText(body.content, MAX_CONTENT_LENGTH);

    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil requis.'), { status: 400 });

    await ensureCoachingNotesTable();

    const membership = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const member = membership[0];
    if (!member) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });

    const canEdit = member.owner_id === user.id || COACHING_ROLES.includes(String(member.role || '').toLowerCase());
    if (!canEdit) throw Object.assign(new Error('Seul le staff, le capitaine ou l’owner peut modifier le bilan coaching.'), { status: 403 });

    const players = await sql`
      select id
      from players
      where id = ${playerId}
        and team_id = ${teamId}
      limit 1
    `;
    if (!players[0]) throw Object.assign(new Error('Profil joueur introuvable dans cette équipe.'), { status: 404 });

    const rows = await sql`
      insert into player_coaching_notes (team_id, player_id, content, updated_by)
      values (${teamId}, ${playerId}, ${content}, ${user.id})
      on conflict (team_id, player_id) do update
        set content = excluded.content,
            updated_by = excluded.updated_by,
            updated_at = now()
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'profile.coaching_note.update', 'players', ${playerId}, ${JSON.stringify({ teamId, length: content.length })}::jsonb)
    `;

    return json({ note: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
