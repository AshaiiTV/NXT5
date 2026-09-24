import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db';
import { discordError, assertDiscordArtifactEnvironment } from './discord-access';
import { getDiscordConfig, isDiscordId } from './discord-config';

export interface BotContext {
  teamId: string; guildId: string; discordUserId: string; userId: string;
  teamName: string; role: string; canStaff: boolean; canManage: boolean;
  playerIds: string[]; timezone: string; identityId?: string;
}
export interface BotPublishedButton {
  messageId: string;
  kind: 'presence' | 'review';
  entityId: string;
  version?: number;
}
export const BOT_SCHEMA_VERSIONS = ['discord-bot-identity-20260922-v1', 'discord-bot-workflows-20260922-v1', 'discord-bot-role-access-20260923-v1', 'discord-command-channel-20260924-v1'];
export async function assertDiscordBotSchemaReady() {
  try {
    const rows = await sql('select migration_key from app_schema_migrations where migration_key=any($1::text[])', [BOT_SCHEMA_VERSIONS]);
    if (BOT_SCHEMA_VERSIONS.every(key => rows.some(row => row.migration_key === key))) return;
  } catch { /* Maintenance has one stable public message, with no DB details. */ }
  throw discordError('Les nouvelles commandes sont en préparation. Le guide /nxt help reste disponible.', 503, 'DISCORD_BOT_SCHEMA_REQUIRED');
}
export function botText(value: unknown, max = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/@/g, '@\u200b').replace(/([\\*_`~|<>\[\]()])/g, '\\$1').slice(0, max);
}
export function botMessage(title: string, description: string, fields: any[] = []) {
  let budget = 5700 - String(title).length - Math.min(String(description).length, 3900);
  const safeFields = fields.slice(0, 25).flatMap(field => {
    const name = String(field.name || 'Information').slice(0, 256);
    const value = String(field.value || '—').slice(0, Math.min(1024, Math.max(0, budget - name.length)));
    budget -= name.length + value.length;
    return value ? [{ name, value, inline: Boolean(field.inline) }] : [];
  });
  return { embeds: [{ title: String(title).slice(0, 256), description: String(description).slice(0, 3900), color: 0x67e8f9, fields: safeFields }], allowed_mentions: { parse: [] } };
}
export function botLink(path: string) {
  const base = getDiscordConfig().siteUrl;
  if (!base || !path.startsWith('/') || path.startsWith('//')) throw discordError('Le lien NXT5 est indisponible.', 503, 'DISCORD_SITE_UNAVAILABLE');
  return new URL(path, base).toString();
}
export function assertBotStaff(ctx: BotContext, manage = false) {
  if (manage ? !ctx.canManage : !ctx.canStaff) throw discordError(manage ? 'Cette commande est réservée au capitaine ou au propriétaire NXT5.' : 'Cette commande est réservée au staff NXT5.', 403, 'DISCORD_ROLE_FORBIDDEN');
}
export const botTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function validBotToken(token: unknown): token is string { return typeof token === 'string' && /^[a-f0-9]{48}$/.test(token); }
export async function botIdentity(discordUserId: string) {
  const [link] = await sql('select l.*,u.account_name,u.name from discord_user_links l join users u on u.id=l.user_id where l.discord_user_id=$1', [discordUserId]);
  if (!link) throw discordError('Lie ton compte avec /nxt lier, puis utilise le salon de commandes de ton équipe.', 403, 'DISCORD_ACCOUNT_REQUIRED');
  return link;
}
export function botMemberRoleIds(memberRoles: unknown): string[] {
  return Array.isArray(memberRoles) ? memberRoles.filter((role): role is string =>
    typeof role === 'string' && /^[0-9]{17,20}$/.test(role)) : [];
}
export async function botTeams(discordUserId: string, guildId: string, memberRoles?: unknown) {
  const identity = await botIdentity(discordUserId);
  const candidates = await sql(`select t.id,t.name,t.tag,t.owner_id,tm.role,coalesce(s.timezone,'Europe/Paris') as timezone,
      a.team_id as role_access_team_id,
      a.guild_id as role_access_guild_id,to_jsonb(a.role_ids) as role_access_ids
    from teams t join discord_connections c on c.team_id=t.id and c.guild_id=$2 and c.status<>'disconnected'
    left join team_members tm on tm.team_id=t.id and tm.user_id=$1
    left join discord_bot_settings s on s.team_id=t.id
    left join discord_bot_role_access a on a.team_id=t.id
    where (t.owner_id=$1 or tm.user_id=$1) order by lower(t.name),t.id`, [identity.user_id, guildId]);
  // Discord signs member.roles on every interaction. An absent/malformed role
  // list must never authorize a configured team; server administrators are not
  // exempt from that team's explicit role policy.
  const roles = new Set(botMemberRoleIds(memberRoles));
  const teams = candidates.filter(team => !team.role_access_team_id ||
    (team.role_access_guild_id === guildId && Array.isArray(team.role_access_ids) && team.role_access_ids.length > 0
      && team.role_access_ids.some((role: unknown) => typeof role === 'string' && roles.has(role))));
  return { identity, teams };
}
export async function resolveBotContext(discordUserId: string, guildId: string, channelId: string, memberRoles?: unknown,
  expectedTeam?: string, publishedButton?: BotPublishedButton): Promise<BotContext> {
  if (!isDiscordId(channelId)) throw discordError('Utilise un salon de commandes lié à ton équipe.', 403, 'DISCORD_CHANNEL_FORBIDDEN');
  const { identity, teams } = await botTeams(discordUserId, guildId, memberRoles);
  const linked = await sql("select team_id from discord_connections where guild_id=$1 and command_channel_id=$2 and status<>'disconnected'", [guildId, channelId]);
  let teamId = linked.length === 1 ? linked[0].team_id : null;
  if (!teamId && linked.length === 0 && publishedButton && expectedTeam && isDiscordId(publishedButton.messageId)) {
    // Reminder and review buttons can remain in a separate publication salon.
    // Accept only the original bot message recorded for this exact team,
    // channel, guild, object and review version. Shared publication routes
    // therefore cannot lend a button to a different team's member.
    const sent = await sql(`select o.team_id from discord_bot_outbox o
      join discord_bot_settings s on s.team_id=o.team_id
      where o.guild_id=$1 and o.channel_id=$2 and o.message_id=$3
      and o.team_id=$4 and o.state='sent' and (
        ($5='presence' and s.channels->>'planning'=$2 and o.kind in ('reminder','presence') and o.event_id=$6)
        or ($5='review' and s.channels->>'reviews'=$2 and o.kind='review' and o.report_id=$6 and o.report_version=$7)
      ) limit 2`, [guildId, channelId, publishedButton.messageId, expectedTeam,
      publishedButton.kind, publishedButton.entityId, publishedButton.version || null]);
    if (sent.length === 1) teamId = sent[0].team_id;
  }
  if (!teamId) throw discordError('Ce salon n’est pas le salon de commandes d’une équipe NXT5. Demande à un responsable de le choisir dans Bot Discord.', 403, 'DISCORD_CHANNEL_FORBIDDEN');
  const team = teams.find(candidate => candidate.id === teamId);
  if (!team) throw discordError('Ton compte NXT5 ou tes rôles Discord ne donnent pas accès à l’équipe de ce salon.', 403, 'DISCORD_TEAM_FORBIDDEN');
  if (expectedTeam && ![team.id.toLowerCase(), team.name.toLowerCase()].includes(expectedTeam.toLowerCase())) {
    throw discordError('L’équipe demandée ne correspond pas au salon de commandes.', 403, 'DISCORD_TEAM_FORBIDDEN');
  }
  const role = team.owner_id === identity.user_id ? 'owner' : String(team.role);
  const canManage = ['owner', 'captain'].includes(role);
  const players = await sql('select id from players where team_id=$1 and user_id=$2', [team.id, identity.user_id]);
  return { teamId: team.id, guildId, discordUserId, userId: identity.user_id, teamName: team.name, role,
    canManage, canStaff: canManage || ['coach','assistant','analyst','manager','board'].includes(role),
    playerIds: players.map(player => player.id), timezone: team.timezone, identityId: identity.id };
}
export async function saveBotPending(ctx: BotContext, command: string, options: Record<string, any>, kind: 'confirm' | 'modal', form?: any) {
  assertDiscordArtifactEnvironment();
  const identity = await botIdentity(ctx.discordUserId);
  if (identity.user_id !== ctx.userId || (ctx.identityId && identity.id !== ctx.identityId)) throw discordError('La liaison du compte a changé. Relance la commande.', 409, 'DISCORD_ACCOUNT_CHANGED');
  const token = randomBytes(24).toString('hex');
  await sql(`insert into discord_bot_pending(token_hash,link_id,guild_id,team_id,command,options,kind,form,expires_at)
    values($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,now()+interval '10 minutes')`,
    [botTokenHash(token), identity.id, ctx.guildId, ctx.teamId || null, command, JSON.stringify(options), kind, form ? JSON.stringify(form) : null]);
  return token;
}
export async function botConfirmation(ctx: BotContext, command: string, options: Record<string, any>, description: string) {
  const token = await saveBotPending(ctx, command, options, 'confirm');
  return { ...botMessage('Confirmer · ' + botText(ctx.teamName, 180), description), components: [{ type: 1, components: [
    { type: 2, style: 3, label: 'Confirmer', custom_id: 'nxt:confirm:' + token },
    { type: 2, style: 2, label: 'Annuler', custom_id: 'nxt:cancel:' + token },
  ] }] };
}
export async function loadBotPending(token: string, discordUserId: string, guildId: string, consume = false) {
  if (!validBotToken(token)) throw discordError('Ce bouton est invalide.', 400, 'DISCORD_BUTTON_INVALID');
  const hash = botTokenHash(token);
  // Consumption and ownership checks are atomic. Relinking cascades old buttons away.
  const query = consume
    ? `update discord_bot_pending p set consumed_at=now() from discord_user_links l where p.link_id=l.id and p.token_hash=$1 and l.discord_user_id=$2 and p.guild_id=$3 and p.consumed_at is null and p.expires_at>now() returning p.*`
    : `select p.* from discord_bot_pending p join discord_user_links l on l.id=p.link_id where p.token_hash=$1 and l.discord_user_id=$2 and p.guild_id=$3 and p.consumed_at is null and p.expires_at>now()`;
  const [pending] = await sql(query, [hash, discordUserId, guildId]);
  if (!pending) throw discordError('Ce bouton a expiré ou a déjà été utilisé. Relance la commande.', 409, 'DISCORD_BUTTON_EXPIRED');
  return pending;
}
