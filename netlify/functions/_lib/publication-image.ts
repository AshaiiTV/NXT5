import { sql } from './db';
import { getPublicationAsset, putPublicationAsset } from './publication-assets';
import { renderGamePublicationPng } from './publication-render';

export async function getOrRenderPublicationImage(teamId: string, snapshot: { id: string; body: any }) {
  const filename = 'nxt5-game-' + String(snapshot.body.entityId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) + '.png';
  // Image identity excludes generation time and source revision. Both are
  // bookkeeping fields, never painted. Team/entity/template/options remain.
  const candidates = await sql(`select s.asset_key from publication_snapshots s
    join discord_publications p on p.id=s.publication_id where p.team_id=$1 and s.asset_key is not null
      and (s.body-'generatedAt'-'sourceRevision')=($2::jsonb-'generatedAt'-'sourceRevision')
    order by s.created_at desc limit 1`, [teamId, JSON.stringify(snapshot.body)]);
  if (candidates[0]?.asset_key) {
    const bytes = await getPublicationAsset(candidates[0].asset_key);
    if (bytes) {
      await sql('update publication_snapshots set asset_key=$1 where id=$2', [candidates[0].asset_key, snapshot.id]);
      return { bytes, filename, cached: true };
    }
  }
  const image = await renderGamePublicationPng(snapshot.body, { includeHints: false });
  if (image.bytes.byteLength > 3 * 1024 * 1024) return null;
  const asset = await putPublicationAsset({ teamId, snapshotId: snapshot.id, ...image });
  await sql('update publication_snapshots set asset_key=$1 where id=$2', [asset.key, snapshot.id]);
  return { ...image, cached: false };
}
