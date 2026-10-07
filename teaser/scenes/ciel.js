/* Ciel de la v7 : nébuleuse, rayons venus du haut et poussière en profondeur, dans chaque image.
 * Seule scène qui écrit NX.bg et NX.post, et seule à appeler NX.dust.draw (bible §3.2, §3.6).
 * Elle porte aussi : le couplage ciel-caméra, les montées avant les impacts, l'éclat des rayons sur les
 * quatre temps forts, l'éclairage des rôles, le faisceau resserré de « Une même direction. »,
 * les deux ondes de lumière dans les rayons (fronts) et l'unique onde de choc du film (14,4 s). */
NX.scene({
  id: 'ciel', start: 0, end: NX.DURATION, z: -10,
  prepare() {
    // Points d'impact en px écran, calculés une fois avec la caméra de leur instant (fonctions pures de t).
    const at = (t, X, Y, Z = 0) => { const p = NX.cam.project(X, Y, Z, NX.cam.at(t)); return { x: p.x, y: p.y }; };
    const T = NX.T;
    this.gusts = [
      { t0: T.hookEnd, ...at(T.hookEnd, 958.7, 452.1), amp: 30 },
      { t0: T.emblem - 0.6, ...at(T.emblem - 0.6, 960, 441.7), amp: -20 },
      { t0: T.emblem, ...at(T.emblem, 960, 441.7), amp: 30 },
      { t0: T.tools, ...at(T.tools, 975, 300, -60), amp: 24 },
      { t0: T.end, ...at(T.end, 959.1, 246.0), amp: 30 },
    ];
    this.C = at(T.emblem, 960, 441.7);
    // Temps de dérive de la poussière intégré une fois (pas de 5 ms) : l'accélération des montées reste continue.
    const swell = t => Math.max(NX.env(t, 3.6, 3.8, 4.6, 4.8), NX.env(t, T.tools - 1.2, T.tools - 1.0, T.tools - 0.22, T.tools - 0.02),
      NX.env(t, T.end - 1.2, T.end - 1.0, T.end - 0.2, T.end));
    const dt = 0.005, n = Math.ceil((NX.DURATION + 1) / dt), acc = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) acc[i + 1] = acc[i] + (1 + 0.6 * swell((i + 0.5) * dt)) * dt;
    this.driftTime = t => { const f = NX.clamp(t / dt, 0, n), i = Math.min(n - 1, Math.floor(f)); return acc[i] + (acc[i + 1] - acc[i]) * (f - i); };
  },
  render(S) {
    const t = S.t, T = NX.T, E = NX.ease, sky = NX.sky.at(t), seg = NX.seg, sm = NX.smooth;
    // Horloge du ciel (v7.1, revue E) : le bruit des rayons et de la nébuleuse suit le temps du shader (uTime = t·speed).
    // Avancer S5 de 4,8 s l'avait posé sur une portion clairsemée de ce bruit : le faisceau de rayons de la v7 avait
    // disparu de « Une même direction. ». Le ciel rattrape la phase de la v7 (son emblème naissait à 14,4) pendant la
    // transition des rôles, τ = t + SKY_SHIFT·smooth(SKY_RAMP, T.emblem, t), puis la garde jusqu'à la fin : S1–S2
    // inchangés, ciel de la v7 dès l'impact de 9,6 (S5, drop, S6–S7). Ne pas ramener le décalage plus loin : l'horloge
    // du ciel reculerait. Mesuré : pendant la fusion, le ciel change au plus deux fois plus vite d'une image à l'autre.
    const SKY_SHIFT = 14.4 - T.emblem, SKY_RAMP = T.roles, skyT = t + SKY_SHIFT * sm(SKY_RAMP, T.emblem, t);
    // Base : identique à la v6, couplée à la caméra. La teinte suit la même horloge, sur la durée de la v7 (33,6 s),
    // pour que chaque plan garde la couleur validée de la v7 ; elle atteint le fuchsia de la fin à 28,8 s.
    NX.bgMix({
      nebula: 0.58, warp: 0.6, rays: 0.9, rayX: 0, rayY: 0.6, rayStrength: 1, stars: 0.32,
      hue: 0.12 + 0.55 * sm(0, 33.6, skyT), speed: t > 0 ? skyT / t : 1, intensity: 1,
      zoom: sky.zoom, cx: sky.cx, cy: sky.cy,
    }, 1);
    const B = NX.bg;
    // Groove de la v6 (approuvé) : le ciel respire au tempo pendant les outils. Phase du temps calculée sans résidu
    // flottant : 13,2 % 0,6 vaut 0,5999…, ce qui éteignait la pulsation sur l'image même du drop et sur 16,2, 17,4,
    // 20,4, 23,4, 26,4 et 29,4 dans les rendus à une sous-image (aperçus, planches ; le rendu final n'a aucune
    // sous-image exactement sur un temps).
    const groove = sm(T.tools - 0.2, T.tools, t) * (1 - sm(T.end + 1.9, T.end + 2.4, t));
    const ph = t / NX.BEAT, beatX = (ph - Math.floor(ph + 1e-9)) * NX.BEAT;
    B.pulse = groove * Math.exp(-7 * beatX);
    // S1 : montée avant la première écriture, relâchée après l'impact.
    B.rayStrength += 0.25 * E.inQuad(seg(t, 3.6, 4.75)) * (1 - E.outCubic(seg(t, 4.8, 5.4)));
    // v7.1 : la question (trois lignes) brûle 4,45–4,8 ; les rayons prennent sa lumière pendant que la lumière écrit
    // le logo, puis la rendent après l'impact (sans quoi la luminance perdait 5,8 entre deux échantillons avant l'impact).
    const burn = E.sine(seg(t, 4.45, 4.78)) * (1 - E.sine(seg(t, 5.0, 5.8)));
    B.rays += 0.25 * burn; B.intensity += 0.042 * burn;
    // Éclat des rayons sur les quatre temps forts (jamais de voile uniforme).
    let flash = 0;
    // Au drop, les rayons sont encore resserrés et renforcés : son éclat est réduit pour garder la même ampleur.
    // Au retour du logo, la carte brûle et le logo s'allume en même temps : l'éclat du ciel y est réduit de moitié.
    // Au logo, l'embrasement qui précède l'impact (ci-dessous) multiplie déjà l'éclat : poids 0,9.
    for (const h of T.hits) if (t >= h) flash += (h === T.tools ? 0.3 : h === T.end ? 0.5 : h === T.hookEnd ? 0.9 : 1) * Math.exp(-4 * (t - h));
    // Éclat mesuré pour rester dans la règle de continuité (|ΔY| ≤ 9 sur la fenêtre d'un impact).
    B.rays += 0.65 * flash; B.intensity += 0.14 * flash; B.flash = 0.02 * flash;
    // S2 → S3 (v7.2) : l'emblème du logo reste. La lumière que le front reprend au mot-symbole (6,78–7,17) est relayée en
    // phase par les scènes : cœur de l'emblème (logo.js) et anneau de scène des rôles (equipe.js, 6,96–7,10). L'ancien
    // relais du ciel (7,11–7,8, réglé pour la disparition du logo entier) arrivait après les lettres et faisait un éclat
    // hors impact : il est retiré (revue M, out/v72/M/lead-patch/).
    // Rôles (7,2–9,6) : le ciel reste éclairé pendant la transition, puis rend la main au faisceau de « direction ».
    const lift = sm(6.6, 7.4, t) * (1 - sm(T.emblem - 0.4, T.emblem + 0.6, t));
    B.rays += 0.45 * lift; B.nebula += 0.24 * lift; B.intensity += 0.08 * lift;
    // S5 : les rayons se resserrent en faisceau (plafonné à 0,45 pour ne jamais assombrir), puis s'ouvrent au drop.
    const open = E.sine(seg(t, T.tools, T.tools + 0.3)), focus = E.sine(seg(t, T.emblem + 0.2, T.emblem + 1.2)) * (1 - open);
    B.rayFocus = 0.45 * focus;
    // Le resserrement concentre la lumière sans assombrir : il retire environ un tiers de la luminosité du ciel,
    // compensé ici (mesuré : ciel seul ≈ 12–13 de luminance au lieu de 8–10).
    B.rayStrength += 0.8 * focus + 0.25 * E.sine(seg(t, T.tools - 0.8, T.tools - 0.02)) * (1 - open);
    B.intensity += 0.12 * focus;
    // La flèche entre dans la source : la source s'embrase juste avant le drop au lieu de laisser l'image s'assombrir
    // (le titre et la flèche s'effacent), puis s'éteint en 0,12 s quand la lumière redescend sur la carte.
    const swell = sm(T.tools - 0.28, T.tools - 0.03, t) * (1 - sm(T.tools, T.tools + 0.12, t));
    B.rays += 0.45 * swell; B.intensity += 0.06 * swell;
    // S8 → S9 : la lumière se prépare au retour de l'emblème.
    B.rayStrength += 0.3 * sm(T.end - 0.8, T.end - 0.05, t) * (1 - sm(T.end, T.end + 1.0, t));
    // S9 : les rayons gardent leur éclat pendant que la carte brûle, puis se posent quand la carte finale arrive
    // (sans ce relais, la luminance perdait 10,4 entre deux échantillons après l'impact).
    const hold = sm(T.end + 0.05, T.end + 0.2, t) * (1 - sm(T.end + 0.35, T.end + 0.9, t));
    B.rays += 0.5 * hold; B.intensity += 0.1 * hold;
    // Ondes de lumière dans les rayons, à la hauteur des fronts qui écrivent les logos.
    if (t > 4.2 && t < 5.6) { B.front = NX.env(t, 4.2, 4.3, 5.3, 5.6); B.frontR = NX.FRONT.hook(t) / 1080 / sky.zoom; }
    else if (t > T.end - 0.5 && t < T.end + 1.1) { B.front = NX.env(t, T.end - 0.5, T.end - 0.4, T.end + 0.8, T.end + 1.1); B.frontR = NX.FRONT.end(t) / 1080 / sky.zoom; }
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
    const gain = t < T.end - 0.4 ? NX.lerp(1, 0.75, sm(T.tools + 0.3, T.tools + 0.8, t)) : NX.lerp(0.75, 0.9, sm(T.end - 0.4, T.end, t));
    NX.dust.draw(t, { gain, time: this.driftTime ? this.driftTime(t) : t, gusts: this.gusts || [], wave });
  },
});
