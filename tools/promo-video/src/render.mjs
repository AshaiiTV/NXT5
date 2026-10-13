// Renderer: scenes -> frames -> ffmpeg (H.264 60fps) + music mux, with transitions and global post FX.
// Usage:
//   node src/render.mjs                         full render (parallel workers) -> out/nxt5-promo.mp4
//   node src/render.mjs --stills 1.2,5,19.3     PNG stills at those seconds -> out/stills/
//   node src/render.mjs --scene S04 --stills 4  stills at local times (seconds) inside a scene
//   node src/render.mjs --from 18 --to 32       render a time range (preview mp4 with audio)
//   node src/render.mjs --sheet S04             contact sheet (8 frames across the scene)
//   options: --scale 0.5 (preview resolution), --workers 4, --out file.mp4
import * as Canvas from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.__canvasMod = Canvas;
const K = await import('./kit.mjs');
const { W, H, FPS, BAR, BEAT, barT, clamp, E, C, rgba, rng, offscreen, frameContext, noise1, loadEvents } = K;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);

const musicWav = path.join(OUT, 'music.wav');
const eventsFile = path.join(OUT, 'music.events.json');
if (!existsSync(eventsFile)) {
  console.error('missing out/music.events.json — run: python3 music.py out/music.wav');
  process.exit(1);
}
const EV = loadEvents(eventsFile);
await K.preloadUI();
const TOTAL = EV.duration;

// ------------------------------------------------------------------ scenes
const script = JSON.parse(readFileSync(path.join(ROOT, 'script.json'), 'utf8'));
const sceneFiles = readdirSync(path.join(ROOT, 'scenes')).filter((f) => /^S\d\d.*\.mjs$/.test(f)).sort();
const scenes = [];
const PREVIEW = Boolean(args.stills || args.sheet);
for (const file of sceneFiles) {
  let mod;
  try {
    mod = (await import(pathToFileURL(path.join(ROOT, 'scenes', file)).href)).default;
  } catch (err) {
    // While several people edit scenes in parallel, a broken neighbour must not block previews.
    if (!PREVIEW) throw err;
    console.error(`! ${file} failed to load: ${err.message}`);
    continue;
  }
  const meta = script.scenes.find((s) => s.id === mod.id) || {};
  scenes.push({ transitionOut: 'cut', ...meta, ...mod, cards: mod.cards || meta.cards || [] });
}
scenes.sort((a, b) => a.startBar - b.startBar);
if (!scenes.length) throw new Error('no scenes');

function sceneAt(t) {
  const b = t / BAR;
  let s = scenes[0];
  for (const sc of scenes) if (b >= sc.startBar) s = sc;
  return s;
}

/** Draws one scene at absolute time t into ctx; returns its fx request object. */
function drawScene(ctx, scene, t) {
  const f = frameContext(t, scene);
  f.cardsOf = scene.cards;
  ctx.save();
  let fx;
  try {
    fx = scene.draw(ctx, f, K) || {};
  } catch (err) {
    console.error(`scene ${scene.id} failed at t=${t.toFixed(3)}:`, err);
    if (!PREVIEW) throw err;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#400';
    ctx.fillRect(0, 0, W, H);
    K.text(ctx, `${scene.id} ERROR: ${err.message}`.slice(0, 90), W / 2, H / 2, { size: 40, font: (px) => K.F.inter(px, 700) });
    fx = {};
  }
  ctx.restore();
  return fx;
}

// ------------------------------------------------------------------ transitions
// Each transition covers [B - pre, B + post] around the boundary B between scene A and B.
const TRANS = {
  cut: { pre: 0, post: 0 },
  flash: { pre: 0.06, post: 0.25 },
  slash: { pre: BEAT * 0.5, post: BEAT * 0.15 },
  star: { pre: BEAT * 0.75, post: BEAT * 0.1 },
  shatter: { pre: 0, post: BEAT * 1.6 },
  glitch: { pre: BEAT * 0.25, post: BEAT * 0.25 },
  zoom: { pre: BEAT * 0.5, post: BEAT * 0.25 },
  iris: { pre: BEAT * 0.6, post: 0.05 },
};

