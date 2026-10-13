// YouTube thumbnail for the v2 film (charte v1.92: Inter, official wordmark, the glass 5 poster).
// node v2/thumbnail.mjs -> out/v2/thumbnail.png (1280x720)
import * as Canvas from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './film.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out/v2');
const A = await F.loadAssets();
const c = Canvas.createCanvas(F.W, F.H);
const ctx = c.getContext('2d');
F.backdrop(ctx, 0, { dim: 0.25 });
F.glow(ctx, 1450, 760, 700, '#8B5CF6', 0.4);
F.glow(ctx, 1750, 420, 500, '#E879F9', 0.16);
F.glow(ctx, 1100, 380, 500, '#67E8F9', 0.1);
const gw = 900;
const gh = (gw * A.poster.height) / A.poster.width;
ctx.drawImage(A.poster, 1470 - gw / 2, 560 - gh / 2, gw, gh);
F.text(ctx, 'Défaite.', 110, 470, { size: 230, weight: 700, color: F.C.danger, tracking: -5 });
F.text(ctx, 'Pourquoi ?', 116, 700, { size: 200, weight: 700, spectrum: 'Pourquoi', tracking: -4 });
F.wordmark(ctx, 300, 900, 380);
const out = Canvas.createCanvas(1280, 720);
out.getContext('2d').drawImage(c, 0, 0, 1280, 720);
writeFileSync(path.join(OUT, 'thumbnail.png'), out.toBuffer('image/png'));
console.log(path.join(OUT, 'thumbnail.png'));
