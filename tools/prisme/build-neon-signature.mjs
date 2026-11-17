import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';

// The outline shares the hero's approved NXT geometry. The five keeps its
// existing faceted artwork and therefore also its recognizable silhouette.
const root = path.resolve('public/assets/brand/prisme');
const paths = [
  'M534,361L443,362L393,502L303,362L201,363L142,533L100,663L212,663L261,515L351,664L438,664L533,375Z',
  'M872,360L760,360L688,432L684,429L640,361L538,361L543,380L605,492L458,651L451,664L572,664L652,577L655,579L705,664L834,663L735,506L866,373Z',
  'M1159,359L884,361L825,441L927,442L856,663L967,663L1036,441L1133,440Z',
];
const five = await loadImage(path.join(root, 'nxt5-neon-5-source.png'));
const pixels = createCanvas(five.width, five.height);
const pixelContext = pixels.getContext('2d');
pixelContext.drawImage(five, 0, 0);
const data = pixelContext.getImageData(0, 0, five.width, five.height).data;
let minX = five.width, minY = five.height, maxX = 0, maxY = 0;
for (let y = 0; y < five.height; y++) for (let x = 0; x < five.width; x++) {
  if (data[(y * five.width + x) * 4 + 3] > 12) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
const canvas = createCanvas(1600, 600);
const ctx = canvas.getContext('2d');
ctx.save();
ctx.translate(-65, -155);
ctx.scale(.95, .95);
const gradient = ctx.createLinearGradient(100, 660, 1150, 360);
gradient.addColorStop(0, '#67e8f9');
gradient.addColorStop(.38, '#f4f6ff');
gradient.addColorStop(.7, '#a78bfa');
gradient.addColorStop(1, '#e879f9');
ctx.strokeStyle = gradient;
ctx.lineWidth = 3;
ctx.lineJoin = 'miter';
ctx.shadowColor = '#8068ff';
ctx.shadowBlur = 5;
for (const d of paths) ctx.stroke(new Path2D(d));
ctx.shadowBlur = 0;
for (const d of paths) ctx.stroke(new Path2D(d));
ctx.restore();
const fiveWidth = maxX - minX + 1;
const fiveHeight = maxY - minY + 1;
const displayWidth = 570;
const displayHeight = displayWidth * fiveHeight / fiveWidth;
const displayY = 16 + (550 - displayHeight) / 2;
ctx.drawImage(five, minX, minY, fiveWidth, fiveHeight, 1005, displayY, displayWidth, displayHeight);
await fs.writeFile(path.join(root, 'nxt5-neon-source.png'), canvas.toBuffer('image/png'));
for (const width of [320, 640, 1280]) {
  const small = createCanvas(width, Math.round(width * 600 / 1600));
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  await fs.writeFile(path.join(root, `nxt5-neon-${width}.webp`), small.toBuffer('image/webp', 92));
}
const fivePath = 'M1435,358L1172,359L1113,540L1285,540L1287,542L1274,579L1099,579L1071,662L1325,663L1361,636L1400,510L1362,470L1231,471L1230,468L1241,438L1410,438Z';
const fiveScale = displayWidth / (1435 - 1071);
const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><title>NXT5</title><g transform="translate(-65 -155) scale(.95)" fill="none" stroke="#F4F6FF" stroke-width="22" stroke-linejoin="miter">${paths.map(d => `<path d="${d}"/>`).join('')}</g><path d="${fivePath}" transform="translate(${1005 - 1071 * fiveScale} ${displayY - 358 * fiveScale}) scale(${fiveScale})" fill="#F4F6FF"/></svg>`;
await fs.writeFile(path.join(root, 'nxt5-neon-mono-blanc.svg'), mono);
await fs.writeFile('importer-app/assets/prisme/nxt5-neon-mono-blanc.svg', mono);
const monoCanvas = createCanvas(640, 240);
monoCanvas.getContext('2d').drawImage(await loadImage(Buffer.from(mono)), 0, 0, 640, 240);
await fs.writeFile(path.join(root, 'nxt5-neon-mono-640.png'), monoCanvas.toBuffer('image/png'));

// Color stays part of the identity at navigation size. A stronger outline
// survives downsampling, while the five keeps its original faceted artwork.
const compactCanvas = createCanvas(1600, 600);
const compactContext = compactCanvas.getContext('2d');
compactContext.save();
compactContext.translate(-65, -155);
compactContext.scale(.95, .95);
const compactGradient = compactContext.createLinearGradient(100, 660, 1150, 360);
compactGradient.addColorStop(0, '#67E8F9');
compactGradient.addColorStop(.52, '#A5B4FC');
compactGradient.addColorStop(1, '#C4B5FD');
compactContext.strokeStyle = compactGradient;
compactContext.lineWidth = 16;
compactContext.lineJoin = 'miter';
for (const d of paths) compactContext.stroke(new Path2D(d));
compactContext.restore();
compactContext.drawImage(five, minX, minY, fiveWidth, fiveHeight, 1005, displayY, displayWidth, displayHeight);
for (const width of [320, 640]) {
  const small = createCanvas(width, width * 600 / 1600);
  small.getContext('2d').drawImage(compactCanvas, 0, 0, small.width, small.height);
  await fs.writeFile(path.join(root, `nxt5-neon-interface-${width}.webp`), small.toBuffer('image/webp', 94));
  if (width === 640) {
    const png = small.toBuffer('image/png');
    await fs.writeFile(path.join(root, 'nxt5-neon-interface-640.png'), png);
    await fs.writeFile('importer-app/assets/prisme/nxt5-neon-interface-640.png', png);
  }
}
console.log('NXT5 neon signature built from hero outline and existing faceted five.');
