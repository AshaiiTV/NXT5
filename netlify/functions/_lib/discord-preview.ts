import { sql } from './db';
import { uuid, discordError } from './discord-access';
import { buildGamePublicationSnapshot } from '../../../shared/publications/game-publication.js';
import { buildDiscordMessage } from './discord-client';
import { getDiscordConfig } from './discord-config';
import { renderGamePublicationPng } from './publication-render';

export async function loadDiscordPreview({ teamId, matchId, routeId, render = true }: {
  teamId: string; matchId: string; routeId: string; render?: boolean;
}) {
  uuid(matchId, 'Game'); uuid(routeId, 'Destination');
  // One statement reads match and participants from the same DB snapshot.
  const rows = await sql("select to_jsonb(m) || jsonb_build_object('participants',coalesce((select jsonb_agg(to_jsonb(mp) order by mp.team_key,mp.role) from match_participants mp where mp.match_id=m.id),'[]'::jsonb)) as match,to_jsonb(t) as team,to_jsonb(r) as route,(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]'::jsonb) from match_categories where team_id=m.team_id) as categories from matches m join teams t on t.id=m.team_id join discord_connections c on c.team_id=m.team_id join discord_routes r on r.team_id=m.team_id and r.guild_id=c.guild_id where m.id=$1 and m.team_id=$2 and r.id=$3 and r.enabled and c.status in ('active','paused')", [matchId, teamId, routeId]);
  const row = rows[0];
  if (!row) throw discordError('Game ou destination indisponible pour cette équipe.', 404);
  const selected = row.route.category_ids || [];
  const categories = new Set([...(row.match.category_ids || []), row.match.category_id].filter(Boolean));
  if (selected.length && !selected.some((id) => categories.has(id))) throw discordError('Cette game ne correspond pas aux catégories de la destination.', 409);
  const snapshotRevision = Number(row.match.publication_revision || 0);
  const snapshot = buildGamePublicationSnapshot({ team: row.team, match: row.match, categories: row.categories, sourceRevision: snapshotRevision, generatedAt: new Date().toISOString() });
  let image = render ? await renderGamePublicationPng(snapshot, { includeHints: Boolean(row.route.include_hints) }) : null;
  const oversized = Boolean(image && image.bytes.length > 3 * 1024 * 1024);
  if (oversized) image = null;
  const siteUrl = getDiscordConfig().siteUrl;
  if (!siteUrl) throw discordError('Adresse NXT5 non configurée.', 503, 'DISCORD_NOT_CONFIGURED');
  const message = buildDiscordMessage(snapshot, { includeHints: row.route.include_hints, mentionRoleId: row.route.mention_role_id,
    reference: 'aperçu', siteUrl, hasImage: Boolean(image), filename: image?.filename });
  if (oversized) message.embeds[0].fields.push({name:'Visuel',value:'Visuel trop volumineux. Les détails restent accessibles dans NXT5.',inline:false});
  return { snapshot, snapshotRevision, message, image, route: row.route };
}
