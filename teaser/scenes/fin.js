/* Fin (S9, bible §4) — fenêtre 27,95–33,6, z 3.
 * 28,0–28,8 : l'emblème ressort de la lumière, descend l'axe et se pose sur celui du logo final.
 *   Dans le même passage, le front NX.FRONT.end (avance 0) écrit NXT5 dessous, derrière la porte : les lignes de
 *   l'emblème et l'empreinte de son bas (ellipse autour de la lance et des pales) restent fermées jusqu'à 28,80.
 *   Les outils (S8) sont brûlés par « outils » avec 100 px d'avance. C'est le bouclage du moment 1.
 * 28,8 : impact. L'échange emblème → logo se fait sous l'éclair (repli de la bible §5.3, voir plus bas).
 * 29,4–31,8 : la carte finale arrive sur les carillons. La caméra se pose à 33,6.
 * Fonction pure de t : étincelles, instants d'émission et instant de l'étoile du reflet sont calculés une fois
 * dans prepare(). Les logos ne sont jamais tournés en 3D ni filtrés : masques, profondeur et feuilles de lumière.
 * Vérification (bible §6.9, §6.10) : NX.finDebug = { dock } force les lignes de l'emblème du logo et masque
 * l'emblème qui se pose ; { noLockup } retire le logo final ; { leavesOff } coupe toute lumière ajoutée. Sans
 * drapeau, l'image de 28,80 − 1/180 est le rendu « emblème seul » du contrôle (la porte est fermée jusqu'à 28,80). */
