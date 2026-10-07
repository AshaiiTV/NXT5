/* Fin (S9, bible §4 et amendement v7.1) — fenêtre HIT − 0,85 → NX.DURATION (26,75–32,4), z 3.
 * Tous les temps sont relatifs à l'impact HIT = NX.T.end (27,6 en v7.1 ; 28,8 en v7) et aux carillons
 * NX.beats.chimes (eux-mêmes posés sur NX.T.end) : un recalage de la frise déplace toute la scène.
 * HIT − 0,8 → HIT (26,8–27,6) : l'emblème ressort de la lumière, descend l'axe et se pose sur celui du logo final.
 *   Dans le même passage, le front NX.FRONT.end (avance 0) écrit le logo final, comme en S2. Les traits de l'emblème
 *   du logo (lignes de l'emblème, et sous la ligne de coupe l'empreinte de l'emblème qui se pose) restent derrière la
 *   porte jusqu'à HIT : l'emblème qui vole les tient. Sa plaque sombre, écrite par le même front, apparaît avec la
 *   pose (HIT − 0,16 → HIT) : elle est complète à l'impact, jamais en une image.
 *   Les outils (S8) sont brûlés par « outils » avec 100 px d'avance. C'est le bouclage du moment 1.
 * HIT : impact. L'échange des traits emblème → logo se fait sous l'éclair (repli de la bible §5.3, voir plus bas).
 * Carillons (HIT + 0,6 → HIT + 3,0, soit 28,2–30,6) : la carte finale arrive. La caméra se pose à NX.DURATION (32,4).
 * Fonction pure de t : porte, empreinte, étincelles, instants d'émission et instant de l'étoile du reflet sont calculés
 * une fois dans prepare(). Les logos ne sont jamais tournés en 3D ni filtrés : masques, profondeur et feuilles de lumière.
 * Aucun élément vide ou entièrement transparent ne reste affiché sous la racine 3D (display:none, ENGINE.md) : halo avant
 *   HIT − 0,10, logo final tant que sa porte ne laisse rien voir, bande blanche une fois passée, chrome de l'emblème avant
 *   sa naissance.
 * Vérification (bible §6.9, §6.10), drapeaux NX.finDebug :
 *   { dock }      porte ouverte (traits de l'emblème du logo visibles) et emblème qui se pose masqué ;
 *   { noLockup }  logo final retiré ;
 *   { leavesOff } toute lumière ajoutée coupée ;
 *   { plateOff }  la plaque sombre des lignes de l'emblème et de l'empreinte n'est jamais écrite : rendu de
 *                 référence pour mesurer l'arrivée de la plaque image par image.
 * Sans drapeau, l'image de HIT − 1/180 est le rendu « emblème seul » du contrôle (traits fermés jusqu'à HIT). */
