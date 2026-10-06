import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { acquireSyncLease, releaseSyncLease, assertProfileNotFresh, reserveSyncBudget, syncDeadline, syncFingerprint, syncTimeout } from './_lib/riot-sync';
import { RIOT_SYNC_MAX_MATCHES } from '../../shared/riot-sync-policy.js';
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
const MATCH_FETCH_CONCURRENCY = 4;
const DEFAULT_PROFILE_SYNC_MAX_MATCHES = RIOT_SYNC_MAX_MATCHES;

function profileSyncMaxMatches() {
  const value = Number(process.env.RIOT_PROFILE_SYNC_MAX_MATCHES || DEFAULT_PROFILE_SYNC_MAX_MATCHES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PROFILE_SYNC_MAX_MATCHES;
  // A synchronous function has a bounded upstream budget, even if an old
  // environment still requests a 1,000-match scan.
  return Math.max(1, Math.min(Math.floor(value), RIOT_SYNC_MAX_MATCHES));
}

function currentSeasonStartTimestamp() {
  return Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);
}

async function mapLimited(items, limit, mapper, cancel) {
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
        cancel(err);
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

async function fetchCurrentSeasonSoloqMatchIds(puuid, platform, signal: AbortSignal) {
  const startTime = currentSeasonStartTimestamp();
  const maxMatches = profileSyncMaxMatches();
  const matchIds: string[] = [];

  for (let start = 0; start < maxMatches; start += MATCH_PAGE_SIZE) {
    const count = Math.min(MATCH_PAGE_SIZE, maxMatches - start);
    signal.throwIfAborted();
    const page = await fetchMatchIdsByPuuid(puuid, platform, { startTime, queue: RANKED_SOLO_QUEUE, start, count, signal });
    if (!Array.isArray(page) || page.some(id => typeof id !== 'string')) throw new Error('Historique Riot invalide.');
    matchIds.push(...page.slice(0, count));
    if (page.length < count) break;
  }

  return [...new Set(matchIds)];
}

async function fetchCurrentSeasonSoloqMostPlayed(puuid, platform, championData, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    const matchIds = await fetchCurrentSeasonSoloqMatchIds(puuid, platform, controller.signal);
    const stats = new Map<number, any>();

    await mapLimited(matchIds, MATCH_FETCH_CONCURRENCY, async (matchId) => {
      try {
        controller.signal.throwIfAborted();
        const match = await fetchRiotMatchById(matchId, platform, { signal: controller.signal });
        const participant = match?.info?.participants?.find((row) => row.puuid === puuid);
        if (!participant?.championId) throw new Error('Participant absent de la partie Riot.');
        const key = Number(participant.championId);
        const current = stats.get(key) || { championId: key, championName: participant.championName, games: 0, wins: 0 };
        current.games += 1;
        if (participant.win) current.wins += 1;
        stats.set(key, current);
      } catch (err) {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (['RIOT_RATE_LIMIT', 'RIOT_UPSTREAM_TIMEOUT'].includes(err.code)) throw err;
        throw Object.assign(new Error('Synchronisation incomplète'), { code: 'RIOT_SYNC_INCOMPLETE' });
      }
    }, error => controller.abort(error));

    return normalizeMatchStats(stats, championData);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  const deadline = syncDeadline(request);
  let lease: { teamId: string; token: string } | null = null;
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

    deadline.check();
    lease = { teamId, token: await acquireSyncLease(teamId, user.id, deadline.signal) };
    deadline.check();
    const platform = platformFromRegion(team.region);
    const results: any[] = [];

    for (const player of players) {
      const fingerprint = syncFingerprint(player, team.region);
      // Revalidate context and fence an expired/replaced worker in the same
      // transaction as every write. clock_timestamp also detects a deadline
      // exceeded while waiting for locks; now() would freeze at transaction start.
      const persist = (writes) => {
        deadline.check();
        return sql.transaction(tx => [
        tx`set local statement_timeout = '2000ms'`,
        tx`set local lock_timeout = '1000ms'`,
        tx`select id from teams where id = ${teamId} for update`,
        tx`select team_id from riot_sync_leases where team_id = ${teamId} for update`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from riot_sync_leases
           where team_id = ${teamId} and token = ${lease!.token}
             and expires_at > clock_timestamp() and clock_timestamp() < ${deadline.expiresAt}::timestamptz`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t
           where t.id = ${teamId} and t.region is not distinct from ${team.region}
             and (t.owner_id = ${user.id} or exists (select 1 from team_members
               where team_id = t.id and user_id = ${user.id}
                 and role in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board')))`,
        tx`select id from players where id = ${player.id} and team_id = ${teamId} for update`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from players
           where id = ${player.id} and team_id = ${teamId}
             and riot_id is not distinct from ${player.riot_id} and role = ${player.role}`,
        ...writes(tx),
        tx`select 1 / case when clock_timestamp() < ${deadline.expiresAt}::timestamptz then 1 else 0 end`
      ], { fetchOptions: { signal: deadline.signal } });
      };
      try {
        deadline.check();
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

        await assertProfileNotFresh(player.id, fingerprint, deadline.signal);
        await reserveSyncBudget(profileSyncMaxMatches(), deadline.signal);
        deadline.check();
        const championData = await getChampionDataMap({ signal: deadline.signal });
        const account = await fetchAccountByRiotId(player.riot_id, platform, { signal: deadline.signal });
        const mostPlayed = await fetchCurrentSeasonSoloqMostPlayed(account.puuid, platform, championData, deadline.signal);
        deadline.check();
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
        `, tx`
          insert into player_riot_sync_state (player_id, fingerprint, synced_at)
          values (${player.id}, ${fingerprint}, clock_timestamp())
          on conflict (player_id) do update set fingerprint = excluded.fingerprint, synced_at = excluded.synced_at
        `, tx`
          insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
          values (${user.id}, 'players.sync_most_played', 'team', ${teamId},
            ${JSON.stringify({ count: 1, playerId: player.id, platform, queue: RANKED_SOLO_QUEUE, maxMatches: profileSyncMaxMatches() })}::jsonb)
        `]);

        results.push({ playerId: player.id, riotId: player.riot_id, ok: true, mostPlayed, source: 'ranked_solo_history' });
      } catch (err) {
        if (deadline.signal.aborted) throw deadline.signal.reason;
        if (Date.now() >= Date.parse(deadline.expiresAt)) throw syncTimeout();
        let code = err.code || null;
        const clientError = Number.isInteger(err.status) && err.status >= 400 && err.status < 500;
        let message = code === 'RIOT_SYNC_INCOMPLETE' ? 'Synchronisation incomplète'
          : ((clientError || code === 'RIOT_RATE_LIMIT') ? err.message : err.publicMessage) || 'Synchronisation incomplète';
        // Rate limits/freshness/timeout are request state, not a new profile
        // status. Never overwrite a previously successful sync for those.
        if (code !== '22012' && err.status !== 429 && !['RIOT_UPSTREAM_TIMEOUT', 'RIOT_SYNC_TIMEOUT', 'RIOT_SYNC_CANCELLED'].includes(code)) {
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
        // Freshness applies to this profile only. Stopping the whole roster here
        // would keep later profiles unreachable on every bulk retry.
        if ((err.status === 429 && err.code !== 'RIOT_SYNC_FRESH') || ['RIOT_RATE_LIMIT', 'RIOT_UPSTREAM_TIMEOUT'].includes(err.code)) break;
      }
    }

    return json({ results });
  } catch (err) {
    return handleError(err);
  } finally {
    deadline.dispose();
    if (lease) {
      try { await releaseSyncLease(lease.teamId, lease.token); }
      catch { console.error('Riot sync lease release failed; lease will expire.', { code: 'RIOT_SYNC_LEASE_RELEASE_FAILED' }); }
    }
  }
}
