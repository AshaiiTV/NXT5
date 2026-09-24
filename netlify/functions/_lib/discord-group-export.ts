import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from './db';
import { auditDiscord, discordError, uuid } from './discord-access';
import { cleanDiscordText, discordRequest, DiscordApiError, findDiscordMessage, getDiscordBotUserId, getDiscordGuild } from './discord-client';
import { getDiscordConfig, isDiscordEnabled, isDiscordId } from './discord-config';
import { assertSubjectRateLimit } from './rate-limit';
import { renderGroupPublicationPng } from './publication-render';
import { buildGroupPublicationSnapshot } from '../../../shared/publications/group-publication.js';

export const GROUP_EXPORT_SCHEMA = 'discord-group-exports-20260924-v1';
const PREVIEW_LIFETIME = 10 * 60_000;
const STALE_SEND_MS = 90_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ERROR_MESSAGES: Record<string, string> = {
  DISCORD_GROUP_UNCONFIRMED: 'L’envoi n’a pas encore pu être confirmé. Vérifie le message dans Discord avant de continuer.',
  DISCORD_GROUP_FAILED: 'L’export du groupe a échoué. Prépare un nouvel aperçu pour réessayer.',
  DISCORD_GROUP_PREVIEW_REQUIRED: 'Le groupe ou le salon a changé. Prépare un nouvel aperçu.',
  DISCORD_GROUP_UNAVAILABLE: 'Le groupe ou le salon n’est plus disponible.',
  DISCORD_GROUP_EMPTY: 'Ce groupe ne contient plus de game.',
  DISCORD_GROUP_MATCH_UNAVAILABLE: 'Certaines games du groupe ne sont plus accessibles.',
  DISCORD_GROUP_CATEGORIES_MISMATCH: 'Les games du groupe ne correspondent plus aux catégories du salon.',
  DISCORD_GROUP_MESSAGE_MISMATCH: 'Ce message ne correspond pas à cet envoi NXT5. Vérifie son identifiant dans le salon indiqué.',
  DISCORD_GROUP_VERIFY_FAILED: 'Le message ne peut pas être vérifié pour le moment. Vérifie son identifiant et les droits du bot.',
  DISCORD_FORBIDDEN: 'Le bot ne dispose plus des droits nécessaires dans ce salon.',
  DISCORD_NOT_FOUND: 'Le salon ou le message Discord est introuvable.',
  DISCORD_RATE_LIMITED: 'Discord demande de patienter avant de réessayer.',
  DISCORD_UNAUTHORIZED: 'La connexion du bot Discord doit être rétablie.',
  DISCORD_NOT_CONFIGURED: 'La connexion Discord est à configurer.',
  DISCORD_UNAVAILABLE: 'Discord est temporairement indisponible. Vérifie cet envoi avant de continuer.',
  DISCORD_INVALID_RESPONSE: 'La réponse de Discord ne confirme pas l’envoi. Vérifie le message avant de continuer.',
  DISCORD_INVALID_REQUEST: 'Discord a refusé cette publication. Prépare un nouvel aperçu.',
  DISCORD_FILE_TOO_LARGE: 'Le visuel dépasse la taille autorisée par Discord.',
};
type Row = Record<string, any>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const reference = (row: Row) => `group:${row.team_id}:${row.request_id}`;
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export async function assertDiscordGroupSchemaReady() {
  try {
    if ((await sql('select migration_key from app_schema_migrations where migration_key=$1', [GROUP_EXPORT_SCHEMA])).length) return;
  } catch { /* Stable public maintenance response. */ }
  throw discordError('La mise à jour des exports de groupes Discord doit être appliquée.', 503, 'DISCORD_GROUP_SCHEMA_REQUIRED');
}

