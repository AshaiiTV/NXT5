import { assertSchemaReady } from './_lib/migrations';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

const VALID_DAYS = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const VALID_TIMES = new Set(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00']);
const VALID_EVENT_TYPES = new Set(['scrim', 'match', 'review', 'custom']);
const WEEK_START_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanEvents(value) {
  const input: Record<string, any> = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  const output: Record<string, { label: string; type: string }> = {};
  for (const [key, rawEvent] of Object.entries(input)) {
    const event = rawEvent as Record<string, any>;
    const [day, time] = String(key || '').split('|');
    if (!VALID_DAYS.has(day) || !VALID_TIMES.has(time)) continue;
    const label = String(event?.label || '').trim().slice(0, 80);
    if (!label) continue;
    const type = VALID_EVENT_TYPES.has(String(event?.type || '')) ? String(event.type) : 'custom';
    output[`${day}|${time}`] = { label, type };
  }
  return output;
}

function cleanSlots(value) {
  const input: Record<string, any> = value && typeof value === 'object' ? value as Record<string, any> : {};
  const output: Record<string, any> = {};
  for (const day of VALID_DAYS) {
    const times = Array.isArray(input[day]) ? input[day] : [];
    output[day] = [...new Set(times.filter((time) => VALID_TIMES.has(String(time))))];
  }
  const events = cleanEvents(input._events || input.events);
  if (Object.keys(events).length) output._events = events;
  return output;
}

async function ensureAvailabilityTable() {
  await assertSchemaReady();
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureAvailabilityTable();
    const body = await readJson(request);
    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    const weekStart = String(body.weekStart || '').trim();
    const slots = cleanSlots(body.slots);
    const notes = String(body.notes || '').trim().slice(0, 500) || null;

    if (!teamId || !playerId) throw Object.assign(new Error('Team et profil requis.'), { status: 400 });
    if (!WEEK_START_RE.test(weekStart)) throw Object.assign(new Error('Semaine invalide.'), { status: 400 });

    const playerRows = await sql`
      select players.*
      from players
      where players.id = ${playerId}
        and players.team_id = ${teamId}
      limit 1
    `;
    const player = playerRows[0];
    if (!player) throw Object.assign(new Error('Profil introuvable.'), { status: 404 });

    const memberRows = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
      limit 1
    `;
    const member = memberRows[0];
    const role = String(member?.role || '').toLowerCase();
    const canManage = member?.owner_id === user.id || ['owner', 'captain', 'coach', 'assistant', 'analyst', 'board'].includes(role);
    const ownsProfile = player.user_id && player.user_id === user.id;
    if (!canManage && !ownsProfile) {
      throw Object.assign(new Error('Tu peux modifier uniquement tes disponibilités, sauf staff autorisé.'), { status: 403 });
    }

    const rows = await sql`
      insert into player_availability (team_id, player_id, week_start, slots, notes, updated_by)
      values (${teamId}, ${playerId}, ${weekStart}::date, ${JSON.stringify(slots)}::jsonb, ${notes}, ${user.id})
      on conflict (team_id, player_id, week_start)
      do update set
        slots = excluded.slots,
        notes = excluded.notes,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'player_availability.upsert', 'player', ${playerId}, ${JSON.stringify({ teamId, weekStart })}::jsonb)
    `;

    return json({ availability: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
