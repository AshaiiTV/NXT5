import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from './db';
import { discordError } from './discord-access';
import { discordEnv, getDiscordConfig, isDiscordEnabled, isDiscordId } from './discord-config';
import { discordRequest, getDiscordGuild } from './discord-client';

export const COMMUNITY_SCHEMA = 'discord-community-announcements-20260924-v1';
const DEFAULT_GUILD = '1509552311972790332';
const PREVIEW_LIFETIME = 10 * 60 * 1000;
type Row = Record<string, any>;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const footer = (reference: string) => 'NXT5 · ' + reference;
const link = (row: Row) => isDiscordId(row.message_id)
  ? `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}` : null;

export async function assertCommunityReady() {
  if (!isDiscordEnabled()) throw discordError('La publication Discord est désactivée ou sa configuration est incomplète.', 409, 'DISCORD_PUBLISHING_DISABLED');
  try {
    if ((await sql('select migration_key from app_schema_migrations where migration_key=$1', [COMMUNITY_SCHEMA])).length) return;
  } catch { /* Stable maintenance response, without database details. */ }
  throw discordError('La mise à jour des annonces Discord doit être appliquée.', 503, 'DISCORD_COMMUNITY_SCHEMA_REQUIRED');
}

function guildId() {
  const value = discordEnv('DISCORD_COMMUNITY_GUILD_ID');
  if (value && !isDiscordId(value)) throw discordError('Le serveur communautaire configuré est invalide.', 409, 'DISCORD_COMMUNITY_GUILD_INVALID');
  return value || DEFAULT_GUILD;
}
async function liveCommunity() {
  const expectedApplicationId = getDiscordConfig().applicationId;
  const [bot, application] = await Promise.all([discordRequest('/users/@me'), discordRequest('/applications/@me')]);
  if (application?.id !== expectedApplicationId || !isDiscordId(bot?.id) || bot.bot !== true
    || application.bot?.id !== bot.id) {
    throw discordError('L’identité du bot Discord ne correspond pas à NXT5.', 409, 'DISCORD_APPLICATION_MISMATCH');
  }
  const live = await getDiscordGuild(guildId());
  if (live.guild?.id !== guildId()) throw discordError('Le serveur Discord ne correspond pas à la communauté NXT5.', 409, 'DISCORD_COMMUNITY_GUILD_MISMATCH');
  return { ...live, botId: bot.id };
}
async function settings() {
  return (await sql('select * from discord_community_settings where singleton=true'))[0] || null;
}
function channelFor(live: Awaited<ReturnType<typeof getDiscordGuild>>, setting: Row | null) {
  const channelId = setting && setting.guild_id === live.guild.id ? setting.channel_id : null;
  const channel = live.channels.find(item => item.id === channelId && item.canSend);
  if (!channel) throw discordError('Choisis un salon communautaire accessible au bot avant de préparer une annonce.', 409, 'DISCORD_COMMUNITY_CHANNEL_REQUIRED');
  return channel;
}
function parseAnnouncement(body: Row) {
  if (typeof body.reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(body.reference)) {
    throw discordError('Utilise une référence de 1 à 80 lettres, chiffres, points, tirets ou underscores.', 400, 'DISCORD_ANNOUNCEMENT_REFERENCE_INVALID');
  }
  // Do not trim or escape: the preview and the published Markdown must match exactly.
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 4096 || body.content.includes('\u0000')) {
    throw discordError('L’annonce doit contenir entre 1 et 4 096 caractères.', 400, 'DISCORD_ANNOUNCEMENT_CONTENT_INVALID');
  }
  return { reference: body.reference, content: body.content, contentHash: hash(body.content) };
}
function assertSameReference(row: Row | undefined, input: ReturnType<typeof parseAnnouncement>, setting: Row) {
  if (row && (row.content_hash !== input.contentHash || row.content !== input.content || row.guild_id !== setting.guild_id
    || row.channel_id !== setting.channel_id || row.application_id !== getDiscordConfig().applicationId)) {
    throw discordError('Cette référence désigne déjà un autre contenu ou salon. Choisis une nouvelle référence.', 409, 'DISCORD_ANNOUNCEMENT_REFERENCE_CONFLICT');
  }
}
function previewClaims(userId: string, input: ReturnType<typeof parseAnnouncement>, setting: Row) {
  return { purpose: 'community-announcement', userId, applicationId: getDiscordConfig().applicationId,
    guildId: setting.guild_id, channelId: setting.channel_id, configVersion: String(setting.config_version),
    reference: input.reference, contentHash: input.contentHash };
}
function signPreview(claims: Row) {
  const payload = Buffer.from(JSON.stringify({ ...claims, expiresAt: Date.now() + PREVIEW_LIFETIME })).toString('base64url');
  return payload + '.' + createHmac('sha256', getDiscordConfig().workerSecret).update(payload).digest('hex');
}
function verifyPreview(value: unknown, expected: Row, allowExpired = false) {
  const invalid = () => discordError('Prépare à nouveau l’aperçu avant de publier : son contenu, son salon ou sa validité a changé.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
  if (typeof value !== 'string' || value.length > 1600 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw invalid();
  const [payload, signature] = value.split('.');
  const calculated = createHmac('sha256', getDiscordConfig().workerSecret).update(payload).digest();
  if (!timingSafeEqual(calculated, Buffer.from(signature, 'hex'))) throw invalid();
  let claims: Row;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw invalid(); }
  if (!claims || !Number.isFinite(claims.expiresAt) || (!allowExpired && claims.expiresAt < Date.now()) || claims.expiresAt > Date.now() + PREVIEW_LIFETIME
    || Object.entries(expected).some(([key, item]) => claims[key] !== item)) throw invalid();
}

export async function communityOverview() {
  const [live, setting, announcements] = await Promise.all([liveCommunity(), settings(), sql('select * from discord_community_announcements order by created_at desc limit 20')]);
  return { guild: live.guild, channels: live.channels.map(({ id, name, canSend }) => ({ id, name, canSend })),
    channelId: setting?.guild_id === live.guild.id ? setting.channel_id : null,
    announcements: announcements.map(row => ({ id: row.id, reference: row.reference, channelId: row.channel_id,
      status: row.status, messageUrl: link(row), createdAt: row.created_at })) };
}
export async function configureCommunityChannel(channelId: unknown, userId: string) {
  if (!isDiscordId(channelId)) throw discordError('Salon Discord invalide.', 400, 'DISCORD_COMMUNITY_CHANNEL_INVALID');
  const live = await liveCommunity();
  if (!live.channels.some(channel => channel.id === channelId && channel.canSend)) {
    throw discordError('Ce salon ne fait pas partie du serveur communautaire ou le bot ne peut pas y publier.', 409, 'DISCORD_COMMUNITY_CHANNEL_FORBIDDEN');
  }
  const [saved] = await sql(`insert into discord_community_settings(singleton,guild_id,channel_id,updated_by)
    values(true,$1,$2,$3) on conflict(singleton) do update set guild_id=excluded.guild_id,channel_id=excluded.channel_id,
    config_version=discord_community_settings.config_version+1,updated_by=excluded.updated_by,updated_at=now() returning channel_id`, [live.guild.id, channelId, userId]);
  return { channelId: saved.channel_id };
}
export async function previewCommunityAnnouncement(body: Row, userId: string) {
  const input = parseAnnouncement(body);
  const [live, setting] = await Promise.all([liveCommunity(), settings()]);
  const channel = channelFor(live, setting);
  const [existing] = await sql('select * from discord_community_announcements where reference=$1', [input.reference]);
  assertSameReference(existing, input, setting);
  return { reference: input.reference, content: input.content, channelId: channel.id, guildName: live.guild.name, channelName: channel.name,
    previewToken: signPreview(previewClaims(userId, input, setting)) };
}
function matchingMessage(message: any, row: Row) {
  return isDiscordId(message?.id) && message.channel_id === row.channel_id && message.author?.id === row.bot_id
    && message.embeds?.some((embed: any) => embed.footer?.text === footer(row.reference) && typeof embed.description === 'string'
      && hash(embed.description) === row.content_hash);
}
function result(row: Row, verified?: boolean) {
  return { status: row.status === 'sent' ? 'sent' : 'uncertain', messageUrl: link(row), reference: row.reference,
    ...(verified === undefined ? {} : { verified }) };
}
async function recoverAnnouncement(row: Row) {
  if (row.status === 'sent') {
    let message;
    try { message = await discordRequest(`/channels/${row.channel_id}/messages/${row.message_id}`); }
    catch { return result(row, false); } // Preserve the existing receipt, never republish.
    if (!matchingMessage(message, row)) throw discordError('Le message publié doit être vérifié dans Discord. Aucun nouvel envoi effectué.', 409, 'DISCORD_ANNOUNCEMENT_MESSAGE_CHANGED');
    return result(row, true);
  }
  let found;
  try {
    const messages = await discordRequest(`/channels/${row.channel_id}/messages?limit=100`);
    if (Array.isArray(messages)) found = messages.find(message => matchingMessage(message, row));
  } catch { /* Unavailable history is not evidence that no message was sent. */ }
  if (found) {
    const [saved] = await sql("update discord_community_announcements set status='sent',message_id=$2,error_code=null,updated_at=now() where id=$1 returning *", [row.id, found.id]);
    return result(saved, true);
  }
  await sql("update discord_community_announcements set status='uncertain',error_code='DELIVERY_UNCONFIRMED',updated_at=now() where id=$1 and status='sending'", [row.id]);
  return result({ ...row, status: 'uncertain' });
}

// Reconciliation is read-only in Discord and uses the immutable original
// destination, even after the administrator selects another publication salon.
export async function recoverCommunityAnnouncement(reference: unknown) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(reference)) {
    throw discordError('Référence d’annonce invalide.', 400, 'DISCORD_ANNOUNCEMENT_REFERENCE_INVALID');
  }
  const [row] = await sql('select * from discord_community_announcements where reference=$1', [reference]);
  if (!row) throw discordError('Cette annonce est introuvable.', 404, 'DISCORD_ANNOUNCEMENT_NOT_FOUND');
  const live = await liveCommunity();
  if (row.guild_id !== live.guild.id || row.application_id !== getDiscordConfig().applicationId || row.bot_id !== live.botId) {
    throw discordError('Cette annonce appartient à une autre configuration Discord.', 409, 'DISCORD_ANNOUNCEMENT_CONFIGURATION_CHANGED');
  }
  if (row.status === 'failed') return { status: 'failed', messageUrl: null, reference: row.reference };
  return recoverAnnouncement(row);
}

