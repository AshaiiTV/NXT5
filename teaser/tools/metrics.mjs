/* Mesures de la bible §6.5 sur une vidéo : luminance moyenne Y et énergie de contours E à 4 images/s.
 *   node tools/metrics.mjs out/final/nxt5-teaser-v7.mp4 [--csv out/metrics.csv]
 * Seuils (v7.1) : E ≥ 1.0 partout ; Y ≥ 13 dès 0,5 s ; moyenne 7.0–9.5 ≥ 15 ; moyenne 10.45–12.7 ≥ 17.1 ;
 * passages d'outil 16.45–16.7, 19.95–20.45 et 23.55–24.05 ≥ 15 ; |ΔY| ≤ 4.5 entre échantillons, sauf ≤ 9 dans la
 * fenêtre d'un impact (−0,1 à +0,75 s). Impacts : 4.8, 9.6, 13.2, 27.6 (--v7 pour l'ancienne frise de la v7). */
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
const [video, ...rest] = process.argv.slice(2);
if (!video) { console.log('usage : node tools/metrics.mjs VIDEO [--csv fichier]'); process.exit(1); }
// Format lu sur la vidéo : 480×270 en 16:9, 270×480 en vertical (même nombre de points).
const [vw, vh] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video]).toString().trim().split(',').map(Number);
const W = vh > vw ? 270 : 480, H = vh > vw ? 480 : 270, FPS = 4;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
const n = Math.floor(raw.length / (W * H)), rows = [];
// Vertical : luminance de la bande des légendes (y 1500–1920, les 105 dernières lignes sur 480) et du reste de l'image.
const V = H > W, FOOT = V ? Math.round(H * 1500 / 1920) : H;
for (let k = 0; k < n; k++) {
  const o = k * W * H; let sy = 0, se = 0, sf = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = raw[o + y * W + x]; sy += v; if (y >= FOOT) sf += v; if (x) se += Math.abs(v - raw[o + y * W + x - 1]); }
  rows.push({ t: k / FPS, Y: sy / (W * H), E: se / ((W - 1) * H), F: V ? sf / (W * (H - FOOT)) : 0, R: V ? (sy - sf) / (W * FOOT) : 0 });
}
const v7 = rest.includes('--v7'), hits = v7 ? [4.8, 14.4, 18.0, 28.8] : [4.8, 9.6, 13.2, 27.6], fails = [];
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
const checks = v7
  ? [['rôles 7.0–9.5', 7.0, 9.5, 15.0], ['direction 15.25–17.5', 15.25, 17.5, 17.1], ['passage 21.25–21.5', 21.25, 21.5, 15.0], ['passage 24.75–25.25', 24.75, 25.25, 15.0]]
  : [['rôles 7.0–9.5', 7.0, 9.5, 15.0], ['direction 10.45–12.7', 10.45, 12.7, 17.1], ['passage 16.45–16.7', 16.45, 16.7, 15.0], ['passage 19.95–20.45', 19.95, 20.45, 15.0], ['passage 23.55–24.05', 23.55, 24.05, 15.0]];
for (const [name, a, b, min] of checks) { const m = mean(a, b); console.log(`${name.padEnd(22)} Y moyen ${m.toFixed(1)} (seuil ${min})`); if (m < min) fails.push(`${name} : ${m.toFixed(1)} < ${min}`); }
if (V) {
  // 9:16 (MOTION-BIBLE-9x16.md §6.11) : la bande des légendes reste plus sombre que le reste de l'image à chaque échantillon.
  for (const r of rows) if (r.t >= 0.5 && r.F > r.R) fails.push(`bande des légendes plus claire que l'image : ${r.F.toFixed(1)} > ${r.R.toFixed(1)} à ${r.t.toFixed(2)} s`);
  const worst = rows.filter(r => r.t >= 0.5).reduce((m, r) => Math.max(m, r.F - r.R), -Infinity);
  console.log(`bande des légendes : au plus ${worst.toFixed(1)} par rapport au reste de l'image (doit rester < 0)`);
}
console.log(`${rows.length} échantillons ; Y min ${Math.min(...rows.filter(r => r.t >= 0.5).map(r => r.Y)).toFixed(1)} ; E min ${Math.min(...rows.map(r => r.E)).toFixed(2)}`);
const i = rest.indexOf('--csv'); if (i >= 0) writeFileSync(rest[i + 1], (V ? 't,Y,E,foot,rest\n' : 't,Y,E\n') + rows.map(r => `${r.t},${r.Y.toFixed(2)},${r.E.toFixed(3)}` + (V ? `,${r.F.toFixed(2)},${r.R.toFixed(2)}` : '')).join('\n'));
console.log(fails.length ? `ÉCHECS (${fails.length}) :\n- ` + fails.join('\n- ') : 'Tous les seuils sont respectés.');
process.exit(fails.length ? 2 : 0);
