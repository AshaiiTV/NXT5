// Checkpoint: three key frames of the v2 film.
// node v2/keyframes.mjs --poses out/v2/poses.json   (then render them with glass/render-glass.cjs)
// node v2/keyframes.mjs                             -> out/v2/key-*.png
import * as Canvas from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './film.mjs';

const { W, H, C, seg, ease } = F;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out/v2');
mkdirSync(OUT, { recursive: true });
const KEYS = [
  { name: 'key-1-hook', t: 2.6 },
  { name: 'key-2-drop', t: 16.9 },
  { name: 'key-3-analyse', t: 20.6 },
];

if (process.argv.includes('--poses')) {
  writeFileSync(process.argv[process.argv.indexOf('--poses') + 1], JSON.stringify(KEYS.map((k) => F.glassPose(k.t))));
  process.exit(0);
}

await F.loadAssets();
const GLASS_DIR = path.join(OUT, 'glass-keys');

function hook(ctx, t) {
  F.backdrop(ctx, t, { dim: 0.55 });
  F.glow(ctx, W / 2, H * 0.62, 700, '#8B5CF6', 0.16);
  const k1 = seg(t, 0, 0.35);
  F.revealLine(ctx, k1, 0, 560, 230, () => F.text(ctx, 'Défaite.', W / 2, 560, { size: 230, weight: 700, color: C.danger, align: 'center', tracking: -4 }));
  const k2 = seg(t, 2, 2.4);
  F.revealLine(ctx, k2, 0, 680, 64, () => F.text(ctx, 'Encore une.', W / 2, 680, { size: 64, weight: 500, color: C.text2, align: 'center' }));
}

async function drop(ctx, t, i) {
  F.backdrop(ctx, t, { dim: 0.3 });
  F.glow(ctx, 1500, 760, 620, '#8B5CF6', 0.32);
  F.glow(ctx, 980, 420, 420, '#67E8F9', 0.10);
  F.glow(ctx, 1720, 520, 420, '#E879F9', 0.12);
  const g = await F.loadGlassFrame(GLASS_DIR, i);
  if (g) {
    const gw = 820;
    const gh = (gw * g.height) / g.width;
    ctx.drawImage(g, 1510 - gw / 2, 540 - gh / 2 + 20, gw, gh);
  }
  const k = seg(t, 16.15, 16.6);
  F.revealLine(ctx, k, 0, 470, 88, () => F.text(ctx, 'Comprends tes parties.', 150, 470, { size: 88, weight: 700 }));
  F.revealLine(ctx, seg(t, 16.35, 16.8), 0, 580, 88, () => F.text(ctx, 'Prépare la suite.', 150, 580, { size: 88, weight: 700, spectrum: 'Prépare la suite.' }));
  F.text(ctx, 'L’espace de travail des équipes et coachs League of Legends', 154, 660, { size: 32, weight: 500, color: C.text2, alpha: ease.out(seg(t, 16.6, 17)) });
  F.wordmark(ctx, 330, 880, 360, ease.out(seg(t, 16.7, 17.1)));
}

function analyse(ctx, t) {
  F.backdrop(ctx, t, { dim: 0.45, img: 'clouds' });
  F.glow(ctx, 1300, 560, 700, '#8B5CF6', 0.22);
  const k = ease.outQuint(seg(t, 20, 20.5));
  ctx.save();
  ctx.translate((1 - k) * 80, 0);
  const sh = F.uiShot(ctx, 'ui-match-timeline-3345.png', 800, 250, 1000, [80, 600, 1760, 860], { alpha: k });
  F.fictiveTag(ctx, 800, 250 + sh + 40, k);
  ctx.restore();
  F.text(ctx, 'ANALYSE', 150, 380, { size: 28, weight: 700, color: C.cyan, tracking: 6 });
  F.text(ctx, 'Revois chaque', 150, 480, { size: 84, weight: 700 });
  F.text(ctx, 'moment clé.', 150, 580, { size: 84, weight: 700, spectrum: 'moment clé.' });
  F.text(ctx, 'Écart d’or, objectifs et combats', 152, 660, { size: 32, weight: 500, color: C.text2 });
  F.text(ctx, 'au fil de la partie.', 152, 704, { size: 32, weight: 500, color: C.text2 });
}

const canvas = Canvas.createCanvas(W, H);
const ctx = canvas.getContext('2d');
for (const [i, k] of KEYS.entries()) {
  ctx.save();
  if (k.name.includes('hook')) hook(ctx, k.t);
  else if (k.name.includes('drop')) await drop(ctx, k.t, i);
  else analyse(ctx, k.t);
  ctx.restore();
  const file = path.join(OUT, `${k.name}.png`);
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(file);
}
