import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requireDiscordTeam, assertDiscordMethod, discordResponseError, discordError, uuid } from './_lib/discord-access';
import { getPublicationAsset } from './_lib/publication-assets';
import { getOrRenderPublicationImage } from './_lib/publication-image';
import { assertSubjectRateLimit } from './_lib/rate-limit';
export default async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET']);
    const params = new URL(request.url).searchParams;
    const { teamId, user } = await requireDiscordTeam(request, context, params.get('teamId'));
    await assertSubjectRateLimit('discord-asset', user.id, { limit: 20, windowSeconds: 60 });
    const snapshotId = uuid(params.get('snapshotId'), 'Visuel');
    const rows = await sql("select s.id,s.asset_key,s.body from publication_snapshots s join discord_publications p on p.id=s.publication_id join matches m on m.id=p.entity_id and m.team_id=p.team_id where s.id=$1 and p.team_id=$2 and p.state not in ('withdrawn','deleted')", [snapshotId, teamId]);
    if (!rows[0]) throw discordError('Visuel indisponible.', 404);
    let bytes = rows[0].asset_key ? await getPublicationAsset(rows[0].asset_key) : null;
    if (!bytes) bytes = (await getOrRenderPublicationImage(teamId, {id:rows[0].id,body:rows[0].body}))?.bytes || null;
    if (!bytes) throw discordError('Visuel trop volumineux. Consulte les détails de la game dans NXT5.', 413);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="nxt5-game.png"', 'Vary': 'Cookie' } });
  } catch (error) { return discordResponseError(error); }
}
export const config: Config = { method: 'GET' };
