/**
 * Rebuild the NXT5 Open Graph image with local fonts and official brand assets.
 * Usage: node tools/generate-social-card.mjs
 *
 * Brand reference: the single NXT5 charter linked by this checkout's AGENTS.md.
 * Emblem: the Monolithe glass tile (public/assets/brand/nxt5-emblem.svg) rasterised by
 * tools/generate-brand-assets.mjs; wordmark: the Sculpture lockup from the same source.
 */
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { PNG_THEME, pngBackground, pngPanel, pngImageContain } from '../src/utils/png-report.js';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const localPath = (relativePath) => fileURLToPath(new URL(relativePath, root));
const width = 1200;
const height = 630;
const fontFamily = 'NXT5 Social';

for (const weight of [400, 500, 600, 700]) {
  const path = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`);
  if (!GlobalFonts.registerFromPath(path, fontFamily)) {
    throw new Error(`Unable to load the local Inter font at weight ${weight}.`);
  }
}

const [wordmark, emblem, atmosphere, ...roles] = await Promise.all([
  loadImage(localPath('public/assets/nxt5-wordmark.png')),
  loadImage(localPath('public/assets/nxt5-loader-favicon.png')),
  loadImage(localPath('public/assets/home-motion/atmosphere.webp')),
  ...['top', 'jungle', 'middle', 'bottom', 'utility'].map(role => loadImage(localPath(`public/assets/roles/position-${role}.svg`))),
]);
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';

pngBackground(context, width, height);
context.save();
context.globalAlpha = .48;
context.drawImage(atmosphere, 0, 0, width, height);
context.restore();
const veil = context.createLinearGradient(0, 0, width, height);
veil.addColorStop(0, 'rgba(17,24,39,.87)');
veil.addColorStop(.62, 'rgba(34,30,66,.45)');
veil.addColorStop(1, 'rgba(17,24,39,.72)');
context.fillStyle = veil;
context.fillRect(0, 0, width, height);

function drawAsset(image, x, y, displayWidth) {
  // Preserve the complete image, its transparency, colors and original ratio.
  context.drawImage(image, x, y, displayWidth, displayWidth * image.height / image.width);
}

function text(value, x, y, size, weight, fill, maxWidth) {
  context.font = `${weight} ${size}px "${fontFamily}"`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  const measuredWidth = context.measureText(value).width;
  if (maxWidth && measuredWidth > maxWidth) {
    throw new Error(`Text exceeds its safe area: ${value} (${measuredWidth}px > ${maxWidth}px).`);
  }
  context.fillStyle = fill;
  context.fillText(value, x, y);
}

drawAsset(wordmark, 64, 56, 218);
context.font = `500 25px "${fontFamily}"`;
context.textAlign = 'right';
context.fillStyle = PNG_THEME.muted;
context.fillText('nxt5.org', 1136, 100);

text('Analyse tes parties.', 64, 250, 64, 700, PNG_THEME.text, 748);
const headlineGradient = context.createLinearGradient(64, 0, 718, 0);
headlineGradient.addColorStop(0, '#A5F3FC');
headlineGradient.addColorStop(0.55, '#C4B5FD');
headlineGradient.addColorStop(1, '#F0ABFC');
text('Prépare ton équipe.', 64, 328, 64, 700, headlineGradient, 748);

text('L’espace de travail des équipes et coachs', 64, 407, 28, 400, PNG_THEME.muted, 730);
text('League of Legends.', 64, 449, 28, 500, PNG_THEME.text, 730);

// The Monolithe emblem is itself a glass tile: draw it directly, with the product's violet halo.
context.save();
const halo = context.createRadialGradient(984, 340, 20, 984, 340, 230);
halo.addColorStop(0, 'rgba(139,92,246,.34)');
halo.addColorStop(1, 'rgba(139,92,246,0)');
context.fillStyle = halo;
context.fillRect(754, 110, 460, 460);
context.restore();
pngImageContain(context, emblem, 834, 180, 300, 300);

context.fillStyle = 'rgba(154, 182, 218, 0.18)';
context.fillRect(64, 526, 1072, 1);
const accentGradient = context.createLinearGradient(64, 0, 256, 0);
accentGradient.addColorStop(0, '#67E8F9');
accentGradient.addColorStop(0.38, '#818CF8');
accentGradient.addColorStop(0.65, '#A78BFA');
accentGradient.addColorStop(1, '#E879F9');
context.fillStyle = accentGradient;
context.fillRect(64, 526, 192, 2);

text('Analyse · Débriefs · Draft · Planning', 64, 576, 25, 500, PNG_THEME.muted, 710);
roles.forEach((role, index) => {
  const x = 838 + index * 62;
  pngPanel(context, x, 547, 50, 50, { radius: 12 });
  pngImageContain(context, role, x + 10, 557, 30, 30);
});

const output = localPath('public/og-nxt5.png');
await writeFile(output, await canvas.encode('png'));
console.log(`Generated public/og-nxt5.png (${width} × ${height}).`);
