// NXT5 promo v2 — the full 38 s film as a pure function of time, cut on music2.py (120 BPM, bar = 2 s).
// 0 hook · 8 build (five roles) · 15.5 silence · 16 drop (glass 5) · 20-28 features · 28 recap · 32 end card
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './film.mjs';

const { W, H, C, seg, lerp, ease, clamp } = F;
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.resolve(HERE, '../out/v2');
export const GLASS_DIR = path.join(OUT, 'glass-drop');
export const GLASS_FROM = 16;
export const GLASS_TO = 20;
const NBSP = ' ';

let EV = null;
export function loadEvents(file = path.join(HERE, '../out/music2.events.json')) {
  EV = JSON.parse(readFileSync(file, 'utf8'));
  return EV;
}
function env(kind, t, decay = 6) {
  let last = -Infinity;
  for (const e of EV[kind] || []) if (e <= t + 1e-6) last = e;
  return Number.isFinite(last) ? Math.exp(-(t - last) * decay) : 0;
}
export const DURATION = () => EV.duration;

/** Glass 5 pose for the drop (frames rendered once by glass/render-glass.cjs). */
export function glassPoses(fps = F.FPS) {
  const n = Math.round((GLASS_TO - GLASS_FROM) * fps);
  return Array.from({ length: n }, (_, i) => F.glassPose(GLASS_FROM + i / fps));
}

