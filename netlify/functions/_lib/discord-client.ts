import { createHash } from 'node:crypto';
import { getDiscordConfig, isDiscordId } from './discord-config';

export class DiscordApiError extends Error {
  retryAfter: number;
  retryAfterMs: number;
  ambiguous: boolean;
  uncertain: boolean;
  constructor(public status: number, public code: string, options: { retryAfter?: number; ambiguous?: boolean } = {}) {
    const messages: Record<string, string> = {
      DISCORD_FORBIDDEN: 'Le bot ne dispose plus des droits nécessaires dans ce salon.',
      DISCORD_NOT_FOUND: 'Le salon ou le message Discord est introuvable.',
      DISCORD_RATE_LIMITED: 'Discord demande de patienter avant le prochain envoi.',
      DISCORD_UNAUTHORIZED: 'La connexion du bot Discord doit être rétablie.',
      DISCORD_NOT_CONFIGURED: 'L’application Discord est à configurer.',
      DISCORD_UNAVAILABLE: 'Discord est temporairement indisponible.',
      DISCORD_INVALID_RESPONSE: 'La réponse de Discord doit être vérifiée.',
      DISCORD_INVALID_REQUEST: 'La publication ne peut pas être envoyée sous cette forme.',
      DISCORD_FILE_TOO_LARGE: 'Le visuel dépasse la taille prévue pour cette publication.',
    };
    super(messages[code] || 'La requête Discord a échoué.');
    this.name = 'DiscordApiError';
    this.retryAfter = Number.isFinite(Number(options.retryAfter)) ? Math.max(0, Number(options.retryAfter) || 0) : 0;
    this.retryAfterMs = this.retryAfter * 1000;
    this.ambiguous = this.uncertain = Boolean(options.ambiguous);
  }
}

type DiscordFile = { name: string; bytes: Uint8Array };
type RequestOptions = { method?: string; body?: any; files?: DiscordFile[] };

export async function discordRequest(path: string, options: RequestOptions = {}): Promise<any> {
  const { botToken } = getDiscordConfig();
  if (!botToken) throw new DiscordApiError(503, 'DISCORD_NOT_CONFIGURED');
  // Relative API routes only: credentials must never follow a caller-provided host.
  if (!/^\/(users\/@me(?:\/guilds)?|guilds\/[0-9]{17,20}(?:\/(?:channels|roles|members\/[0-9]{17,20}))?|channels\/[0-9]{17,20}(?:\/messages(?:\/[0-9]{17,20})?)?|applications\/(?:@me|[0-9]{17,20}(?:\/guilds\/[0-9]{17,20})?\/commands))(?:\?[^#]*)?$/.test(path)) {
    throw new DiscordApiError(400, 'DISCORD_INVALID_REQUEST');
  }
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw new DiscordApiError(400, 'DISCORD_INVALID_REQUEST');
  const messageMutation = ['POST', 'PATCH'].includes(method) && /^\/channels\/[0-9]{17,20}\/messages(?:\/[0-9]{17,20})?$/.test(path);
  let requestBody = options.body;
  if (messageMutation) {
    requestBody = { ...options.body, allowed_mentions: options.body?.allowed_mentions || { parse: [], users: [], roles: [], replied_user: false } };
    if (method === 'PATCH') { delete requestBody.nonce; delete requestBody.enforce_nonce; }
  }
  const mutating = !['GET', 'HEAD'].includes(method);
  const headers: Record<string, string> = { Authorization: 'Bot ' + botToken, 'User-Agent': 'DiscordBot (https://nxt5.org, 1.0)' };
  let body: BodyInit | undefined;
  if (options.files?.length) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(requestBody || {}));
    options.files.forEach((file, index) => {
      if (file.bytes.byteLength > 8 * 1024 * 1024) throw new DiscordApiError(413, 'DISCORD_FILE_TOO_LARGE');
      form.append('files[' + index + ']', new Blob([new Uint8Array(file.bytes)], { type: 'image/png' }), file.name);
    });
    body = form;
  } else if (requestBody !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(requestBody);
  }
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10' + path, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new DiscordApiError(503, 'DISCORD_UNAVAILABLE', { ambiguous: mutating });
  }
  if (response.status === 204) return null;
  let result: any;
  try { result = await response.json(); } catch { /* Classify HTTP failures even when Discord returns an HTML error page. */ }
  if (!response.ok) {
    const status = response.status;
    const code = status === 401 ? 'DISCORD_UNAUTHORIZED' : status === 403 ? 'DISCORD_FORBIDDEN'
      : status === 404 ? 'DISCORD_NOT_FOUND' : status === 429 ? 'DISCORD_RATE_LIMITED'
      : status >= 500 ? 'DISCORD_UNAVAILABLE' : 'DISCORD_INVALID_REQUEST';
    const retryValue = Number(result?.retry_after ?? response.headers.get('retry-after') ?? 1);
    const retryAfter = Number.isFinite(retryValue) && retryValue > 0 ? retryValue : 1;
    throw new DiscordApiError(status, code, { retryAfter: status === 429 ? retryAfter : 0, ambiguous: mutating && status >= 500 });
  }
  if (result === null || typeof result !== 'object') {
    throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE', { ambiguous: mutating });
  }
  return result;
}