async function loadGroup(teamId: string, archiveId: string, routeId: string): Promise<Row & { sourceHash: string; snapshot: ReturnType<typeof buildGroupPublicationSnapshot> }> {
  // Group, participants and route are read from the same PostgreSQL snapshot.
  const [row] = await sql(`select to_jsonb(a) as archive,jsonb_build_object('id',t.id,'name',t.name) as team,
    to_jsonb(r) as route,c.status as connection_status,c.config_version,
    coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('participants',coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.id) from match_participants p where p.match_id=m.id),'[]'::jsonb)) order by m.id)
      from matches m where m.team_id=a.team_id and a.match_ids ? m.id::text),'[]'::jsonb) as matches,
    coalesce((select jsonb_agg(jsonb_build_object('id',mc.id,'name',mc.name) order by mc.id)
      from match_categories mc where mc.team_id=a.team_id),'[]'::jsonb) as categories
    from match_archives a join teams t on t.id=a.team_id join discord_connections c on c.team_id=a.team_id
    join discord_routes r on r.team_id=a.team_id and r.guild_id=c.guild_id
    where a.id=$1 and a.team_id=$2 and r.id=$3 and r.enabled and c.status in ('active','paused')`, [archiveId, teamId, routeId]);
  if (!row) throw discordError('Groupe ou destination indisponible pour cette équipe.', 404, 'DISCORD_GROUP_UNAVAILABLE');
  const ids = row.archive.match_ids;
  if (!Array.isArray(ids) || !ids.length) throw discordError('Ajoute au moins une game au groupe avant de le partager.', 409, 'DISCORD_GROUP_EMPTY');
  const requested = new Set(ids.map(value => uuid(value, 'Game du groupe').toLowerCase()));
  if (requested.size !== ids.length || requested.size !== row.matches.length || row.matches.some((match: Row) => !requested.has(match.id))) {
    throw discordError('Certaines games du groupe sont supprimées ou ne sont pas accessibles à cette équipe. Actualise le groupe.', 409, 'DISCORD_GROUP_MATCH_UNAVAILABLE');
  }
  const selected = row.route.category_ids || [];
  if (selected.length && row.matches.some((match: Row) => !selected.some((id: string) => [...(match.category_ids || []), match.category_id].includes(id)))) {
    throw discordError('Toutes les games du groupe doivent correspondre aux catégories de ce salon.', 409, 'DISCORD_GROUP_CATEGORIES_MISMATCH');
  }
  const snapshot = buildGroupPublicationSnapshot({ team: row.team, archive: row.archive, matches: row.matches, categories: row.categories,
    sourceRevision: '' });
  // Only the public projection contributes: private notes are never published.
  const sourceHash = hash(JSON.stringify(canonical(snapshot)));
  return { ...row, snapshot, sourceHash };
}

function claims(userId: string, group: Row) {
  return { purpose: 'group-export', userId, applicationId: getDiscordConfig().applicationId, teamId: group.team.id,
    archiveId: group.archive.id, routeId: group.route.id, guildId: group.route.guild_id, channelId: group.route.channel_id,
    configVersion: String(group.config_version), sourceHash: group.sourceHash,
    routeHash: hash(JSON.stringify(canonical(group.route))) };
}
function signPreview(value: Row) {
  const payload = Buffer.from(JSON.stringify({ ...value, expiresAt: Date.now() + PREVIEW_LIFETIME })).toString('base64url');
  return payload + '.' + createHmac('sha256', getDiscordConfig().workerSecret).update(payload).digest('hex');
}
function previewInvalid() {
  return discordError('Le groupe, le salon ou la validité de l’aperçu a changé. Prépare un nouvel aperçu avant de publier.', 409, 'DISCORD_GROUP_PREVIEW_REQUIRED');
}
function verifyPreview(value: unknown, expected: Row) {
  if (typeof value !== 'string' || value.length > 2500 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw previewInvalid();
  const [payload, signature] = value.split('.');
  if (!timingSafeEqual(createHmac('sha256', getDiscordConfig().workerSecret).update(payload).digest(), Buffer.from(signature, 'hex'))) throw previewInvalid();
  let decoded: Row;
  try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw previewInvalid(); }
  if (!decoded || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt < Date.now() || decoded.expiresAt > Date.now() + PREVIEW_LIFETIME
    || Object.entries(expected).some(([key, item]) => decoded[key] !== item)) throw previewInvalid();
  return decoded;
}

