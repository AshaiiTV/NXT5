import { renderGamePublicationCanvas } from './game-publication-canvas.js';
import { pngLoadImage, pngDownload } from '../../src/utils/png-report.js';

const fontSources = [
  [400, new URL('../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', import.meta.url).href],
  [500, new URL('../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', import.meta.url).href],
  [600, new URL('../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', import.meta.url).href],
  [700, new URL('../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', import.meta.url).href],
];
let fontsReady;
async function prepareFonts() {
  if (!fontsReady) fontsReady = Promise.all(fontSources.map(async ([weight, url]) => {
    const face = new FontFace('NXT5 Export', `url("${url}")`, { weight: String(weight) });
    document.fonts.add(await face.load());
  })).catch((error) => { fontsReady = undefined; throw error; });
  return fontsReady;
}
export async function renderGamePublicationPng(snapshot, { loadAssets } = {}) {
  await prepareFonts();
  const { canvas } = await renderGamePublicationCanvas(snapshot, {
    createCanvas(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; },
    loadLogo: () => pngLoadImage('/assets/nxt5-wordmark.png'),
    loadAssets,
  });
  return canvas;
}

export async function downloadGamePublicationPng(snapshot, filename, options = {}) {
  await pngDownload(await renderGamePublicationPng(snapshot, options), filename || 'nxt5-game.png');
}
