import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from './db';
import { discordError } from './discord-access';
import { discordEnv, getDiscordConfig, isDiscordEnabled, isDiscordId, publicDiscordStatus } from './discord-config';
import { discordRequest, getDiscordGuild } from './discord-client';

export const COMMUNITY_SCHEMA = 'discord-community-destinations-20260925-v1';
export const MAX_COMMUNITY_DESTINATIONS = 10;
const DEFAULT_GUILD = '1509552311972790332';
const PREVIEW_LIFETIME = 10 * 60 * 1000;
type Row = Record<string, any>;
type Destination = { guildId: string; channelId: string };
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

function communityGuildId() {
  const value = discordEnv('DISCORD_COMMUNITY_GUILD_ID');
  if (value && !isDiscordId(value)) throw discordError('Le serveur communautaire configuré est invalide.', 409, 'DISCORD_COMMUNITY_GUILD_INVALID');
  return value || DEFAULT_GUILD;
}
async function liveIdentity() {
  const expectedApplicationId = getDiscordConfig().applicationId;
  const [bot, application] = await Promise.all([discordRequest('/users/@me'), discordRequest('/applications/@me')]);
  if (application?.id !== expectedApplicationId || !isDiscordId(bot?.id) || bot.bot !== true || application.bot?.id !== bot.id) {
    throw discordError('L’identité du bot Discord ne correspond pas à NXT5.', 409, 'DISCORD_APPLICATION_MISMATCH');
  }
  return { botId: bot.id as string };
}
async function settings() {
  return (await sql('select * from discord_community_settings where singleton=true'))[0] || null;
}
function destinations(value: unknown, allowEmpty = false): Destination[] {
  if (!Array.isArray(value) || value.length > MAX_COMMUNITY_DESTINATIONS || (!allowEmpty && !value.length)
    || value.some(item => !isDiscordId(item?.guildId) || !isDiscordId(item?.channelId))
    || new Set(value.map(item => item.guildId)).size !== value.length) {
    throw discordError(`Choisis entre 1 et ${MAX_COMMUNITY_DESTINATIONS} serveurs, avec un seul salon par serveur.`, 400, 'DISCORD_COMMUNITY_DESTINATIONS_INVALID');
  }
  return value.map(({ guildId, channelId }) => ({ guildId, channelId })).sort((a, b) => a.guildId < b.guildId ? -1 : a.guildId > b.guildId ? 1 : 0);
}
const destinationKey = (value: Destination[]) => JSON.stringify(value);
function assertConfiguredTargets(targets: Destination[], setting: Row | null) {
  if (!setting || destinationKey(destinations(setting.destinations, true)) !== destinationKey(targets)) {
    throw discordError('Enregistre les serveurs et salons choisis, puis prépare à nouveau l’aperçu.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
  }
}
async function limitedMap<T, U>(items: T[], run: (item: T) => Promise<U>, concurrency = 3): Promise<U[]> {
  const output: U[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next++; output[index] = await run(items[index]); }
  }));
  return output;
}
async function availableGuilds() {
  const collected = new Map<string, { id: string; name: string }>();
  let after = '';
  // Discord paginates bots too. Never silently omit servers after the first page.
  for (let page = 0; page < 50; page++) {
    const rows = await discordRequest('/users/@me/guilds?limit=200' + (after ? '&after=' + after : ''));
    if (!Array.isArray(rows) || rows.some(row => !isDiscordId(row?.id) || typeof row.name !== 'string')) {
      throw discordError('La liste des serveurs Discord doit être actualisée.', 502, 'DISCORD_INVALID_RESPONSE');
    }
    for (const row of rows) collected.set(row.id, { id: row.id, name: row.name });
    if (rows.length < 200) return [...collected.values()];
    const last = rows.reduce((max, row) => BigInt(row.id) > BigInt(max) ? row.id : max, after || '0');
    if (last === after) throw discordError('La liste des serveurs Discord doit être actualisée.', 502, 'DISCORD_INVALID_RESPONSE');
    after = last;
  }
  throw discordError('Discord ne permet pas de terminer la liste des serveurs pour le moment.', 503, 'DISCORD_UNAVAILABLE');
}
async function liveDestinations(targets: Destination[], deadline = Infinity) {
  return limitedMap(targets, async target => {
    if (Date.now() + 10_000 > deadline) throw discordError('Discord répond trop lentement. Actualise l’aperçu avant de réessayer.', 503, 'DISCORD_UNAVAILABLE');
    const live = await getDiscordGuild(target.guildId);
    if (live.guild?.id !== target.guildId) throw discordError('Le serveur Discord reçu ne correspond pas au serveur choisi.', 409, 'DISCORD_COMMUNITY_GUILD_MISMATCH');
    const channel = live.channels.find(item => item.id === target.channelId && item.canSend);
    if (!channel) throw discordError('Un salon choisi n’est plus accessible au bot. Vérifie les salons et ses permissions.', 409, 'DISCORD_COMMUNITY_CHANNEL_FORBIDDEN');
    return { ...target, guildName: live.guild.name, channelName: channel.name };
  });
}
function parseAnnouncement(body: Row) {
  if (typeof body.reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(body.reference)) {
    throw discordError('Utilise une référence de 1 à 80 lettres, chiffres, points, tirets ou underscores.', 400, 'DISCORD_ANNOUNCEMENT_REFERENCE_INVALID');
  }
  // Do not trim or escape: the preview and the published Markdown must match exactly.
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 4096 || body.content.includes('\u0000')) {
    throw discordError('L’annonce doit contenir entre 1 et 4 096 caractères.', 400, 'DISCORD_ANNOUNCEMENT_CONTENT_INVALID');
  }
  return { reference: body.reference, content: body.content, contentHash: hash(body.content), destinations: destinations(body.destinations) };
}
function assertSameReference(row: Row | undefined, input: ReturnType<typeof parseAnnouncement>, botId: string) {
  if (row && (row.content_hash !== input.contentHash || row.content !== input.content || row.bot_id !== botId
    || destinationKey(destinations(row.destinations)) !== destinationKey(input.destinations) || row.application_id !== getDiscordConfig().applicationId)) {
    throw discordError('Cette référence désigne déjà un autre contenu ou d’autres destinations. Choisis une nouvelle référence.', 409, 'DISCORD_ANNOUNCEMENT_REFERENCE_CONFLICT');
  }
}
function previewClaims(userId: string, input: ReturnType<typeof parseAnnouncement>, setting: Row) {
  return { purpose: 'community-announcement', userId, applicationId: getDiscordConfig().applicationId,
    destinationsHash: hash(destinationKey(input.destinations)), configVersion: String(setting.config_version),
    reference: input.reference, contentHash: input.contentHash };
}
function signPreview(claims: Row) {
  const payload = Buffer.from(JSON.stringify({ ...claims, expiresAt: Date.now() + PREVIEW_LIFETIME })).toString('base64url');
  return payload + '.' + createHmac('sha256', getDiscordConfig().workerSecret).update(payload).digest('hex');
}
function verifyPreview(value: unknown, expected: Row, allowExpired = false) {
  const invalid = () => discordError('Prépare à nouveau l’aperçu avant de publier : son contenu, ses destinations ou sa validité ont changé.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
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
  await liveIdentity();
  const [guilds, setting, announcements] = await Promise.all([availableGuilds(), settings(), sql('select * from discord_community_announcements order by created_at desc limit 50')]);
  const selected = destinations(setting?.destinations || [], true);
  const detailed = await limitedMap(guilds, async guild => {
    const channelId = selected.find(item => item.guildId === guild.id)?.channelId || null;
    try {
      const live = await getDiscordGuild(guild.id);
      if (live.guild?.id !== guild.id) throw new Error('Guild mismatch');
      return { ...guild, channels: live.channels.map(({ id, name, canSend }) => ({ id, name, canSend })), channelId };
    } catch {
      return { ...guild, channels: [], channelId, error: 'Les salons de ce serveur sont indisponibles. Vérifie les permissions du bot, puis actualise.' };
    }
  });
  const installUrl = publicDiscordStatus().installUrl;
  const guildId = communityGuildId();
  const communityInstall = installUrl ? new URL(installUrl) : null;
  communityInstall?.searchParams.set('guild_id', guildId);
  communityInstall?.searchParams.set('disable_guild_select', 'true');
  return { guilds: detailed, destinations: selected, installUrl,
    community: { guildId, joined: guilds.some(guild => guild.id === guildId), installUrl: communityInstall?.toString() || null },
    announcements: announcements.map(row => ({ id: row.id, reference: row.reference, guildId: row.guild_id,
      guildName: guilds.find(guild => guild.id === row.guild_id)?.name || null, channelId: row.channel_id,
      status: row.status, messageUrl: link(row), createdAt: row.created_at })) };
}
export async function configureCommunityChannel(value: unknown, userId: string, reference?: unknown) {
  const targets = destinations(value, true);
  if (reference !== undefined) {
    const restored = await restoreCommunityAnnouncement(reference);
    if (destinationKey(targets) !== destinationKey(restored.destinations)) {
      throw discordError('La reprise doit conserver tous les serveurs et salons de cette annonce.', 409, 'DISCORD_ANNOUNCEMENT_REFERENCE_CONFLICT');
    }
    await liveDestinations(targets.filter(target => restored.results.some(row => row.guildId === target.guildId && ['queued', 'failed'].includes(row.status))));
  } else {
    await liveIdentity();
    await liveDestinations(targets);
  }
  const [saved] = await sql(`insert into discord_community_settings(singleton,destinations,updated_by)
    values(true,$1::jsonb,$2) on conflict(singleton) do update set destinations=excluded.destinations,
    config_version=discord_community_settings.config_version+1,updated_by=excluded.updated_by,updated_at=now() returning destinations`, [destinationKey(targets), userId]);
  return { destinations: saved.destinations };
}
export async function previewCommunityAnnouncement(body: Row, userId: string) {
  const input = parseAnnouncement(body);
  const [identity, setting] = await Promise.all([liveIdentity(), settings()]);
  assertConfiguredTargets(input.destinations, setting);
  const [existing] = await sql('select * from discord_community_batches where reference=$1', [input.reference]);
  assertSameReference(existing, input, identity.botId);
  const receipts = existing ? await sql('select * from discord_community_announcements where reference=$1', [input.reference]) : [];
  const pending = existing ? input.destinations.filter(target => receipts.some(row => row.guild_id === target.guildId && ['queued', 'failed'].includes(row.status))) : input.destinations;
  const active = await liveDestinations(pending);
  // Receipted destinations need no publishing permissions to reconcile. Keep
  // their original identifiers visible even if the bot has since left a guild.
  const targets = input.destinations.map(target => active.find(item => item.guildId === target.guildId)
    || { ...target, guildName: target.guildId, channelName: target.channelId });
  return { reference: input.reference, content: input.content, destinations: targets,
    previewToken: signPreview(previewClaims(userId, input, setting)) };
}
function matchingMessage(message: any, row: Row) {
  return isDiscordId(message?.id) && message.channel_id === row.channel_id && message.author?.id === row.bot_id
    && message.embeds?.some((embed: any) => embed.footer?.text === footer(row.reference) && typeof embed.description === 'string'
      && hash(embed.description) === row.content_hash);
}
function result(row: Row, verified?: boolean) {
  return { status: ['sent', 'failed', 'queued'].includes(row.status) ? row.status : 'uncertain',
    guildId: row.guild_id, channelId: row.channel_id, messageUrl: link(row), reference: row.reference,
    ...(verified === undefined ? {} : { verified }) };
}
function aggregate(reference: string, results: Row[]) {
  const status = results.every(item => item.status === 'sent') ? 'sent' : results.some(item => item.status === 'sent') ? 'partial'
    : results.some(item => ['uncertain', 'queued'].includes(item.status)) ? 'uncertain' : 'failed';
  return { reference, status, results };
}
function deliveryFailure(row: Row, error: any) {
  return { ...result({ ...row, status: 'failed' }), code: /^[A-Z_]{1,80}$/.test(error?.code || '') ? error.code : 'DISCORD_DELIVERY_FAILED',
    error: 'L’envoi a été refusé. Vérifie l’accès du bot à ce salon, puis prépare un nouvel aperçu pour réessayer.' };
}
async function recoverAnnouncement(row: Row) {
  if (['queued', 'failed'].includes(row.status)) return result(row);
  if (row.status === 'sent') {
    let message;
    try { message = await discordRequest(`/channels/${row.channel_id}/messages/${row.message_id}`); }
    catch { return result(row, false); } // Preserve the existing receipt, never republish.
    if (!matchingMessage(message, row)) return { ...result(row, false), code: 'DISCORD_ANNOUNCEMENT_MESSAGE_CHANGED', error: 'Le message publié doit être vérifié dans Discord. Aucun nouvel envoi effectué.' };
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
  // A concurrent publisher may have persisted its receipt while history was read.
  const [current] = await sql('select * from discord_community_announcements where id=$1', [row.id]);
  return result(current || { ...row, status: 'uncertain' });
}

// Reconciliation reads Discord only and keeps the immutable original targets,
// including when the community has not joined or the selected servers changed.
export async function recoverCommunityAnnouncement(reference: unknown, guildId?: unknown) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(reference)) {
    throw discordError('Référence d’annonce invalide.', 400, 'DISCORD_ANNOUNCEMENT_REFERENCE_INVALID');
  }
  if (guildId !== undefined && !isDiscordId(guildId)) throw discordError('Serveur Discord invalide.', 400, 'DISCORD_COMMUNITY_GUILD_INVALID');
  const rows = await sql('select * from discord_community_announcements where reference=$1 order by guild_id', [reference]);
  const selected = guildId ? rows.filter(row => row.guild_id === guildId) : rows;
  if (!selected.length) throw discordError('Cette annonce est introuvable.', 404, 'DISCORD_ANNOUNCEMENT_NOT_FOUND');
  const identity = await liveIdentity();
  if (selected.some(row => row.application_id !== getDiscordConfig().applicationId || row.bot_id !== identity.botId)) {
    throw discordError('Cette annonce appartient à une autre configuration Discord.', 409, 'DISCORD_ANNOUNCEMENT_CONFIGURATION_CHANGED');
  }
  return aggregate(reference, await limitedMap(selected, recoverAnnouncement));
}

