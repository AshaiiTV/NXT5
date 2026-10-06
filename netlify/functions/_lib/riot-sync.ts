import { createHash, randomUUID } from 'node:crypto';
import { sql } from './db';
import { RIOT_SYNC_DEADLINE_MS } from '../../../shared/riot-sync-policy.js';

export function syncTimeout() {
  return Object.assign(new Error('La synchronisation a dépassé le délai prévu. Réessaie plus tard.'), {
    status: 504, code: 'RIOT_SYNC_TIMEOUT',
    publicMessage: 'La synchronisation a dépassé le délai prévu. Réessaie plus tard.'
  });
}

export function syncDeadline(request: Request) {
  const controller = new AbortController();
  const expiresAt = new Date(Date.now() + RIOT_SYNC_DEADLINE_MS).toISOString();
  const cancel = () => controller.abort(Object.assign(new Error('Synchronisation interrompue.'), {
    status: 408, code: 'RIOT_SYNC_CANCELLED'
  }));
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const timer = setTimeout(() => controller.abort(syncTimeout()), RIOT_SYNC_DEADLINE_MS);
  timer.unref?.();
  return {
    signal: controller.signal, expiresAt,
    check() {
      if (Date.now() >= Date.parse(expiresAt) && !controller.signal.aborted) controller.abort(syncTimeout());
      controller.signal.throwIfAborted();
    },
    dispose() { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
  };
}

const limited = (code: string, message: string, retryAfter: number) => Object.assign(new Error(message), {
  status: 429, code, retryAfter: Math.max(1, Math.ceil(retryAfter))
});

async function syncQuery(query, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(2500);
  const results = await sql.transaction(tx => [
    tx`set local statement_timeout = '1500ms'`,
    tx`set local lock_timeout = '1000ms'`,
    query(tx)
  ], { fetchOptions: { signal: signal ? AbortSignal.any([signal, timeout]) : timeout } });
  return results[2];
}

async function takeBudget(endpoint: string, subject: string, cost: number, limit: number, seconds: number, signal?: AbortSignal) {
  const digest = createHash('sha256').update(subject).digest('hex');
  const rateKey = `${endpoint}:${digest}`;
  return syncQuery(tx => tx`
    insert into rate_limits (rate_key, ip, endpoint, attempts, window_start, updated_at)
    values (${rateKey}, 'shared', ${endpoint}, ${cost}, clock_timestamp(), clock_timestamp())
    on conflict (rate_key) do update set
      attempts = case when rate_limits.window_start <= clock_timestamp() - make_interval(secs => ${seconds})
        then ${cost} else rate_limits.attempts + ${cost} end,
      window_start = case when rate_limits.window_start <= clock_timestamp() - make_interval(secs => ${seconds})
        then clock_timestamp() else rate_limits.window_start end,
      updated_at = clock_timestamp()
    where rate_limits.window_start <= clock_timestamp() - make_interval(secs => ${seconds})
      or rate_limits.attempts + ${cost} <= ${limit}
    returning attempts
  `, signal);
}

/** Acquire before any upstream call. No transaction remains open during Riot IO. */
export async function acquireSyncLease(teamId: string, userId: string, signal?: AbortSignal) {
  const token = randomUUID();
  const rows = await syncQuery(tx => tx`
    insert into riot_sync_leases (team_id, token, expires_at)
    values (${teamId}, ${token}, clock_timestamp() + interval '45 seconds')
    on conflict (team_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where riot_sync_leases.expires_at <= clock_timestamp()
    returning token
  `, signal);
  if (!rows.length) throw limited('RIOT_SYNC_BUSY', 'Une synchronisation est déjà en cours pour cette équipe.', 45);
  try {
    const account = await takeBudget('riot-profile-sync-account', userId, 1, 6, 600, signal);
    if (!account.length) throw limited('RIOT_SYNC_ACCOUNT_LIMIT', 'Trop de synchronisations. Réessaie dans quelques minutes.', 600);
  } catch (error) {
    await releaseSyncLease(teamId, token);
    throw error;
  }
  return token;
}

export async function releaseSyncLease(teamId: string, token: string) {
  // Conditional release cannot delete a newer worker's lease after expiry.
  await syncQuery(tx => tx`delete from riot_sync_leases where team_id = ${teamId} and token = ${token}`);
}

export function syncFingerprint(player, region: string) {
  return createHash('sha256').update(JSON.stringify([player.riot_id, player.role, region])).digest('hex');
}

export async function assertProfileNotFresh(playerId: string, fingerprint: string, signal?: AbortSignal) {
  const rows = await syncQuery(tx => tx`
    select greatest(1, ceil(extract(epoch from synced_at + interval '5 minutes' - clock_timestamp()))) as retry_after
    from player_riot_sync_state
    where player_id = ${playerId} and fingerprint = ${fingerprint}
      and synced_at > clock_timestamp() - interval '5 minutes'
  `, signal);
  if (rows.length) throw limited('RIOT_SYNC_FRESH', 'Ce profil a déjà été synchronisé récemment.', Number(rows[0].retry_after));
}

/** Reserve the worst-case upstream cost atomically across all users and teams.
 * Do not refund unused calls: an interrupted process cannot safely report usage.
 * The sync allocation leaves headroom for other Riot operations on the same key.
 */
export async function reserveSyncBudget(maxMatches: number, signal?: AbortSignal) {
  if (!Number.isInteger(maxMatches) || maxMatches < 1 || maxMatches > 80) throw new Error('Invalid Riot sync budget.');
  const cost = maxMatches + 1 + Math.ceil(maxMatches / 80);
  const rows = await takeBudget('riot-profile-sync-budget', process.env.RIOT_API_KEY || 'unconfigured', cost, 90, 120, signal);
  if (!rows.length) throw limited('RIOT_SYNC_BUDGET', 'Le budget de synchronisation Riot est atteint. Réessaie dans deux minutes.', 120);
}
