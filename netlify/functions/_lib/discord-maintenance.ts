import { sql } from './db';
import { assertDiscordSchemaReady } from './discord-queue';
import { deletePublicationAsset, listPublicationAssets, publicationAssetCreatedAt } from './publication-assets';

const DAY = 86_400_000;

/** Keeps current publication references and every unresolved delivery. PNGs
 * may be rebuilt from a retained snapshot after the 30-day storage window. */
export async function maintainDiscordPublications({ maxScan = 5000, budgetMs = 12 * 60_000 } = {}) {
  await assertDiscordSchemaReady();
  const started = Date.now();
  let removed = 0, scanned = 0, truncated = false;
  const expired = await sql(`select s.id,s.asset_key from publication_snapshots s
    join discord_publications p on p.id=s.publication_id
    where s.asset_key is not null and s.created_at<now()-interval '30 days'
      and p.state not in ('sending','uncertain')
      and not exists(select 1 from publication_jobs j where j.publication_id=p.id and j.source_revision=s.source_revision
        and j.status in ('queued','preparing','sending','uncertain','retry_wait','blocked'))
    order by s.created_at limit 500`);
  for (const snapshot of expired) {
    if (Date.now() - started > budgetMs) { truncated = true; break; }
    // The DB reference is cleared only after a successful idempotent deletion.
    // Shared cached keys are kept until every referencing snapshot is old.
    const needed = await sql(`select s.id from publication_snapshots s join discord_publications p on p.id=s.publication_id
      where s.asset_key=$1 and (s.created_at>=now()-interval '30 days' or p.state in ('sending','uncertain')
        or exists(select 1 from publication_jobs j where j.publication_id=p.id and j.source_revision=s.source_revision
          and j.status in ('queued','preparing','sending','uncertain','retry_wait','blocked'))) limit 1`, [snapshot.asset_key]);
    if (!needed.length) { await deletePublicationAsset(snapshot.asset_key); removed++; }
    await sql('update publication_snapshots set asset_key=null where id=$1 and asset_key=$2', [snapshot.id, snapshot.asset_key]);
  }
  // Also covers a team deleted by cascade and an upload whose DB update failed.
  // A one-day grace period protects concurrent uploads awaiting their reference.
  for await (const blob of listPublicationAssets()) {
    if (++scanned > maxScan || Date.now() - started > budgetMs) { truncated = true; break; }
    const used = await sql('select id from publication_snapshots where asset_key=$1 limit 1', [blob.key]);
    if (used.length) continue;
    const createdAt = await publicationAssetCreatedAt(blob.key);
    if (createdAt !== null && createdAt < Date.now() - DAY) { await deletePublicationAsset(blob.key); removed++; }
  }
  await sql.transaction([
    sql("delete from discord_link_codes where expires_at<now()-interval '1 day'"),
    sql("delete from discord_interaction_receipts where created_at<now()-interval '7 days'"),
    sql(`delete from discord_deliveries d where d.created_at<now()-interval '90 days'
      and d.status not in ('sending','uncertain') and not exists(select 1 from discord_publications p
        where p.id=d.publication_id and p.state in ('sending','uncertain'))`),
    sql(`delete from publication_jobs j using discord_publications p where j.publication_id=p.id
      and j.updated_at<now()-interval '90 days' and j.status in ('succeeded','superseded','cancelled')
      and j.last_error_code is distinct from 'WITHDRAW_RETRY_REQUIRED'
      and j.source_revision<p.published_revision and p.state not in ('sending','uncertain')`),
    sql(`delete from publication_snapshots s using discord_publications p where s.publication_id=p.id
      and s.created_at<now()-interval '90 days' and s.asset_key is null
      and s.source_revision<p.published_revision and p.state not in ('sending','uncertain')
      and not exists(select 1 from publication_jobs j where j.publication_id=p.id and j.source_revision=s.source_revision)`),
  ]);
  const result = { removed, scanned, truncated, durationMs: Date.now() - started };
  console.info('[discord-maintenance]', result);
  return result;
}
