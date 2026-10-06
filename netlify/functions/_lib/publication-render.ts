import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderGamePublicationCanvas } from '../../../shared/publications/game-publication-canvas.js';
import { loadGamePublicationAssets } from '../../../shared/publications/game-publication-assets.js';
import { renderGroupPublicationCanvas } from '../../../shared/publications/group-publication-canvas.js';

let registered = false;
let logoPromise: ReturnType<typeof loadImage> | undefined;
function prepareFont() {
  if (registered) return;
  for (const weight of [400, 500, 600, 700]) {
    const fontPath = path.join(process.cwd(), `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`);
    if (!GlobalFonts.registerFromPath(fontPath, 'NXT5 Export')) throw new Error('La police du rendu NXT5 est indisponible.');
  }
  registered = true;
}
async function bundledLogo() {
  if (!logoPromise) {
    // Netlify included_files preserves this path. Never fetch a URL from a snapshot.
    const filename = path.join(process.cwd(), 'public/assets/nxt5-wordmark.png');
    logoPromise = readFile(filename).then((bytes) => loadImage(bytes));
    logoPromise.catch(() => { logoPromise = undefined; });
  }
  return logoPromise;
}
async function publicationIcon(url: string) {
  // Only URLs built from sanitized champion names / numeric item IDs are used.
  // Bound both time and bytes; an unavailable icon must not block publication.
  if (!/^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/\d+\.\d+\.\d+\/img\/(champion\/[A-Za-z0-9]+|item\/\d+)\.png$/.test(url)) return null;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4000) });
  const limit = 2 * 1024 * 1024;
  if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png' || Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return size ? loadImage(Buffer.concat(chunks, size)) : null;
}

export async function renderGamePublicationPng(snapshot, { includeHints = true }: { includeHints?: boolean } = {}) {
  prepareFont();
  const { canvas, width, height } = await renderGamePublicationCanvas(snapshot, {
    createCanvas, loadLogo: bundledLogo, includeHints,
    loadAssets: data => loadGamePublicationAssets(data, publicationIcon),
  });
  const bytes = await canvas.encode('png');
  return { bytes, mimeType: 'image/png' as const, width, height, filename: `nxt5-game-${String(snapshot.entityId || 'export').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.png` };
}

export async function renderGroupPublicationPng(snapshot) {
  prepareFont();
  const { canvas, width, height } = await renderGroupPublicationCanvas(snapshot, { createCanvas, loadLogo: bundledLogo });
  const bytes = await canvas.encode('png');
  return { bytes, mimeType: 'image/png' as const, width, height, filename: `nxt5-group-${String(snapshot.entityId || 'export').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.png` };
}