function transitionAt(t) {
  for (let i = 0; i < scenes.length - 1; i++) {
    const a = scenes[i];
    const b = scenes[i + 1];
    const B = barT(b.startBar);
    const kind = TRANS[a.transitionOut] ? a.transitionOut : 'cut';
    const { pre, post } = TRANS[kind];
    if (kind !== 'cut' && t >= B - pre && t < B + post) return { a, b, B, kind, p: (t - (B - pre)) / (pre + post || 1) };
  }
  return null;
}

const SHARDS = (() => {
  const R = rng(99);
  const cols = 8;
  const rows = 5;
  const pts = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const jx = x > 0 && x < cols ? (R() - 0.5) * (W / cols) * 0.7 : 0;
      const jy = y > 0 && y < rows ? (R() - 0.5) * (H / rows) * 0.7 : 0;
      pts.push([(x * W) / cols + jx, (y * H) / rows + jy]);
    }
  }
  const tris = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * (cols + 1) + x;
      const q = [pts[i], pts[i + 1], pts[i + cols + 2], pts[i + cols + 1]];
      if (R() > 0.5) tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
      else tris.push([q[0], q[1], q[3]], [q[1], q[2], q[3]]);
    }
  }
  return tris.map((tr) => {
    const cx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3;
    const cy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3;
    const dx = cx - W / 2;
    const dy = cy - H / 2;
    const d = Math.hypot(dx, dy) || 1;
    return { tr, cx, cy, vx: (dx / d) * (900 + R() * 1400), vy: (dy / d) * (700 + R() * 1200) - 300, spin: (R() - 0.5) * 8 };
  });
})();