export async function publishCommunityAnnouncement(body: Row, userId: string) {
  const input = parseAnnouncement(body);
  const [live, setting] = await Promise.all([liveCommunity(), settings()]);
  channelFor(live, setting);
  const [previous] = await sql('select * from discord_community_announcements where reference=$1', [input.reference]);
  assertSameReference(previous, input, setting);
  verifyPreview(body.previewToken, previewClaims(userId, input, setting), Boolean(previous && previous.status !== 'failed'));
  if (previous && previous.status !== 'failed') return recoverAnnouncement(previous);
  // The setting is locked while claiming: a stale preview cannot create a delivery.
  const inserted = await sql(`with destination as materialized (select 1 from discord_community_settings
      where singleton=true and guild_id=$1 and channel_id=$2 and config_version=$3 for share)
    insert into discord_community_announcements(reference,application_id,guild_id,channel_id,content,content_hash,status,created_by,bot_id)
    select $4,$5,$1,$2,$6,$7,'sending',$8,$9 from destination on conflict(reference) do nothing returning *`,
  [setting.guild_id, setting.channel_id, setting.config_version, input.reference, getDiscordConfig().applicationId, input.content, input.contentHash, userId, live.botId]);
  let row = inserted[0];
  if (!row) {
    const [existing] = await sql('select * from discord_community_announcements where reference=$1', [input.reference]);
    assertSameReference(existing, input, setting);
    if (!existing) throw discordError('Le salon a changé. Prépare à nouveau l’aperçu.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    if (existing.status !== 'failed') return recoverAnnouncement(existing);
    // Only a definitely refused request may be explicitly retried. A timeout is never "failed".
    [row] = await sql(`update discord_community_announcements set status='sending',error_code=null,updated_at=now()
      where id=$1 and status='failed' and exists(select 1 from discord_community_settings where singleton=true
      and guild_id=$2 and channel_id=$3 and config_version=$4) returning *`, [existing.id, setting.guild_id, setting.channel_id, setting.config_version]);
    if (!row) return recoverAnnouncement((await sql('select * from discord_community_announcements where id=$1', [existing.id]))[0]);
  }
  let attempted = false;
  try {
    const current = await settings();
    if (!isDiscordEnabled() || current?.guild_id !== setting.guild_id || current?.channel_id !== setting.channel_id
      || String(current?.config_version) !== String(setting.config_version)) {
      throw discordError('Le salon ou l’activation Discord a changé. Prépare à nouveau l’aperçu.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    }
    const payload = { embeds: [{ description: input.content, color: 0x67e8f9, footer: { text: footer(input.reference) } }],
      allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
      nonce: hash(`${row.application_id}:${row.guild_id}:${row.channel_id}:${row.reference}:${row.content_hash}`).slice(0, 24), enforce_nonce: true };
    attempted = true;
    const message = await discordRequest(`/channels/${row.channel_id}/messages`, { method: 'POST', body: payload });
    if (!matchingMessage(message, row)) throw Object.assign(new Error('Unconfirmed Discord response'), { ambiguous: true });
    const [saved] = await sql("update discord_community_announcements set status='sent',message_id=$2,error_code=null,updated_at=now() where id=$1 returning *", [row.id, message.id]);
    return result(saved, true);
  } catch (error) {
    const uncertain = attempted && (error?.ambiguous || !error?.status || error.status >= 500);
    const state = uncertain ? 'uncertain' : 'failed';
    try {
      await sql("update discord_community_announcements set status=$2,error_code=$3,updated_at=now() where id=$1 and status<>'sent'", [row.id, state, uncertain ? 'DELIVERY_UNCONFIRMED' : String(error?.code || 'DISCORD_DELIVERY_FAILED')]);
    } catch { /* A durable "sending" row also blocks a second POST after storage failure. */ }
    if (uncertain) return result({ ...row, status: 'uncertain' });
    throw error;
  }
}
