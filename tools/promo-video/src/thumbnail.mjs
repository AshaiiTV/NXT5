// YouTube thumbnail (1280x720) drawn with the same kit as the film.
// node src/thumbnail.mjs  ->  out/thumbnail.png (+ out/thumbnail-alt.png)
import * as Canvas from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.__canvasMod = Canvas;
const K = await import('./kit.mjs');
const { W, H, C, F, rgba } = K;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
mkdirSync(OUT, { recursive: true });
K.loadEvents(path.join(OUT, 'music.events.json'));
await K.preloadUI();

function draw(variant) {
  const c = Canvas.createCanvas(W, H);
  const ctx = c.getContext('2d');
  const f = K.frameContext(20.0, { startBar: 12, endBar: 16 });
  K.background(ctx, f, { warm: 1, intensity: 1.4 });
  K.halftone(ctx, f, { color: C.fuchsia, alpha: 0.35, band: [0.05, 0.6], maxR: 7 });

  // diagonal Persona split: left "tilt" red zone, right brand zone
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.46, 0);
  ctx.lineTo(W * 0.34, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  const red = ctx.createLinearGradient(0, 0, W * 0.4, H);
  red.addColorStop(0, '#3a0816');
  red.addColorStop(1, '#12040a');
  ctx.fillStyle = red;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.fuchsia2;
  K.polyPath(ctx, [[W * 0.46, 0], [W * 0.49, 0], [W * 0.37, H], [W * 0.34, H]]);
  ctx.fill();
  ctx.fillStyle = C.cyan;
  K.polyPath(ctx, [[W * 0.495, 0], [W * 0.505, 0], [W * 0.385, H], [W * 0.375, H]]);
  ctx.fill();

  // tilted player silhouette (head + shoulders over a monitor), red rim light
  ctx.save();
  ctx.translate(W * 0.2, H * 0.62);
  ctx.shadowColor = C.red;
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#05010a';
  ctx.beginPath();
  ctx.ellipse(0, -170, 95, 110, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-260, 260);
  ctx.quadraticCurveTo(-240, -40, -10, -50);
  ctx.quadraticCurveTo(230, -40, 260, 260);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 6;
  ctx.shadowColor = C.red;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.ellipse(W * 0.2, H * 0.62 - 170, 95, 110, -0.25, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  // gaming headset: band over the head + ear cup + mic boom
  ctx.save();
  ctx.translate(W * 0.2, H * 0.62 - 170);
  ctx.rotate(-0.25);
  ctx.strokeStyle = '#2a0710';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(0, 10, 118, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.fillStyle = '#16030a';
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 5;
  ctx.shadowColor = C.red;
  ctx.shadowBlur = 25;
  K.roundRect(ctx, -140, -10, 50, 92, 18);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-110, 70);
  ctx.quadraticCurveTo(-90, 140, -10, 135);
  ctx.stroke();
  ctx.restore();
  ctx.shadowBlur = 0;

  // big headline
  const headline = variant === 'alt' ? ['TES GAMES', 'DISENT TOUT.'] : ['PAS LE', 'JUNGLE.'];
  K.text(ctx, headline[0], W * 0.71, H * 0.3, { size: 210, font: F.anton, stroke: 22, strokeColor: C.ink, glow: 0 });
  K.text(ctx, headline[1], W * 0.71, H * 0.53, { size: 230, font: F.anton, stroke: 24, strokeColor: C.ink, emph: headline[1], glow: 40 });

  // the real UI as proof (falls back to a placeholder panel if the screenshot is missing)
  const img = K.uiImage('ui-match-timeline-3345.png');
  if (img) K.screen(ctx, 'ui-match-timeline-3345.png', W * 0.71, H * 0.82, 820, { src: [90, 600, 1740, 660], tilt: -0.04, frame: C.cyan, glare: 0.25 });
  else K.panel(ctx, W * 0.5, H * 0.7, 760, 250, { header: 'ANALYSE DE PARTIE', tilt: -0.05 });

  // arrow to "TOI"
  K.stamp(ctx, 'TOI ?', W * 0.15, H * 0.17, { size: 110, color: C.red, angle: -0.12 });
  K.logo(ctx, W * 0.87, H * 0.08, 330, { fill: 1, glow: 30 });

  const out = Canvas.createCanvas(1280, 720);
  out.getContext('2d').drawImage(c, 0, 0, 1280, 720);
  const file = path.join(OUT, variant === 'alt' ? 'thumbnail-alt.png' : 'thumbnail.png');
  writeFileSync(file, out.toBuffer('image/png'));
  console.log(file);
}
draw('main');
draw('alt');
