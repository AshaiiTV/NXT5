/* Ciel de la v7 : nébuleuse, rayons venus du haut et poussière en profondeur, dans chaque image.
 * Seule scène qui écrit NX.bg et NX.post, et seule à appeler NX.dust.draw (bible §3.2, §3.6).
 * Elle porte aussi : le couplage ciel-caméra, les montées avant les impacts, l'éclat des rayons sur les
 * quatre temps forts, l'éclairage du passage des rôles, le faisceau resserré de « Une même direction. »,
 * les deux ondes de lumière dans les rayons (fronts) et l'unique onde de choc du film (14,4 s). */
NX.scene({
  id: 'ciel', start: 0, end: NX.DURATION, z: -10,
  prepare() {
    // Points d'impact en px écran, calculés une fois avec la caméra de leur instant (fonctions pures de t).
    const at = (t, X, Y, Z = 0) => { const p = NX.cam.project(X, Y, Z, NX.cam.at(t)); return { x: p.x, y: p.y }; };
    this.gusts = [
      { t0: 4.8, ...at(4.8, 958.7, 452.1), amp: 30 },
      { t0: 13.8, ...at(13.8, 960, 441.7), amp: -20 },
      { t0: 14.4, ...at(14.4, 960, 441.7), amp: 30 },
      { t0: 18.0, ...at(18.0, 975, 300, -60), amp: 24 },
      { t0: 28.8, ...at(28.8, 959.1, 246.0), amp: 30 },
    ];
    this.C = at(14.4, 960, 441.7);
    // Temps de dérive de la poussière intégré une fois (pas de 5 ms) : l'accélération des montées reste continue.
    const swell = t => Math.max(NX.env(t, 3.6, 3.8, 4.6, 4.8), NX.env(t, 16.8, 17.0, 17.78, 17.98), NX.env(t, 27.6, 27.8, 28.6, 28.8));
    const dt = 0.005, n = Math.ceil((NX.DURATION + 1) / dt), acc = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) acc[i + 1] = acc[i] + (1 + 0.6 * swell((i + 0.5) * dt)) * dt;
    this.driftTime = t => { const f = NX.clamp(t / dt, 0, n), i = Math.min(n - 1, Math.floor(f)); return acc[i] + (acc[i + 1] - acc[i]) * (f - i); };
  },
  render(S) {
    const t = S.t, T = NX.T, E = NX.ease, sky = NX.sky.at(t), seg = NX.seg, sm = NX.smooth;
    // Base : identique à la v6, couplée à la caméra.
    NX.bgMix({
      nebula: 0.58, warp: 0.6, rays: 0.9, rayX: 0, rayY: 0.6, rayStrength: 1, stars: 0.32,
      hue: 0.12 + 0.55 * sm(0, NX.DURATION, t), speed: 1, intensity: 1,
      zoom: sky.zoom, cx: sky.cx, cy: sky.cy,
    }, 1);
    const B = NX.bg;
    // Groove de la v6 (approuvé) : le ciel respire au tempo pendant les outils.
    const groove = sm(T.tools - 0.2, T.tools, t) * (1 - sm(T.end + 1.9, T.end + 2.4, t));
    B.pulse = groove * NX.pulse(t, NX.BEAT, 7, 0);
    // S1 : montée avant la première écriture, relâchée après l'impact.
    B.rayStrength += 0.25 * E.inQuad(seg(t, 3.6, 4.75)) * (1 - E.outCubic(seg(t, 4.8, 5.4)));
    // Éclat des rayons sur les quatre temps forts (jamais de voile uniforme).
    let flash = 0;
    // Au drop, les rayons sont encore resserrés et renforcés : son éclat est réduit pour garder la même ampleur.
    for (const h of T.hits) if (t >= h) flash += (h === T.tools ? 0.3 : 1) * Math.exp(-4 * (t - h));
    // Éclat mesuré pour rester dans la règle de continuité (|ΔY| ≤ 9 sur la fenêtre d'un impact).
    B.rays += 0.65 * flash; B.intensity += 0.14 * flash; B.flash = 0.02 * flash;
    // S3 : le passage des rôles, le plus sombre de la v6, est éclairé.
    const lift = sm(6.6, 7.4, t) * (1 - sm(10.2, 11.4, t));
    B.rays += 0.45 * lift; B.nebula += 0.24 * lift; B.intensity += 0.08 * lift;
    // S5 : les rayons se resserrent en faisceau (plafonné à 0,45 pour ne jamais assombrir), puis s'ouvrent au drop.
    const open = E.sine(seg(t, 18.0, 18.3)), focus = E.sine(seg(t, 14.6, 15.6)) * (1 - open);
    B.rayFocus = 0.45 * focus;
    // Le resserrement concentre la lumière sans assombrir : il retire environ un tiers de la luminosité du ciel,
    // compensé ici (mesuré : ciel seul ≈ 12–13 de luminance au lieu de 8–10).
    B.rayStrength += 0.8 * focus + 0.25 * E.sine(seg(t, 17.2, 17.98)) * (1 - open);
    B.intensity += 0.12 * focus;
    B.rays += 0.2 * sm(17.9, 18.0, t) * (1 - sm(18.0, 18.4, t));
    // S8 → S9 : la lumière se prépare au retour de l'emblème.
    B.rayStrength += 0.3 * sm(28.0, 28.75, t) * (1 - sm(28.8, 29.8, t));
    // Ondes de lumière dans les rayons, à la hauteur des fronts qui écrivent les logos.
    if (t > 4.2 && t < 5.6) { B.front = NX.env(t, 4.2, 4.3, 5.3, 5.6); B.frontR = NX.FRONT.hook(t) / 1080 / sky.zoom; }
    else if (t > 28.3 && t < 29.9) { B.front = NX.env(t, 28.3, 28.4, 29.6, 29.9); B.frontR = NX.FRONT.end(t) / 1080 / sky.zoom; }
    // L'unique onde de choc du film : naissance de l'emblème (réfraction de la nébuleuse et anneau de poussière).
    let wave = null;
    const tw = t - T.emblem;
    if (tw >= 0 && tw <= 1.1 && this.C) {
      const p = seg(tw, 0, 1.1);
      B.waveX = (this.C.x - 960) / 1080; B.waveY = (540 - this.C.y) / 1080;
      B.waveR = 0.05 + 0.95 * E.outCubic(p); B.waveS = 0.025 * (1 - p) * (1 - p);
      wave = { x: this.C.x, y: this.C.y, R: 60 + 1100 * E.outCubic(p), w: 40, gain: 2.5 };
    }
    // Post : pas de secousse (la caméra porte l'impact), vignette légère.
    NX.post.shake = 0; NX.post.vignette = 0.8;
    // Poussière : un peu plus discrète autour de l'interface, accélérée pendant les montées.
    const gain = t < 28.4 ? NX.lerp(1, 0.75, sm(18.3, 18.8, t)) : NX.lerp(0.75, 0.9, sm(28.4, 28.8, t));
    NX.dust.draw(t, { gain, time: this.driftTime ? this.driftTime(t) : t, gusts: this.gusts || [], wave });
  },
});
