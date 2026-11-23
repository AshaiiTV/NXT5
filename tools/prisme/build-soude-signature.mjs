import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  SOUDE_BASELINE, SOUDE_BOUNDS, SOUDE_CANVAS, SOUDE_CONTOUR, SOUDE_FIVE, SOUDE_FIVE_BOUNDS,
  SOUDE_FIVE_EDGE, SOUDE_FIVE_INNER, SOUDE_SLOPE,
} from './soude-geometry.mjs';

// Signature soudée NXT5 (charte 2.9) : un seul contour lumineux fait le tour de NXT5,
// la barre du T débouche dans le 5 et le verre naît à cet endroit.
// Les SVG écrits ici sont les masters ; tous les bitmaps en sont des rendus.
// Usage : node tools/prisme/build-soude-signature.mjs, puis node tools/prisme/build-assets.mjs.
const root = path.resolve('public/assets/brand/prisme');
const importer = path.resolve('importer-app/assets/prisme');
const { width: W, height: H } = SOUDE_CANVAS;
const B = SOUDE_BOUNDS;
const F = SOUDE_FIVE_BOUNDS;

const stops = (list) => list.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity === undefined ? '' : ` stop-opacity="${opacity}"`}/>`).join('');
const linear = (id, [x1, y1], [x2, y2], list) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
/** Dégradé dont les lignes de niveau suivent la pente des fûts, de t0 à t1. */
function alongStems(t0, t1) {
  const n = 1 + SOUDE_SLOPE * SOUDE_SLOPE;
  return [[t0, 0], [+(t0 + (t1 - t0) / n).toFixed(2), +((t1 - t0) * SOUDE_SLOPE / n).toFixed(2)]];
}
const facet = (points) => points.map(([px, py]) => `${(F.x0 + px * (F.x1 - F.x0)).toFixed(1)},${(F.y0 + py * (F.y1 - F.y0)).toFixed(1)}`).join(' ');

const STROKE = {
  large: [['0', '#67E8F9'], ['.3', '#F4F6FF'], ['.62', '#A78BFA'], ['1', '#E879F9']],
  interface: [['0', '#67E8F9'], ['.5', '#A5B4FC'], ['.82', '#C4B5FD'], ['1', '#E3B4FD']],
  clair: [['0', '#0E7490'], ['.5', '#4F46E5'], ['1', '#7E22CE']],
};
const GLASS = {
  profond: [['0', '#B3A6FF'], ['.42', '#6F4FE8'], ['1', '#41209C']],
  clair: [['0', '#C2BCFF'], ['.42', '#8A6CF6'], ['1', '#5F35D6']],
};

/**
 * variant : "large" (trait fin, lueur, verre profond), "interface" (trait renforcé, verre clair)
 * ou "clair" (trait sombre pour fond clair).
 */
function signatureSvg(variant) {
  const large = variant === 'large';
  const strokeWidth = large ? 6 : 16;
  const glass = large ? GLASS.profond : GLASS.clair;
  const [fadeFrom, fadeTo] = alongStems(SOUDE_FIVE_EDGE - 115, SOUDE_FIVE_EDGE + 16);
  const area = `x="0" y="0" width="${W}" height="${H}"`;
  const glow = large ? `<path d="${SOUDE_CONTOUR}" fill="none" stroke="#8068FF" stroke-width="${strokeWidth + 5}" stroke-linejoin="miter" opacity=".5" filter="url(#lueur)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>NXT5</title>