async function groupImage(snapshot: any) {
  try {
    const image = await renderGroupPublicationPng(snapshot);
    return image.bytes.byteLength <= MAX_IMAGE_BYTES ? image : null;
  } catch (error: any) {
    if (error?.code === 'GROUP_PNG_TOO_LARGE') return null;
    throw error;
  }
}
function buildGroupMessage(snapshot: any, referenceId: string, image: Awaited<ReturnType<typeof groupImage>>) {
  const context = snapshot.context, facts = snapshot.facts;
  const url = new URL('/games', getDiscordConfig().siteUrl);
  url.searchParams.set('team', snapshot.teamId); url.searchParams.set('archive', snapshot.entityId); url.searchParams.set('view', 'groups');
  const title = cleanDiscordText(`${context.teamName} · ${context.groupName}`, 256);
  const result = `${facts.games} game${facts.games > 1 ? 's' : ''} · ${facts.wins} victoire${facts.wins > 1 ? 's' : ''} · ${facts.losses} défaite${facts.losses > 1 ? 's' : ''}`;
  const fields: any[] = facts.unknown ? [{ name: 'Résultats indisponibles', value: String(facts.unknown), inline: true }] : [];
  if (!image) fields.push({ name: 'Visuel', value: 'Ce groupe est trop volumineux pour joindre son PNG. Le bilan complet reste accessible sur NXT5.', inline: false });
  const embed: any = { title, description: result, color: 0x67e8f9, fields, url: url.toString(), footer: { text: 'NXT5 · ' + referenceId },
    ...(image ? { image: { url: 'attachment://' + image.filename } } : {}) };
  return { content: '', embeds: [embed], allowed_mentions: { parse: [], roles: [], users: [], replied_user: false },
    nonce: hash(referenceId).slice(0, 24), enforce_nonce: true,
    attachments: image ? [{ id: 0, filename: image.filename, description: `${title}. ${result}`.slice(0, 1024) }] : [],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Voir le groupe sur NXT5', url: url.toString() }] }] };
}

export async function previewDiscordGroup({ teamId, archiveId, routeId, userId }: { teamId: string; archiveId: string; routeId: string; userId: string }) {
  if (!getDiscordConfig().configured) throw discordError('La connexion Discord est à configurer.', 503, 'DISCORD_NOT_CONFIGURED');
  const group = await loadGroup(teamId, archiveId, routeId), image = await groupImage(group.snapshot);
  return { message: buildGroupMessage(group.snapshot, 'aperçu du groupe', image), sourceHash: group.sourceHash,
    imageDataUrl: image ? 'data:image/png;base64,' + Buffer.from(image.bytes).toString('base64') : null,
    previewToken: signPreview({ ...claims(userId, group), hasImage: Boolean(image) }) };
}

export function publicDiscordGroupExport(row: Row) {
  const stale = row.status === 'sending' && Date.now() - new Date(row.created_at).getTime() > STALE_SEND_MS;
  const errorCode = stale ? 'DISCORD_GROUP_UNCONFIRMED' : row.error_code || null;
  return { id: row.id, requestId: row.request_id, archiveId: row.archive_id, routeId: row.route_id,
    guildId: row.guild_id, channelId: row.channel_id, channelName: row.channel_name, sourceHash: row.source_hash,
    status: stale ? 'uncertain' : row.status, createdAt: row.created_at, completedAt: row.completed_at,
    errorCode, lastError: errorCode ? ERROR_MESSAGES[errorCode] || 'L’envoi doit être vérifié. Consulte son état avant de réessayer.' : null,
    messageUrl: row.status === 'succeeded' && isDiscordId(row.message_id) ? `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}` : null };
}
async function stored(teamId: string, requestId: string) {
  return (await sql('select * from discord_group_exports where team_id=$1 and request_id=$2', [teamId, requestId]))[0];
}
async function reconcile(row: Row, messageId?: string) {
  if ((publicDiscordGroupExport(row).status !== 'uncertain' && !(messageId && row.status === 'sending')) || !isDiscordEnabled()
    || row.application_id !== getDiscordConfig().applicationId) return publicDiscordGroupExport(row);
  await assertSubjectRateLimit('discord-group-reconcile', row.team_id, { limit: 6, windowSeconds: 60 });
  try {
    // Missing history never proves that Discord did not receive the first POST.
    let found: any;
    if (messageId) {
      const botId = await getDiscordBotUserId();
      const message = await discordRequest(`/channels/${row.channel_id}/messages/${messageId}`);
      if (message?.id !== messageId || message.channel_id !== row.channel_id || message.author?.id !== botId
        || !message.embeds?.some((embed: any) => embed.footer?.text === 'NXT5 · ' + reference(row))) {
        return { ...publicDiscordGroupExport(row), errorCode: 'DISCORD_GROUP_MESSAGE_MISMATCH', lastError: ERROR_MESSAGES.DISCORD_GROUP_MESSAGE_MISMATCH };
      }
      found = message;
    } else found = await findDiscordMessage(row.channel_id, { reference: reference(row), after: row.created_at });
    if (isDiscordId(found?.id) && found.channel_id === row.channel_id) {
      const [saved] = await sql("update discord_group_exports set status='succeeded',message_id=$2,error_code=null,completed_at=now() where id=$1 and status in ('sending','uncertain') returning *", [row.id, found.id]);
      if (saved) return publicDiscordGroupExport(saved);
    }
  } catch {
    // Preserve the durable fence until a delivery can be confirmed.
    if (messageId) return { ...publicDiscordGroupExport(row), errorCode: 'DISCORD_GROUP_VERIFY_FAILED', lastError: ERROR_MESSAGES.DISCORD_GROUP_VERIFY_FAILED };
  }
  return publicDiscordGroupExport(row);
}
export async function verifyDiscordGroup({ teamId, archiveId, requestId, messageId }: { teamId: string; archiveId: string; requestId: string; messageId?: string }) {
  if (messageId !== undefined && !isDiscordId(messageId)) throw discordError('L’identifiant du message Discord doit contenir 17 à 20 chiffres.', 400, 'DISCORD_GROUP_MESSAGE_ID_INVALID');
  const row = await stored(teamId, requestId);
  if (!row) return { requestId, status: 'not_found', messageUrl: null };
  if (row.archive_id !== archiveId) throw discordError('Cet envoi appartient à un autre groupe.', 409, 'DISCORD_GROUP_REQUEST_CONFLICT');
  return reconcile(row, messageId);
}
export async function listDiscordGroupExports(teamId: string, archiveId: string) {
  return (await sql('select * from discord_group_exports where team_id=$1 and archive_id=$2 order by created_at desc,id desc limit 20', [teamId, archiveId])).map(publicDiscordGroupExport);
}

export async function publishDiscordGroup(input: { teamId: string; archiveId: string; routeId: string; requestId: string; userId: string; previewToken: unknown }) {
  const { teamId, archiveId, routeId, requestId, userId } = input;
  const previous = await stored(teamId, requestId);
  if (previous) {
    if (previous.archive_id !== archiveId || previous.route_id !== routeId) throw discordError('Cet identifiant d’envoi appartient à un autre groupe ou salon.', 409, 'DISCORD_GROUP_REQUEST_CONFLICT');
    return reconcile(previous);
  }
  if (!isDiscordEnabled()) throw discordError('Les envois Discord sont suspendus sur cet environnement.', 409, 'DISCORD_PUBLISHING_DISABLED');
  const group = await loadGroup(teamId, archiveId, routeId);
  verifyPreview(input.previewToken, claims(userId, group));
  if (group.connection_status !== 'active') throw discordError('Active la diffusion de cette équipe avant de partager ce groupe.', 409, 'DISCORD_GROUP_CONNECTION_PAUSED');
  const existing = await sql(`select * from discord_group_exports where team_id=$1 and archive_id=$2 and guild_id=$3 and channel_id=$4
    and (status in ('sending','uncertain') or (status='succeeded' and source_hash=$5)) order by created_at desc limit 1`,
  [teamId, archiveId, group.route.guild_id, group.route.channel_id, group.sourceHash]);
  if (existing[0]) return reconcile(existing[0]);
  const image = await groupImage(group.snapshot);
  verifyPreview(input.previewToken, { ...claims(userId, group), hasImage: Boolean(image) });
  const live = await getDiscordGuild(group.route.guild_id);
  if (live.guild.id !== group.route.guild_id || !live.channels.some(channel => channel.id === group.route.channel_id && channel.canSend)) {
    throw discordError('Le bot ne peut pas publier dans ce salon.', 409, 'DISCORD_GROUP_CHANNEL_FORBIDDEN');
  }
  // The receipt is the mutex; both uniqueness constraints fence concurrent UUIDs.
  const [claimed] = await sql(`insert into discord_group_exports(team_id,request_id,archive_id,route_id,application_id,guild_id,channel_id,channel_name,config_version,source_hash,status,created_by)
    select r.team_id,$3,$4,r.id,$5,r.guild_id,r.channel_id,r.channel_name,c.config_version,$6,'sending',$7
    from discord_routes r join discord_connections c on c.team_id=r.team_id join match_archives a on a.team_id=r.team_id and a.id=$4
    where r.team_id=$1 and r.id=$2 and r.enabled and c.status='active' and c.guild_id=r.guild_id
      and r.guild_id=$8 and r.channel_id=$9 and c.config_version=$10
    on conflict do nothing returning *`, [teamId, routeId, requestId, archiveId, getDiscordConfig().applicationId, group.sourceHash, userId,
    group.route.guild_id, group.route.channel_id, group.config_version]);
  if (!claimed) {
    const raced = await stored(teamId, requestId) || (await sql(`select * from discord_group_exports where team_id=$1 and archive_id=$2 and guild_id=$3 and channel_id=$4
      and (status in ('sending','uncertain') or (status='succeeded' and source_hash=$5)) order by created_at desc limit 1`,
    [teamId, archiveId, group.route.guild_id, group.route.channel_id, group.sourceHash]))[0];
    if (raced) {
      if (raced.archive_id !== archiveId || (raced.request_id === requestId && raced.route_id !== routeId)) throw discordError('Cet identifiant d’envoi appartient à un autre groupe ou salon.', 409, 'DISCORD_GROUP_REQUEST_CONFLICT');
      return reconcile(raced);
    }
    throw previewInvalid();
  }
  let attempted = false;
  try {
    await auditDiscord(userId, teamId, 'discord.group_export_requested', { archiveId, routeId, requestId, sourceHash: group.sourceHash });
    // Rendering and live permission checks may take time. Re-read every source and
    // destination guard immediately before the one permitted Discord mutation.
    const current = await loadGroup(teamId, archiveId, routeId);
    verifyPreview(input.previewToken, { ...claims(userId, current), hasImage: Boolean(image) });
    if (!isDiscordEnabled() || current.connection_status !== 'active') throw previewInvalid();
    const message = buildGroupMessage(group.snapshot, reference(claimed), image);
    attempted = true;
    const result = await discordRequest(`/channels/${claimed.channel_id}/messages`, { method: 'POST', body: message,
      ...(image ? { files: [{ name: image.filename, bytes: image.bytes }] } : {}) });
    if (!isDiscordId(result?.id) || result.channel_id !== claimed.channel_id) throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE', { ambiguous: true });
    const [saved] = await sql("update discord_group_exports set status='succeeded',message_id=$2,error_code=null,completed_at=now() where id=$1 and status in ('sending','uncertain') returning *", [claimed.id, result.id]);
    return publicDiscordGroupExport(saved || { ...claimed, status: 'uncertain', error_code: 'DISCORD_GROUP_UNCONFIRMED' });
  } catch (error: any) {
    const uncertain = attempted && (!(error instanceof DiscordApiError) || error.ambiguous || error.status >= 500);
    const status = uncertain ? 'uncertain' : 'failed';
    const code = error instanceof DiscordApiError || String(error?.code || '').startsWith('DISCORD_') ? error.code : 'DISCORD_GROUP_FAILED';
    try {
      const [saved] = await sql("update discord_group_exports set status=$2,error_code=$3,completed_at=case when $2='failed' then now() else null end where id=$1 and status='sending' returning *", [claimed.id, status, code]);
      if (saved) return publicDiscordGroupExport(saved);
      const current = await stored(teamId, requestId);
      if (current) return publicDiscordGroupExport(current);
    } catch { /* A stored sending row is itself a durable no-resend fence. */ }
    return publicDiscordGroupExport({ ...claimed, status, error_code: code });
  }
}
