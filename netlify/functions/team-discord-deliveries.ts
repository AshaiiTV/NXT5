import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, uuid } from './_lib/discord-access';

export default async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    const { teamId, canPublish } = await requireDiscordTeam(request, context, new URL(request.url).searchParams.get('teamId'), 'staff');
    const requestedMatch = new URL(request.url).searchParams.get('matchId');
    const matchId = requestedMatch ? uuid(requestedMatch, 'Game') : null;
    const rows = await sql("select j.*,p.message_id,p.guild_id,p.channel_id,p.state as publication_state,p.desired_revision,p.lease_expires_at as publication_lease,p.id as publication_id,m.opponent,m.game_id,r.channel_name,c.status as connection_status,c.config_version as current_config_version,exists(select 1 from publication_jobs w where w.publication_id=p.id and w.last_error_code='WITHDRAW_RETRY_REQUIRED') as withdrawal_pending from publication_jobs j join discord_publications p on p.id=j.publication_id and p.team_id=j.team_id left join matches m on m.id=j.entity_id and m.team_id=j.team_id left join discord_routes r on r.id=p.route_id left join discord_connections c on c.team_id=j.team_id where j.team_id=$1 and ($2::uuid is null or j.entity_id=$2) order by j.created_at desc,j.id desc limit 100", [teamId, matchId]);
    return json({ deliveries: rows.map((row) => ({
      id: row.id, publicationId: row.publication_id, status: row.publication_state === 'withdrawn' ? (row.withdrawal_pending ? 'withdrawal_pending' : 'withdrawn') : row.status, matchId: row.entity_id,
      matchLabel: row.opponent || row.game_id || 'Game supprimée', channelName: row.channel_name || row.channel_id,
      messageUrl: row.message_id && (row.publication_state !== 'withdrawn' || row.withdrawal_pending) ? 'https://discord.com/channels/' + row.guild_id + '/' + row.channel_id + '/' + row.message_id : null,
      lastError: row.last_error || row.last_error_code, createdAt: row.created_at, revision: Number(row.source_revision),
      canRetry: canPublish && ['blocked', 'retry_wait'].includes(row.status) && !['uncertain','sending','withdrawn','deleted'].includes(row.publication_state)
        && row.connection_status === 'active' && String(row.config_version) === String(row.current_config_version) && String(row.source_revision) === String(row.desired_revision),
      canResolve: canPublish && row.status === 'uncertain' && row.publication_state === 'uncertain',
      canRemove: canPublish && Boolean(row.message_id) && !['sending','uncertain'].includes(row.publication_state) && (row.publication_state !== 'withdrawn' || row.withdrawal_pending)
        && (!row.publication_lease || Date.parse(row.publication_lease) < Date.now()),
    })) });
  } catch (error) { return discordResponseError(error); }
}
export const config: Config = { method: 'GET' };
