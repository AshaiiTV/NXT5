import { getStore } from '@netlify/blobs';
import { getDiscordConfig, discordEnv } from './discord-config';

function assets() {
  const context = discordEnv('CONTEXT');
  const suffix = ['deploy-preview', 'branch-deploy'].includes(context) ? 'preview' : getDiscordConfig().environment;
  return getStore({ name: 'nxt5-discord-' + suffix, consistency: 'strong' });
}
export async function putPublicationAsset({ teamId, snapshotId, bytes, filename, mimeType }: {
  teamId: string; snapshotId: string; bytes: Uint8Array; filename: string; mimeType: string;
}) {
  if (!/^[a-f0-9-]{36}$/i.test(teamId) || !/^[a-f0-9-]{36}$/i.test(snapshotId)) throw new Error('INVALID_ASSET_KEY');
  if (bytes.byteLength > 8 * 1024 * 1024 || mimeType !== 'image/png') throw new Error('INVALID_ASSET');
  const key = teamId + '/' + snapshotId + '/game.png';
  await assets().set(key, new Uint8Array(bytes).buffer, { metadata: { mimeType, filename: filename.slice(0, 180), createdAt: new Date().toISOString() } });
  return { key };
}
export async function getPublicationAsset(key: string): Promise<Uint8Array | null> {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/game\.png$/i.test(key)) return null;
  const data = await assets().get(key, { type: 'arrayBuffer' });
  return data ? new Uint8Array(data) : null;
}
export async function deletePublicationAsset(key: string) {
  if (/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/game\.png$/i.test(key)) await assets().delete(key);
}

export async function* listPublicationAssets() {
  for await (const page of assets().list({ paginate: true })) {
    for (const blob of page.blobs) yield blob;
  }
}
export async function publicationAssetCreatedAt(key: string) {
  const entry = await assets().getMetadata(key);
  const time = Date.parse(String(entry?.metadata?.createdAt || ''));
  return Number.isFinite(time) ? time : null;
}
