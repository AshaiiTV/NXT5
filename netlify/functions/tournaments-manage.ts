import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureAuditLogsSchema, ensureWorkflowSchema } from './_lib/schema';

function cleanText(value: unknown, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function cleanIds(value: unknown) {
  return [...new Set((Array.isArray(value) ? value : []).map((id) => cleanText(id, 80)).filter(Boolean))].slice(0, 12);
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureWorkflowSchema();
    await ensureAuditLogsSchema();
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const tournamentId = cleanText(body.tournamentId, 80);
    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const memberships = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const membership = memberships[0];
    const canManage = membership && (membership.owner_id === user.id || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(membership.role || '').toLowerCase()));
    if (!canManage) throw Object.assign(new Error('Seul le staff peut gérer le mode tournoi.'), { status: 403 });

    if (action === 'delete') {
      const deleted = await sql`delete from tournaments where id = ${tournamentId} and team_id = ${teamId} returning id, opponent`;
      if (!deleted[0]) throw Object.assign(new Error('Série introuvable.'), { status: 404 });
      await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${user.id}, 'tournaments.delete', 'tournament', ${tournamentId}, ${JSON.stringify({ teamId, opponent: deleted[0].opponent })}::jsonb)`;
      return json({ ok: true });
    }

    const opponent = cleanText(body.opponent, 120);
    const format = cleanText(body.format || 'BO3', 8).toUpperCase();
    const status = cleanText(body.status || 'preparation', 20).toLowerCase();
    const side = cleanText(body.side || 'undecided', 20).toLowerCase();
    const maxWins = format === 'BO5' ? 3 : format === 'BO3' ? 2 : 1;
    const score = (value: unknown) => {
      const number = Number(value || 0);
      return Number.isFinite(number) ? Math.max(0, Math.min(maxWins, Math.round(number))) : 0;
    };
    const ourScore = score(body.ourScore);
    const opponentScore = score(body.opponentScore);
    const notes = cleanText(body.notes, 3000) || null;
    const scheduledAt = cleanText(body.scheduledAt, 40) || null;
    const matchIds = cleanIds(body.matchIds);
    if (!opponent) throw Object.assign(new Error('Adversaire requis.'), { status: 400 });
    if (!['BO1', 'BO3', 'BO5'].includes(format)) throw Object.assign(new Error('Format invalide.'), { status: 400 });
    if (!['preparation', 'live', 'complete'].includes(status)) throw Object.assign(new Error('Statut invalide.'), { status: 400 });
    if (!['undecided', 'blue', 'red'].includes(side)) throw Object.assign(new Error('Side invalide.'), { status: 400 });
    if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) throw Object.assign(new Error('Date de tournoi invalide.'), { status: 400 });

    let rows;
    if (action === 'update') {
      rows = await sql`
        update tournaments
        set opponent = ${opponent}, format = ${format}, status = ${status}, our_score = ${ourScore},
            opponent_score = ${opponentScore}, side = ${side}, scheduled_at = ${scheduledAt}, notes = ${notes},
            match_ids = ${JSON.stringify(matchIds)}::jsonb, updated_at = now()
        where id = ${tournamentId} and team_id = ${teamId}
        returning *
      `;
    } else {
      rows = await sql`
        insert into tournaments (team_id, created_by, opponent, format, status, our_score, opponent_score, side, scheduled_at, notes, match_ids)
        values (${teamId}, ${user.id}, ${opponent}, ${format}, ${status}, ${ourScore}, ${opponentScore}, ${side}, ${scheduledAt}, ${notes}, ${JSON.stringify(matchIds)}::jsonb)
        returning *
      `;
    }
    if (!rows[0]) throw Object.assign(new Error('Série introuvable.'), { status: 404 });
    await sql`insert into audit_logs (user_id, action, entity_type, entity_id, metadata) values (${user.id}, ${action === 'update' ? 'tournaments.update' : 'tournaments.create'}, 'tournament', ${rows[0].id}, ${JSON.stringify({ teamId, opponent, format })}::jsonb)`;
    return json({ tournament: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
