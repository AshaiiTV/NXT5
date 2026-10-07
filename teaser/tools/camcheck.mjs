/* Contrôle de la caméra (bible §6.7) avec les vraies clés et la vraie projection du kit.
 *   node tools/camcheck.mjs
 * Marges : chaque boîte de contenu reste à ≥ 154 px des côtés et ≥ 86 px du haut et du bas dans sa fenêtre.
 * Échelle des titres ≥ 0,945 ; avancée ≤ 75 px/s (≤ 150 pendant la révélation du drop) ; panoramique et bascule ≤ 0,8 °/s
 * (orbite ≤ 1,6 °/s) ; dérive des sujets ≤ 60 px/s pendant les tenues ; vitesse nulle sur la dernière image. */
import { chromium } from 'playwright-core';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fi = process.argv.indexOf('--format'), V = (fi > 0 ? process.argv[fi + 1] : process.env.NX_FORMAT || 'h') === 'v', VW = V ? 1080 : 1920, VH = V ? 1920 : 1080;
const EXE = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'].find(p => existsSync(p));
const b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-web-security', '--allow-file-access-from-files', '--disable-gpu-rasterization'] });
const p = await b.newPage({ viewport: { width: VW, height: VH } });
await p.goto(`file://${ROOT}/index.html?capture=1&only=ciel${V ? '&format=v' : ''}`);
await p.waitForFunction(() => window.NXready === true, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const G = NX.G, fails = [], info = [];
  const art = L => { const k = L.w / 1254; return [L.left + 90 * k, L.top + 106 * k, L.left + 1165 * k, L.top + 802 * k, 0]; };
  // Boîtes de contenu (monde) et leurs fenêtres d'affichage.
  // v7.1 : fenêtres lues sur NX.T (rôles en transition, quatre outils).
  const T = NX.T, D = NX.DURATION, P = G.pent, sq = G.roles.tile * P.scale / 2;
  // v7.2 : pentagone r = 262 autour du centre optique de l'emblème (NX.M72.C0 + S0·NX.M72.OPT), y vers le bas, Mid en haut.
  const PC = [NX.M72.C0[0] + NX.M72.S0 * NX.M72.OPT[0], NX.M72.C0[1] + NX.M72.S0 * NX.M72.OPT[1]], PR = 262;
  const pentBox = (() => { const xs = [], ys = []; P.deg.forEach(a => { const r = a * Math.PI / 180; xs.push(PC[0] + PR * Math.cos(r)); ys.push(PC[1] + PR * Math.sin(r)); });
    return [Math.min(...xs) - sq, Math.min(...ys) - sq, Math.max(...xs) + sq, Math.max(...ys) + sq, 0]; })();
  const boxes = [
    ['question', 0, T.hookEnd, [960 - 664, 350, 960 + 664, 662, 0], true],   // trois lignes, haut monde 350 (accroche.js)
    ['logo S2', 5.0, 6.9, art(G.L2)],
    ['rôles (pentagone v7.2)', T.roles - 0.12, T.fuse + 0.4, pentBox],
    ['emblème (fondu → 9,6)', NX.M72.DISSOLVE[0], T.emblem, 'm72'],
    ['emblème S5', T.emblem, T.tools - 0.6, [G.E5.left, G.E5.top, G.E5.left + G.E5.size, G.E5.top + G.E5.size, 0]],
    ['« Une même direction. »', T.emblem + 0.6, T.tools - 0.3, [960 - 462, 700, 960 + 462, 805, 0], true],
    ['colonne des titres', T.tools + 0.25, T.end - 0.1, [G.tools.col.left, G.tools.col.top, G.tools.col.left + 686, G.tools.col.top + 260, G.tools.col.z], true],
    ['pile de cartes', T.tools + 0.1, T.end - 0.1, 'stack'],
    ['logo final', T.end + 0.2, D, art(G.L9)],
    ['ligne finale', T.end + 1.4, D, [960 - 532, G.end.line1Top, 960 + 532, G.end.line1Top + 58, 0], true],
  ];
  const S = G.tools.stack, r = S.rotY * Math.PI / 180;
  const stackPts = c => [[0, 0], [S.w, 0], [0, S.h], [S.w, S.h]].map(([u, v]) => NX.cam.project(S.left + u * Math.cos(r), S.top + v, S.z - u * Math.sin(r), c));
  for (const [name, a, z, box, isText] of boxes) {
    const [x0, y0, x1, y1, Z] = box === 'stack' ? [S.left, S.top, S.left + S.w, S.top + S.h, S.z] : box === 'm72' ? [0, 0, 0, 0, 0] : box;
    let worst = Infinity, wt = a, minS = Infinity;
    for (let t = a; t <= z + 1e-6; t += 0.05) {
      const c = NX.cam.at(t), m = NX.M72.pose(t), F = NX.G.FAV, E0 = [m.cx - F.ringC[0] * m.s, m.cy - F.ringC[1] * m.s];
      const pts = box === 'stack' ? stackPts(c) : box === 'm72' ? [[0, 0], [512, 0], [0, 512], [512, 512]].map(([u, v]) => NX.cam.project(E0[0] + u * m.s, E0[1] + v * m.s, m.z, c)) : [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([X, Y]) => NX.cam.project(X, Y, Z, c));
      for (const q of pts) {
        const m = Math.min(q.x - 154, NX.W - 154 - q.x, q.y - 86, NX.H - 86 - q.y);
        if (m < worst) { worst = m; wt = t; }
      }
      minS = Math.min(minS, NX.cam.project((x0 + x1) / 2, (y0 + y1) / 2, Z, c).s);
    }
    info.push(`${name.padEnd(24)} marge minimale ${worst.toFixed(0)} px (à ${wt.toFixed(2)} s), échelle min ${minS.toFixed(3)}`);
    if (worst < 0) fails.push(`${name} sort du cadre de sécurité de ${(-worst).toFixed(0)} px à ${wt.toFixed(2)} s`);
    if (isText && minS < 0.945) fails.push(`${name} : échelle ${minS.toFixed(3)} < 0,945`);
  }
  // Vitesses de la caméra.
  const dt = 0.01; let worstDolly = 0, wd = 0, worstPan = 0, wp = 0;
  for (let t = 0; t < D; t += dt) {
    const a = NX.cam.at(t), b = NX.cam.at(t + dt);
    const vz = Math.abs(b.z - a.z) / dt, lim = t >= T.tools && t <= T.tools + 1.4 ? 150 : 75;
    // l'accent d'impact n'est pas compté comme une avancée
    const pun = h => NX.punch(t + dt, h, 24) - NX.punch(t, h, 24); let vp = 0; for (const h of NX.T.hits) vp += Math.abs(pun(h)) / dt;
    if (vz - vp > lim && vz - vp > worstDolly) { worstDolly = vz - vp; wd = t; }
    const vyaw = Math.abs(b.yaw - a.yaw) / dt, vpitch = Math.abs(b.pitch - a.pitch) / dt, orbit = t >= T.tools && t <= T.end + 1.2;
    const v = Math.max(vyaw, vpitch); if (v > (orbit ? 1.6 : 0.8) && v > worstPan) { worstPan = v; wp = t; }
  }
  if (worstDolly) fails.push(`avancée ${worstDolly.toFixed(0)} px/s à ${wd.toFixed(2)} s`);
  if (worstPan) fails.push(`panoramique ou bascule ${worstPan.toFixed(2)} °/s à ${wp.toFixed(2)} s`);
  const e0 = NX.cam.at(D - 0.01), e1 = NX.cam.at(D), vEnd = Math.hypot(e1.x - e0.x, e1.y - e0.y, e1.z - e0.z) / 0.01;
  info.push(`vitesse finale ${vEnd.toFixed(2)} px/s`);
  if (vEnd > 0.5) fails.push(`la caméra bouge encore à ${D} s (${vEnd.toFixed(2)} px/s)`);
  // Dérive des sujets pendant les tenues (centre de la boîte projeté).
  const holds = [['question', 3.4, 4.4, 960, 503, 0], ['logo S2', 5.1, 6.6, 958.7, 452.1, 0], ['emblème S5', T.emblem + 0.2, T.tools - 0.7, 960, 441.7, 0], ['logo final', T.end + 0.7, D - 0.1, 959.1, 246, 0]];
  for (const [name, a, z, X, Y, Z] of holds) {
    let worst = 0, wt = a;
    for (let t = a; t < z; t += 0.02) { const p0 = NX.cam.project(X, Y, Z, NX.cam.at(t)), p1 = NX.cam.project(X, Y, Z, NX.cam.at(t + 0.02)); const v = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 0.02; if (v > worst) { worst = v; wt = t; } }
    info.push(`${name.padEnd(24)} dérive maximale ${worst.toFixed(0)} px/s (à ${wt.toFixed(2)} s)`);
    if (worst > 60) fails.push(`${name} dérive à ${worst.toFixed(0)} px/s à ${wt.toFixed(2)} s`);
  }
  return { info, fails };
});
console.log(out.info.join('\n'));
console.log(out.fails.length ? `ÉCHECS (${out.fails.length}) :\n- ` + out.fails.join('\n- ') : 'Caméra conforme.');
await b.close();
process.exit(out.fails.length ? 2 : 0);
