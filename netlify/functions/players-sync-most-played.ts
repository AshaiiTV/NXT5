import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import {
  fetchAccountByRiotId,
  fetchMatchIdsByPuuid,
  fetchRiotMatchById,
  getChampionDataMap,
  platformFromRegion
} from './_lib/riot';

const STAFF_ROLES = new Set(['COACH', 'ASSISTANT', 'ANALYST', 'MANAGER', 'BOARD']);
const RANKED_SOLO_QUEUE = 420;
const MATCH_PAGE_SIZE = 80;
const MATCH_FETCH_CONCURRENCY = 10;
const DEFAULT_PROFILE_SYNC_MAX_MATCHES = 80;

function profileSyncMaxMatches() {
  const value = Number(process.env.RIOT_PROFILE_SYNC_MAX_MATCHES || DEFAULT_PROFILE_SYNC_MAX_MATCHES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PROFILE_SYNC_MAX_MATCHES;
  return Math.min(Math.floor(value), 1000);
}

function currentSeasonStartTimestamp() {
  return Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);
}

async function mapLimited(items, limit, mapper) {
  const output: any[] = [];
  let index = 0;
  let failure;
  async function worker() {
    while (!failure && index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        output[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (err) {
        if (!failure || err.code === 'RIOT_RATE_LIMIT') failure = err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure;
  return output;
}

function normalizeMatchStats(stats, championData) {
  return [...stats.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 3)
    .map((item) => {
      const champion = championData.get(Number(item.championId));
      const winrate = item.games ? Math.round((item.wins / item.games) * 100) : 0;
      return {
        championId: Number(item.championId),
        champion: champion?.name || item.championName || `Champion ${item.championId}`,
        imageUrl: champion?.imageUrl || null,
        games: item.games,
        wins: item.wins,
        losses: item.games - item.wins,
        winrate,
        points: item.games,
        source: 'match_history'
      };
    });
}

async function fetchCurrentSeasonSoloqMatchIds(puuid, platform) {
  const startTime = currentSeasonStartTimestamp();
  const maxMatches = profileSyncMaxMatches();
  const matchIds: string[] = [];

  for (let start = 0; start < maxMatches; start += MATCH_PAGE_SIZE) {
    const count = Math.min(MATCH_PAGE_SIZE, maxMatches - start);
    const page = await fetchMatchIdsByPuuid(puuid, platform, { startTime, queue: RANKED_SOLO_QUEUE, start, count });
    matchIds.push(...page);
    if (page.length < count) break;
  }

  return matchIds;
}

async function fetchCurrentSeasonSoloqMostPlayed(puuid, platform, championData) {
  const matchIds = await fetchCurrentSeasonSoloqMatchIds(puuid, platform);
  const stats = new Map<number, any>();

  await mapLimited(matchIds, MATCH_FETCH_CONCURRENCY, async (matchId) => {
    try {
      const match = await fetchRiotMatchById(matchId, platform);
      const participant = match?.info?.participants?.find((row) => row.puuid === puuid);
      if (!participant?.championId) throw new Error('Participant absent de la partie Riot.');
      const key = Number(participant.championId);
      const current = stats.get(key) || { championId: key, championName: participant.championName, games: 0, wins: 0 };
      current.games += 1;
      if (participant.win) current.wins += 1;
      stats.set(key, current);
    } catch (err) {
      if (err.code === 'RIOT_RATE_LIMIT') throw err;
      throw Object.assign(new Error('Synchronisation incomplète'), { code: 'RIOT_SYNC_INCOMPLETE' });
    }
  });

  return normalizeMatchStats(stats, championData);
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = String(body.teamId || '').trim();
    const playerId = String(body.playerId || '').trim();
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });

    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Seul l’owner ou un staff autorisé peut synchroniser les most played.'), { status: 403 });

    const players = playerId
      ? await sql`select * from players where team_id = ${teamId} and id = ${playerId} order by created_at asc`
      : await sql`select * from players where team_id = ${teamId} order by created_at asc`;
    if (!players.length) throw Object.assign(new Error('Ajoute au moins un joueur avant de synchroniser les most played.'), { status: 400 });

    const platform = platformFromRegion(team.region);
    const championData = await getChampionDataMap();
    const results: any[] = [];

    for (const player of players) {
      // Collect Riot data without holding a lock, then revalidate its entire context.
      const persist = (writes) => sql.transaction(tx => [
        tx`select id from teams where id = ${teamId} for update`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
           where t.id = ${teamId} and t.region is not distinct from ${team.region}
             and (t.owner_id = ${user.id} or exists (select 1 from team_members
               where team_id = t.id and user_id = ${user.id}
                 and role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board')))`,
        tx`select id from players where id = ${player.id} and team_id = ${teamId} for update`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from players
           where id = ${player.id} and team_id = ${teamId}
             and riot_id is not distinct from ${player.riot_id} and role = ${player.role}`,
        ...writes(tx)
      ]);
      try {
        const staffRole = STAFF_ROLES.has(String(player.role || '').toUpperCase());
        if (staffRole || !player.riot_id) {
          await persist(tx => [tx`
            update players
            set status = ${staffRole ? 'Profil staff sans Riot ID' : 'Riot ID manquant'},
                updated_at = now()
            where id = ${player.id} and team_id = ${teamId}
          `]);
          results.push({ playerId: player.id, riotId: player.riot_id, ok: true, skipped: true, reason: staffRole ? 'Profil staff sans Riot ID' : 'Riot ID manquant' });
          continue;
        }

        const account = await fetchAccountByRiotId(player.riot_id, platform);
        const mostPlayed = await fetchCurrentSeasonSoloqMostPlayed(account.puuid, platform, championData);
        if (!mostPlayed.length) throw Object.assign(new Error('Aucun match SoloQ trouvé sur la saison courante.'), { status: 404 });

        const totalPoints = mostPlayed.reduce((sum, item) => sum + Number(item.points || 0), 0);
        await persist(tx => [tx`
          update players
          set most_played = ${JSON.stringify(mostPlayed)}::jsonb,
              performance_score = ${totalPoints || null},
              status = ${mostPlayed.length ? 'Top SoloQ saison synchronisé' : 'Aucun match SoloQ saison trouvé'},
              updated_at = now()
          where id = ${player.id} and team_id = ${teamId}
        `, tx`
          delete from champion_pool
          where team_id = ${teamId}
            and player_id = ${player.id}
            and source in ('match_history', 'mastery')
        `]);

        results.push({ playerId: player.id, riotId: player.riot_id, ok: true, mostPlayed, source: 'ranked_solo_history' });
      } catch (err) {
        let code = err.code || null;
        const clientError = Number.isInteger(err.status) && err.status >= 400 && err.status < 500;
        let message = code === 'RIOT_SYNC_INCOMPLETE' ? 'Synchronisation incomplète'
          : ((clientError || code === 'RIOT_RATE_LIMIT') ? err.message : err.publicMessage) || 'Synchronisation incomplète';
        if (code !== '22012') {
          try {
            await persist(tx => [tx`update players set status = ${message}, updated_at = now()
              where id = ${player.id} and team_id = ${teamId} and riot_id is not distinct from ${player.riot_id}`]);
          } catch (statusError) {
            if (statusError.code !== '22012') throw statusError;
            code = '22012';
          }
        }
        if (code === '22012') {
          code = 'PLAYER_CHANGED';
          message = 'Le profil ou les accès ont changé. Recharge l’équipe puis réessaie.';
        }
        results.push({ playerId: player.id, riotId: player.riot_id, ok: false, error: message, code, retryAfter: err.retryAfter || null });
        if (err.code === 'RIOT_RATE_LIMIT') break;
      }
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'players.sync_most_played', 'team', ${teamId}, ${JSON.stringify({ count: players.length, playerId: playerId || null, platform, queue: RANKED_SOLO_QUEUE, maxMatches: profileSyncMaxMatches() })}::jsonb)
    `;

    return json({ results });
  } catch (err) {
    return handleError(err);
  }
}
