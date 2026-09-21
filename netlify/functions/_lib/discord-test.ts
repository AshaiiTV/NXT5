import { sql } from './db';
import { discordError, auditDiscord } from './discord-access';
import { assertSubjectRateLimit } from './rate-limit';
import { buildDiscordMessage, discordRequest, DiscordApiError, findDiscordMessage, getDiscordGuild } from './discord-client';
import { getDiscordConfig, isDiscordEnabled, isDiscordId } from './discord-config';
import { renderGamePublicationPng } from './publication-render';
import { buildDiscordDemoSnapshot } from '../../../shared/publications/discord-demo.js';

const SCHEMA_VERSION = 'discord-connection-tests-20260921-v1';
const STALE_SEND_MS = 90_000;
const reference = (teamId: string, requestId: string) => 'connection-test:' + teamId + ':' + requestId;
let demoImage: ReturnType<typeof renderGamePublicationPng> | undefined;
async function image() {
  if (!demoImage) {
    demoImage = renderGamePublicationPng(buildDiscordDemoSnapshot(), { includeHints: false });
    demoImage.catch(() => { demoImage = undefined; });
  }
  return demoImage;
}
function message(referenceId: string, filename: string) {
  const payload = buildDiscordMessage(buildDiscordDemoSnapshot(), {
    reference: referenceId, siteUrl: getDiscordConfig().siteUrl || 'https://nxt5.org', hasImage: true, filename, includeHints: false,
  });
  payload.content = '🧪 Test de connexion NXT5 — données fictives. Aucune game réelle et aucune mention.';
  payload.embeds[0].title = 'TEST NXT5 · Exemple fictif';
  payload.embeds[0].url = new URL('/bot-discord', getDiscordConfig().siteUrl || 'https://nxt5.org').toString();
  payload.components = [];
  payload.attachments[0].description = 'Exemple fictif de statistiques NXT5 pour tester la connexion Discord';
  return payload;
}
export async function assertDiscordTestSchemaReady() {
  try {
    if ((await sql('select migration_key from app_schema_migrations where migration_key=$1', [SCHEMA_VERSION])).length) return;
  } catch { /* Avoid exposing database internals before the migration is ready. */ }
  throw discordError('La mise à jour du test Discord doit être appliquée.', 503, 'DISCORD_TEST_SCHEMA_REQUIRED');
}
export function publicDiscordTest(row: any) {
  if (!row) return null;
  const stale = row.status === 'sending' && Date.now() - new Date(row.created_at).getTime() > STALE_SEND_MS;
  return { requestId: row.request_id, routeId: row.route_id, channelId: row.channel_id, guildId: row.guild_id,
    configVersion: Number(row.config_version), status: stale ? 'uncertain' : row.status,
    messageUrl: row.status === 'succeeded' && isDiscordId(row.message_id)
      ? `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}` : null,
    createdAt: row.created_at, completedAt: row.completed_at,
    errorCode: stale ? 'DISCORD_TEST_UNCONFIRMED' : row.error_code };
}
export async function loadDiscordTestPreview(teamId: string) {
  const [rendered, rows, pending] = await Promise.all([
    image(), sql('select * from discord_connection_tests where team_id=$1 order by created_at desc,request_id desc limit 1', [teamId]),
    sql(`select t.* from discord_connection_tests t
      join discord_connections c on c.team_id=t.team_id and c.guild_id=t.guild_id and c.status<>'disconnected'
      join discord_routes r on r.team_id=t.team_id and r.guild_id=t.guild_id and r.channel_id=t.channel_id and r.enabled
      where t.team_id=$1 and t.status in ('sending','uncertain') order by t.created_at desc limit 10`, [teamId]),
  ]);
  return { message: message('connection-test:preview', rendered.filename),
    imageDataUrl: 'data:image/png;base64,' + Buffer.from(rendered.bytes).toString('base64'),
    latestTest: publicDiscordTest(rows[0]), pendingTests: pending.map(publicDiscordTest) };
}
async function stored(teamId: string, requestId: string) {
  return (await sql('select * from discord_connection_tests where team_id=$1 and request_id=$2', [teamId, requestId]))[0];
}
async function reconcile(row: any) {
  if (publicDiscordTest(row)?.status !== 'uncertain' || !isDiscordEnabled()) return row;
  await assertSubjectRateLimit('discord-test-reconcile', row.team_id, { limit: 6, windowSeconds: 60 });
  // An unconfirmed response only permits a bounded read of known bot messages.
  // No matching message is not proof of non-delivery and never permits a resend.
  try {
    const found = await findDiscordMessage(row.channel_id, { reference: reference(row.team_id, row.request_id), after: row.created_at });
    if (isDiscordId(found?.id) && found.channel_id === row.channel_id) {
      const rows = await sql("update discord_connection_tests set status='succeeded',message_id=$3,error_code=null,completed_at=now() where team_id=$1 and request_id=$2 and status in ('sending','uncertain') returning *", [row.team_id, row.request_id, found.id]);
      return rows[0] || row;
    }
  } catch { /* Preserve the durable fence if Discord cannot confirm this send. */ }
  return row;
}
export async function sendDiscordConnectionTest({ teamId, routeId, requestId, userId }: { teamId: string; routeId: string; requestId: string; userId: string }) {
  // PostgreSQL UUIDs are canonical lowercase. Use the same representation in
  // message references, otherwise an uppercase request cannot be reconciled.
  teamId = teamId.toLowerCase(); routeId = routeId.toLowerCase(); requestId = requestId.toLowerCase();
  const previous = await stored(teamId, requestId);
  if (previous) {
    if (previous.route_id !== routeId) throw discordError('Cet identifiant de test désigne un autre salon.', 409, 'DISCORD_TEST_REQUEST_CONFLICT');
    return publicDiscordTest(await reconcile(previous));
  }
  if (!isDiscordEnabled()) throw discordError('Les envois Discord sont suspendus sur cet environnement.', 409, 'DISCORD_PUBLISHING_DISABLED');
  await assertSubjectRateLimit('discord-connection-test', teamId, { limit: 3, windowSeconds: 300 });
  const candidates = await sql(`select r.*,c.config_version from discord_routes r join discord_connections c on c.team_id=r.team_id
    where r.id=$2 and r.team_id=$1 and r.enabled and r.guild_id=c.guild_id and c.status in ('active','paused')`, [teamId, routeId]);
  const route = candidates[0];
  if (!route) throw discordError('Enregistre un salon de cette équipe avant le test.', 409, 'DISCORD_TEST_ROUTE_REQUIRED');
  const live = await getDiscordGuild(route.guild_id);
  if (!live.channels.some((channel) => channel.id === route.channel_id && channel.canSend)) {
    throw discordError('Le bot doit pouvoir envoyer les messages et images et lire ce salon.', 409, 'DISCORD_TEST_CHANNEL_FORBIDDEN');
  }
  // One atomic insert is both the idempotency receipt and the destination fence.
  const claimed = await sql(`insert into discord_connection_tests(team_id,request_id,route_id,guild_id,channel_id,config_version,status,created_by)
    select r.team_id,$3,r.id,r.guild_id,r.channel_id,c.config_version,'sending',$4
    from discord_routes r join discord_connections c on c.team_id=r.team_id
    where r.team_id=$1 and r.id=$2 and r.enabled and c.status in ('active','paused') and c.guild_id=r.guild_id
      and c.guild_id=$5 and r.channel_id=$6 and c.config_version=$7
    on conflict do nothing returning *`, [teamId, routeId, requestId, userId, route.guild_id, route.channel_id, route.config_version]);
  if (!claimed.length) {
    const raced = await stored(teamId, requestId);
    if (raced) {
      if (raced.route_id !== routeId) throw discordError('Cet identifiant de test désigne un autre salon.', 409, 'DISCORD_TEST_REQUEST_CONFLICT');
      return publicDiscordTest(raced);
    }
    const blocked = (await sql("select * from discord_connection_tests where team_id=$1 and guild_id=$2 and channel_id=$3 and status in ('sending','uncertain')", [teamId, route.guild_id, route.channel_id]))[0];
    if (blocked) return publicDiscordTest(await reconcile(blocked));
    throw discordError('La configuration a changé. Actualise le dashboard.', 409, 'DISCORD_TEST_CONFIG_CHANGED');
  }
  let attempted = false;
  try {
    await auditDiscord(userId, teamId, 'discord.connection_test_requested', { routeId, requestId, channelId: route.channel_id });
    const rendered = await image();
    // Rendering must not send to a destination removed or relinked meanwhile.
    const current = await sql(`select r.id from discord_routes r join discord_connections c on c.team_id=r.team_id
      where r.team_id=$1 and r.id=$2 and r.enabled and c.status in ('active','paused') and c.guild_id=r.guild_id
        and c.guild_id=$3 and r.channel_id=$4 and c.config_version=$5`, [teamId, routeId, route.guild_id, route.channel_id, route.config_version]);
    if (!current.length || !isDiscordEnabled()) throw discordError('La configuration a changé. Actualise le dashboard.', 409, 'DISCORD_TEST_CONFIG_CHANGED');
    attempted = true;
    const result = await discordRequest('/channels/' + route.channel_id + '/messages', { method: 'POST',
      body: message(reference(teamId, requestId), rendered.filename), files: [{ name: rendered.filename, bytes: rendered.bytes }] });
    if (!isDiscordId(result?.id) || result.channel_id !== route.channel_id) throw new DiscordApiError(502, 'DISCORD_INVALID_RESPONSE', { ambiguous: true });
    const rows = await sql("update discord_connection_tests set status='succeeded',message_id=$3,completed_at=now() where team_id=$1 and request_id=$2 returning *", [teamId, requestId, result.id]);
    return publicDiscordTest(rows[0]);
  } catch (error: any) {
    const uncertain = attempted && (!(error instanceof DiscordApiError) || error.ambiguous);
    const code = error instanceof DiscordApiError || String(error?.code || '').startsWith('DISCORD_TEST_') ? error.code : 'DISCORD_TEST_FAILED';
    const rows = await sql("update discord_connection_tests set status=$3,error_code=$4,completed_at=case when $3='failed' then now() else null end where team_id=$1 and request_id=$2 returning *", [teamId, requestId, uncertain ? 'uncertain' : 'failed', code]);
    return publicDiscordTest(rows[0]);
  }
}
