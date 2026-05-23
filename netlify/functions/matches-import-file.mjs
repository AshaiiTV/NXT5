import { sql } from './_lib/db.mjs';
import { json, readJson, assertMethod, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import { persistAnalyzedMatch } from './_lib/analytics.mjs';
import { fetchRiotMatch, platformFromRegion, resolveMatchIdByTournamentCode } from './_lib/riot.mjs';

function unwrapImportPayload(body) {
  const payload = body?.payload || body?.file || body;
  const match = payload?.match || payload?.riotMatch || (payload?.info?.participants ? payload : null);
  const gameId = String(payload?.gameId || payload?.metadata?.gameId || match?.metadata?.matchId || '').trim().toUpperCase();
  const tournamentCode = String(payload?.tournamentCode || payload?.code || payload?.metadata?.tournamentCode || '').trim().toUpperCase();
  const platform = platformFromRegion(payload?.platform || payload?.metadata?.platform || 'EUW1');
  const label = String(body?.label || payload?.label || payload?.metadata?.label || '').trim().slice(0, 120);
  const opponent = String(body?.opponent || payload?.opponent || payload?.metadata?.opponent || '').trim().slice(0, 120);
  return { match, gameId, tournamentCode, platform, label, opponent };
}

function assertRiotMatchShape(match) {
  if (!match || typeof match !== 'object') {
    throw Object.assign(new Error('Fichier invalide : JSON Riot/NXT5 introuvable.'), { status: 400, code: 'NXT5_IMPORT_FILE_INVALID' });
  }
  if (!match.info || !Array.isArray(match.info.participants) || !Array.isArray(match.info.teams)) {
    throw Object.assign(new Error('Fichier invalide : il manque info.participants ou info.teams.'), { status: 400, code: 'NXT5_IMPORT_FILE_INVALID' });
  }
}

export default async function handler(request, context) {
  try {
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const teamId = String(body.teamId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    let { match, gameId, tournamentCode, platform, label, opponent } = unwrapImportPayload(body);
    let resolvedGameId = gameId || String(match?.metadata?.matchId || '').trim().toUpperCase();
    if (!resolvedGameId && tournamentCode) resolvedGameId = await resolveMatchIdByTournamentCode(tournamentCode, platform);
    if (!/^([A-Z0-9]+)_\d+$/.test(resolvedGameId)) {
      throw Object.assign(new Error('Game ID absent ou invalide dans le fichier. Attendu : EUW1_7123456789.'), { status: 400, code: 'NXT5_IMPORT_FILE_INVALID' });
    }
    if (!match) match = await fetchRiotMatch(resolvedGameId);
    assertRiotMatchShape(match);

    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Team introuvable ou non autorisée.'), { status: 403 });

    const roster = await sql`select * from players where team_id = ${teamId}`;
    if (!roster.length) throw Object.assign(new Error('Ajoute au moins un joueur au roster avant d’importer une game.'), { status: 400 });

    let savedMatch = await persistAnalyzedMatch({ team, gameId: resolvedGameId, match, roster, userId: user.id });
    if (opponent || label) {
      const named = await sql`
        update matches
        set opponent = ${opponent || label}
        where id = ${savedMatch.id}
        returning *
      `;
      savedMatch = named[0] || savedMatch;
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'match.import_file', 'match', ${savedMatch.id}, ${JSON.stringify({ gameId: resolvedGameId, teamId })}::jsonb)
    `;

    return json({ match: savedMatch });
  } catch (err) {
    return handleError(err);
  }
}