// Restore the immutable draft after a page reload without sending or changing
// its saved selection. The administrator still prepares a fresh preview.
export async function restoreCommunityAnnouncement(reference: unknown) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(reference)) {
    throw discordError('Référence d’annonce invalide.', 400, 'DISCORD_ANNOUNCEMENT_REFERENCE_INVALID');
  }
  const [batch] = await sql('select * from discord_community_batches where reference=$1', [reference]);
  if (!batch) throw discordError('Cette annonce est introuvable.', 404, 'DISCORD_ANNOUNCEMENT_NOT_FOUND');
  const identity = await liveIdentity();
  if (batch.application_id !== getDiscordConfig().applicationId || batch.bot_id !== identity.botId) {
    throw discordError('Cette annonce appartient à une autre configuration Discord.', 409, 'DISCORD_ANNOUNCEMENT_CONFIGURATION_CHANGED');
  }
  const targets = destinations(batch.destinations);
  const rows = await sql('select * from discord_community_announcements where reference=$1 order by guild_id', [reference]);
  if (rows.length !== targets.length) throw discordError('Les reçus de cette annonce doivent être vérifiés. Aucun nouvel envoi effectué.', 409, 'DISCORD_ANNOUNCEMENT_RECEIPTS_INCOMPLETE');
  return { ...aggregate(reference, rows.map(row => result(row))), content: batch.content, destinations: targets };
}