(function () {
  const SRC_LOGO = '../public/assets/nxt5-logo.png', SRC_FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G, L9 = G.L9, DK = G.dock, FAV = G.FAV, LOGO = G.LOGO;
  const K9 = L9.w / LOGO.W, H9 = LOGO.H * K9;                    // logo final : 620 × 488,98 px monde
  const KF = DK.size / FAV.W;                                      // px de l'emblème → px monde (0,5648)
  const RING = [DK.left + FAV.ringC[0] * KF, DK.top + FAV.ringC[1] * KF]; // anneau posé : (959,09 ; 245,94)
  const YCUT = L9.top + LOGO.rows.wordmark[0] * K9;                // 287,54 : haut de la bande du mot-symbole
  const CUT9 = YCUT - L9.top;                                      // la même ligne dans le repère du logo (217,54)
  const HIT = NX.T.end;                                            // 28,8
  const FLY = [28.0, HIT], Y0 = -850, Z0 = -4000;                  // retour : (959,1 ; −850 ; −4000) → posé
  const FRONT_OFF = 29.45;                                         // au-delà, la bande est passée sous tout le logo
  /* Échange sous l'éclair (repli §5.3, ouvert à l'impact plutôt qu'à 28,78 : rien ne change avant 28,80).
   * Les deux PNG n'ont pas les mêmes pixels (plaque sombre, lueurs peintes et arcs prolongés jusqu'aux rails dans le
   * logo) : le contrôle §6.9 échoue sans défaut d'alignement. La porte s'ouvre d'abord (la plaque arrive sous le pic
   * de l'éclair, derrière l'emblème opaque), puis l'emblème s'efface sur le logo : aucun creux vers le fond. */
  const SWAP_GATE = [HIT, HIT + 0.03], SWAP_FAV = [HIT + 0.01, HIT + 0.06];
  const LIFT = 2;                                                  // l'emblème vole 2 px devant le plan du logo (§2.7)
  const BIRTH_LUM = 0.22;                                          // lumière de naissance sur les traits clairs (≤ 0,30)
  /* Empreinte du bas de l'emblème sous la ligne de coupe (lance, pales, pointes des arcs, départ des rails) : ellipse
   * autour du centre de l'anneau, en px monde, bord adouci. Rien du logo n'y est écrit avant l'échange : ni plaque,
   * ni bande blanche, ni doublon de pale quand l'emblème est encore à quelques px de sa place. */
  const HOLE = { rx: 115, ry: 95, f: 12 };
  const RAMP = 10;                                                 // demi-largeur (px monde) du fondu de la ligne de coupe
  const HALO = { left: 310, top: -130, w: 1300, h: 900, z: -4 };   // halo v6 (centre 960 ; 320), un peu en retrait
  // Plafond de marque (bible §2.3) : au plus 0,30 de lumière ajoutée sur le chrome. Le cœur du reflet vaut 0,95,
  // d'où l'opacité de la feuille (même valeur que le kit et que S2).
  const SWEEP_A = 0.30 / 0.95;
  // Reflet du logo final : la bande de S2 (cœur spéculaire net, épaules douces), pour que les deux logos se répondent.
  const SWEEP_BAND = 'linear-gradient(105deg,transparent 0%,rgba(150,215,255,.10) 28%,rgba(185,232,255,.38) 43%,rgba(255,255,255,.95) 48.5%,rgba(255,255,255,.95) 51.5%,rgba(205,192,255,.38) 57%,rgba(196,181,253,.10) 72%,transparent 100%)';
  // Les deux boîtes de logo sont écrites à 2× puis réduites de moitié (échelle uniforme) : sous la caméra tournée,
  // Chrome rastérise un calque 3D à l'échelle locale 1 puis le rééchantillonne, ce qui rendait le logo flou jusqu'à
  // 30,0 (énergie de détail 396 contre 2010 une fois la caméra frontale). À 2×, 1742 : net pendant tout le retour.
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
  .fin-l2{top:${G.end.line2Top}px;font-weight:600;font-size:40px;color:var(--text2)}
  `);

  /** Masque à plusieurs couches, en intersection (même convention que le kit). */
  const finMask = (el, layers) => {
    const v = layers.join(','), many = layers.length > 1;
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = layers.map(() => '100% 100%').join(','); el.style.webkitMaskSize = el.style.maskSize;
    el.style.maskRepeat = 'no-repeat'; el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = many ? layers.map(() => 'intersect').join(',') : '';
    el.style.webkitMaskComposite = many ? layers.map(() => 'source-in').join(',') : '';
  };
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
  /* Porte du logo final (px locaux 2×) : la bande du mot-symbole et du slogan, ouverte en fondu sur 20 px monde
   * autour de la ligne de coupe (jamais de marche dans la plaque), moins l'empreinte du bas de l'emblème.
   * Fermée, elle est cuite une fois en image (prepare) ; pendant l'échange, chaque facteur laisse passer √open côté
   * fermé, si bien que les lignes de l'emblème (fermées deux fois) s'ouvrent exactement à « open », sans union de
   * masques (mask-composite: add doublait le coût de l'image). */
  const GATE_Y0 = (CUT9 - RAMP) * SS, GATE_Y1 = (CUT9 + RAMP) * SS;
  const HOLE_C = [(RING[0] - L9.left) * SS, (RING[1] - L9.top) * SS], HOLE_F = HOLE.f / HOLE.rx;
  const finRamp = a => `linear-gradient(to bottom,rgba(0,0,0,${a}) ${GATE_Y0.toFixed(2)}px,#000 ${GATE_Y1.toFixed(2)}px)`;
  const finHole = a => `radial-gradient(ellipse ${(HOLE.rx * SS).toFixed(1)}px ${(HOLE.ry * SS).toFixed(1)}px at ${HOLE_C[0].toFixed(2)}px ${HOLE_C[1].toFixed(2)}px,rgba(0,0,0,${a}) 100%,#000 ${(100 * (1 + HOLE_F)).toFixed(2)}%)`;
  /** Valeur de la porte fermée au px local 2× (x, y) : mêmes interpolations linéaires que les deux dégradés. */
  const finGateAt = (x, y) => NX.clamp((y - GATE_Y0) / (GATE_Y1 - GATE_Y0)) * NX.clamp((Math.hypot((x - HOLE_C[0]) / (HOLE.rx * SS), (y - HOLE_C[1]) / (HOLE.ry * SS)) - 1) / HOLE_F);
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
    id: 'fin', start: 27.95, end: NX.DURATION, post: 0.4, z: 3,
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
      // Masque neutre sur l'image de l'emblème : sans masque, Chrome la traite en « image composée directement » et
      // réutilise une rastérisation dont l'échelle dépend des images rendues avant (écart de 1/255 selon l'ordre).
      finMask(this.FL.img, ['linear-gradient(#000,#000)']);
      // Carte finale.
      this.ctaw = NX.el(`<div class="fin-ctaw"><span class="fin-cta">nxt5.org<i></i></span></div>`, root);
      this.cta = this.ctaw.firstElementChild; this.glint = this.cta.querySelector('i');
      this.l1 = NX.el(`<div class="fin-line fin-l1"><div class="tz-line">Pour les équipes et coachs League of Legends</div></div>`, root);
      this.l2 = NX.el(`<div class="fin-line fin-l2"><div class="tz-line">Accès actuellement gratuit</div></div>`, root);
      this.w1 = NX.type.prepare(this.l1).words; this.w2 = NX.type.prepare(this.l2).words;
    },
    layout() {
      // Centre du bouton en monde, pour la lumière du canvas (mesuré une fois les polices chargées).
      this.ctaC = [L9.left + L9.w / 2, G.end.buttonTop + this.cta.offsetHeight / 2];
    },
    async prepare(root) {
      const m = /translateZ\(([-\d.]+)px\)/.exec(root.style.transform || '');
      this.rz = m ? +m[1] : 0;                                    // décalage en z de la racine (ordre des scènes)
      await Promise.all([this.L.prepare(), this.FL.prepare()]);
      // Porte fermée cuite en une image, et masque de la bande blanche = traits clairs (même loi que le kit) × porte :
      // la bande ne court que sur le chrome clair du mot-symbole et du slogan, jamais sur l'emblème (ni ses lignes,
      // ni l'empreinte de son bas). Une couche fixe au lieu de trois : moins de calques de masque à chaque image.
      {
        const img = this.L.img, w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
        const d = c.getImageData(0, 0, w, h).data, gate = c.createImageData(w, h), hot = c.createImageData(w, h);
        const kx = L9.w * SS / w, ky = H9 * SS / h;               // px locaux 2× par px de l'image
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4, k = finGateAt((x + 0.5) * kx, (y + 0.5) * ky);
          const l = (0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]) / 255, br = NX.smooth(0.35, 0.65, l) * d[o + 3] / 255;
          gate.data[o] = gate.data[o + 1] = gate.data[o + 2] = hot.data[o] = hot.data[o + 1] = hot.data[o + 2] = 255;
          gate.data[o + 3] = Math.round(255 * k); hot.data[o + 3] = Math.round(255 * k * br);
        }
        c.putImageData(gate, 0, 0); this.gateUrl = `url(${cv.toDataURL('image/png')})`;
        c.putImageData(hot, 0, 0); finMask(this.L.hot, [`url(${cv.toDataURL('image/png')})`]);
      }
      // 200 étincelles prises sur les pixels clairs du mot-symbole et du slogan (lignes ≥ 440), émises au passage du front,
      // hors de l'empreinte du bas de l'emblème (rien n'y est écrit par le front : elle s'ouvre à l'échange).
      const v0 = LOGO.rows.wordmark[0] / LOGO.H, hk = (HOLE.rx + HOLE.f) / HOLE.rx;
      const outHole = p => Math.hypot((L9.left + p.u * L9.w - RING[0]) / HOLE.rx, (L9.top + p.v * H9 - RING[1]) / HOLE.ry) >= hk;
      const pts = NX.sample(this.L.img, 900, 2888, 400, 0.45).filter(p => p.v >= v0 && outHole(p)).slice(0, 200);
      this.nSparks = pts.length;
      this.sparks = pts.map((p, k) => {
        const r = NX.rng(28800 + k), X = L9.left + p.u * L9.w, Y = L9.top + p.v * H9;
        return {
          X, Y, te: NX.light.when(NX.FRONT.end, X, Y, this.rz, { t0: 28.3, t1: 30.0 }),
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
      this.starT = 30.30 + 0.65 * lo;
    },
    render(S) {
      const t = S.t, rz = this.rz || 0, dbg = NX.finDebug || {}, fx = NX.fx.ctx;
      const tau = t - HIT, R = NX.FRONT.end(t), frontOn = t < FRONT_OFF, lightsOn = !dbg.leavesOff;
      // Échange (première sous-image ≥ 28,80) : la porte s'ouvre en 0,03 s, puis l'emblème s'efface en 0,05 s.
      const open = dbg.dock ? 1 : dbg.xInstant ? (t >= HIT ? 1 : 0) : sm(SWAP_GATE[0], SWAP_GATE[1], t) * (t >= HIT ? 1 : 0);
      const hitLum = lightsOn && tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0;   // surexposition de l'impact (≤ 0,30)
      // Emblème : son chrome apparaît en smooth(28,00 ; 28,20) ; sa lumière (feuille lum, traits clairs, ≤ 0,30) naît
      // avec le cœur et s'éteint en 0,3 s : il sort de la source comme un dessin de lumière qui prend matière.
      const favImg = sm(FLY[0], FLY[0] + 0.2, t), favBox = dbg.dock ? 0 : 1 - sm(SWAP_FAV[0], SWAP_FAV[1], t);
      const birthLum = lightsOn ? BIRTH_LUM * sm(27.98, 28.06, t) * (1 - E.sine(seg(t, 28.06, 28.36))) : 0;
      const favLum = Math.max(birthLum, hitLum);
      const favOn = favBox > 0 && (favImg > 0 || favLum > 0.002) && t < SWAP_FAV[1];

      // ---- Retour de l'emblème (28,00–28,80), puis effacement sous l'éclair (28,81–28,86) ----
      // Jamais masqué : en dessous de la ligne de coupe, le logo n'écrit rien dans son empreinte avant l'échange.
      if (favOn) {
        const P = finFavPose(finFlight(t), rz, dbg.lift ?? LIFT);
        this.fav.style.display = '';
        this.fav.style.transform = `translate3d(${P.x.toFixed(3)}px,${P.y.toFixed(3)}px,${P.z.toFixed(3)}px) scale(${(P.k / SS).toFixed(6)})`;
        this.fav.style.opacity = favBox.toFixed(4);
        this.FL.img.style.opacity = favImg.toFixed(4);
        // Lumière de naissance, puis surexposition de l'impact tant qu'il est visible (même loi que le logo).
        const fl = favLum > 0.002 ? favLum : 0;
        this.FL.lum.style.display = fl ? '' : 'none';
        this.FL.lum.style.opacity = fl.toFixed(4);
      } else this.fav.style.display = 'none';
      // Lumière du cœur de l'emblème (#fxback, derrière le DOM : jamais de voile sur le logo ni sur ce qui reste
      // de S8). Il naît d'une source : un cœur chaud et serré dans l'anneau, un halo large et très léger teinté
      // comme les rayons ; pic vers 28,06, éteint à 28,40. À l'approche, le cœur se recharge (montée 28,42–28,80,
      // bible §2.5 « cores grow ») et passe la main à l'impact de 28,8, qui l'éteint en quelques images.
      if (lightsOn && t < HIT + 0.6) {
        const f = finFlight(Math.min(t, HIT)), p = NX.cam.project(RING[0], f.Y, rz + f.Z), size = DK.size * p.s;
        const born = sm(27.97, 28.06, t) * (1 - E.sine(seg(t, 28.08, 28.40)));
        const charge = 0.22 * E.inQuad(seg(t, 28.42, HIT)) * (tau < 0 ? 1 : Math.exp(-8 * tau));
        if (born > 0.003) {
          NX.lk.glow(p.x, p.y, 1.6 * size, [165, 243, 252], 0.10 * born, NX.fxBack.ctx);
          NX.lk.glow(p.x, p.y, 0.6 * size, [225, 248, 255], 0.35 * born, NX.fxBack.ctx);
        }
        if (charge > 0.003) NX.lk.glow(p.x, p.y, 0.95 * size, [190, 235, 255], charge, NX.fxBack.ctx);
      }

      // ---- Logo final écrit par le front, derrière la porte ----
      // Feuilles du kit pilotées ici (et non par L.frame, dont les largeurs en px supposent une boîte à 1×).
      const L = this.L, Lc = frontOn ? finLocal(L9.left, L9.top, rz, R, t) : null;
      this.box.style.display = dbg.noLockup ? 'none' : '';
      const written = Lc ? finWrite(Lc) : null;
      // Porte : fermée (image cuite) jusqu'à 28,80, puis ouverte en 0,03 s ; entièrement ouverte, elle disparaît.
      const ga = Math.sqrt(open).toFixed(4);
      const gate = open >= 1 ? [] : open > 0 ? [finHole(ga), finRamp(ga)] : [this.gateUrl];
      const imgLayers = written ? [written, ...gate] : gate;
      finMask(L.img, imgLayers);
      // Bande blanche sur le chrome clair, au front d'écriture (masque fixe posé dans prepare).
      const hotOn = lightsOn && !!Lc;
      L.hot.style.opacity = hotOn ? 1 : 0;
      L.hot.style.display = hotOn ? '' : 'none';
      L.hot.style.background = hotOn ? finBand(Lc) : 'none';
      // Surexposition de l'impact (≤ 0,30, e^(−6τ)), seulement sur ce qui est déjà écrit et ouvert.
      const lum = hitLum > 0.002 ? hitLum : 0;
      L.lum.style.opacity = lum.toFixed(4);
      L.lum.style.display = lum ? '' : 'none';
      finMask(L.lum, lum ? (dbg.xLumOpen && t >= HIT ? [L.url, ...(written ? [written] : [])] : [L.url, ...imgLayers]) : [L.url]);
      // Reflet unique de la tenue (carillon 4, 30,30–30,95, SHEEN).
      const gp = seg(t, 30.30, 30.95), sweepP = lightsOn ? E.sheen(gp) : -1, sweepOn = sweepP > 0 && sweepP < 1;
      L.sweep.style.opacity = sweepOn ? SWEEP_A.toFixed(4) : 0;
      L.sweep.style.display = sweepOn ? '' : 'none';
      L.band.style.transform = `translateX(${NX.lerp(-110, 300, sweepOn ? sweepP : 0).toFixed(2)}%)`;

      // ---- Halo (28,70–29,20), écrit lui aussi par la lumière : jamais de voile sur ce qui reste de S8 ----
      this.halo.style.opacity = (sm(28.70, 29.20, t) * (0.6 + 0.4 * (tau >= 0 ? Math.exp(-3 * tau) : 1))).toFixed(4);
      if (frontOn) NX.light.write(this.halo, NX.light.local(HALO.left, HALO.top, rz + HALO.z, R, t), { feather: 200 });
      else NX.light.clear(this.halo);

      // ---- Lumière du canvas (#fx) ----
      if (lightsOn) {
        // Impact : cœur et une traînée, au centre de l'anneau posé.
        if (tau >= 0 && tau < 1.5) { const c = NX.cam.project(RING[0], RING[1], rz); NX.hit(t, HIT, c.x, c.y, { flare: 0.55, core: 420, coreA: 0.40 }); }
        // Étincelles du mot-symbole (même physique que S2).
        if (this.sparks && t > 28.3 && t < 31.6) {
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
        // Reflet du logo (30,30–30,95) : débord doux qui suit la bande (entrée et sortie adoucies, pas de saut),
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
        // Cloche de 31,8 : étoile douce sur la pointe (g 0,5, 0,4 s).
        if (t > 31.7 && t < 32.3) { const p = tip(); NX.lk.star(p.x, p.y, 0.5 * finStarG(t, 31.86, 0.06, 0.34), { size: 0.8 * p.s }); }
      }

      // ---- Carte finale ----
      // Carillon 1 (29,40) : le bouton s'ouvre depuis le centre ; son éclat monte avec l'ouverture (attaque 0,06 s)
      // puis retombe en e^(−3τ).
      const pc = E.enter(seg(t, 29.40, 29.85)), ins = 50 * (1 - pc);
      this.cta.style.clipPath = pc >= 1 ? 'none' : `inset(0 ${ins.toFixed(3)}% 0 ${ins.toFixed(3)}%)`;
      if (lightsOn && t >= 29.40 && t < 31.0 && this.ctaC) {
        const tb = t - 29.40, p = NX.cam.project(this.ctaC[0], this.ctaC[1], rz);
        NX.lk.glow(p.x, p.y, 260 * p.s, [165, 215, 255], 0.25 * Math.exp(-3 * tb) * sm(0, 0.06, tb));
      }
      // Carillon 5 (30,60–31,20) : reflet intérieur du bouton.
      const pg = E.sheen(seg(t, 30.60, 31.20)), gOn = lightsOn && pg > 0 && pg < 1;
      this.glint.style.opacity = gOn ? 1 : 0;
      this.glint.style.display = gOn ? '' : 'none';
      this.glint.style.transform = `translateX(${NX.lerp(-105, 222, gOn ? pg : 0).toFixed(2)}%)`;
      // Carillons 2 et 3 : les deux lignes montent à travers leur masque.
      NX.type.rise(this.w1, t, 29.70, 0.04, 0.6);
      NX.type.rise(this.w2, t, 30.00, 0.04, 0.6);
    },
  });
})();