function composeTransition(ctx, tr, t) {
  const { a, b, B, kind } = tr;
  const p = clamp(tr.p);
  const [ca, xa] = offscreen('A');
  const [cb, xb] = offscreen('B');
  let fxA = {};
  let fxB = {};
  if (kind === 'shatter') {
    fxA = drawScene(xa, a, B - 1 / FPS); // frozen last frame of A
    fxB = drawScene(xb, b, t);
    ctx.drawImage(cb, 0, 0);
    const q = (t - B) / TRANS.shatter.post;
    const tt = (t - B);
    for (const s of SHARDS) {
      ctx.save();
      const ox = s.vx * tt * (0.4 + q);
      const oy = s.vy * tt + 1600 * tt * tt;
      ctx.translate(s.cx + ox, s.cy + oy);
      ctx.rotate(s.spin * tt);
      ctx.scale(1 - q * 0.4, 1 - q * 0.4);
      ctx.translate(-s.cx, -s.cy);
      ctx.beginPath();
      ctx.moveTo(...s.tr[0]);
      ctx.lineTo(...s.tr[1]);
      ctx.lineTo(...s.tr[2]);
      ctx.closePath();
      ctx.globalAlpha = 1 - E.inQuad(q);
      ctx.save();
      ctx.clip();
      ctx.drawImage(ca, 0, 0);
      ctx.restore();
      ctx.strokeStyle = rgba(C.cyan, 0.9 * (1 - q));
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    const flash = Math.exp(-tt * 14);
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, W, H);
    return { ...fxB, rgb: Math.max(fxB.rgb || 0, 18 * (1 - q)) };
  }
  if (kind === 'flash') {
    const before = t < B;
    const fx = before ? drawScene(ctx, a, t) : drawScene(ctx, b, t);
    const k = before ? (t - (B - TRANS.flash.pre)) / TRANS.flash.pre : 1 - (t - B) / TRANS.flash.post;
    ctx.fillStyle = `rgba(255,255,255,${clamp(k) ** 1.5})`;
    ctx.fillRect(0, 0, W, H);
    return fx;
  }
  fxA = drawScene(xa, a, t);
  fxB = drawScene(xb, b, t);
  ctx.drawImage(ca, 0, 0);
  ctx.save();
  if (kind === 'slash') {
    const e = E.inOutExpo(p);
    const ang = -0.32;
    const span = W * 1.6;
    const x = -span / 2 + e * span * 1.25;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.rect(-span, -H * 1.5, x + span, H * 3);
    ctx.save();
    ctx.clip();
    ctx.rotate(-ang);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(cb, 0, 0);
    ctx.restore();
    // band
    ctx.fillStyle = C.fuchsia2;
    ctx.fillRect(x - 10, -H * 1.5, 140 * (1 - Math.abs(e - 0.5) * 1.2), H * 3);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(x - 16, -H * 1.5, 8, H * 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 130 * (1 - Math.abs(e - 0.5) * 1.2), -H * 1.5, 26, H * 3);
  } else if (kind === 'star' || kind === 'iris') {
    const e = E.inQuart(p);
    const r = e * 2600;
    ctx.save();
    if (kind === 'star') K.starPath(ctx, W / 2, H / 2, r, r * 0.45, 5, -Math.PI / 2 + e * 1.2);
    else {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.drawImage(cb, 0, 0);
    ctx.restore();
    ctx.lineWidth = 14;
    ctx.strokeStyle = K.linearSpectrum(ctx, 0, 0, W, H);
    ctx.shadowColor = C.fuchsia;
    ctx.shadowBlur = 40;
    ctx.stroke();
  } else if (kind === 'glitch') {
    const R = rng(Math.floor(t * FPS));
    for (let i = 0; i < 18; i++) {
      const y = R() * H;
      const h = 10 + R() * 90;
      const useB = R() < p;
      const dx = (R() - 0.5) * 260 * Math.sin(p * Math.PI);
      ctx.drawImage(useB ? cb : ca, 0, y, W, h, dx, y, W, h);
    }
    if (p > 0.5) {
      ctx.globalAlpha = (p - 0.5) * 2;
      ctx.drawImage(cb, 0, 0);
    }
  } else if (kind === 'zoom') {
    const e = E.inOutExpo(p);
    ctx.globalAlpha = e;
    ctx.translate(W / 2, H / 2);
    ctx.scale(lerpN(1.6, 1, e), lerpN(1.6, 1, e));
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(cb, 0, 0);
  }
  ctx.restore();
  return p < 0.5 ? fxA : fxB;
}
const lerpN = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ post FX
const GRAIN = Array.from({ length: 4 }, (_, k) => {
  const c = Canvas.createCanvas(W / 2, H / 2);
  const x = c.getContext('2d');
  const img = x.createImageData(W / 2, H / 2);
  const R = rng(k + 1);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(R() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
});
const VIGNETTE = (() => {
  const c = Canvas.createCanvas(W, H);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(2,6,17,0)');
  g.addColorStop(1, 'rgba(2,6,17,0.72)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
})();

function rgbSplit(ctx, src, amount, t) {
  const [cr, xr] = offscreen('R');
  xr.drawImage(src, 0, 0);
  xr.globalCompositeOperation = 'multiply';
  xr.fillStyle = '#ff0000';
  xr.fillRect(0, 0, W, H);
  const [cg, xg] = offscreen('G');
  xg.drawImage(src, 0, 0);
  xg.globalCompositeOperation = 'multiply';
  xg.fillStyle = '#00ffff';
  xg.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const R = rng(Math.floor(t * FPS) + 7);
  const dy = (R() - 0.5) * amount * 0.3;
  ctx.drawImage(cr, amount, dy);
  ctx.drawImage(cg, -amount, -dy);
  ctx.restore();
  // slice displacement
  if (amount > 8) {
    const [cs, xs] = offscreen('S');
    xs.drawImage(ctx.canvas, 0, 0);
    const n = Math.floor(amount / 3);
    for (let i = 0; i < n; i++) {
      const y = R() * H;
      const h = 4 + R() * 40;
      ctx.drawImage(cs, 0, y, W, h, (R() - 0.5) * amount * 6, y, W, h);
    }
  }
}

/** Renders the final composited frame at time t into `canvas`. */
function renderFrame(canvas, t) {
  const ctx = canvas.getContext('2d');
  const [cs, xs] = offscreen('scene');
  xs.fillStyle = C.night;
  xs.fillRect(0, 0, W, H);
  const tr = transitionAt(t);
  const scene = sceneAt(t);
  const fx = tr ? composeTransition(xs, tr, t) : drawScene(xs, scene, t);

  // automatic music-driven FX (scenes can tune with fx.shake / fx.rgb / fx.zoom / fx.flash, or fx.auto=false)
  const f = frameContext(t, scene);
  const auto = fx.auto !== false;
  const drop = f.energy >= 0.9 ? 1 : 0;
  const hit = Math.exp(-f.since('impact') * 5);
  let shake = (fx.shake ?? 0) + (auto ? hit * 26 + drop * f.kick * 8 : 0);
  let rgb = (fx.rgb ?? 0) + (auto ? Math.exp(-f.since('impact') * 9) * 22 + drop * f.env('snare', 18) * 7 : 0);
  let zoom = (fx.zoom ?? 0) + (auto ? hit * 0.05 + drop * f.kick * 0.016 : 0);
  const flash = (fx.flash ?? 0) + (auto ? Math.exp(-f.since('impact') * 18) * 0.55 : 0);
  if (t < 0.02) shake = rgb = zoom = 0;

  ctx.save();
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  const sx = noise1(t * 30, 1) * shake;
  const sy = noise1(t * 30, 2) * shake;
  const rot = noise1(t * 22, 3) * shake * 0.0012;
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.rotate(rot);
  ctx.scale(1 + zoom + shake * 0.0012, 1 + zoom + shake * 0.0012);
  ctx.translate(-W / 2, -H / 2);
  if (rgb > 1.5) rgbSplit(ctx, cs, rgb, t);
  else ctx.drawImage(cs, 0, 0);
  ctx.restore();

  if (flash > 0.01) {
    ctx.fillStyle = `rgba(235,250,255,${clamp(flash)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(VIGNETTE, 0, 0);
  // scanlines + grain
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(GRAIN[Math.floor(t * FPS) % 4], 0, 0, W, H);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  // fade in from black at the very start, fade out at the end
  // the end card holds to the last frame unless the scene asks for a fade (fx.fadeOut 0..1)
  const fadeOut = clamp(fx.fadeOut ?? 0);
  if (fadeOut > 0) {
    ctx.fillStyle = `rgba(2,6,17,${fadeOut})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ------------------------------------------------------------------ outputs
function savePng(canvas, file, scale = 1) {
  if (scale !== 1) {
    const c = Canvas.createCanvas(Math.round(W * scale), Math.round(H * scale));
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    canvas = c;
  }
  writeFileSync(file, canvas.toBuffer('image/png'));
}

async function encodeRange(t0, t1, file, { scale = 1, audio = false } = {}) {
  const canvas = Canvas.createCanvas(W, H);
  const ow = Math.round((W * scale) / 2) * 2;
  const oh = Math.round((H * scale) / 2) * 2;
  const small = scale !== 1 ? Canvas.createCanvas(ow, oh) : null;
  const ffArgs = ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${ow}x${oh}`, '-r', String(FPS), '-i', '-'];
  if (audio) ffArgs.push('-ss', t0.toFixed(4), '-t', (t1 - t0).toFixed(4), '-i', musicWav, '-c:a', 'aac', '-b:a', '256k');
  ffArgs.push('-c:v', 'libx264', '-preset', scale < 1 ? 'veryfast' : 'slow', '-crf', scale < 1 ? '23' : '16', '-pix_fmt', 'yuv420p', '-tune', 'animation', file);
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
  const f0 = Math.round(t0 * FPS);
  const f1 = Math.round(t1 * FPS);
  for (let fr = f0; fr < f1; fr++) {
    renderFrame(canvas, fr / FPS);
    let src = canvas;
    if (small) {
      const sx = small.getContext('2d');
      sx.drawImage(canvas, 0, 0, ow, oh);
      src = small;
    }
    const data = src.getContext('2d').getImageData(0, 0, ow, oh).data;
    if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise((r) => ff.stdin.once('drain', r));
    if (process.send && fr % 30 === 0) process.send({ fr });
  }
  ff.stdin.end();
  await done;
}

const scale = Number(args.scale || 1);

if (args.worker) {
  const [a, b] = String(args.worker).split(':').map(Number);
  await encodeRange(a / FPS, b / FPS, args.out, { scale });
  process.exit(0);
}

if (args.stills || args.sheet) {
  const dir = path.join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const canvas = Canvas.createCanvas(W, H);
  let times = [];
  if (args.sheet) {
    const sc = scenes.find((s) => s.id === args.sheet);
    const a = barT(sc.startBar);
    const b = Math.min(barT(sc.endBar), TOTAL);
    const n = Number(args.n || 8);
    times = Array.from({ length: n }, (_, i) => a + ((i + 0.5) / n) * (b - a));
    const cols = 4;
    const tw = 480;
    const th = 270;
    const sheet = Canvas.createCanvas(cols * tw, Math.ceil(n / cols) * th);
    const sx = sheet.getContext('2d');
    times.forEach((t, i) => {
      renderFrame(canvas, t);
      sx.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
      sx.fillStyle = '#fff';
      sx.font = '700 18px Inter';
      sx.fillText(`${t.toFixed(2)}s  bar ${(t / BAR).toFixed(2)}`, (i % cols) * tw + 8, Math.floor(i / cols) * th + 22);
    });
    const file = path.join(dir, `sheet-${args.sheet}.png`);
    writeFileSync(file, sheet.toBuffer('image/png'));
    console.log(file);
  } else {
    const sc = args.scene ? scenes.find((s) => s.id === args.scene) : null;
    times = String(args.stills).split(',').map(Number).map((x) => (sc ? barT(sc.startBar) + x : x));
    for (const t of times) {
      renderFrame(canvas, t);
      const file = path.join(dir, `${sc ? sc.id + '-' : ''}t${t.toFixed(2)}.png`);
      savePng(canvas, file, Number(args.scale || 0.5));
      console.log(file);
    }
  }
  process.exit(0);
}

// video render (range or full), split across worker processes
const t0 = Number(args.from || 0);
const t1 = Math.min(Number(args.to || TOTAL), TOTAL);
const workers = Number(args.workers || Math.max(1, Math.min(os.cpus().length, 8)));
const outFile = path.resolve(args.out || path.join(OUT, args.from || args.to ? `preview-${t0}-${t1}.mp4` : 'nxt5-promo.mp4'));
const f0 = Math.round(t0 * FPS);
const f1 = Math.round(t1 * FPS);
const chunk = Math.ceil((f1 - f0) / workers);
const parts = [];
const started = process.hrtime.bigint();
const { fork } = await import('node:child_process');
const progress = new Array(workers).fill(0);
await Promise.all(
  Array.from({ length: workers }, (_, i) => {
    const a = f0 + i * chunk;
    const b = Math.min(f1, a + chunk);
    if (a >= b) return null;
    const part = path.join(OUT, `part-${i}.mp4`);
    parts.push(part);
    return new Promise((res, rej) => {
      const child = fork(fileURLToPath(import.meta.url), ['--worker', `${a}:${b}`, '--out', part, '--scale', String(scale)]);
      child.on('message', (m) => {
        progress[i] = m.fr - a;
        const tot = progress.reduce((x, y) => x + y, 0);
        if (i === 0) process.stdout.write(`\r${tot}/${f1 - f0} frames`);
      });
      child.on('exit', (c) => (c ? rej(new Error(`worker ${i} exited ${c}`)) : res()));
    });
  }),
);
const list = path.join(OUT, 'parts.txt');
writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
await new Promise((res, rej) => {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', t0.toFixed(4), '-t', (t1 - t0).toFixed(4), '-i', musicWav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', outFile], { stdio: 'inherit' });
  ff.on('close', (c) => (c ? rej(new Error('mux failed')) : res()));
});
parts.forEach((p) => unlinkSync(p));
unlinkSync(list);
console.log(`\n${outFile}  (${((Number(process.hrtime.bigint() - started) / 1e9)).toFixed(1)}s)`);
