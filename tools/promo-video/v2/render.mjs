// v2 renderer.  node v2/render.mjs --poses            -> out/v2/glass-poses.json (drop sculpture)
//               node v2/render.mjs --sheet [step]     -> out/v2/sheet.png (contact sheet)
//               node v2/render.mjs --stills 1.2,16.5  -> out/v2/still-*.png
//               node v2/render.mjs                    -> out/v2/nxt5-promo-v2.mp4 (parallel workers + music)
import * as Canvas from '@napi-rs/canvas';
import { spawn, fork } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './film.mjs';
import * as M from './movie.mjs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MUSIC = path.join(HERE, '../out/music2.wav');
mkdirSync(M.OUT, { recursive: true });
const ev = M.loadEvents();
const DUR = ev.duration;
const FRAMES = Math.round(DUR * F.FPS);

if (args.includes('--poses')) {
  const file = path.join(M.OUT, 'glass-poses.json');
  writeFileSync(file, JSON.stringify(M.glassPoses()));
  console.log(file);
  process.exit(0);
}

await F.loadAssets();
const canvas = Canvas.createCanvas(F.W, F.H);
const ctx = canvas.getContext('2d');
const frameAt = async (fr) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  await M.drawFrame(ctx, fr / F.FPS, fr);
};

if (args.includes('--sheet') || args.includes('--stills')) {
  if (args.includes('--stills')) {
    for (const t of opt('--stills').split(',').map(Number)) {
      await frameAt(Math.round(t * F.FPS));
      const file = path.join(M.OUT, `still-${t.toFixed(2)}.png`);
      writeFileSync(file, canvas.toBuffer('image/png'));
      console.log(file);
    }
  } else {
    const step = Number(opt('--sheet') || 1);
    const times = [];
    for (let t = 0.1; t < DUR; t += step) times.push(t);
    const cols = 6, tw = 320, th = 180;
    const sheet = Canvas.createCanvas(cols * tw, Math.ceil(times.length / cols) * th);
    const sx = sheet.getContext('2d');
    for (const [i, t] of times.entries()) {
      await frameAt(Math.round(t * F.FPS));
      sx.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
      sx.fillStyle = 'rgba(0,0,0,.6)';
      sx.fillRect((i % cols) * tw, Math.floor(i / cols) * th, 64, 22);
      sx.fillStyle = '#fff';
      sx.font = '600 16px Inter';
      sx.fillText(`${t.toFixed(1)}s`, (i % cols) * tw + 6, Math.floor(i / cols) * th + 16);
    }
    const file = path.join(M.OUT, 'sheet.png');
    writeFileSync(file, sheet.toBuffer('image/png'));
    console.log(file);
  }
  process.exit(0);
}

async function encode(f0, f1, file) {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${F.W}x${F.H}`, '-r', String(F.FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())));
  for (let fr = f0; fr < f1; fr++) {
    await frameAt(fr);
    const data = ctx.getImageData(0, 0, F.W, F.H).data;
    if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise((r) => ff.stdin.once('drain', r));
    // napi finalizers only run when the event loop turns: yield so freed pixel buffers are released
    if (fr % 8 === 0) {
      globalThis.gc?.();
      await new Promise((r) => setImmediate(r));
    }
    if (process.send && fr % 30 === 0) process.send({ fr });
  }
  ff.stdin.end();
  await done;
}

if (args.includes('--worker')) {
  const [a, b] = opt('--worker').split(':').map(Number);
  await encode(a, b, opt('--out'));
  process.exit(0);
}

const workers = Math.max(1, Math.min(os.cpus().length, 4));
const chunk = Math.ceil(FRAMES / workers);
const parts = [];
await Promise.all(Array.from({ length: workers }, (_, i) => {
  const a = i * chunk;
  const b = Math.min(FRAMES, a + chunk);
  const part = path.join(M.OUT, `part-${process.pid}-${i}.mp4`);
  parts.push(part);
  return new Promise((res, rej) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker', `${a}:${b}`, '--out', part], { execArgv: ['--expose-gc'] });
    child.on('exit', (c, sig) => (c || sig ? rej(new Error(`worker ${i}: ${c ?? sig}`)) : res()));
  });
}));
const list = path.join(M.OUT, `parts-${process.pid}.txt`);
writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
const out = path.join(M.OUT, 'nxt5-promo-v2.mp4');
await new Promise((res, rej) => {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', MUSIC, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
  ff.on('close', (c) => (c ? rej(new Error('mux')) : res()));
});
parts.forEach((p) => unlinkSync(p));
unlinkSync(list);
console.log(out);
