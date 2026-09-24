import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderGamePublicationCanvas } from '../../../shared/publications/game-publication-canvas.js';
import { renderDiscordPublicationCanvas } from '../../../shared/publications/discord-publication-canvas.js';
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
export async function renderGamePublicationPng(snapshot, { includeHints = true, layout = 'discord' }: { includeHints?: boolean; layout?: 'discord' | 'full' } = {}) {
  prepareFont();
  const renderer = layout === 'full' ? renderGamePublicationCanvas : renderDiscordPublicationCanvas;
  const { canvas, width, height } = await renderer(snapshot, { createCanvas, loadLogo: bundledLogo, includeHints });
  const bytes = await canvas.encode('png');
  return { bytes, mimeType: 'image/png' as const, width, height, filename: `nxt5-game-${String(snapshot.entityId || 'export').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.png` };
}

export async function renderGroupPublicationPng(snapshot) {
  prepareFont();
  const { canvas, width, height } = await renderGroupPublicationCanvas(snapshot, { createCanvas, loadLogo: bundledLogo });
  const bytes = await canvas.encode('png');
  return { bytes, mimeType: 'image/png' as const, width, height, filename: `nxt5-group-${String(snapshot.entityId || 'export').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.png` };
}
