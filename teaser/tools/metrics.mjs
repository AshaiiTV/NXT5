/* Mesures de la bible §6.5 sur une vidéo : luminance moyenne Y et énergie de contours E à 4 images/s.
 *   node tools/metrics.mjs out/final/nxt5-teaser-v7.mp4 [--csv out/metrics.csv]
 * Seuils : E ≥ 1.0 partout ; Y ≥ 13 dès 0,5 s ; moyenne 7.0–9.5 ≥ 15 ; moyenne 15.25–17.5 ≥ 17.1 ;
 * 21.25–21.5 et 24.75–25.25 ≥ 15 ; |ΔY| ≤ 4.5 entre échantillons, sauf ≤ 9 dans la fenêtre d'un impact (−0,1 à +0,75 s). */
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
const [video, ...rest] = process.argv.slice(2);
if (!video) { console.log('usage : node tools/metrics.mjs VIDEO [--csv fichier]'); process.exit(1); }
const W = 480, H = 270, FPS = 4;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const n = Math.floor(raw.length / (W * H)), rows = [];
for (let k = 0; k < n; k++) {
  const o = k * W * H; let sy = 0, se = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = raw[o + y * W + x]; sy += v; if (x) se += Math.abs(v - raw[o + y * W + x - 1]); }
  rows.push({ t: k / FPS, Y: sy / (W * H), E: se / ((W - 1) * H) });
}
const hits = [4.8, 14.4, 18.0, 28.8], fails = [];
const mean = (a, b) => { const r = rows.filter(r => r.t >= a - 1e-6 && r.t <= b + 1e-6); return r.reduce((s, r) => s + r.Y, 0) / Math.max(1, r.length); };
for (const r of rows) {
  if (r.E < 1.0) fails.push(`vide : E ${r.E.toFixed(2)} à ${r.t.toFixed(2)} s`);
  if (r.t >= 0.5 && r.Y < 13) fails.push(`presque noir : Y ${r.Y.toFixed(1)} à ${r.t.toFixed(2)} s`);
}
for (let k = 1; k < rows.length; k++) {
  // Fenêtre d'impact : la montée du flash et sa retombée naturelle sont tolérées jusqu'à 9.
  const d = rows[k].Y - rows[k - 1].Y, inHit = hits.some(h => rows[k].t >= h - 0.1 && rows[k].t - h <= 0.75);
  if (Math.abs(d) > 4.5 && !(inHit && Math.abs(d) <= 9)) fails.push(`saut de luminance ${d.toFixed(1)} à ${rows[k].t.toFixed(2)} s`);
}
const checks = [['rôles 7.0–9.5', 7.0, 9.5, 15.0], ['direction 15.25–17.5', 15.25, 17.5, 17.1], ['passage 21.25–21.5', 21.25, 21.5, 15.0], ['passage 24.75–25.25', 24.75, 25.25, 15.0]];
for (const [name, a, b, min] of checks) { const m = mean(a, b); console.log(`${name.padEnd(22)} Y moyen ${m.toFixed(1)} (seuil ${min})`); if (m < min) fails.push(`${name} : ${m.toFixed(1)} < ${min}`); }
console.log(`${rows.length} échantillons ; Y min ${Math.min(...rows.filter(r => r.t >= 0.5).map(r => r.Y)).toFixed(1)} ; E min ${Math.min(...rows.map(r => r.E)).toFixed(2)}`);
const i = rest.indexOf('--csv'); if (i >= 0) writeFileSync(rest[i + 1], 't,Y,E\n' + rows.map(r => `${r.t},${r.Y.toFixed(2)},${r.E.toFixed(3)}`).join('\n'));
console.log(fails.length ? `ÉCHECS (${fails.length}) :\n- ` + fails.join('\n- ') : 'Tous les seuils sont respectés.');
process.exit(fails.length ? 2 : 0);
