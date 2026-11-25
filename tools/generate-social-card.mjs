/**
 * Render the share image from the Monolithe photograph used on the site.
 * Usage: node tools/generate-social-card.mjs
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';

const root = new URL('../', import.meta.url);
const localPath = (name) => fileURLToPath(new URL(name, root));
const font = localPath('public/assets/fonts/chakra-petch/chakra-petch-latin-600-italic.woff2');
if (!GlobalFonts.registerFromPath(font, 'NXT5 Display')) {
  throw new Error('Could not load the local Chakra Petch display font.');
}

const photo = await loadImage(localPath('public/assets/brand/prisme/monolithe-1600.webp'));
const canvas = createCanvas(1200, 630);
const context = canvas.getContext('2d');
const photoHeight = photo.height * canvas.width / photo.width;
context.imageSmoothingQuality = 'high';
// Use the photograph's dark sky for the headline and preserve both ends of the sculpture.
context.drawImage(photo, 0, 0, canvas.width, photoHeight);
context.font = 'italic 600 56px "NXT5 Display"';
context.fillStyle = '#F4F6FF';
context.fillText('Analyse tes parties.', 62, 84);
context.fillText('Prépare ton équipe.', 62, 146);

await writeFile(localPath('public/og-nxt5.png'), await canvas.encode('png'));
console.log('Generated public/og-nxt5.png (1200 × 630).');
