import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { sql } from './_lib/db';
import { json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, auditDiscord } from './_lib/discord-access';
import { isDiscordId } from './_lib/discord-config';
import { getDiscordGuild } from './_lib/discord-client';

const ROLE_ACCESS_SCHEMA_VERSION = 'discord-bot-role-access-20260923-v1';
const MAX_ROLE_IDS = 25;

async function assertRoleAccessSchemaReady() {
  try {
    const rows = await sql('select migration_key from app_schema_migrations where migration_key=$1', [ROLE_ACCESS_SCHEMA_VERSION]);
    if (rows.length) return;
  } catch { /* Return a stable maintenance error while the migration is pending. */ }
  throw discordError('La migration des rôles Discord doit être appliquée avant ce réglage.', 503, 'DISCORD_BOT_ROLE_ACCESS_SCHEMA_REQUIRED');
}

function parseRoleIds(value: unknown, guildId: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_ROLE_IDS) {
    throw discordError(`Choisis au maximum ${MAX_ROLE_IDS} rôles Discord.`, 400, 'DISCORD_ROLE_ACCESS_INVALID');
  }
  if (value.some((id) => !isDiscordId(id) || id === guildId) || new Set(value).size !== value.length) {
    throw discordError('La liste des rôles Discord est invalide ou contient un doublon.', 400, 'DISCORD_ROLE_ACCESS_INVALID');
  }
  return value;
}

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST']);
    const body = request.method === 'POST' ? await readJson(request, 12_000) : {};
    const access = await requireDiscordTeam(request, context, body.teamId || new URL(request.url).searchParams.get('teamId'), request.method === 'POST' ? 'manage' : 'staff');
    const { teamId, user } = access;
    await assertRoleAccessSchemaReady();

    if (request.method === 'GET') {
      const [connections, policies] = await Promise.all([
        sql('select guild_id,status from discord_connections where team_id=$1', [teamId]),
        sql('select guild_id,role_ids from discord_bot_role_access where team_id=$1', [teamId]),
      ]);
      const connection = connections[0];
      const policy = policies[0];
      return json({
        guildId: connection?.status !== 'disconnected' ? connection?.guild_id || null : null,
        configuredGuildId: policy?.guild_id || null,
        roleIds: policy?.role_ids || [],
        enabled: Boolean(policy),
      });
    }

    await assertSubjectRateLimit('discord-role-access', user.id, { limit: 8, windowSeconds: 60 });
    const guildId = body.guildId;
    if (!isDiscordId(guildId)) throw discordError('Serveur Discord invalide.', 400, 'DISCORD_ROLE_ACCESS_INVALID');
    const roleIds = parseRoleIds(body.roleIds, guildId);
    const connections = await sql("select guild_id from discord_connections where team_id=$1 and guild_id=$2 and status in ('active','paused')", [teamId, guildId]);
    if (!connections.length) throw discordError('La liaison de cette équipe a changé. Actualise la page.', 409, 'DISCORD_CONNECTION_CHANGED');

    if (roleIds.length) {
      const live = await getDiscordGuild(guildId);
      const availableRoles = new Set(live.roles.map((role) => role.id));
      if (live.guild.id !== guildId || roleIds.some((id) => !availableRoles.has(id))) {
        throw discordError('Un rôle choisi n’est plus disponible sur ce serveur. Actualise les rôles.', 409, 'DISCORD_ROLE_ACCESS_ROLE_UNAVAILABLE');
      }
      const saved = await sql(`with linked as materialized (
          select 1 from discord_connections where team_id=$1 and guild_id=$2 and status in ('active','paused') for update
        ) insert into discord_bot_role_access(team_id,guild_id,role_ids)
        select $1,$2,$3::text[] from linked
        on conflict(team_id) do update set guild_id=excluded.guild_id,role_ids=excluded.role_ids,updated_at=now()
        returning guild_id,role_ids`, [teamId, guildId, roleIds]);
      if (!saved.length) throw discordError('La liaison de cette équipe a changé. Actualise la page.', 409, 'DISCORD_CONNECTION_CHANGED');
      await auditDiscord(user.id, teamId, 'discord.bot_role_access_updated', { guildId, roleIds });
      return json({ guildId, configuredGuildId: guildId, roleIds: saved[0].role_ids, enabled: true });
    }

    // Removing the policy is a separate, explicit UI action. NXT5 team
    // membership and command-specific permissions still apply afterward.
    const removed = await sql(`with linked as materialized (
        select 1 from discord_connections where team_id=$1 and guild_id=$2 and status in ('active','paused') for update
      ), removed as (
        delete from discord_bot_role_access where team_id=$1 and exists(select 1 from linked) returning team_id
      ) select exists(select 1 from linked) as linked`, [teamId, guildId]);
    if (!removed[0]?.linked) throw discordError('La liaison de cette équipe a changé. Actualise la page.', 409, 'DISCORD_CONNECTION_CHANGED');
    await auditDiscord(user.id, teamId, 'discord.bot_role_access_removed', { guildId });
    return json({ guildId, configuredGuildId: null, roleIds: [], enabled: false });
  } catch (error) { return discordResponseError(error); }
}

export default withDiscordRuntime(handler);
export const config: Config = { method: ['GET', 'POST'] };
