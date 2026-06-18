import { sql } from './_lib/db';
import { json, readJson, handleError } from './_lib/http';
import { ensureTournamentCodesTable } from './_lib/tournament-codes';

export default async function handler(request: Request): Promise<Response> {
  try {
    if (!['POST', 'GET'].includes(request.method)) {
      return json({ error: 'Méthode non autorisée.' }, 405);
    }
    if (request.method === 'GET') return json({ ok: true });

    const body = await readJson(request);
    const shortCode = String(body.shortCode || body.tournamentCode || body.code || '').trim().toUpperCase();
    const gameId = String(body.gameId || body.matchId || '').trim();
    const region = String(body.region || '').trim().toUpperCase();
    const importedGameId = gameId && region ? `${region}_${gameId}` : gameId;

    let metadata = {};
    try {
      metadata = typeof body.metaData === 'string' ? JSON.parse(body.metaData) : (body.metaData || {});
    } catch {
      metadata = {};
    }

    if (!shortCode || !importedGameId) {
      return json({ ok: true, skipped: true });
    }

    await ensureTournamentCodesTable();
    const rows = metadata?.teamId
      ? await sql`
          update tournament_codes
          set imported_game_id = ${importedGameId},
              status = case when status = 'imported' then status else 'ready' end,
              updated_at = now()
          where team_id = ${metadata.teamId}
            and code = ${shortCode}
          returning id
        `
      : await sql`
          update tournament_codes
          set imported_game_id = ${importedGameId},
              status = case when status = 'imported' then status else 'ready' end,
              updated_at = now()
          where code = ${shortCode}
          returning id
        `;

    return json({ ok: true, linked: rows.length, gameId: importedGameId });
  } catch (err) {
    return handleError(err);
  }
}
