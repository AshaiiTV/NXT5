/* S5 Direction (bible v7 §4 S5), 14,25–18,1 s : « Une même direction. »
 * 14,4 : l'emblème naît de la fusion (opacité 14,28–14,42 sous les particules d'equipe.js), impact sobre
 * au centre de l'anneau. Le titre monte, l'emblème respire, un faisceau part de la pointe de la lance vers la
 * source (15,6), un seul reflet passe sur le chrome (16,15–16,85). Puis l'emblème se condense en sa lance
 * (masque doux 17,40–17,75), la lance monte le long du faisceau et entre dans la lumière (17,50–17,98).
 * 18,0 : le faisceau s'éteint, la lumière redescend sur la première carte (outils.js).
 * Interfaces : equipe.js possède les particules et ne dessine jamais le PNG ; cette scène possède l'emblème et
 * NX.hit(14,4) ; « ciel » possède l'onde de choc, le resserrement des rayons, la montée et la poussière.
 * Le logo n'est jamais tourné ni filtré : masque doux, translation, échelle uniforme, feuilles de lumière.
 * Fonction pure de t : masques, instants d'étoile et toile annexe sont préparés une fois. */
(function () {
  const SRC = '../public/assets/nxt5-loader-favicon.png';
  const G5 = NX.G.E5, FV = NX.G.FAV, BOX = G5.size, K = BOX / FV.W;   // 460 px pour 512 px d'image
  const E = NX.ease, seg = NX.seg, sm = NX.smooth, clamp = NX.clamp, SINE = E.sine;
  const ZR = 1.2 * 0.5;                          // le moteur décale la racine de la scène (z 1,2) de 0,6 px
  const ZH = 0, ZB = 2, ZT = 3;                  // halo, emblème, titre : calques relevés (jamais coplanaires)
  const OX = FV.ringC[0] * K, OY = FV.ringC[1] * K;     // centre de l'anneau dans la boîte (227,75 ; 241,68)
  const CX = G5.left + OX, CY = G5.top + OY;     // C = (960 ; 441,7), centre de l'anneau en monde
  const TIPV = FV.spearTip[1] * K;               // pointe de la lance : y 46,7 dans la boîte (monde 246,7)
  const AXIS = 960 - G5.left;                    // axe de la lance dans la boîte (monde x 960)
  const HALO = 900;                              // halo : dégradé radial de 900 px centré sur C

  /* Frise (bible §4 S5). */
  const HIT = NX.T.emblem;                       // 14,4 : naissance de l'emblème
  const BIRTH = [14.28, 14.42];                  // opacité de l'emblème sous les particules
  const TITLE_IN = 14.55, TITLE_OUT = 17.62;     // montée (pas 0,12, ENTER 0,8) ; sortie (pas 0,05, EXIT 0,32)
  const TITLE_GONE = TITLE_OUT + 2 * 0.05 + 0.32;  // 18,04 : dernier mot sorti
  const BREATH = [14.60, 17.40];                 // respiration : y −10 px, échelle 1 → 1,025 (SINE)
  const SHEEN_T = [15.30, 16.10];                // reflet du mot « direction. »
  const DRAW = [15.60, 16.50];                   // tracé du faisceau, de la pointe vers la source (SINE)
  const KICKS = [NX.beats.lightKicks[2], NX.beats.lightKicks[3]];   // 15,6 et 16,8
  const GLINT = [16.15, 16.85];                  // reflet unique de la tenue (SHEEN)
  const COND = [17.40, 17.75];                   // condensation en lance (GLIDE)
  const SPEAR_LUM = [17.45, 17.80];              // lumière froide sur la lance 0 → 0,5
  const RISE = [17.50, 17.98];                   // montée de 260 px le long du faisceau (LIFT)
  const FADE = [17.75, 17.98];                   // la lance s'efface dans la lumière
  const OFF = NX.T.tools;                        // 18,0 : faisceau éteint, relais au faisceau du drop
  const SPEAR = [44.5, 54.7];                    // colonnes de la lance (en % de la boîte), bords doux de 3 %
  const SWEEP_A = 0.30 / 0.95;                   // pic du reflet = 0,30 de lumière ajoutée (plafond de marque)
  const BEAM_CORE = [200, 240, 255], BEAM_GLOW = [167, 200, 255];
  const TAN15 = Math.tan(15 * Math.PI / 180);

  NX.css(`
  .dir-halo{position:absolute;left:${CX - HALO / 2}px;top:${(CY - HALO / 2).toFixed(2)}px;width:${HALO}px;height:${HALO}px;opacity:0;transform-origin:50% 50%;background:radial-gradient(closest-side,rgba(129,140,248,.35),rgba(129,140,248,.25) 22%,rgba(129,140,248,.12) 48%,rgba(129,140,248,.04) 74%,rgba(129,140,248,0))}
  .dir-box{position:absolute;left:${G5.left}px;top:${G5.top}px;width:${BOX}px;height:${BOX}px;isolation:isolate;opacity:0;transform-origin:${OX.toFixed(2)}px ${OY.toFixed(2)}px}
  .dir-title{top:700px;transform:translateZ(${ZT}px)}
  `);

  /** Pose de l'emblème : respiration (−10 px, ×1,025, SINE) puis montée de 260 px (LIFT) ; échelle autour de C. */
  const pose = t => {
    const br = SINE(seg(t, BREATH[0], BREATH[1])), up = E.lift(seg(t, RISE[0], RISE[1]));
    return { s: 1 + 0.025 * br, dy: -10 * br - 260 * up };
  };
  /** Point (u, v) de la boîte, en px de la boîte → point monde [X, Y, Z]. */
  const dirWorld = (P, u, v) => [CX + (u - OX) * P.s, CY + (v - OY) * P.s + P.dy, ZR + ZB];
  const dirProj = (P, u, v) => { const w = dirWorld(P, u, v); return NX.cam.project(w[0], w[1], w[2]); };
  /** Centre de la bande de reflet (gradient 105°, 34 % de large, translateX −110 % → 300 %) à mi-hauteur, en u. */
  const sweepAt = p => (NX.lerp(-110, 300, p) / 100) * 0.34 + 0.17;
  const sheenInv = y => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (E.sheen(m) < y) a = m; else b = m; } return (a + b) / 2; };

  /** Faisceau additif au profil transversal de NX.lk.beam, fondu aux deux bouts (f0 au pied, f1 à la tête) :
   *  la tête qui monte se lit comme de la lumière, jamais comme une barre coupée. Toile annexe oc (préparée). */
  function dirBeam(ctx, oc, x0, y0, x1, y1, w0, w1, a, rgb, f0, f1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (a <= 0.003 || len < 1) return;
    const o = oc.getContext('2d'), L = Math.min(len, oc.width - 4), wm = Math.max(w0, w1), H = Math.min(oc.height, Math.ceil(wm) + 4), cy = H / 2;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.clearRect(0, 0, L + 4, H);
    const gr = o.createLinearGradient(0, cy - wm / 2, 0, cy + wm / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, `rgba(${rgb},${(a * 0.5).toFixed(4)})`); gr.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(4)})`);
    gr.addColorStop(0.7, `rgba(${rgb},${(a * 0.5).toFixed(4)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = gr; o.beginPath(); o.moveTo(0, cy - w0 / 2); o.lineTo(L, cy - w1 / 2); o.lineTo(L, cy + w1 / 2); o.lineTo(0, cy + w0 / 2); o.closePath(); o.fill();
    let a0 = f0, a1 = f1; if (a0 + a1 > L) { const q = L / (a0 + a1); a0 *= q; a1 *= q; }
    const lg = o.createLinearGradient(0, 0, L, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(a0 / L, '#000'); lg.addColorStop(1 - a1 / L, '#000'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    o.globalCompositeOperation = 'destination-in'; o.fillStyle = lg; o.fillRect(0, 0, L + 4, H);
    o.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.drawImage(oc, 0, 0, L + 4, H, 0, -cy, L + 4, H);
    ctx.restore();
  }

  NX.scene({
    id: 'direction', start: 14.25, end: 18.1, z: 1.2,
    build(root) {
      this.halo = NX.el('<div class="dir-halo"></div>', root);
      this.box = NX.el('<div class="dir-box"></div>', root);
      this.L = NX.logoLight(this.box, SRC);
      this.title = NX.el(`<div class="tz-center dir-title"><div class="tz-title"><span class="tz-line">Une même <span class="nx-spec">direction.</span></span></div></div>`, root);
      this.words = NX.type.prepare(this.title).words;
      this.spec = this.title.querySelector('.nx-spec');
      this.oc = document.createElement('canvas'); this.oc.width = 1400; this.oc.height = 48;
    },
    async prepare() {
      await this.L.prepare();
      // Étoile du reflet : instant où le centre de la bande croise la pointe de la lance (ancre u .494, v .102).
      const [u, v] = FV.star, uc = u + (v - 0.5) * TAN15, p = ((uc - 0.17) / 0.34 * 100 + 110) / 410;
      this.starT = GLINT[0] + (GLINT[1] - GLINT[0]) * sheenInv(p);
    },
    render(S) {
      const t = S.t, fx = NX.fx.ctx, bk = NX.fxBack.ctx, tau = t - HIT;
      const P = pose(t);

      /* ---------------- Emblème : naissance, respiration, condensation, montée ---------------- */
      const birth = sm(BIRTH[0], BIRTH[1], t), fade = 1 - sm(FADE[0], FADE[1], t), vis = birth * fade;
      const cond = E.glide(seg(t, COND[0], COND[1]));
      const box = this.box;
      if (vis <= 0) box.style.display = 'none';
      else {
        box.style.display = '';
        box.style.opacity = vis.toFixed(4);
        box.style.transform = `translate3d(0px,${P.dy.toFixed(3)}px,${ZB}px) scale(${P.s.toFixed(5)})`;
        // Condensation : masque horizontal doux sur la boîte plate (jamais de clip-path, qui laisse des coupes nettes).
        if (cond > 0) {
          const l = SPEAR[0] * cond, r = 100 - (100 - SPEAR[1]) * cond;
          const m = `linear-gradient(to right,transparent ${(l - 3).toFixed(3)}%,#000 ${l.toFixed(3)}%,#000 ${r.toFixed(3)}%,transparent ${(r + 3).toFixed(3)}%)`;
          box.style.maskImage = m; box.style.webkitMaskImage = m;
          box.style.maskRepeat = box.style.webkitMaskRepeat = 'no-repeat';
        } else { box.style.maskImage = ''; box.style.webkitMaskImage = ''; }
        const lum = (tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0) + 0.5 * sm(SPEAR_LUM[0], SPEAR_LUM[1], t);
        const gp = seg(t, GLINT[0], GLINT[1]), sweepP = gp > 0 && gp < 1 ? E.sheen(gp) : -1;
        this.L.frame({ front: null, written: true, lum, sweepP, sweepA: SWEEP_A });
      }

      /* ---------------- Halo : apparaît avec l'emblème, +20 % sur les temps 15,6 et 16,8, se resserre sur la lance ---------------- */
      const hA = sm(14.30, 14.62, t) * (1 + 0.2 * NX.beatPulse(t, KICKS, 2.5)) / 1.2 * (1 - 0.35 * cond) * fade;
      if (hA <= 0.001) this.halo.style.display = 'none';
      else {
        this.halo.style.display = '';
        this.halo.style.opacity = hA.toFixed(4);
        this.halo.style.transform = `translate3d(0px,${P.dy.toFixed(3)}px,${ZH}px) scale(${(P.s * (1 - 0.7 * cond)).toFixed(5)},${(P.s * (1 - 0.15 * cond)).toFixed(5)})`;
      }

      /* ---------------- Titre « Une même direction. » ---------------- */
      if (t >= TITLE_IN && t < TITLE_GONE) {
        this.title.style.display = '';
        NX.type.rise(this.words, t, TITLE_IN, 0.12, 0.8);
        NX.type.sink(this.words, t, TITLE_OUT, 0.05, 0.32);
        NX.type.sheen(this.spec, t, SHEEN_T[0], SHEEN_T[1], 0.35);
      } else this.title.style.display = 'none';

      /* ---------------- Impact de 14,4 au centre de l'anneau (cœur, une traînée violette) ---------------- */
      if (tau >= 0 && tau < 1.5) {
        const q = dirProj(P, OX, OY);
        NX.hit(t, HIT, q.x, q.y, { core: 400, coreA: 0.40, flare: 0.6, tint: [167, 139, 250], s: q.s });
      }

      /* ---------------- Faisceau « direction » (#fxback, derrière l'emblème), de la pointe vers la source ---------------- */
      if (t >= DRAW[0] && t < OFF) {
        const d = SINE(seg(t, DRAW[0], DRAW[1]));
        const k = (0.5 + 0.3 * NX.beatPulse(t, [KICKS[1]], 3) + 0.4 * sm(17.4, 17.95, t)) * (1 + 0.4 * SINE(seg(t, RISE[0], RISE[0] + 0.3)));
        // Pied 10 px sous la pointe (dans la lance) et fondu sur 26 px : le faisceau sort de la pointe.
        const foot = dirProj(P, AXIS, TIPV + 10), tip = dirProj(P, AXIS, TIPV), s = NX.light.src(t);
        const hx = tip.x + (s.x - tip.x) * d, hy = tip.y + (s.y - tip.y) * d;
        const f0 = 26 * tip.s, f1 = 60;
        dirBeam(bk, this.oc, foot.x, foot.y, hx, hy, 24, 24 + 6 * d, 0.16 * k, BEAM_GLOW, f0, f1);
        dirBeam(bk, this.oc, foot.x, foot.y, hx, hy, 3, 3, 0.6 * k, BEAM_CORE, f0, f1);
      }

      /* ---------------- Reflet : débord doux qui suit la bande, une étoile sur la pointe de la lance ---------------- */
      const gp = seg(t, GLINT[0], GLINT[1]);
      if (gp > 0 && gp < 1) {
        const q = dirProj(P, sweepAt(E.sheen(gp)) * BOX, BOX / 2), a = 0.06 * sm(0, 0.12, gp) * (1 - sm(0.88, 1, gp));
        if (a > 0.002) {
          fx.save(); fx.globalCompositeOperation = 'lighter';
          fx.setTransform(0.15 * BOX * P.s * q.s, 0, 0, 0.62 * BOX * P.s * q.s, q.x, q.y);
          const g = fx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, `rgba(205,240,255,${a.toFixed(4)})`); g.addColorStop(0.45, `rgba(190,225,255,${(a * 0.55).toFixed(4)})`); g.addColorStop(1, 'rgba(190,225,255,0)');
          fx.fillStyle = g; fx.fillRect(-1, -1, 2, 2); fx.restore();
        }
      }
      if (this.starT && Math.abs(t - this.starT) < 0.45) {
        const g = 0.7 * (t < this.starT ? sm(this.starT - 0.07, this.starT, t) : Math.exp(-6 * (t - this.starT)));
        if (g > 0.004) { const q = dirProj(P, FV.star[0] * BOX, FV.star[1] * BOX); NX.lk.star(q.x, q.y, g, { size: 0.7 * q.s }); }
      }
    },
  });
})();
