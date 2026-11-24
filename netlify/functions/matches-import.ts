import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertImportRequestActive, fetchRequestedRiotMatch, runAfterMatchPersistence } from './_lib/match-import-request';
import { persistAnalyzedMatch } from './_lib/analytics';
import { wakeDiscordPublications } from './_lib/discord-wake';
import { assertMatchSourceMutationEnvironment, matchSourceMutationsAllowed } from './_lib/match-source-environment';
import { assertRateLimit } from './_lib/rate-limit';
import { notifyMatchImport } from './_lib/match-notifications';

function cleanText(value, max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertImportRequestActive(request.signal);
    // Where games may be written, throttle and authenticate before reading the
    // body (like teams-join). On an isolated preview only read-only previews are
    // accepted: the body is checked first so a write is refused before any DB access.
    let body: any = null;
    if (!matchSourceMutationsAllowed(context)) {
      body = await readJson(request);
      if (!body.previewOnly) assertMatchSourceMutationEnvironment(context);
    }
    assertSessionSecret();
    await assertRateLimit(request, 'match-import', { limit: 20, windowSeconds: 60 });
    const user = await requireAuth(request, context);
    body ??= await readJson(request);

    let gameId = String(body.gameId || '').trim().toUpperCase();
    const teamId = String(body.teamId || '').trim();
    const label = cleanText(body.label, 120);
    const rawCategoryIds = body.categoryIds || [];
    const categoryIds = [...new Set((Array.isArray(rawCategoryIds) ? rawCategoryIds : [rawCategoryIds]).map((id) => String(id || '').trim()).filter(Boolean))];
    const laneAssignments = body.laneAssignments && typeof body.laneAssignments === 'object' ? body.laneAssignments : {};
    const enemyLaneAssignments = body.enemyLaneAssignments && typeof body.enemyLaneAssignments === 'object' ? body.enemyLaneAssignments : {};
    const playerAssignments = body.playerAssignments && typeof body.playerAssignments === 'object' ? body.playerAssignments : {};
    const allyTeamSide = cleanText(body.allyTeamSide, 20);

    if (!gameId) throw Object.assign(new Error('Game ID requis.'), { status: 400 });
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });
    if (gameId && !/^([A-Z0-9]+)_\d+$/.test(gameId)) throw Object.assign(new Error('Format Game ID invalide. Exemple : EUW1_7123456789'), { status: 400 });

    // Primary-key lookup with an indexed membership check: no DISTINCT over
    // every team column (avatar included), only the fields used below.
    const teams = await sql`
      select teams.id, teams.name, teams.region
      from teams
      where teams.id = ${teamId}
        and (
          teams.owner_id = ${user.id}
          or exists (select 1 from team_members where team_members.team_id = teams.id and team_members.user_id = ${user.id}
            and team_members.role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
        )
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Import non autorisé pour cette team.'), { status: 403 });

    const roster = await sql`select * from players where team_id = ${teamId}`;
    if (!roster.length) throw Object.assign(new Error('Ajoute au moins un joueur au roster avant d’importer une game.'), { status: 400 });

    const match = await fetchRequestedRiotMatch(gameId, request.signal);
    if (body.previewOnly) {
      return json({
        gameId,
        match: {
          gameId,
          duration: match.info?.gameDuration || 0,
          version: match.info?.gameVersion || '',
          teams: [100, 200].map((teamId) => ({
            teamId,
            side: teamId === 100 ? 'BLUE' : 'RED',
            win: Boolean(match.info?.teams?.find((team) => team.teamId === teamId)?.win),
            participants: (match.info?.participants || []).filter((participant) => participant.teamId === teamId).map((participant) => ({
              participantId: participant.participantId,
              teamId: participant.teamId,
              champion: participant.championName,
              championId: participant.championId,
              summonerName: participant.summonerName,
              riotId: participant.riotIdTagline ? `${participant.riotIdGameName || participant.summonerName}#${participant.riotIdTagline}` : participant.summonerName,
              teamPosition: participant.teamPosition || participant.individualPosition || participant.lane || ''
            }))
          }))
        }
      });
    }
    const savedMatch = await persistAnalyzedMatch({ team, gameId, match, roster, userId: user.id, laneAssignments, enemyLaneAssignments, playerAssignments, allyTeamSide, label, categoryIds,
      opponentId: body.opponentId, newOpponentName: body.newOpponentName, signal: request.signal });
    wakeDiscordPublications(context);

    await runAfterMatchPersistence('match-import', 'audit log', () => sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'match.import', 'match', ${savedMatch.id}, ${JSON.stringify({ gameId, teamId, label, categoryIds })}::jsonb)
      `);

    if (savedMatch.inserted) {
      const notificationTask = runAfterMatchPersistence('match-import', 'notification email', () => notifyMatchImport({ siteUrl: process.env.PUBLIC_SITE_URL || new URL(request.url).origin, teamId, matchId: savedMatch.id, gameId: savedMatch.game_id || gameId, actorKey: user.id }));
      if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(notificationTask);
      else await notificationTask;
    }

    return json({
      warnings: savedMatch.warnings || [],
      firstImport: savedMatch.firstImport,
      match: {
        id: savedMatch.id,
        game_id: savedMatch.game_id,
        team_id: savedMatch.team_id,
        opponent: savedMatch.opponent,
        opponent_id: savedMatch.opponent_id,
        result: savedMatch.result,
        created_at: savedMatch.created_at
      }
    });
  } catch (err) {
    return handleError(err);
  }
}