let botIdentity: { token: string; id: string } | null = null;
export async function getDiscordBotUserId(): Promise<string> {
  const token = getDiscordConfig().botToken;
  if (botIdentity?.token === token) return botIdentity.id;
  const me = await discordRequest('/users/@me');
  if (!isDiscordId(me?.id) || me?.bot !== true) throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE');
  botIdentity = { token, id: me.id };
  return me.id;
}

export function discordPermissions(guild: any, roles: any[], member: any, channel?: any): bigint {
  if (!isDiscordId(guild?.id) || !isDiscordId(member?.user?.id) || !Array.isArray(roles) || !Array.isArray(member.roles)) return 0n;
  if (isDiscordId(guild.owner_id) && guild.owner_id === member.user.id) return (1n << 63n) - 1n;
  const bits = (value: unknown): bigint | null => {
    if (value === null || value === undefined) return 0n;
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
    if (!/^[0-9]+$/.test(String(value))) return null;
    try { return BigInt(String(value)); } catch { return null; }
  };
  const roleIds = new Set([String(guild.id), ...member.roles.map(String)]);
  let permissions = 0n;
  for (const role of roles.filter((role) => roleIds.has(String(role.id)))) {
    const value = bits(role.permissions);
    if (value === null) return 0n;
    permissions |= value;
  }
  if (permissions & 8n) return (1n << 63n) - 1n;
  const overwrites = channel?.permission_overwrites || [];
  if (!Array.isArray(overwrites)) return 0n;
  const relevant = overwrites.filter((item) => Number(item.type) === 0 ? roleIds.has(String(item.id)) : Number(item.type) === 1 && String(item.id) === member.user.id);
  if (relevant.some((item) => bits(item.deny) === null || bits(item.allow) === null)) return 0n;
  const everyone = relevant.find((item) => Number(item.type) === 0 && String(item.id) === String(guild.id));
  if (everyone) permissions = (permissions & ~bits(everyone.deny)!) | bits(everyone.allow)!;
  const roleOverwrites = relevant.filter((item) => Number(item.type) === 0 && String(item.id) !== String(guild.id));
  const deny: bigint = roleOverwrites.reduce((value: bigint, item: any): bigint => value | bits(item.deny)!, 0n);
  const allow: bigint = roleOverwrites.reduce((value: bigint, item: any): bigint => value | bits(item.allow)!, 0n);
  permissions = (permissions & ~deny) | allow;
  const own = relevant.find((item) => Number(item.type) === 1 && String(item.id) === member.user.id);
  if (own) permissions = (permissions & ~bits(own.deny)!) | bits(own.allow)!;
  // Discord timeout retains viewing/history only; it does not grant either.
  if (Date.parse(member.communication_disabled_until || '') > Date.now()) permissions &= 1024n | 65536n;
  return permissions;
}

export async function getDiscordGuild(guildId: string) {
  if (!isDiscordId(guildId)) throw new DiscordApiError(400, 'DISCORD_INVALID_REQUEST');
  const botId = await getDiscordBotUserId();
  const [guild, channels, roles, member] = await Promise.all([
    discordRequest('/guilds/' + guildId), discordRequest('/guilds/' + guildId + '/channels'),
    discordRequest('/guilds/' + guildId + '/roles'), discordRequest('/guilds/' + guildId + '/members/' + botId),
  ]);
  if (guild?.id !== guildId || member?.user?.id !== botId || !Array.isArray(channels) || !Array.isArray(roles)) throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE');
  const required = 1024n | 2048n | 16384n | 32768n | 65536n;
  return {
    guild: { id: guild.id, name: guild.name },
    channels: channels.filter((channel) => isDiscordId(channel.id) && [0, 5].includes(channel.type) && (!channel.guild_id || channel.guild_id === guildId)).map((channel) => {
      const permissions = discordPermissions(guild, roles, member, channel);
      return { id: channel.id, name: channel.name, canSend: (permissions & required) === required,
        canMentionRoles: Boolean(permissions & (1n << 17n)) };
    }),
    roles: roles.filter((role) => isDiscordId(role.id) && String(role.id) !== guildId && !role.managed).map((role) => ({ id: role.id, name: role.name, mentionable: Boolean(role.mentionable) })),
  };
}