async function publishDestination(row: Row, setting: Row, deadline: number) {
  // Leave unattempted destinations queued when this synchronous invocation is
  // nearly over; the next explicit publish can safely resume them.
  if (Date.now() + 10_000 > deadline) return result(row);
  if (!['queued', 'failed'].includes(row.status)) return recoverAnnouncement(row);
  const [claimed] = await sql(`with destination as materialized (select 1 from discord_community_settings
      where singleton=true and config_version=$2 for share)
    update discord_community_announcements set status='sending',error_code=null,updated_at=now()
      where id=$1 and status in ('queued','failed') and exists(select 1 from destination) returning *`, [row.id, setting.config_version]);
  if (!claimed) {
    const [current] = await sql('select * from discord_community_announcements where id=$1', [row.id]);
    return recoverAnnouncement(current || row);
  }
  let attempted = false;
  try {
    const current = await settings();
    if (!isDiscordEnabled() || String(current?.config_version) !== String(setting.config_version)) {
      throw discordError('La sélection ou l’activation Discord a changé. Prépare à nouveau l’aperçu.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
    }
    const payload = { embeds: [{ description: row.content, color: 0x67e8f9, footer: { text: footer(row.reference) } }],
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
    } catch { /* A durable sending row also blocks a second POST after storage failure. */ }
    return uncertain ? result({ ...row, status: 'uncertain' }) : deliveryFailure(row, error);
  }
}

export async function publishCommunityAnnouncement(body: Row, userId: string) {
  const deadline = Date.now() + 50_000;
  const input = parseAnnouncement(body);
  const [identity, setting] = await Promise.all([liveIdentity(), settings()]);
  assertConfiguredTargets(input.destinations, setting);
  const [previous] = await sql('select * from discord_community_batches where reference=$1', [input.reference]);
  assertSameReference(previous, input, identity.botId);
  let rows = await sql('select * from discord_community_announcements where reference=$1 order by guild_id', [input.reference]);
  const reconciliationOnly = Boolean(previous && rows.length === input.destinations.length && rows.every(row => !['failed', 'queued'].includes(row.status)));
  verifyPreview(body.previewToken, previewClaims(userId, input, setting), reconciliationOnly);
  if (reconciliationOnly) return aggregate(input.reference, await limitedMap(rows, recoverAnnouncement));
  const pending = previous ? input.destinations.filter(target => rows.some(row => row.guild_id === target.guildId && ['queued', 'failed'].includes(row.status))) : input.destinations;
  await liveDestinations(pending, deadline);
  // One SQL statement durably creates the whole batch and every queued receipt.
  // A terminated invocation can therefore never make a partial send look complete.
  await sql(`with destination as materialized (select 1 from discord_community_settings
      where singleton=true and config_version=$1 and destinations=$2::jsonb for share),
    batch as (insert into discord_community_batches(reference,application_id,bot_id,content,content_hash,destinations)
      select $3,$4,$5,$6,$7,$2::jsonb from destination on conflict(reference) do nothing returning *)
    insert into discord_community_announcements(reference,application_id,guild_id,channel_id,content,content_hash,status,created_by,bot_id)
      select batch.reference,batch.application_id,target->>'guildId',target->>'channelId',batch.content,batch.content_hash,'queued',$8,batch.bot_id
      from batch cross join jsonb_array_elements(batch.destinations) target on conflict(reference,guild_id) do nothing returning *`,
  [setting.config_version, destinationKey(input.destinations), input.reference, getDiscordConfig().applicationId, identity.botId, input.content, input.contentHash, userId]);
  const [batch] = await sql('select * from discord_community_batches where reference=$1', [input.reference]);
  if (!batch) throw discordError('Les destinations ont changé. Prépare à nouveau l’aperçu.', 409, 'DISCORD_ANNOUNCEMENT_PREVIEW_REQUIRED');
  assertSameReference(batch, input, identity.botId);
  rows = await sql('select * from discord_community_announcements where reference=$1 order by guild_id', [input.reference]);
  if (rows.length !== input.destinations.length) throw discordError('Les reçus de cette annonce doivent être vérifiés. Aucun nouvel envoi effectué.', 409, 'DISCORD_ANNOUNCEMENT_RECEIPTS_INCOMPLETE');
  return aggregate(input.reference, await limitedMap(rows, row => publishDestination(row, setting, deadline)));
}
