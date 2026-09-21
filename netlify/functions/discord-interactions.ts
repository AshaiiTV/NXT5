import type { Config, Context } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { createHash } from 'node:crypto';
import { sql } from './_lib/db';
import { json } from './_lib/http';
import { getDiscordConfig, verifyDiscordInteraction, isDiscordId, isDiscordEnabled, publicDiscordStatus } from './_lib/discord-config';
import { assertDiscordSchemaReady } from './_lib/discord-queue';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { getDiscordGuild } from './_lib/discord-client';

function responseMessage(content: string) {
  return { content, allowed_mentions: { parse: [] } };
}
function canManageServer(interaction: any) {
  try {
    const permissions = BigInt(interaction.member?.permissions || '0');
    return Boolean(permissions & (32n | 8n));
  } catch { return false; }
}
const teamCommands = ['statut', 'pause', 'reprendre'];
const cleanLabel = (value: unknown, limit = 100) => Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ')).slice(0, limit).join('');
const teamName = (connection: any) => cleanLabel(connection.team_name || 'Équipe NXT5').replace(/([\\*_`~|<>\[\]()])/g, '\\$1');

// Suggestions disclose only teams already linked to this guild, and only to
// Discord server managers. Choosing a label submits its stable team ID.
export async function discordTeamChoices(interaction: any) {
  if (!isDiscordId(interaction.guild_id) || !isDiscordId(interaction.member?.user?.id) || !canManageServer(interaction)) return [];
  const command = interaction.data?.options?.[0];
  const option = command?.options?.find((item: any) => item.name === 'equipe' && item.focused === true);
  if (!teamCommands.includes(command?.name) || typeof option?.value !== 'string' || option.value.length > 100) return [];
  await assertDiscordSchemaReady();
  await assertSubjectRateLimit('discord-autocomplete', interaction.guild_id + ':' + interaction.member.user.id, { limit: 60, windowSeconds: 60 });
  const search = option.value.trim();
  const rows = await sql(`select c.team_id,t.name as team_name,t.tag from discord_connections c join teams t on t.id=c.team_id
    where c.guild_id=$1 and c.status<>'disconnected' and ($2='' or strpos(lower(t.name || ' ' || coalesce(t.tag,'')),lower($2))>0 or c.team_id::text=$2)
    order by lower(t.name),c.team_id limit 25`, [interaction.guild_id, search]);
  return rows.map((row) => ({ name: cleanLabel(row.team_name, 65) + (row.tag ? ' [' + cleanLabel(row.tag, 10) + ']' : '') + ' · ' + row.team_id.slice(-8), value: row.team_id }));
}

async function autocompleteResponse(interaction: any) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    // Autocomplete cannot be deferred: return an empty list before Discord's
    // three-second deadline if the database is slow. No team state is changed.
    const choices = await Promise.race([discordTeamChoices(interaction), new Promise<[]>(resolve => { timer = setTimeout(() => resolve([]), 2000); })]);
    return json({ type: 8, data: { choices } });
  } catch { return json({ type: 8, data: { choices: [] } }); }
  finally { clearTimeout(timer!); }
}
export async function executeDiscordCommand(interaction: any): Promise<string> {
  await assertDiscordSchemaReady();
  if (!isDiscordId(interaction.id) || !isDiscordId(interaction.guild_id) || !isDiscordId(interaction.member?.user?.id)) return 'Commande Discord invalide.';
  if (!canManageServer(interaction)) return 'La gestion de cette connexion est réservée aux responsables du serveur.';
  const claimed=await sql("insert into discord_interaction_receipts(interaction_id,guild_id,discord_user_id,command_name) values($1,$2,$3,$4) on conflict(interaction_id) do nothing returning interaction_id",
    [interaction.id,interaction.guild_id,interaction.member.user.id,String(interaction.data?.options?.[0]?.name || '').slice(0,40)]);
  if (!claimed.length) {
    const [receipt]=await sql("select status,response_text,created_at from discord_interaction_receipts where interaction_id=$1",[interaction.id]);
    return receipt?.response_text || 'Cette commande a déjà été reçue. Consulte la connexion dans NXT5 avant de lancer une nouvelle commande.';
  }
  try {
    const response=await executeClaimedCommand(interaction);
    await sql("update discord_interaction_receipts set status='completed',response_text=$2,completed_at=now() where interaction_id=$1 and status='processing'",[interaction.id,response]);
    return response;
  } catch(error:any) {
    const response=commandFailureMessage(error);
    await sql("update discord_interaction_receipts set status='failed',response_text=$2,error_code=$3,completed_at=now() where interaction_id=$1 and status='processing'",[interaction.id,response,String(error?.code || 'COMMAND_FAILED').slice(0,100)]);
    return response;
  }
}

function commandFailureMessage(error:any) {
  if (error?.code==='23505' || error?.code==='22012') return 'La liaison a changé ou ce code a déjà été utilisé. Actualise NXT5 et réessaie.';
  if (error?.status===429) return 'Trop de commandes rapprochées. Patiente un instant puis réessaie.';
  return 'L’opération n’a pas pu aboutir. Vérifie la connexion dans NXT5 puis réessaie.';
}

async function executeClaimedCommand(interaction:any):Promise<string> {
  const guildId = interaction.guild_id;
  await assertSubjectRateLimit('discord-command', guildId + ':' + interaction.member.user.id, { limit: 8, windowSeconds: 60 });
  const command = interaction.data?.options?.[0];
  if (command?.name === 'connecter') {
    const provided = String(command.options?.find((option) => option.name === 'code')?.value || '').toUpperCase();
    if (!/^[A-F0-9 -]{16,24}$/.test(provided)) return 'Code invalide. Génère un nouveau code dans les réglages Discord de ton équipe NXT5.';
    const normalized = provided.replace(/[ -]/g, '');
    if (normalized.length !== 16) return 'Code invalide.';
    const hash = createHash('sha256').update(normalized).digest('hex');
    // Check actual bot membership before binding, without granting any NXT
    // access to the caller's Discord identity.
    await getDiscordGuild(guildId);
    const codes = await sql("select l.*,t.owner_id,tm.role from discord_link_codes l join teams t on t.id=l.team_id left join team_members tm on tm.team_id=l.team_id and tm.user_id=l.created_by where l.code_hash=$1 and l.consumed_at is null and l.expires_at>now() and (t.owner_id=l.created_by or tm.role in ('owner','captain'))", [hash]);
    const code = codes[0];
    if (!code) return 'Ce code est expiré, déjà utilisé ou n’est plus autorisé. Génère-en un nouveau dans NXT5.';
    const result = await sql.transaction([
      sql("select team_id from discord_connections where team_id=$1 for update", [code.team_id]),
      sql("select 1/case when exists(select 1 from discord_link_codes l join teams t on t.id=l.team_id left join team_members tm on tm.team_id=l.team_id and tm.user_id=l.created_by where l.id=$1 and l.team_id=$2 and l.consumed_at is null and l.expires_at>now() and (t.owner_id=l.created_by or tm.role in ('owner','captain'))) then 1 else 0 end", [code.id, code.team_id]),
      sql("update discord_link_codes set consumed_at=now(),guild_id=$2 where id=$1 and consumed_at is null", [code.id, guildId]),
      sql("update discord_connections set guild_id=$2,status='paused',enabled_at=null,config_version=config_version+1,updated_at=now() where team_id=$1 returning team_id", [code.team_id, guildId]),
      sql("update publication_jobs set status='cancelled',last_error_code='DISCORD_RELINKED',updated_at=now() where team_id=$1 and status in ('queued','preparing','retry_wait')", [code.team_id]),
      sql("delete from discord_routes where team_id=$1 and guild_id<>$2", [code.team_id, guildId]),
      sql("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values($1,'discord.connected','team',$2,$3::jsonb)", [code.created_by, code.team_id, JSON.stringify({ guildId, discordUserId: interaction.member.user.id, interactionId:interaction.id })]),
    ]);
    if (!result[3]?.length) return 'La liaison n’a pas été enregistrée. Actualise NXT5.';
    return 'Serveur relié à cette équipe NXT5. Retourne dans ses réglages pour choisir les salons, tester l’aperçu puis activer les publications. Les autres équipes de ce serveur conservent leurs réglages.';
  }
  if (command?.name === 'aide') return 'Invite le bot une seule fois sur ce serveur, puis relie chaque équipe avec son propre code /nxt connecter. Configure ses salons dans NXT5. Pour /nxt statut, /nxt pause et /nxt reprendre, choisis l’option equipe lorsque plusieurs équipes partagent le serveur. Chaque action concerne uniquement l’équipe choisie.';
  if (!teamCommands.includes(command?.name)) return 'Commande inconnue. Utilise /nxt aide.';
  const option = command.options?.find((item: any) => item.name === 'equipe');
  if (option && (typeof option.value !== 'string' || !option.value.trim() || option.value.length > 100)) return 'Choisis une équipe dans les suggestions de l’option equipe.';
  const selected = option?.value.trim() || null;
  const selectedIsId = selected != null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected);
  const rows = await sql(`select c.*,t.name as team_name from discord_connections c join teams t on t.id=c.team_id
    where c.guild_id=$1 and c.status<>'disconnected' and ($2::text is null or case when $3::boolean then c.team_id::text=lower($2) else lower(t.name)=lower($2) end)
    order by c.created_at,c.team_id limit 2`, [guildId, selected, selectedIsId]);
  if (!rows.length) return selected ? 'Cette équipe n’est pas reliée à ce serveur. Choisis une équipe dans les suggestions de l’option equipe.' : 'Aucune équipe n’est reliée à ce serveur. Relie chaque équipe depuis NXT5 avec son propre code.';
  if (rows.length > 1) return `Plusieurs équipes correspondent. Choisis l’équipe dans les suggestions de /nxt ${command.name} equipe. Aucune équipe n’a été modifiée.`;
  const connection = rows[0];
  if (command?.name === 'pause') {
    await sql.transaction([
      sql("select team_id from discord_connections where team_id=$1 for update",[connection.team_id]),
      sql("select 1/case when exists(select 1 from discord_connections where team_id=$1 and guild_id=$2 and config_version=$3 and status<>'disconnected') then 1 else 0 end",[connection.team_id,guildId,connection.config_version]),
      sql("update discord_connections set status='paused',updated_at=now() where team_id=$1 and guild_id=$2", [connection.team_id, guildId]),
      sql("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(null,'discord.pause','team',$1,$2::jsonb)",[connection.team_id,JSON.stringify({guildId,discordUserId:interaction.member.user.id,interactionId:interaction.id,source:'discord'})]),
    ]);
    return 'Les publications de ' + teamName(connection) + ' sont en pause.';
  }
  if (command?.name === 'reprendre') {
    if (!isDiscordEnabled()) return 'Les envois Discord sont suspendus par NXT5. La connexion de l’équipe reste en pause.';
    const live = await getDiscordGuild(guildId);
    const routes = await sql("select channel_id from discord_routes where team_id=$1 and enabled", [connection.team_id]);
    if (!routes.length || routes.some((route) => !live.channels.some((channel) => channel.id === route.channel_id && channel.canSend))) return 'Vérifie les salons et permissions depuis NXT5 avant de reprendre.';
    await sql.transaction([
      sql("select team_id from discord_connections where team_id=$1 for update",[connection.team_id]),
      sql("select 1/case when exists(select 1 from discord_connections where team_id=$1 and guild_id=$2 and config_version=$3 and status<>'disconnected') then 1 else 0 end",[connection.team_id,guildId,connection.config_version]),
      sql("update discord_connections set status='active',enabled_at=coalesce(enabled_at,now()),updated_at=now() where team_id=$1 and guild_id=$2", [connection.team_id, guildId]),
      sql("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(null,'discord.resume','team',$1,$2::jsonb)",[connection.team_id,JSON.stringify({guildId,discordUserId:interaction.member.user.id,interactionId:interaction.id,source:'discord'})]),
    ]);
    return 'Connexion active pour ' + teamName(connection) + '. Ses publications suivent les règles configurées dans NXT5.';
  }
  if (command?.name === 'statut') {
    const status = publicDiscordStatus();
    return 'Connexion de ' + teamName(connection) + ' : ' + (connection.status === 'active' ? 'active' : 'en pause') + '. Envois du service : ' + (status.enabled ? 'actifs' : 'suspendus') + '. Consulte son historique détaillé dans NXT5.';
  }
  return 'Commande inconnue. Utilise /nxt aide.';
}

async function replyToDeferred(interaction: any) {
  let content: string;
  try { content = await executeDiscordCommand(interaction); }
  catch (error: any) {
    console.error('[discord-interaction]', { code: error?.code || 'COMMAND_FAILED', status: error?.status || 500 });
    content = commandFailureMessage(error);
  }
  const { applicationId } = getDiscordConfig();
  try {
    const response = await fetch('https://discord.com/api/v10/webhooks/' + applicationId + '/' + encodeURIComponent(interaction.token) + '/messages/@original', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(responseMessage(content)), redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error('[discord-interaction]', { code: 'FOLLOWUP_FAILED', status: response.status });
  } catch { console.error('[discord-interaction]', { code: 'FOLLOWUP_UNAVAILABLE' }); }
}

async function handler(request: Request, context: Context) {
  if (request.method !== 'POST') return json({ error: 'Méthode refusée.' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 64_000) return json({ error: 'Requête trop volumineuse.' }, 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > 64_000 || !verifyDiscordInteraction(request, body)) return json({ error: 'Signature Discord invalide.' }, 401);
  let interaction: any;
  try { interaction = JSON.parse(body); } catch { return json({ error: 'JSON invalide.' }, 400); }
  if (!interaction || typeof interaction!=='object' || Array.isArray(interaction)) return json({error:'Interaction invalide.'},400);
  if (interaction.type === 1) return json({ type: 1 });
  const { applicationId } = getDiscordConfig();
  if (![2, 4].includes(interaction.type) || !isDiscordId(interaction.id) || interaction.application_id !== applicationId || !isDiscordId(interaction.guild_id)
    || !isDiscordId(interaction.member?.user?.id) || interaction.data?.name !== 'nxt' || typeof interaction.token !== 'string' || interaction.token.length > 1024) {
    if (interaction.type === 4) return json({ type: 8, data: { choices: [] } });
    return json({ type: 4, data: { ...responseMessage('Cette commande doit être utilisée dans le serveur relié à NXT5.'), flags: 64 } });
  }
  if (interaction.type === 4) return autocompleteResponse(interaction);
  if (!canManageServer(interaction)) return json({ type: 4, data: { ...responseMessage('Cette commande est réservée aux responsables du serveur.'), flags: 64 } });
  // Acknowledge before remote DB/API work; Discord requires a response in 3s.
  if (typeof (context as any).waitUntil !== 'function') return json({ type: 4, data: { ...responseMessage('Le traitement des commandes est indisponible. Utilise les réglages NXT5.'), flags: 64 } });
  (context as any).waitUntil(replyToDeferred(interaction));
  return json({ type: 5, data: { flags: 64 } });
}
export default withDiscordRuntime(handler);
export const config: Config = { method: 'POST' };
