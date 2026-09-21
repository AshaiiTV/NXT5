import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { sql } from './_lib/db';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, auditDiscord, uuid } from './_lib/discord-access';
import { getDiscordGuild } from './_lib/discord-client';
import { isDiscordId } from './_lib/discord-config';

export function publicDiscordRoute(route: any) {
  return { id: route.id, channelId: route.channel_id, channelName: route.channel_name, categoryIds: route.category_ids,
    includeHints: route.include_hints, mentionRoleId: route.mention_role_id, enabled: route.automatic };
}
async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST']);
    const body = request.method === 'POST' ? await readJson(request, 32_000) : {};
    const { teamId, user } = await requireDiscordTeam(request, context, body.teamId || new URL(request.url).searchParams.get('teamId'), request.method === 'POST' ? 'manage' : 'staff');
    if (request.method === 'GET') {
      // Capture routes and their version in one statement, so an activation
      // recap cannot pair older destinations with a newer connection version.
      const [snapshot] = await sql(`select c.guild_id,c.config_version,
        coalesce(jsonb_agg(to_jsonb(r) order by r.created_at,r.id) filter(where r.id is not null),'[]'::jsonb) as routes
        from discord_connections c left join discord_routes r on r.team_id=c.team_id and r.enabled
        where c.team_id=$1 group by c.guild_id,c.config_version`, [teamId]);
      return json({ routes: (snapshot?.routes || []).map(publicDiscordRoute),
        guildId: snapshot?.guild_id || null, configVersion: snapshot ? Number(snapshot.config_version) : null });
    }
    await assertSubjectRateLimit('discord-routes', user.id, { limit: 10, windowSeconds: 60 });
    if (!Array.isArray(body.routes) || body.routes.length > 10) throw discordError('Configure au maximum dix destinations.');
    const connections = await sql("select * from discord_connections where team_id=$1", [teamId]);
    const connection = connections[0];
    if (!connection?.guild_id || connection.status === 'disconnected') throw discordError('Relie d’abord ton serveur Discord.', 409);
    const live = await getDiscordGuild(connection.guild_id);
    const categories = await sql("select id from match_categories where team_id=$1", [teamId]);
    const categoryIds = new Set(categories.map((category) => category.id));
    const seenChannels = new Set<string>();
    const routes = body.routes.map((route: any) => {
      if (!route || typeof route !== 'object' || Array.isArray(route)) throw discordError('Destination invalide.');
      if (!isDiscordId(route.channelId) || seenChannels.has(route.channelId)) throw discordError('Chaque salon doit correspondre à une seule règle.');
      seenChannels.add(route.channelId);
      const channel = live.channels.find((item) => item.id === route.channelId);
      if (!channel?.canSend) throw discordError('Le bot doit pouvoir voir le salon, y envoyer des messages et images, et lire son historique.', 409);
      if (!Array.isArray(route.categoryIds) || route.categoryIds.length > 100) throw discordError('Catégories invalides.');
      const selected = [...new Set(route.categoryIds.map((id: any) => uuid(id, 'Catégorie')))];
      if (selected.some((id) => !categoryIds.has(id))) throw discordError('Une catégorie n’appartient pas à cette équipe.', 403);
      const roleId = route.mentionRoleId || null;
      if (roleId) {
        const role = live.roles.find((item) => item.id === roleId);
        if (!isDiscordId(roleId) || !role || (!role.mentionable && !channel.canMentionRoles)) throw discordError('Ce rôle ne peut pas être mentionné dans ce salon.');
      }
      return { channelId: channel.id, channelName: channel.name, categoryIds: selected, includeHints: route.includeHints === true, mentionRoleId: roleId, automatic: route.enabled === true };
    });
    await sql.transaction([
      sql("select team_id from discord_connections where team_id=$1 for update", [teamId]),
      // Guard the server identity checked above against a concurrent relink.
      sql("select 1/case when exists(select 1 from discord_connections where team_id=$1 and guild_id=$2 and config_version=$3) then 1 else 0 end", [teamId, connection.guild_id, connection.config_version]),
      sql("update discord_connections set config_version=config_version+1,updated_at=now() where team_id=$1", [teamId]),
      sql("update publication_jobs set status='cancelled',last_error_code='CONFIG_CHANGED',updated_at=now() where team_id=$1 and status in ('queued','preparing','retry_wait')", [teamId]),
      sql("delete from discord_routes where team_id=$1 and not(channel_id=any($2::text[]))", [teamId, routes.map((route) => route.channelId)]),
      ...routes.map((route) => sql("insert into discord_routes(team_id,guild_id,channel_id,channel_name,category_ids,include_hints,mention_role_id,enabled,automatic,created_by) values($1,$2,$3,$4,$5::jsonb,$6,$7,true,$8,$9) on conflict(team_id,channel_id,publication_kind) do update set guild_id=excluded.guild_id,channel_name=excluded.channel_name,category_ids=excluded.category_ids,include_hints=excluded.include_hints,mention_role_id=excluded.mention_role_id,enabled=true,automatic=excluded.automatic,updated_at=now()", [teamId, connection.guild_id, route.channelId, route.channelName, JSON.stringify(route.categoryIds), route.includeHints, route.mentionRoleId, route.automatic, user.id])),
    ]);
    await auditDiscord(user.id, teamId, 'discord.routes_updated', { channels: routes.map((route) => route.channelId) });
    return json({ ok: true });
  } catch (error: any) {
    if (error?.code === '22012') return discordResponseError(discordError('La connexion a changé. Actualise les réglages.', 409));
    return discordResponseError(error);
  }
}
export default withDiscordRuntime(handler);
export const config: Config = { method: ['GET', 'POST'] };