export function cleanDiscordText(value: unknown, maxLength = 1000): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/([\\`*_{}\[\]<>~|])/g, '\\$1').slice(0, maxLength);
}

export function buildDiscordMessage(snapshot: any, options: {
  includeHints?: boolean; mentionRoleId?: string | null; reference: string; siteUrl: string; hasImage?: boolean; filename?: string;
}) {
  const context = snapshot.context || {};
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  const number = (value: number, compact = false) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: compact ? 1 : 0 }).format(compact && Math.abs(value) >= 1000 ? value / 1000 : value) + (compact && Math.abs(value) >= 1000 ? ' k' : '');
  const brief = (value: unknown, limit: number) => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return cleanDiscordText(text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text, limit * 2);
  };
  const pair = (key: string, compact = false) => {
    const fact = snapshot.facts?.[key];
    return finite(fact?.ally) && finite(fact?.enemy) ? number(fact.ally, compact) + '–' + number(fact.enemy, compact) : null;
  };
  const title = brief(context.teamName || 'Équipe NXT5', 95) + ' vs ' + brief(context.opponentName || 'Adversaire', 95);
  const allCategories = (Array.isArray(context.categories) ? context.categories : []).map((item) => brief(item?.name, 36)).filter(Boolean);
  const categories = [...allCategories.slice(0, 2), ...(allCategories.length > 2 ? ['+' + (allCategories.length - 2)] : [])].join(' · ');
  const score = pair('kills');
  const summary = [brief(context.result || 'Résultat indisponible', 40), score ? score + ' kills' : null, context.duration ? brief(context.duration, 24) : 'Durée indisponible'].filter(Boolean).join(' · ');
  const description = [summary, categories].filter(Boolean).join('\n');
  const game = new URL('/statistiques', options.siteUrl);
  game.searchParams.set('team', snapshot.teamId);
  game.searchParams.set('match', snapshot.entityId);
  const essentials = [['gold', 'Or'], ['dragons', 'Dragons'], ['towers', 'Tours']].flatMap(([key, label]) => {
    const value = pair(key, key === 'gold');
    return value ? [label + ' ' + value] : [];
  }).join(' · ');
  // The PNG carries the detail. Keep only a useful text fallback when it cannot
  // be attached, instead of doubling the card's height with the same numbers.
  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (!options.hasImage) fields.push({ name: 'Notre équipe / adversaire', value: essentials || 'Statistiques indisponibles.', inline: false });
  if (options.includeHints) {
    const hint = (Array.isArray(snapshot.reviewHints) ? snapshot.reviewHints : []).find((item) => item && item.availability !== 'insufficient' && (item.observation || item.action));
    const value = hint ? [brief(hint.observation, 210), brief(hint.action, 110)].filter(Boolean).join('\n') : '';
    if (value) fields.push({ name: 'Piste de review', value, inline: false });
  }
  const filename = options.filename || 'nxt5-game.png';
  if (!/^[a-zA-Z0-9_.-]{1,128}\.png$/.test(filename) || !options.reference || options.reference.length > 160) throw new DiscordApiError(400, 'DISCORD_INVALID_REQUEST');
  const roleId = isDiscordId(options.mentionRoleId) ? options.mentionRoleId : null;
  const embed: any = { title: title.slice(0, 256), description, color: 0x67e8f9, url: game.toString(), fields,
    footer: { text: 'NXT5 · ' + options.reference }, ...(options.hasImage ? { image: { url: 'attachment://' + filename } } : {}) };
  return {
    content: roleId ? '<@&' + roleId + '>' : '',
    embeds: [embed],
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [], users: [], replied_user: false },
    nonce: createHash('sha256').update(options.reference).digest('hex').slice(0, 24),
    enforce_nonce: true,
    attachments: options.hasImage ? [{ id: 0, filename, description: [title, summary, essentials].filter(Boolean).join('. ').slice(0, 1024) }] : [],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Voir la game sur NXT5', url: game.toString() }] }],
  };
}

export async function findDiscordMessage(channelId: string, { reference, after }: { reference: string; after?: Date | string }) {
  if (!isDiscordId(channelId)) throw new DiscordApiError(400, 'DISCORD_INVALID_REQUEST');
  const botId = await getDiscordBotUserId();
  const messages = await discordRequest('/channels/' + channelId + '/messages?limit=100');
  if (!Array.isArray(messages)) throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE');
  const earliest = after ? new Date(after).getTime() - 60_000 : 0;
  return messages.find((message) => message.author?.id === botId && (!earliest || Date.parse(message.timestamp) >= earliest)
    && message.embeds?.some((embed) => embed.footer?.text === 'NXT5 · ' + reference)) || null;
}