<defs>
${linear('trait', [B.x0, SOUDE_BASELINE], [B.x1, B.y0], STROKE[variant])}
${linear('verre', [F.x0, F.y0], [F.x1, F.y1], glass)}
${linear('naissance', fadeFrom, fadeTo, [['0', '#fff', 0], ['1', '#fff', 1]])}
<mask id="fondu" maskUnits="userSpaceOnUse" ${area}><rect ${area} fill="url(#naissance)"/></mask>
<clipPath id="silhouette"><path d="${SOUDE_CONTOUR}"/></clipPath>
${large ? '<filter id="lueur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>' : ''}
</defs>
<g clip-path="url(#silhouette)" mask="url(#fondu)">
<rect ${area} fill="url(#verre)"/>
<polygon points="${facet([[0, 0], [.73, 0], [0, .79]])}" fill="#FFFFFF" opacity="${large ? '.14' : '.2'}"/>
<polygon points="${facet([[.15, 1], [1, .2], [1, .41], [.34, 1]])}" fill="#FFFFFF" opacity=".1"/>
<polygon points="${facet([[1, .52], [1, 1], [.5, 1]])}" fill="#2A1280" opacity=".4"/>
<path d="${SOUDE_FIVE_INNER}" fill="none" stroke="#FFFFFF" stroke-opacity="${large ? '.26' : '.3'}" stroke-width="${large ? 5 : 6}"/>
</g>
${glow}<path d="${SOUDE_CONTOUR}" fill="none" stroke="url(#trait)" stroke-width="${strokeWidth}" stroke-linejoin="miter"/>
</svg>
`;
}

/** Une couleur : contour du mot et 5 plein. Réservé à l'impression, la gravure et les filigranes. */
const monoSvg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>NXT5</title><path d="${SOUDE_FIVE}" fill="${color}"/><path d="${SOUDE_CONTOUR}" fill="none" stroke="${color}" stroke-width="16" stroke-linejoin="miter"/></svg>
`;

async function raster(svg, width) {
  const canvas = createCanvas(width, Math.round(width * H / W));
  canvas.getContext('2d').drawImage(await loadImage(Buffer.from(svg)), 0, 0, canvas.width, canvas.height);
  return canvas;
}

const masters = {
  'nxt5-soude.svg': signatureSvg('large'),
  'nxt5-soude-interface.svg': signatureSvg('interface'),
  'nxt5-soude-clair.svg': signatureSvg('clair'),
  'nxt5-soude-mono-blanc.svg': monoSvg('#F4F6FF'),
  'nxt5-soude-mono-nuit.svg': monoSvg('#111827'),
};
for (const [name, svg] of Object.entries(masters)) await fs.writeFile(path.join(root, name), svg);

// Grande signature : scènes, présentations et partages.
await fs.writeFile(path.join(root, 'nxt5-soude-source.png'), (await raster(masters['nxt5-soude.svg'], W)).toBuffer('image/png'));
for (const width of [320, 640, 1280]) {
  await fs.writeFile(path.join(root, `nxt5-soude-${width}.webp`), (await raster(masters['nxt5-soude.svg'], width)).toBuffer('image/webp', 92));
}

// Signature d'interface : navigation, emails, exports et Importer. La couleur reste, le trait est renforcé.
for (const width of [320, 640]) {
  const canvas = await raster(masters['nxt5-soude-interface.svg'], width);
  await fs.writeFile(path.join(root, `nxt5-soude-interface-${width}.webp`), canvas.toBuffer('image/webp', 94));
  if (width === 640) {
    const png = canvas.toBuffer('image/png');
    await fs.writeFile(path.join(root, 'nxt5-soude-interface-640.png'), png);
    await fs.writeFile(path.join(importer, 'nxt5-soude-interface-640.png'), png);
  }
}
// Signe compact : le 5 de la signature, seul, sur tuile nuit. L'arête (#arete) est retirée
// sous 48 px par tools/prisme/build-assets.mjs, où elle ne ferait qu'épaissir le chiffre.
const iconScale = 44 / (F.y1 - F.y0);
const iconTransform = `translate(${((64 - (F.x1 - F.x0) * iconScale) / 2 - F.x0 * iconScale).toFixed(2)} ${(10 - F.y0 * iconScale).toFixed(2)}) scale(${iconScale.toFixed(5)})`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>NXT5</title><defs><linearGradient id="verre" x1="0" y1="0" x2="1" y2="1">${stops([['0', '#E3DEFF'], ['.5', '#A78BFA'], ['1', '#7C4FF0']])}</linearGradient><linearGradient id="trait" x1="0" y1="1" x2="1" y2="0">${stops([['0', '#A5B4FC'], ['1', '#E3B4FD']])}</linearGradient></defs><rect width="64" height="64" rx="12" fill="#070A14"/><path transform="${iconTransform}" d="${SOUDE_FIVE}" fill="url(#verre)"/><path id="arete" transform="${iconTransform}" d="${SOUDE_FIVE}" fill="none" stroke="url(#trait)" stroke-width="${(1.8 / iconScale).toFixed(1)}" stroke-linejoin="miter"/></svg>
`;
await fs.writeFile(path.join(root, 'favicon.svg'), favicon);
console.log('Signature soudée NXT5 : masters SVG, favicon et rendus écrits dans public/assets/brand/prisme.');
