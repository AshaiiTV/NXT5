import type { Config, Context } from '@netlify/functions';
import { randomBytes, createHash } from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, auditDiscord } from './_lib/discord-access';
import { publicDiscordStatus } from './_lib/discord-config';
import { getDiscordGuild } from './_lib/discord-client';

export default async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST']);
    const body = request.method === 'POST' ? await readJson(request, 12_000) : {};
    const access = await requireDiscordTeam(request, context, body.teamId || new URL(request.url).searchParams.get('teamId'), request.method === 'POST' ? 'manage' : 'staff');
    const { teamId, user } = access;
    if (request.method === 'GET') {
      const [rows, categories] = await Promise.all([
        sql("select * from discord_connections where team_id=$1", [teamId]),
        sql("select id,name from match_categories where team_id=$1 order by name", [teamId]),
      ]);
      const connection = rows[0];
      let live: Awaited<ReturnType<typeof getDiscordGuild>> | null = null;
      let connectionError: string | null = null;
      if (connection?.guild_id && connection.status !== 'disconnected' && publicDiscordStatus().configured) {
        try { live = await getDiscordGuild(connection.guild_id); } catch (error: any) { connectionError = error.message; }
      }
      return json({ ...publicDiscordStatus(), canManage: access.canManage, canPublish: access.canPublish, categories,
        connection: connection ? { id: connection.team_id, guildId: connection.guild_id, guildName: live?.guild.name || connection.guild_id,
          status: connection.status, paused: connection.status === 'paused', configVersion: Number(connection.config_version), enabledAt: connection.enabled_at } : null,
        channels: live?.channels || [], roles: live?.roles || [], connectionError });
    }
    await assertSubjectRateLimit('discord-connection', user.id, { limit: 8, windowSeconds: 60 });
    if (body.action === 'create-link') {
      const status = publicDiscordStatus();
      if (!status.configured) throw discordError('L’application Discord doit être configurée avant la liaison.', 503, 'DISCORD_NOT_CONFIGURED');
      const code = randomBytes(8).toString('hex').toUpperCase();
      const hash = createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      await sql.transaction([
        sql("insert into discord_connections(team_id,status,created_by) values($1,'pending',$2) on conflict(team_id) do nothing", [teamId, user.id]),
        sql("delete from discord_link_codes where team_id=$1 and consumed_at is null", [teamId]),
        sql("insert into discord_link_codes(code_hash,team_id,created_by,expires_at) values($1,$2,$3,$4)", [hash, teamId, user.id, expiresAt]),
      ]);
      await auditDiscord(user.id, teamId, 'discord.link_requested');
      return json({ code: code.match(/.{4}/g)!.join('-'), expiresAt, installUrl: status.installUrl });
    }
    if (!['pause', 'resume', 'disconnect'].includes(body.action)) throw discordError('Action inconnue.');
    const rows = await sql("select * from discord_connections where team_id=$1", [teamId]);
    const connection = rows[0];
    if (!connection) throw discordError('Aucune connexion Discord pour cette équipe.', 404);
    if (body.action === 'resume') {
      if (!connection.guild_id || connection.status === 'disconnected') throw discordError('Relie d’abord le serveur Discord.', 409);
      const live = await getDiscordGuild(connection.guild_id);
      const routes = await sql("select * from discord_routes where team_id=$1 and enabled", [teamId]);
      if (!routes.length || routes.some((route) => !live.channels.some((channel) => channel.id === route.channel_id && channel.canSend))) {
        throw discordError('Configure au moins un salon accessible au bot avant l’activation.', 409);
      }
      await sql("update discord_connections set status='active',enabled_at=coalesce(enabled_at,now()),updated_at=now() where team_id=$1", [teamId]);
    } else if (body.action === 'pause') {
      await sql("update discord_connections set status='paused',updated_at=now() where team_id=$1", [teamId]);
    } else {
      await sql.transaction([
        sql("update discord_connections set status='disconnected',config_version=config_version+1,updated_at=now() where team_id=$1", [teamId]),
        sql("update publication_jobs set status='cancelled',last_error_code='DISCORD_DISCONNECTED',updated_at=now() where team_id=$1 and status in ('queued','preparing','retry_wait')", [teamId]),
        sql("delete from discord_link_codes where team_id=$1 and consumed_at is null", [teamId]),
      ]);
    }
    await auditDiscord(user.id, teamId, 'discord.' + body.action);
    return json({ ok: true });
  } catch (error) { return discordResponseError(error); }
}
export const config: Config = { method: ['GET', 'POST'] };