// ------------------------------------------------------------------ helpers
function withCamera(ctx, scale, fn, cx = W / 2, cy = H / 2) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}
/** Light band sweeping across a rectangle (glass glint), p 0..1. */
function glint(ctx, x, y, w, h, p) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20);
  ctx.clip();
  const gx = x - 300 + p * (w + 600);
  const g = ctx.createLinearGradient(gx - 160, y, gx + 160, y + h * 0.3);
  g.addColorStop(0, 'rgba(226,232,255,0)');
  g.addColorStop(0.5, 'rgba(226,232,255,0.13)');
  g.addColorStop(1, 'rgba(226,232,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
function bloom(ctx, t, at, color = '#8B5CF6', strength = 0.55) {
  const k = t - at;
  if (k < 0 || k > 1.2) return;
  const a = strength * Math.exp(-k * 4);
  F.glow(ctx, W / 2, H / 2, 1300, color, a);
}

// ------------------------------------------------------------------ 0-8 s: hook
function hook(ctx, t) {
  F.backdrop(ctx, t, { dim: 0.55 });
  const beat = env('taiko', t, 5) * 0.08 + env('impact', t, 2.5) * 0.12;
  F.glow(ctx, W / 2, H * 0.66, 760, '#8B5CF6', 0.14 + beat);
  bloom(ctx, t, 0, '#8B5CF6', 0.35);
  bloom(ctx, t, 4, '#8B5CF6', 0.3);
  const out = 1 - ease.inOut(seg(t, 7.55, 7.95));
  withCamera(ctx, 1 + 0.035 * (t / 8), () => {
    ctx.save();
    ctx.globalAlpha *= out;
    // "Défaite." — already readable on frame 0, then steps back when the question arrives
    const up = ease.inOut(seg(t, 3.85, 4.35));
    ctx.save();
    ctx.translate(W / 2, lerp(560, 300, up));
    ctx.scale(lerp(1, 0.5, up), lerp(1, 0.5, up));
    F.revealLine(ctx, seg(t, -0.22, 0.2), -W / 2, 0, 230, () =>
      F.text(ctx, 'Défaite.', 0, 0, { size: 230, weight: 700, color: C.danger, align: 'center', tracking: -4, alpha: lerp(1, 0.45, up) }));
    ctx.restore();
    const enc = 1 - seg(t, 3.7, 3.95);
    if (enc > 0) F.revealLine(ctx, seg(t, 2, 2.4), 0, 680, 64, () => F.text(ctx, 'Encore une.', W / 2, 680, { size: 64, weight: 500, color: C.text2, align: 'center', alpha: enc }));
    F.revealLine(ctx, seg(t, 4.12, 4.55), 0, 600, 128, () => F.text(ctx, 'Tu sais vraiment', W / 2, 600, { size: 128, weight: 700, align: 'center' }));
    F.revealLine(ctx, seg(t, 4.32, 4.75), 0, 750, 128, () => F.text(ctx, `pourquoi${NBSP}?`, W / 2, 750, { size: 128, weight: 700, align: 'center', spectrum: 'pourquoi' }));
    ctx.restore();
  });
}

// ------------------------------------------------------------------ 8-16 s: five roles converge
const ROLES = [['top', 'TOP'], ['jungle', 'JGL'], ['middle', 'MID'], ['bottom', 'ADC'], ['utility', 'SUP']];
function build(ctx, t) {
  F.backdrop(ctx, t, { dim: 0.45 });
  const rise = seg(t, 8, 15.5);
  F.glow(ctx, W / 2, 640, 600 + rise * 300, '#8B5CF6', 0.12 + rise * 0.22 + env('taiko', t, 7) * 0.06);
  const silence = ease.inOut(seg(t, 15.45, 15.6));
  const fadeIn = ease.out(seg(t, 7.9, 8.3));
  ctx.save();
  ctx.globalAlpha *= fadeIn * (1 - silence);
  // headline
  const swap = seg(t, 11.8, 12.1);
  if (swap < 1) F.revealLine(ctx, seg(t, 8.0, 8.4), 0, 330, 104, () => F.text(ctx, 'Cinq joueurs.', W / 2, 330, { size: 104, weight: 700, align: 'center', alpha: 1 - swap }));
  if (t >= 12) F.revealLine(ctx, seg(t, 12.0, 12.45), 0, 330, 104, () => F.text(ctx, 'Une même direction.', W / 2, 330, { size: 104, weight: 700, align: 'center', spectrum: 'direction.' }));
  // tokens
  const conv = ease.in(seg(t, 13, 15.4));
  const cx = W / 2;
  const cy = 640;
  ROLES.forEach(([key, label], i) => {
    const t0 = 8 + i * 0.5;
    const pop = ease.outQuint(seg(t, t0, t0 + 0.35));
    if (pop <= 0) return;
    const x0 = cx + (i - 2) * 280;
    const x = lerp(x0, cx, conv);
    const y = lerp(cy, cy - 20, conv);
    const r = 92 * lerp(1, 0.25, conv) * (0.85 + 0.15 * pop);
    // light trail toward the centre once the build starts converging
    if (t > 12 && conv < 1) {
      const a = 0.25 + 0.5 * seg(t, 12, 15);
      const g = ctx.createLinearGradient(x, y, cx, cy - 20);
      g.addColorStop(0, `rgba(103,232,249,${a})`);
      g.addColorStop(1, `rgba(232,121,249,${a})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(cx, cy - 20);
      ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha *= pop;
    F.glow(ctx, x, y, r * 2.2, '#67E8F9', 0.10 + env('taiko', t, 8) * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const gg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    gg.addColorStop(0, '#263248');
    gg.addColorStop(0.62, '#221e42');
    gg.addColorStop(1, '#1b273c');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(196,181,253,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const icon = F.assets().roles[key];
    const s = r * 1.05;
    ctx.drawImage(icon, x - s / 2, y - s / 2, s, s);
    if (conv < 0.6) F.text(ctx, label, x, y + r + 58, { size: 34, weight: 700, color: C.violetText, align: 'center', tracking: 4, alpha: 1 - conv / 0.6 });
    ctx.restore();
  });
  // convergence point
  if (conv > 0.6) F.glow(ctx, cx, cy - 20, 90 + 120 * conv, '#E879F9', 0.35 * conv);
  ctx.restore();
  // held breath: a single violet point in the dark
  if (silence > 0) {
    ctx.fillStyle = `rgba(17,24,39,${0.85 * silence})`;
    ctx.fillRect(0, 0, W, H);
    F.glow(ctx, cx, cy - 20, 60, '#C4B5FD', 0.9 * silence);
  }
}

// ------------------------------------------------------------------ 16-20 s: drop — the glass 5
async function drop(ctx, t, frameIndex) {
  F.backdrop(ctx, t, { dim: 0.3 });
  const out = ease.inOut(seg(t, 19.55, 20));
  F.glow(ctx, 1500, 760, 620, '#8B5CF6', 0.32);
  F.glow(ctx, 980, 420, 420, '#67E8F9', 0.1);
  F.glow(ctx, 1720, 520, 420, '#E879F9', 0.12 + env('snare', t, 8) * 0.06);
  bloom(ctx, t, 16, '#A78BFA', 0.7);
  const g = await F.loadGlassFrame(GLASS_DIR, frameIndex);
  if (g) {
    const gw = 820;
    const gh = (gw * g.height) / g.width;
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.drawImage(g, 1510 - gw / 2 + out * 120, 560 - gh / 2, gw, gh);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= 1 - out;
  ctx.translate(-out * 120, 0);
  F.revealLine(ctx, seg(t, 16.12, 16.55), 0, 470, 88, () => F.text(ctx, 'Comprends tes parties.', 150, 470, { size: 88, weight: 700 }));
  F.revealLine(ctx, seg(t, 16.35, 16.8), 0, 580, 88, () => F.text(ctx, 'Prépare la suite.', 150, 580, { size: 88, weight: 700, spectrum: 'Prépare la suite.' }));
  F.text(ctx, 'L’espace de travail des équipes et coachs League of Legends', 154, 660, { size: 32, weight: 500, color: C.text2, alpha: ease.out(seg(t, 16.6, 17)) });
  F.wordmark(ctx, 330, 880, 360, ease.out(seg(t, 16.7, 17.1)));
  ctx.restore();
}

// ------------------------------------------------------------------ 20-28 s: one real feature per bar
const FEATURES = [
  { eyebrow: 'ANALYSE', l1: 'Revois chaque', l2: 'moment clé.', sub: ['Écart d’or, objectifs et combats', 'au fil de la partie.'], ui: 'ui-match-timeline-3345.png', crop: [80, 600, 1760, 860], w: 1000 },
  { eyebrow: 'DÉBRIEFS', l1: 'Note ce qui', l2: 'doit changer.', sub: ['Les points à travailler,', 'liés à la partie.'], ui: 'ui-debrief.png', crop: [0, 0, 1952, 1150], w: 960 },
  { eyebrow: 'DRAFT', l1: 'Cinq picks.', l2: 'Une intention.', sub: ['Champions par rôle', 'et compositions à cinq.'], ui: 'ui-draft.png', crop: [0, 100, 1918, 900], w: 1000 },
  { eyebrow: 'PLANNING', l1: 'Le cinq au', l2: 'rendez-vous.', sub: ['Dispos, scrims et débriefs', 'de la semaine.'], ui: 'ui-planning.png', crop: [0, 130, 1918, 1480], w: 780 },
];
function feature(ctx, t) {
  const i = clamp(Math.floor((t - 20) / 2), 0, 3);
  const f = FEATURES[i];
  const lt = t - (20 + i * 2);
  F.backdrop(ctx, t, { dim: 0.45, img: 'clouds' });
  F.glow(ctx, 1300, 560, 720, '#8B5CF6', 0.22 + env('kick', t, 9) * 0.05);
  F.glow(ctx, 1800, 300, 420, '#E879F9', 0.08);
  const enter = ease.outQuint(seg(lt, 0, 0.55));
  const exit = i < 3 ? ease.in(seg(lt, 1.7, 2)) : ease.in(seg(lt, 1.75, 2));
  const alpha = enter * (1 - exit);
  // panel
  const sh = ((f.w * f.crop[3]) / f.crop[2]);
  const px = 1310 - f.w / 2;
  const py = 540 - sh / 2 - 20;
  withCamera(ctx, 1 + 0.025 * seg(lt, 0, 2), () => {
    ctx.save();
    ctx.translate((1 - enter) * 140 - exit * 90, 0);
    F.uiShot(ctx, f.ui, px, py, f.w, f.crop, { alpha });
    glint(ctx, px - 18, py - 18, f.w + 36, sh + 36, seg(lt, 1.0, 1.6));
    F.fictiveTag(ctx, px, py + sh + 40, alpha);
    ctx.restore();
  }, 1310, 540);
  // text
  ctx.save();
  ctx.globalAlpha *= 1 - exit;
  ctx.translate(-exit * 60, 0);
  F.text(ctx, f.eyebrow, 150, 380, { size: 28, weight: 700, color: C.cyan, tracking: 6, alpha: ease.out(seg(lt, 0, 0.3)) });
  F.revealLine(ctx, seg(lt, 0.05, 0.45), 0, 480, 84, () => F.text(ctx, f.l1, 150, 480, { size: 84, weight: 700 }));
  F.revealLine(ctx, seg(lt, 0.18, 0.6), 0, 580, 84, () => F.text(ctx, f.l2, 150, 580, { size: 84, weight: 700, spectrum: f.l2 }));
  f.sub.forEach((s, k) => F.text(ctx, s, 152, 660 + k * 44, { size: 32, weight: 500, color: C.text2, alpha: ease.out(seg(lt, 0.35 + k * 0.08, 0.75 + k * 0.08)) }));
  ctx.restore();
}

// ------------------------------------------------------------------ 28-32 s: the whole team, one place
function recap(ctx, t) {
  const lt = t - 28;
  F.backdrop(ctx, t, { dim: 0.4 });
  F.glow(ctx, W / 2, 700, 900, '#8B5CF6', 0.22 + seg(t, 30, 31.8) * 0.2);
  const out = ease.in(seg(t, 31.6, 32));
  ctx.save();
  ctx.globalAlpha *= 1 - out;
  F.revealLine(ctx, seg(lt, 0, 0.4), 0, 250, 96, () => F.text(ctx, 'Toute l’équipe.', W / 2, 250, { size: 96, weight: 700, align: 'center' }));
  F.revealLine(ctx, seg(lt, 0.5, 0.9), 0, 360, 96, () => F.text(ctx, 'Au même endroit.', W / 2, 360, { size: 96, weight: 700, align: 'center', spectrum: 'même endroit.' }));
  const w = 410;
  withCamera(ctx, 1 + 0.04 * seg(t, 29.5, 32), () => {
    FEATURES.forEach((f, i) => {
      const k = ease.outQuint(seg(lt, i * 0.5, i * 0.5 + 0.5));
      if (k <= 0) return;
      const sh = Math.min(300, (w * f.crop[3]) / f.crop[2]);
      const crop = [f.crop[0], f.crop[1], f.crop[2], Math.min(f.crop[3], (f.crop[2] * sh) / w)];
      const x = 95 + i * (w + 30);
      const y = 520 + (1 - k) * 120 + (i % 2) * 24;
      F.uiShot(ctx, f.ui, x, y, w, crop, { alpha: k, pad: 12 });
      F.text(ctx, f.eyebrow, x, y + sh + 62, { size: 24, weight: 700, color: C.cyan, tracking: 5, alpha: k });
    });
  }, W / 2, 680);
  ctx.restore();
}

// ------------------------------------------------------------------ 32-38 s: end card
function end(ctx, t) {
  F.backdrop(ctx, t, { dim: 0.35 });
  F.glow(ctx, W / 2, 470, 900, '#8B5CF6', 0.28);
  F.glow(ctx, 520, 360, 500, '#67E8F9', 0.08);
  F.glow(ctx, 1420, 360, 500, '#E879F9', 0.1);
  bloom(ctx, t, 32, '#A78BFA', 0.6);
  const k = ease.outQuint(seg(t, 32, 32.7));
  ctx.save();
  ctx.translate(W / 2, 360);
  ctx.scale(lerp(1.06, 1, k), lerp(1.06, 1, k));
  F.wordmark(ctx, 0, 0, 860, k);
  ctx.restore();
  // manifesto: Inter 600, full letters, last word lavender (charte §2/§5)
  F.revealLine(ctx, seg(t, 32.6, 33.05), 0, 640, 64, () => {
    ctx.font = '600 64px Inter';
    const a = 'Joue. Analyse. ';
    const b = 'Recommence.';
    const wa = ctx.measureText(a).width;
    const wb = ctx.measureText(b).width;
    const x0 = W / 2 - (wa + wb) / 2;
    F.text(ctx, a, x0, 640, { size: 64, weight: 600 });
    F.text(ctx, b, x0 + wa, 640, { size: 64, weight: 600, color: C.violetText });
  });
  F.revealLine(ctx, seg(t, 33.2, 33.6), 0, 770, 72, () => F.text(ctx, 'nxt5.org', W / 2, 770, { size: 72, weight: 700, color: C.cyan, align: 'center' }));
  // primary action: brand gradient, dark text #020611, 2 px corners (charte §3/§6)
  const b = ease.outQuint(seg(t, 33.6, 34.1));
  if (b > 0) {
    ctx.save();
    ctx.globalAlpha *= b;
    ctx.font = '700 34px Inter';
    const label = 'Essaie la démo';
    const bw = ctx.measureText(label).width + 80;
    const bx = W / 2 - bw / 2;
    const by = 830 + (1 - b) * 20;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#22D3EE');
    g.addColorStop(0.5, '#3B82F6');
    g.addColorStop(1, '#D946EF');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 72, 2);
    ctx.fill();
    F.text(ctx, label, W / 2, by + 48, { size: 34, weight: 700, color: C.onAccent, align: 'center' });
    ctx.restore();
  }
}

/** Draws frame t. frameIndex is the global frame number (for the pre-rendered glass frames). */
export async function drawFrame(ctx, t, frameIndex) {
  ctx.save();
  if (t < 8) hook(ctx, t);
  else if (t < 16) build(ctx, t);
  else if (t < 20) await drop(ctx, t, frameIndex - Math.round(GLASS_FROM * F.FPS));
  else if (t < 28) feature(ctx, t);
  else if (t < 32) recap(ctx, t);
  else end(ctx, t);
  ctx.restore();
}
