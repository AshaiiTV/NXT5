import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';

function cleanId(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const teamId = cleanId(body.teamId);
    const matchIds = [...new Set((Array.isArray(body.matchIds) ? body.matchIds : [body.matchId])
      .map(cleanId)
      .filter(Boolean))].slice(0, 20);

    if (!teamId || !matchIds.length) {
      throw Object.assign(new Error('Team et game requises.'), { status: 400 });
    }

    const membership = await sql`
      select teams.id
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!membership.length) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });

    const matches = await sql`
      select id, raw
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    `;
    const validIds = matches.map((match) => match.id);
    const participants = validIds.length ? await sql`
      select *
      from match_participants
      where match_id = any(${validIds})
      order by team_key asc, role asc
    ` : [];

    const participantsByMatch = new Map<string, Array<Record<string, unknown>>>();
    for (const participant of participants) {
      const key = String(participant.match_id || '');
      const rows = participantsByMatch.get(key) || [];
      rows.push(participant);
      participantsByMatch.set(key, rows);
    }

    return json({
      matches: matches.map((match) => ({
        id: match.id,
        raw: match.raw || {},
        participants: participantsByMatch.get(String(match.id)) || []
      }))
    });
  } catch (error) {
    return handleError(error);
  }
}