(function () {
  const SRC_LOGO = '../public/assets/nxt5-logo.png', SRC_FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G, L9 = G.L9, DK = G.dock, FAV = G.FAV, LOGO = G.LOGO;
  const K9 = L9.w / LOGO.W, H9 = LOGO.H * K9;                    // logo final : 620 × 488,98 px monde
  const KF = DK.size / FAV.W;                                      // px de l'emblème → px monde (0,5648)
  const RING = [DK.left + FAV.ringC[0] * KF, DK.top + FAV.ringC[1] * KF]; // anneau posé : (959,09 ; 245,94)
  const YCUT = L9.top + LOGO.rows.wordmark[0] * K9;                // 287,54 : haut de la bande du mot-symbole
  const CUT9 = YCUT - L9.top;                                      // la même ligne dans le repère du logo (217,54)
  const HIT = NX.T.end;                                            // 27,6 (v7 : 28,8)
  const FLY = [HIT - 0.8, HIT], Y0 = -850, Z0 = -4000;             // retour (26,8–27,6) : (959,1 ; −850 ; −4000) → posé
  const FRONT_OFF = HIT + 0.65;                                    // 28,25 : la bande est passée sous tout le logo
  /* Carillons (bible §2.5, NX.beats.chimes) : bouton, ligne, (troisième note), reflet du logo, reflet du bouton, puis
   * la cloche de l'étoile douce. v7.1 : 28,2 / 28,5 / 28,8 / 29,1 / 29,4 et 30,6. Le 7 octobre, la ligne « Accès
   * actuellement gratuit » est retirée à la demande du propriétaire ; la troisième note reste pour l'arpège et sonne
   * pendant la montée de la fin de la ligne (« League of Legends »). */
  const [CH_CTA, CH_L1, , CH_GLINT, CH_CTA_GLINT, BELL] = NX.beats.chimes;
  /* Échange des traits sous l'éclair (repli §5.3 en forme, ouvert à l'impact plutôt qu'à HIT − 0,02 : rien ne change
   * avant HIT). Posés sur la même plaque, les deux PNG ne diffèrent qu'au bord des traits (contrôle §6.9 : moyenne 0,8/255,
   * maximum 5/255 hors de la frange de 2 px) ; sur cette frange, jusqu'à 215/255 (deux PNG rastérisés à deux échelles,
   * rails prolongés depuis les pointes des arcs). Plutôt qu'une coupe franche, les traits du logo s'ouvrent derrière
   * l'emblème opaque, puis l'emblème s'efface sur eux en deux images : aucun bord ne saute, aucun creux vers le fond. */
  const SWAP_GATE = [HIT, HIT + 0.03], SWAP_FAV = [HIT + 0.01, HIT + 0.06];
  const LIFT = 2;                                                  // l'emblème vole 2 px devant le plan du logo (§2.7)
  const BIRTH_LUM = 0.22;                                          // lumière de naissance sur les traits clairs (≤ 0,30)
  /* Empreinte de l'emblème posé dans le logo (px monde) : ses pixels d'alpha ≥ thr, élargis de grow puis adoucis sur
   * feather. Sous la ligne de coupe, seuls les traits du logo couverts par l'emblème qui se pose attendent
   * l'échange ; les rails et le haut des lettres autour de la lance sont écrits par le front et sa bande. */
  const FOOT = { thr: 0.3, grow: 4, feather: 4 };
  /* Traits retenus par la porte : alpha × smoothstep(0,25 ; 0,5 ; max(r, g, b)), comme la silhouette de S2. La loi de
   * luminance du kit classe les moitiés bleue, violette et fuchsia des traits avec la plaque : écrites au repos pendant
   * que l'emblème se pose encore, elles le doublaient. Reste écrite par le front la seule plaque sombre (canal max < 0,25). */
  const STROKE = [0.25, 0.5];
  /* La plaque des lignes de l'emblème et de l'empreinte est écrite par le front et apparaît avec la pose (SINE) : ses
   * contours sombres, peints autour des traits au repos, ne doublent pas l'emblème quand il est encore à 8–20 px de sa
   * place (HIT − 0,20 → HIT − 0,13) ; complète à l'impact. 0,16 s : au plus ~4 de luma par image dans l'anneau
   * autour de l'emblème. */
  const PLATE_IN = [HIT - 0.16, HIT];
  const RAMP = 10;                                                 // demi-largeur (px monde) du fondu de la ligne de coupe
  const HALO = { left: 310, top: -130, w: 1300, h: 900, z: -4 };   // halo v6 (centre 960 ; 320), un peu en retrait
  // Plafond de marque (bible §2.3) : au plus 0,30 de lumière ajoutée sur le chrome. Le cœur du reflet vaut 0,95,
  // d'où l'opacité de la feuille (même valeur que le kit et que S2).
  const SWEEP_A = 0.30 / 0.95;
  // Reflet du logo final : la bande de S2 (cœur spéculaire net, épaules douces), pour que les deux logos se répondent.
  const SWEEP_BAND = 'linear-gradient(105deg,transparent 0%,rgba(150,215,255,.10) 28%,rgba(185,232,255,.38) 43%,rgba(255,255,255,.95) 48.5%,rgba(255,255,255,.95) 51.5%,rgba(205,192,255,.38) 57%,rgba(196,181,253,.10) 72%,transparent 100%)';
  // Les deux boîtes de logo sont écrites à 2× puis réduites de moitié (échelle uniforme) : sous la caméra tournée,
  // Chrome rastérise un calque 3D à l'échelle locale 1 puis le rééchantillonne, ce qui rendait le logo flou jusqu'au
  // retour de la caméra en face (HIT + 1,2 ; énergie de détail 396 contre 2010 une fois frontale). À 2×, 1742 : net
  // pendant tout le retour.
  const SS = 2;
  const E = NX.ease, seg = NX.seg, sm = NX.smooth;

  NX.css(`
  .fin-halo{position:absolute;left:${HALO.left}px;top:${HALO.top}px;width:${HALO.w}px;height:${HALO.h}px;opacity:0;transform:translateZ(${HALO.z}px);background:radial-gradient(closest-side,rgba(103,232,249,.18),rgba(129,140,248,.08) 45%,transparent)}
  .fin-box{position:absolute}
  .fin-ctaw{position:absolute;left:0;right:0;top:${G.end.buttonTop}px;text-align:center}
  .fin-cta{position:relative;display:inline-block;overflow:hidden;isolation:isolate;padding:22px 64px;border-radius:2px;background:linear-gradient(to right,#22D3EE,#3B82F6,#D946EF);color:#020611;font-weight:800;font-size:56px;letter-spacing:.01em;clip-path:inset(0 50% 0 50%)}
  .fin-cta i{position:absolute;top:0;bottom:0;left:0;width:46%;opacity:0;mix-blend-mode:plus-lighter;background:linear-gradient(105deg,transparent 18%,rgba(255,255,255,.16) 50%,transparent 82%)}
  .fin-line{position:absolute;left:0;right:0;text-align:center;white-space:nowrap}
  .fin-l1{top:${G.end.line1Top}px;font-weight:700;font-size:48px;letter-spacing:-.01em;color:var(--text)}
  `);

  /** Masque à plusieurs couches (même convention que le kit). ops : opérateur de chaque couche avec celles qui sont
   *  dessous, 'intersect' (défaut) ou 'add' ; la première couche est celle du dessus. */
  const FIN_WK = { intersect: 'source-in', add: 'source-over' };
  const finMask = (el, layers, ops = null) => {
    const v = layers.join(','), many = layers.length > 1, op = layers.map((_, i) => (ops && ops[i]) || 'intersect');
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = layers.map(() => '100% 100%').join(','); el.style.webkitMaskSize = el.style.maskSize;
    el.style.maskRepeat = 'no-repeat'; el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = many ? op.join(',') : '';
    el.style.webkitMaskComposite = many ? op.map(o => FIN_WK[o]).join(',') : '';
  };
  /** Couche de masque uniforme d'opacité a. */
  const finUni = a => `linear-gradient(rgba(0,0,0,${a.toFixed(4)}),rgba(0,0,0,${a.toFixed(4)}))`;
  /* Front de lumière dans une boîte à SS px locaux par px monde : mêmes dégradés que le kit (bible §3.3, RM = 3000,
   * ellipse K·RM × RM), toutes les largeurs en px multipliées par SS pour garder à l'écran la plume de 70 px et le
   * profil de la bande blanche. */
  const FIN_RM = 3000 * SS, finPc = v => (100 * v / FIN_RM).toFixed(3) + '%';
  const finShape = L => `ellipse ${(NX.light.K * FIN_RM).toFixed(1)}px ${FIN_RM.toFixed(1)}px at ${L.cx.toFixed(1)}px ${L.cy.toFixed(1)}px`;
  /** Repère local du front pour une boîte 2× dont le coin haut-gauche est au point monde (X, Y, Z). */
  const finLocal = (X, Y, Z, R, t) => { const L = NX.light.local(X, Y, Z, R, t); return { cx: L.cx * SS, cy: L.cy * SS, r: L.r * SS }; };
  /** Écrit (kit 'write', plume 70) : visible à l'intérieur du front. */
  const finWrite = L => `radial-gradient(${finShape(L)},#000 ${finPc(L.r - 70 * SS)},transparent ${finPc(L.r + 10 * SS)})`;
  /** Bande blanche qui suit le front (profil de NX.light.band). */
  const finBand = L => `radial-gradient(${finShape(L)},transparent ${finPc(L.r - 170 * SS)},rgba(150,215,255,.28) ${finPc(L.r - 70 * SS)},rgba(200,240,255,.75) ${finPc(L.r - 18 * SS)},#fff ${finPc(L.r - 3 * SS)},transparent ${finPc(L.r + 12 * SS)})`;
  /* Porte du logo final, cuite une fois en image dans prepare() (aux px du PNG). g = part toujours ouverte : la bande du
   * mot-symbole et du slogan, ouverte en fondu sur 20 px monde autour de la ligne de coupe, moins l'empreinte de
   * l'emblème posé. Ailleurs (lignes de l'emblème, empreinte), seuls les traits st (loi STROKE) sont retenus :
   * fermée = 1 − (1 − g)·st. La plaque sombre y est donc écrite par le front comme partout ailleurs. À l'échange, une
   * couche uniforme « open » ajoutée (mask-composite: add) ouvre les traits : 1 − (1 − g)·st·(1 − open). */
  const finRampAt = yMonde => NX.clamp((yMonde - (YCUT - RAMP)) / (2 * RAMP));
  /** Distances euclidiennes au carré (px) au pixel marqué le plus proche (Felzenszwalb–Huttenlocher, exacte). */
  const finEdt2 = (mark, w, h) => {
    const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    const D = new Float64Array(w * h); for (let i = 0; i < w * h; i++) D[i] = mark[i] ? 0 : INF;
    const pass = (len, base, step) => {
      for (let q = 0; q < len; q++) f[q] = D[base + q * step];
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; D[base + q * step] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    };
    for (let x = 0; x < w; x++) pass(h, x, w);
    for (let y = 0; y < h; y++) pass(w, y * w, 1);
    return D;
  };
  /** Position du retour de l'emblème (centre de l'anneau en Y monde, profondeur Z). */
  const finFlight = t => { const e = E.glide(seg(t, FLY[0], FLY[1])); return { Y: Y0 + (RING[1] - Y0) * e, Z: Z0 * (1 - e) }; };
  /* Pose de l'emblème : dessiné LIFT px plus près de la caméra, et ramené par une homothétie centrée au pied de l'œil
   * sur ce plan pour que sa projection reste exactement celle du vol prévu (exact pour deux plans parallèles à z = 0).
   * Posé, il est donc devant le plan du logo sans le moindre décalage à l'écran : le tri en profondeur ne bascule plus. */
  const finFavPose = (f, rz, lift = LIFT) => {
    const c = NX.camState, X = DK.left, Y = DK.top + f.Y - RING[1];
    if (!c) return { x: 0, y: Y - DK.top, z: f.Z + lift, k: 1 };
    const ex = 960 + c.x, ey = 540 + c.y, pz = NX.cam.D - c.z;
    const k = (pz - (rz + f.Z + lift)) / (pz - (rz + f.Z));
    return { x: ex + (X - ex) * k - DK.left, y: ey + (Y - ey) * k - DK.top, z: f.Z + lift, k };
  };
  /** Bande du reflet du logo (kit : 34 % de large, translateX −110 % → 300 %) : centre en fraction de la boîte. */
  const finSweepX = p => 0.34 * NX.lerp(-1.10, 3.00, p) + 0.17;
  /** Étoile douce : attaque en sinus, retombée en sinus. */
  const finStarG = (t, tc, a, b) => E.sine(seg(t, tc - a, tc)) * (1 - E.sine(seg(t, tc, tc + b)));

  NX.scene({
    id: 'fin', start: HIT - 0.85, end: NX.DURATION, post: 0.4, z: 3,
    build(root) {
      this.halo = NX.el(`<div class="fin-halo"></div>`, root);
      // Logo final : boîte plate NX.G.L9 (écrite à 2×, réduite de moitié) avec les feuilles de lumière du kit.
      this.box = NX.el(`<div class="fin-box" style="left:${L9.left}px;top:${L9.top}px;width:${L9.w * SS}px;height:${(H9 * SS).toFixed(3)}px;transform-origin:0 0;transform:scale(${1 / SS})"></div>`, root);
      this.L = NX.logoLight(this.box, SRC_LOGO);
      this.L.band.style.background = SWEEP_BAND;
      // Emblème qui revient : boîte plate NX.G.dock déplacée en profondeur (jamais tournée, jamais filtrée).
      this.fav = NX.el(`<div class="fin-box" style="left:${DK.left}px;top:${DK.top}px;width:${DK.size * SS}px;height:${DK.size * SS}px;transform-origin:0 0;opacity:0"></div>`, root);
      this.FL = NX.logoLight(this.fav, SRC_FAV);
      // Feuilles jamais utilisées ici (pas de silhouette en S9, pas de bande ni de reflet sur l'emblème) : retirées
      // du rendu une fois pour toutes ; les autres ne sont affichées que pendant leur fenêtre (voir render).
      for (const el of [this.L.forge, this.FL.forge, this.FL.hot, this.FL.sweep]) el.style.display = 'none';
      // Carte finale.
      this.ctaw = NX.el(`<div class="fin-ctaw"><span class="fin-cta">nxt5.org<i></i></span></div>`, root);
      this.cta = this.ctaw.firstElementChild; this.glint = this.cta.querySelector('i');
      this.l1 = NX.el(`<div class="fin-line fin-l1"><div class="tz-line">Pour les équipes et coachs League of Legends</div></div>`, root);
      this.w1 = NX.type.prepare(this.l1).words;
    },
    layout() {
      // Centre du bouton en monde, pour la lumière du canvas (mesuré une fois les polices chargées).
      this.ctaC = [L9.left + L9.w / 2, G.end.buttonTop + this.cta.offsetHeight / 2];
    },
    async prepare(root) {
      const m = /translateZ\(([-\d.]+)px\)/.exec(root.style.transform || '');
      this.rz = m ? +m[1] : 0;                                    // décalage en z de la racine (ordre des scènes)
      await Promise.all([this.L.prepare(), this.FL.prepare()]);
      // Porte cuite (voir finRampAt), masque de la bande blanche = chrome clair (loi du kit) × g : elle ne court que sur
      // le chrome ouvert du mot-symbole et du slogan, rails et haut des lettres autour de la lance compris, jamais sur un
      // trait retenu. g seul et la plaque seule (1 − st) pour l'arrivée de la plaque ; les traits seuls pour le rendu de
      // référence { plateOff }. Tout aux px du PNG du logo.
      let gOpen;
      {
        const img = this.L.img, w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d', { willReadFrequently: true });
        // Empreinte : l'emblème tel qu'il est posé (NX.G.dock) dessiné dans le repère du PNG du logo.
        const kPng = w / L9.w, sF = DK.size / FAV.W * kPng;      // px du PNG par px monde ; px du PNG par px de l'emblème
        c.setTransform(sF, 0, 0, sF, (DK.left - L9.left) * kPng, (DK.top - L9.top) * kPng);
        c.drawImage(this.FL.img, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
        const fa = c.getImageData(0, 0, w, h).data, mark = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) mark[i] = fa[i * 4 + 3] >= 255 * FOOT.thr ? 1 : 0;
        const D2 = finEdt2(mark, w, h), r0 = FOOT.grow * kPng, r1 = (FOOT.grow + FOOT.feather) * kPng;
        c.clearRect(0, 0, w, h); c.drawImage(img, 0, 0);
        const d = c.getImageData(0, 0, w, h).data, ims = [0, 1, 2, 3, 4].map(() => c.createImageData(w, h));
        const [gate, hot, gim, pim, sim] = ims;
        gOpen = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
          const ramp = finRampAt(L9.top + (y + 0.5) / kPng);
          for (let x = 0; x < w; x++) {
            const i = y * w + x, o = i * 4, a = d[o + 3] / 255, g = ramp > 0 ? ramp * NX.smooth(r0, r1, Math.sqrt(D2[i])) : 0;
            const br = NX.smooth(0.35, 0.65, (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) / 255) * a;
            const st = NX.smooth(STROKE[0], STROKE[1], Math.max(d[o], d[o + 1], d[o + 2]) / 255) * a;
            for (const im of ims) im.data[o] = im.data[o + 1] = im.data[o + 2] = 255;
            gate.data[o + 3] = Math.round(255 * (1 - (1 - g) * st)); hot.data[o + 3] = Math.round(255 * g * br);
            gim.data[o + 3] = Math.round(255 * g); pim.data[o + 3] = Math.round(255 * (1 - st)); sim.data[o + 3] = Math.round(255 * st);
            gOpen[i] = g;
          }
        }
        const url = im => { c.putImageData(im, 0, 0); return `url(${cv.toDataURL('image/png')})`; };
        this.gateUrl = url(gate); finMask(this.L.hot, [url(hot)]); this.gOnlyUrl = url(gim); this.plateUrl = url(pim); this.strokeUrl = url(sim);
        this.gAt = (u, v) => gOpen[Math.min(h - 1, Math.floor(v * h)) * w + Math.min(w - 1, Math.floor(u * w))];
      }
      // Hygiène d'affichage (ENGINE.md, déterminisme) : un élément vide ou entièrement transparent sous la racine 3D est
      // retiré du rendu (display:none), sinon Chrome peut en garder une texture périmée. Instants calculés une fois dans
      // le repère local du logo final, exactement comme ses masques (NX.light.local au coin haut-gauche, ellipse K × 1) :
      // avant boxOn, la porte ne laisse rien voir (part ouverte g nulle au-dessus de la bande du mot-symbole, plaque pas
      // encore écrite) ; à partir de hotEnd, la bande blanche est entièrement passée sous la boîte. Marge de 0,02 s.
      {
        const K = NX.light.K, W = L9.w, rz = this.rz, DT = 0.0005;
        const loc = t => { const c = NX.cam.at(t), o = NX.cam.project(L9.left, L9.top, rz, c), s = NX.light.src(t); return { cx: (s.x - o.x) / o.s, cy: (s.y - o.y) / o.s, r: NX.FRONT.end(t) / o.s }; };
        // Distance elliptique (px locaux) du centre du front au point le plus proche des lignes y0 → y1, au coin le plus lointain.
        const near = (L, y0, y1) => Math.hypot(Math.max(0, -L.cx, L.cx - W) / K, Math.max(0, y0 - L.cy, L.cy - y1));
        const far = (L, y1) => Math.max(...[0, W].flatMap(x => [0, y1].map(y => Math.hypot((x - L.cx) / K, y - L.cy))));
        const first = (ok, a, b) => { for (let i = 0; a + i * DT <= b; i++) if (ok(loc(a + i * DT))) return a + i * DT; return b; };
        const reach = y0 => first(L => L.r + 12 >= near(L, y0, H9), FLY[0], HIT);  // bord extérieur de la bande (r + 12)
        this.boxTop = reach(0) - 0.02;                                              // { dock } : porte ouverte
        this.boxOn = Math.min(reach(YCUT - RAMP - L9.top), PLATE_IN[0]) - 0.02;
        this.hotEnd = first(L => L.r - 170 >= far(L, H9), HIT - 0.5, FRONT_OFF) + 0.02;
      }
      // 200 étincelles prises sur les pixels clairs du mot-symbole et du slogan (lignes ≥ 440), émises au passage du front,
      // là où il écrit vraiment le chrome (hors de l'empreinte de l'emblème posé, qui s'ouvre à l'échange).
      const v0 = LOGO.rows.wordmark[0] / LOGO.H;
      const pts = NX.sample(this.L.img, 900, 2888, 400, 0.45).filter(p => p.v >= v0 && this.gAt(p.u, p.v) >= 0.5).slice(0, 200);
      this.nSparks = pts.length;
      this.sparks = pts.map((p, k) => {
        const r = NX.rng(28800 + k), X = L9.left + p.u * L9.w, Y = L9.top + p.v * H9;
        return {
          X, Y, te: NX.light.when(NX.FRONT.end, X, Y, this.rz, { t0: HIT - 0.5, t1: HIT + 1.2 }),
          life: 0.8 + 0.7 * r(), rise: 40 + 80 * r(), s: 1.5 + 1.5 * r(), n: 11.3 + 7.1 * k,
          col: `rgb(${p.rgb.map(v => Math.min(255, Math.round(v * 0.7 + 77))).join(',')})`,
        };
      });
      // Halo de chaque étincelle : le même sprite de lumière froide qu'en S2 (construit une fois).
      const sp = document.createElement('canvas'); sp.width = sp.height = 64;
      const sx = sp.getContext('2d'), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(225,245,255,1)'); gr.addColorStop(0.22, 'rgba(200,235,255,.45)'); gr.addColorStop(1, 'rgba(180,220,255,0)');
      sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64); this.sprite = sp;
      // Étoile du reflet : l'instant où la ligne claire (penchée de 15°, gradient à 105°) croise la pointe de la lance.
      const [su, sv] = LOGO.stars.spear, lean = (0.5 - sv) * H9 * Math.tan(15 * Math.PI / 180) / L9.w;
      const pX = (su - lean - 0.17) / 0.34, pTarget = (pX + 1.10) / 4.10;
      let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (E.sheen(mid) < pTarget) lo = mid; else hi = mid; }
      this.starT = CH_GLINT + 0.65 * lo;
    },
    render(S) {
      const t = S.t, rz = this.rz || 0, dbg = NX.finDebug || {}, fx = NX.fx.ctx;
      const tau = t - HIT, R = NX.FRONT.end(t), frontOn = t < FRONT_OFF, lightsOn = !dbg.leavesOff;
      // Échange (première sous-image ≥ HIT) : les traits du logo s'ouvrent en 0,03 s, puis l'emblème s'efface en 0,05 s.
      const open = dbg.dock ? 1 : sm(SWAP_GATE[0], SWAP_GATE[1], t) * (t >= HIT ? 1 : 0);
      const hitLum = lightsOn && tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0;   // surexposition de l'impact (≤ 0,30)
      // Emblème : son chrome apparaît en smooth(HIT − 0,80 ; HIT − 0,60) ; sa lumière (feuille lum, traits clairs, ≤ 0,30) naît
      // avec le cœur et s'éteint en 0,3 s : il sort de la source comme un dessin de lumière qui prend matière.
      const favImg = sm(FLY[0], FLY[0] + 0.2, t), favBox = dbg.dock ? 0 : 1 - sm(SWAP_FAV[0], SWAP_FAV[1], t);
      const birthLum = lightsOn ? BIRTH_LUM * sm(HIT - 0.82, HIT - 0.74, t) * (1 - E.sine(seg(t, HIT - 0.74, HIT - 0.44))) : 0;
      const favLum = Math.max(birthLum, hitLum);
      const favOn = favBox > 0.0005 && (favImg > 0.0005 || favLum > 0.002) && t < SWAP_FAV[1];

      // ---- Retour de l'emblème (HIT − 0,80 → HIT), puis effacement sous l'éclair (HIT + 0,01 → HIT + 0,06) ----
      // Jamais masqué : sous la ligne de coupe, le logo ne montre aucun trait clair dans son empreinte avant l'échange.
      if (favOn) {
        const P = finFavPose(finFlight(t), rz);
        this.fav.style.display = '';
        this.fav.style.transform = `translate3d(${P.x.toFixed(3)}px,${P.y.toFixed(3)}px,${P.z.toFixed(3)}px) scale(${(P.k / SS).toFixed(6)})`;
        this.fav.style.opacity = favBox.toFixed(4);
        // Naissance : la lumière précède le chrome ; tant que le chrome est transparent, son calque est retiré du rendu.
        this.FL.img.style.display = favImg > 0.0005 ? '' : 'none';
        this.FL.img.style.opacity = favImg.toFixed(4);
        // Lumière de naissance, puis surexposition de l'impact tant qu'il est visible (même loi que le logo).
        const fl = favLum > 0.002 ? favLum : 0;
        this.FL.lum.style.display = fl ? '' : 'none';
        this.FL.lum.style.opacity = fl.toFixed(4);
      } else this.fav.style.display = 'none';
      // Lumière du cœur de l'emblème (#fxback, derrière le DOM : jamais de voile sur le logo ni sur ce qui reste
      // de S8). Il naît d'une source : un cœur chaud et serré dans l'anneau, un halo large et très léger teinté
      // comme les rayons ; pic vers HIT − 0,74, éteint à HIT − 0,40. À l'approche, le cœur se recharge (montée
      // HIT − 0,38 → HIT, bible §2.5 « cores grow ») et passe la main à l'impact, qui l'éteint en quelques images.
      if (lightsOn && t < HIT + 0.6) {
        const f = finFlight(Math.min(t, HIT)), p = NX.cam.project(RING[0], f.Y, rz + f.Z), size = DK.size * p.s;
        const born = sm(HIT - 0.83, HIT - 0.74, t) * (1 - E.sine(seg(t, HIT - 0.72, HIT - 0.40)));
        const charge = 0.22 * E.inQuad(seg(t, HIT - 0.38, HIT)) * (tau < 0 ? 1 : Math.exp(-8 * tau));
        if (born > 0.003) {
          NX.lk.glow(p.x, p.y, 1.6 * size, [165, 243, 252], 0.10 * born, NX.fxBack.ctx);
          NX.lk.glow(p.x, p.y, 0.6 * size, [225, 248, 255], 0.35 * born, NX.fxBack.ctx);
        }
        if (charge > 0.003) NX.lk.glow(p.x, p.y, 0.95 * size, [190, 235, 255], charge, NX.fxBack.ctx);
      }

      // ---- Logo final écrit par le front, derrière la porte ----
      // Feuilles du kit pilotées ici (et non par L.frame, dont les largeurs en px supposent une boîte à 1×).
      const L = this.L, Lc = frontOn ? finLocal(L9.left, L9.top, rz, R, t) : null;
      // Retiré du rendu tant que la porte ne laisse rien voir (boxOn, porte ouverte de { dock } : boxTop ; voir prepare).
      this.box.style.display = !dbg.noLockup && t >= (dbg.dock ? this.boxTop : this.boxOn) ? '' : 'none';
      const written = Lc ? finWrite(Lc) : null;
      // Porte : avant HIT, g ∪ (plaque ∩ pPlate) — la plaque arrive avec la pose, les traits de l'emblème sont retenus ;
      // à partir de HIT, l'image cuite 1 − (1 − g)·st, les traits s'ouvrant en 0,03 s par une couche uniforme ajoutée ;
      // entièrement ouverte, elle disparaît. { plateOff } : la plaque n'est jamais écrite.
      const pPlate = dbg.dock ? 1 : E.sine(seg(t, PLATE_IN[0], PLATE_IN[1]));
      let gate, gOps = ['add'];
      if (dbg.plateOff) { gate = open > 0 ? [this.gOnlyUrl, this.strokeUrl, finUni(open)] : [this.gOnlyUrl]; gOps = ['add', 'intersect']; }
      else if (open > 0 || pPlate >= 1) gate = open >= 1 ? [] : open > 0 ? [this.gateUrl, finUni(open)] : [this.gateUrl];
      else if (pPlate > 0) { gate = [this.gOnlyUrl, this.plateUrl, finUni(pPlate)]; gOps = ['add', 'intersect']; }
      else gate = [this.gOnlyUrl];
      if (written) { gate = [written, ...gate]; gOps = ['intersect', ...gOps]; }
      finMask(L.img, gate, gOps);
      // Bande blanche sur le chrome clair, au front d'écriture (masque fixe posé dans prepare), jusqu'à ce qu'elle soit
      // entièrement passée sous la boîte (hotEnd).
      const hotOn = lightsOn && !!Lc && t < this.hotEnd;
      L.hot.style.opacity = hotOn ? 1 : 0;
      L.hot.style.display = hotOn ? '' : 'none';
      L.hot.style.background = hotOn ? finBand(Lc) : 'none';
      // Surexposition de l'impact (≤ 0,30, e^(−6τ)) sur le chrome clair déjà écrit. Pendant l'échange (deux images),
      // elle touche aussi les traits de l'emblème du logo qui s'ouvrent derrière l'emblème opaque : la lumière les
      // montre une image avant leur chrome, sous l'éclair. Un seul masque de plus que le masque clair.
      const lum = hitLum > 0.002 ? hitLum : 0;
      L.lum.style.opacity = lum.toFixed(4);
      L.lum.style.display = lum ? '' : 'none';
      finMask(L.lum, lum && written ? [L.url, written] : [L.url]);
      // Reflet unique de la tenue (carillon 4, CH_GLINT → + 0,65, SHEEN ; 29,10–29,75).
      const gp = seg(t, CH_GLINT, CH_GLINT + 0.65), sweepP = lightsOn ? E.sheen(gp) : -1, sweepOn = sweepP > 0 && sweepP < 1;
      L.sweep.style.opacity = sweepOn ? SWEEP_A.toFixed(4) : 0;
      L.sweep.style.display = sweepOn ? '' : 'none';
      L.band.style.transform = `translateX(${NX.lerp(-110, 300, sweepOn ? sweepP : 0).toFixed(2)}%)`;

      // ---- Halo (HIT − 0,10 → HIT + 0,40), écrit lui aussi par la lumière : jamais de voile sur ce qui reste de S8 ----
      // Transparent avant HIT − 0,10 : retiré du rendu, et son masque n'est écrit que lorsqu'il est affiché.
      const haloA = sm(HIT - 0.10, HIT + 0.40, t) * (0.6 + 0.4 * (tau >= 0 ? Math.exp(-3 * tau) : 1)), haloOn = haloA > 0.0005;
      this.halo.style.display = haloOn ? '' : 'none';
      this.halo.style.opacity = haloA.toFixed(4);
      if (haloOn && frontOn) NX.light.write(this.halo, NX.light.local(HALO.left, HALO.top, rz + HALO.z, R, t), { feather: 200 });
      else NX.light.clear(this.halo);

      // ---- Lumière du canvas (#fx) ----
      if (lightsOn) {
        // Impact : cœur et une traînée, au centre de l'anneau posé.
        if (tau >= 0 && tau < 1.5) { const c = NX.cam.project(RING[0], RING[1], rz); NX.hit(t, HIT, c.x, c.y, { flare: 0.55, core: 420, coreA: 0.40 }); }
        // Étincelles du mot-symbole (même physique que S2).
        if (this.sparks && t > HIT - 0.5 && t < HIT + 2.8) {
          fx.save(); fx.globalCompositeOperation = 'lighter';
          for (const q of this.sparks) {
            const age = t - q.te; if (age < 0 || age > q.life) continue;
            const u = age / q.life, dx = (NX.noise(q.n, age * 1.3) - NX.noise(q.n, 0)) * 6;
            const p = NX.cam.project(q.X + dx, q.Y - q.rise * E.outCubic(u), rz), z = q.s * p.s;
            // Comme en S2 : un halo doux (sprite unique) sous un carré net, pour lire un point de lumière.
            const a = (1 - u) * (1 - u), rr = 2.8 * z + 2;
            fx.globalAlpha = 0.24 * a; fx.drawImage(this.sprite, p.x - rr, p.y - rr, 2 * rr, 2 * rr);
            fx.globalAlpha = a; fx.fillStyle = q.col; fx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
          }
          fx.restore();
        }
        // Reflet du logo (carillon 4, 29,10–29,75) : débord doux qui suit la bande (entrée et sortie adoucies, pas de saut),
        // étoile sur la pointe de la lance.
        const spill = sweepOn ? 0.06 * sm(0, 0.12, gp) * (1 - sm(0.88, 1, gp)) : 0;
        if (spill > 0.002) {
          const p = NX.cam.project(L9.left + finSweepX(sweepP) * L9.w, L9.top + H9 / 2, rz);
          const w = 0.30 * L9.w * p.s, h = 0.62 * H9 * p.s;
          fx.save(); fx.globalCompositeOperation = 'lighter'; fx.setTransform(w / 2, 0, 0, h, p.x, p.y);
          const g = fx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, `rgba(200,240,255,${spill.toFixed(4)})`); g.addColorStop(0.55, `rgba(200,240,255,${(spill * 0.58).toFixed(4)})`); g.addColorStop(1, 'rgba(200,240,255,0)');
          fx.fillStyle = g; fx.fillRect(-1, -1, 2, 2); fx.restore();
        }
        const tip = () => NX.cam.project(L9.left + LOGO.stars.spear[0] * L9.w, L9.top + LOGO.stars.spear[1] * H9, rz);
        if (this.starT && Math.abs(t - this.starT) < 0.4) { const p = tip(); NX.lk.star(p.x, p.y, 0.7 * finStarG(t, this.starT, 0.05, 0.30), { size: 0.9 * p.s }); }
        // Cloche (BELL, 30,6) : étoile douce sur la pointe (g 0,5, 0,4 s).
        if (t > BELL - 0.1 && t < BELL + 0.5) { const p = tip(); NX.lk.star(p.x, p.y, 0.5 * finStarG(t, BELL + 0.06, 0.06, 0.34), { size: 0.8 * p.s }); }
      }

      // ---- Carte finale ----
      // Carillon 1 (CH_CTA, 28,2) : le bouton s'ouvre depuis le centre ; son éclat monte avec l'ouverture (attaque 0,06 s)
      // puis retombe en e^(−3τ).
      const pc = E.enter(seg(t, CH_CTA, CH_CTA + 0.45)), ins = 50 * (1 - pc);
      this.cta.style.clipPath = pc >= 1 ? 'none' : `inset(0 ${ins.toFixed(3)}% 0 ${ins.toFixed(3)}%)`;
      if (lightsOn && t >= CH_CTA && t < CH_CTA + 1.6 && this.ctaC) {
        const tb = t - CH_CTA, p = NX.cam.project(this.ctaC[0], this.ctaC[1], rz);
        NX.lk.glow(p.x, p.y, 260 * p.s, [165, 215, 255], 0.25 * Math.exp(-3 * tb) * sm(0, 0.06, tb));
      }
      // Carillon 5 (CH_CTA_GLINT → + 0,6 ; 29,40–30,00) : reflet intérieur du bouton.
      const pg = E.sheen(seg(t, CH_CTA_GLINT, CH_CTA_GLINT + 0.6)), gOn = lightsOn && pg > 0 && pg < 1;
      this.glint.style.opacity = gOn ? 1 : 0;
      this.glint.style.display = gOn ? '' : 'none';
      this.glint.style.transform = `translateX(${NX.lerp(-105, 222, gOn ? pg : 0).toFixed(2)}%)`;
      // Carillon 2 : la ligne monte à travers son masque.
      NX.type.rise(this.w1, t, CH_L1, 0.04, 0.6);
      // La ligne tant qu'aucun de ses mots n'est entré, et le bouton tant qu'il est fermé, sont retirés du rendu : chaque
      // élément de la racine 3D a son propre calque, et un calque devenu vide n'était plus rastérisé. Rendu juste après
      // la carte complète (v7 : 31,0 puis 29,0), Chrome y affichait une tuile périmée prise au bouton (tache magenta).
      const shown = ws => ws.some(w => +w.style.opacity > 0);
      this.l1.style.display = shown(this.w1) ? '' : 'none';
      this.ctaw.style.display = pc > 0 ? '' : 'none';
    },
  });
})();
