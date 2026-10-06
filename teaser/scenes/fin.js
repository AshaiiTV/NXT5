/* Fin (S9, bible §4) — fenêtre 27,95–33,6, z 3.
 * 28,0–28,8 : l'emblème ressort de la lumière, descend l'axe et se pose au pixel près sur celui du logo final.
 *   Dans le même passage, le front NX.FRONT.end (avance 0) écrit NXT5 dessous, derrière la porte (les lignes de
 *   l'emblème s'ouvrent en fondu devant l'emblème qui se pose, 28,75–28,79, puis il se retire, recouvert) :
 *   c'est le bouclage du moment 1. Les outils (S8) sont brûlés par « outils » avec 100 px d'avance.
 * 28,8 : impact. 29,4–31,8 : la carte finale arrive sur les carillons. La caméra se pose à 33,6.
 * Fonction pure de t : étincelles, instants d'émission et instant de l'étoile du reflet sont calculés une fois
 * dans prepare(). Les logos ne sont jamais tournés en 3D ni filtrés : masques, profondeur et feuilles de lumière.
 * Vérification (bible §6.9, §6.10) : NX.finDebug = { dock } force les lignes de l'emblème du logo et masque
 * l'emblème, { hardGate } garde la porte fermée jusqu'à 28,80 (échange sec), { leavesOff } coupe toute lumière ajoutée. */
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
  const OPEN = [28.75, 28.79];                                     // la porte s'ouvre sous l'emblème, à moins de 2,3 px de la pose
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

  /** Masque à plusieurs couches (même convention que le kit) : intersection par défaut, union avec 'add'. */
  const finMask = (el, layers, op = 'intersect') => {
    const m = layers.filter(Boolean), v = m.join(','), many = m.length > 1;
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = m.map(() => '100% 100%').join(','); el.style.webkitMaskSize = el.style.maskSize;
    el.style.maskRepeat = 'no-repeat'; el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = many ? op : ''; el.style.webkitMaskComposite = many ? (op === 'add' ? 'source-over' : 'source-in') : '';
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
  /** Complément exact de finWrite : visible là où le front n'a pas encore écrit. */
  const finUnwritten = L => `radial-gradient(${finShape(L)},transparent ${finPc(L.r - 70 * SS)},#000 ${finPc(L.r + 10 * SS)})`;
  /** Bande blanche qui suit le front (profil de NX.light.band). */
  const finBand = L => `radial-gradient(${finShape(L)},transparent ${finPc(L.r - 170 * SS)},rgba(150,215,255,.28) ${finPc(L.r - 70 * SS)},rgba(200,240,255,.75) ${finPc(L.r - 18 * SS)},#fff ${finPc(L.r - 3 * SS)},transparent ${finPc(L.r + 12 * SS)})`;
  /** Coupe horizontale dure à y (px locaux) : 'above' garde le haut, 'below' garde le bas. */
  const finCut = (y, keep) => keep === 'above'
    ? `linear-gradient(to bottom,#000 ${y.toFixed(3)}px,transparent ${y.toFixed(3)}px)`
    : `linear-gradient(to bottom,transparent ${y.toFixed(3)}px,#000 ${y.toFixed(3)}px)`;
  const GATE = finCut(CUT9 * SS, 'below');                         // porte : seules les lignes du mot-symbole et du slogan
  /** Position du retour de l'emblème (centre de l'anneau en Y monde, profondeur Z). */
  const finFlight = t => { const e = E.glide(seg(t, FLY[0], FLY[1])); return { Y: Y0 + (RING[1] - Y0) * e, Z: Z0 * (1 - e) }; };
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
      // Feuilles jamais utilisées ici (pas de silhouette en S9, l'emblème ne porte aucune lumière ajoutée) : retirées
      // du rendu une fois pour toutes ; les autres ne sont affichées que pendant leur fenêtre (voir render).
      for (const el of [this.L.forge, this.FL.forge, this.FL.hot, this.FL.lum, this.FL.sweep]) el.style.display = 'none';
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
      // La bande blanche ne touche jamais les lignes de l'emblème (portées par l'emblème qui se pose).
      finMask(this.L.hot, [this.L.url, GATE]);
      // 200 étincelles prises sur les pixels clairs du mot-symbole et du slogan (lignes ≥ 440), émises au passage du front.
      const v0 = LOGO.rows.wordmark[0] / LOGO.H;
      const pts = NX.sample(this.L.img, 900, 2888, 400, 0.45).filter(p => p.v >= v0).slice(0, 200);
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
      const tau = t - HIT, R = NX.FRONT.end(t), frontOn = t < FRONT_OFF;
      const docked = t >= HIT || dbg.dock;                        // sous-image ≥ 28,80 : le logo porte l'emblème
      // L'emblème se retire dès que les lignes de l'emblème du logo sont entièrement ouvertes devant lui (28,79) :
      // il est alors à 0,33 px derrière et totalement recouvert (écart 0,02/255). Plus près, le tri en profondeur de
      // deux plans quasi confondus bascule et le repasserait devant (mesuré à 28,797 : écart 1,15/255, 86 en bordure).
      const favOn = !dbg.dock && t < (dbg.hardGate ? HIT : OPEN[1]);
      const lightsOn = !dbg.leavesOff;

      // ---- Retour de l'emblème (28,00–28,80) ----
      // Au-dessus de y monde 287,5 il est toujours visible ; dans la bande du mot-symbole, il ne reste visible que
      // là où le front n'a pas encore écrit le logo (complément exact de l'écriture) : sa pointe ne double jamais
      // celle du logo et n'est jamais coupée net avant l'arrivée de la lumière.
      if (favOn) {
        const f = finFlight(t), top = DK.top + f.Y - RING[1], cut = finCut((YCUT - top) * SS, 'above');
        this.fav.style.display = '';
        this.fav.style.transform = `translate3d(0px,${(f.Y - RING[1]).toFixed(3)}px,${f.Z.toFixed(3)}px) scale(${1 / SS})`;
        this.fav.style.opacity = sm(FLY[0], FLY[0] + 0.2, t).toFixed(4);
        finMask(this.FL.img, [cut, finUnwritten(finLocal(DK.left, top, rz + f.Z, R, t))], 'add');
      } else this.fav.style.display = 'none';
      // Lumière du cœur de l'emblème (#fxback, derrière le DOM : jamais de voile sur le logo ni sur ce qui reste
      // de S8). Il naît d'une flaque de lumière froide qui s'allume juste avant lui et s'éteint pendant qu'il
      // descend ; à l'approche, son cœur se recharge (montée 27,6–28,8, bible §2.5 « cores grow ») et passe la
      // main à l'impact de 28,8, qui l'éteint en quelques images.
      if (lightsOn && t < HIT + 0.6) {
        const f = finFlight(Math.min(t, HIT)), p = NX.cam.project(RING[0], f.Y, rz + f.Z), size = DK.size * p.s;
        const born = 0.32 * sm(FLY[0], FLY[0] + 0.08, t) * (1 - E.sine(seg(t, FLY[0] + 0.10, FLY[0] + 0.45)));
        const charge = 0.22 * E.inQuad(seg(t, 28.42, HIT)) * (tau < 0 ? 1 : Math.exp(-8 * tau));
        if (born > 0.003) NX.lk.glow(p.x, p.y, 1.35 * size, [200, 240, 255], born, NX.fxBack.ctx);
        if (charge > 0.003) NX.lk.glow(p.x, p.y, 0.95 * size, [190, 235, 255], charge, NX.fxBack.ctx);
      }

      // ---- Logo final écrit par le front, derrière la porte ----
      // La porte ne garde que les lignes du mot-symbole et du slogan ; les lignes de l'emblème s'ouvrent en fondu
      // devant l'emblème (qui arrive de z < 0) pendant ses 2 derniers px (28,75–28,79). Les deux PNG n'ont pas les
      // mêmes pixels (lueurs et plaque sombre peintes dans le logo, texture de la lance) : un échange sec à 28,80
      // sauterait (contrôle §6.9 : écart moyen 3,2/255, max 41/255). Le fondu porte ce changement ; à 28,80 une
      // seule image porte tout le logo et l'emblème, entièrement recouvert, disparaît sans que rien ne bouge.
      // Feuilles du kit pilotées ici (et non par L.frame, dont les largeurs en px supposent une boîte à 1×).
      const L = this.L, Lc = frontOn ? finLocal(L9.left, L9.top, rz, R, t) : null;
      const open = docked ? 1 : dbg.hardGate ? 0 : sm(OPEN[0], OPEN[1], t);
      const gate = open >= 1 ? null : open <= 0 ? GATE
        : `linear-gradient(to bottom,rgba(0,0,0,${open.toFixed(4)}) ${(CUT9 * SS).toFixed(3)}px,#000 ${(CUT9 * SS).toFixed(3)}px)`;
      const written = Lc ? finWrite(Lc) : null;
      finMask(L.img, [written, gate]);
      // Bande blanche sur le chrome clair, au front d'écriture (masque fixe posé dans prepare).
      L.hot.style.opacity = lightsOn && Lc ? 1 : 0;
      L.hot.style.display = lightsOn && Lc ? '' : 'none';
      L.hot.style.background = lightsOn && Lc ? finBand(Lc) : 'none';
      // Surexposition de l'impact (≤ 0,30, e^(−6τ)), seulement sur ce qui est déjà écrit.
      const lumRaw = lightsOn && tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0, lum = lumRaw > 0.002 ? lumRaw : 0;
      L.lum.style.opacity = lum.toFixed(4);
      L.lum.style.display = lum ? '' : 'none';
      finMask(L.lum, lum ? [L.url, written, gate] : [L.url]);
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
      // Carillon 1 (29,40) : le bouton s'ouvre depuis le centre, avec un éclat qui retombe.
      const pc = E.enter(seg(t, 29.40, 29.85)), ins = 50 * (1 - pc);
      this.cta.style.clipPath = pc >= 1 ? 'none' : `inset(0 ${ins.toFixed(3)}% 0 ${ins.toFixed(3)}%)`;
      if (lightsOn && t >= 29.40 && t < 31.0 && this.ctaC) {
        const p = NX.cam.project(this.ctaC[0], this.ctaC[1], rz);
        NX.lk.glow(p.x, p.y, 260 * p.s, [165, 215, 255], 0.25 * Math.exp(-3 * (t - 29.40)));
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
