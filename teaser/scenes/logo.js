/* S2 Logo (bible v7 §4 S2), 4,0–7,2 s : le logo complet, le même qu'en carte finale, n'entre que par la lumière.
 * Dès 4,0 s une silhouette de lumière froide (feuille forge) luit derrière la question ; le front elliptique
 * NX.FRONT.hook l'écrit ensuite de la pointe de la lance jusqu'à la devise (fondu 70 px), une bande blanche
 * court sur le chrome au bord du front et libère 240 étincelles. Impact sobre sur 4,8 s, halo qui respire,
 * un seul reflet diagonal (5,95–6,65) avec son halo de lumière et deux étoiles, puis le logo est pris dans
 * la lumière (LIFT 6,65–7,15) pendant que les cinq lumières des rôles s'allument (equipe.js).
 * Le logo n'est jamais tourné ni filtré : masques, profondeur, échelle uniforme et feuilles de lumière seulement. */
(function () {
  const SRC = '../public/assets/nxt5-logo.png';
  const G = NX.G.L2, LG = NX.G.LOGO, W = G.w, H = W * LG.H / LG.W, K = W / LG.W;
  const ZL = -0.5;                                                       // racine de scène à translateZ(z·0,5 px), z = −1
  const RING = [G.left + LG.ringC[0] * K, G.top + LG.ringC[1] * K];     // centre de l'anneau, monde (958.7, 452.1)
  const HIT = NX.T.hookEnd;                                              // 4,8
  const GLINT = [5.95, 6.65], EXIT = [6.65, 7.15], FADE = [6.90, 7.15];
  const SWEEP_A = 0.30 / 0.95;           // pic du reflet = 0,30 de lumière ajoutée sur le chrome (plafond de marque)
  const STARS = [{ uv: LG.stars.spear, g: 0.7, size: 0.75 }, { uv: LG.stars.five, g: 0.55, size: 0.6 }];
  NX.css(`
  .logo-halo{position:absolute;left:310px;top:40px;width:1300px;height:1000px;background:radial-gradient(closest-side,rgba(103,232,249,.20),rgba(129,140,248,.10) 45%,transparent)}
  .logo-box{position:absolute;left:${G.left}px;top:${G.top}px;width:${W}px;height:${H.toFixed(2)}px;isolation:isolate}
  `);

  // Centre de la bande de reflet (gradient 105°, 34 % de large, translateX −110 % → 300 %) au point (u, v) de la boîte.
  const TAN15 = Math.tan(15 * Math.PI / 180);
  const sweepAt = p => (NX.lerp(-110, 300, p) / 100) * 0.34 + 0.17;             // abscisse u du centre, à mi-hauteur
  const sheenInv = y => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (NX.ease.sheen(m) < y) a = m; else b = m; } return (a + b) / 2; };

  NX.scene({
    id: 'logo', start: 4.0, end: NX.T.roles, z: -1,
    build(root) {
      this.halo = NX.el('<div class="logo-halo"></div>', root);
      this.box = NX.el('<div class="logo-box"></div>', root);
      this.L = NX.logoLight(this.box, SRC);
      // Reflet : même bande de 34 % que le kit, mais un cœur spéculaire net et des épaules douces, pour qu'il se lise
      // comme un éclat sur le chrome sans dépasser le plafond de 0,30 de lumière ajoutée.
      this.L.band.style.background = 'linear-gradient(105deg,transparent 0%,rgba(150,215,255,.10) 28%,rgba(185,232,255,.38) 43%,rgba(255,255,255,.95) 48.5%,rgba(255,255,255,.95) 51.5%,rgba(205,192,255,.38) 57%,rgba(196,181,253,.10) 72%,transparent 100%)';
    },
    async prepare() {
      await this.L.prepare();
      const track = NX.FRONT.hook, win = { t0: 4.2, t1: 5.6 };
      // Fin de l'écriture : le masque d'écriture (opaque à r − 70) couvre les quatre coins de la boîte.
      this.tFull = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => NX.light.when(track, G.left + u * W, G.top + v * H, ZL, { ...win, off: -82 })));
      // Étincelles : 240 points clairs du logo, émis quand le front les atteint, montée 40–120 px, vie 0,8–1,5 s.
      this.sparks = NX.sample(this.L.img, 240, 77, 400, 0.45).map((p, i) => {
        const r = NX.rng(500 + i), X = G.left + p.u * W, Y = G.top + p.v * H;
        const life = 0.8 + 0.7 * r(), rise = 40 + 80 * r(), s = 1.5 + 1.5 * r(), n = 13.7 * i + 50 * r();
        const te = NX.light.when(track, X, Y, ZL, win);
        const col = p.rgb.map(v => Math.min(255, Math.round(v * 0.7 + 77))).join(',');
        return { X, Y, te, life: Math.min(life, 6.5 - te), rise, s, n, fill: `rgb(${col})` };
      });
      // Halo doux de chaque étincelle (sprite unique, lumière froide) : un point de lumière, pas un grain de poussière.
      const sp = document.createElement('canvas'); sp.width = sp.height = 64;
      const sx = sp.getContext('2d'), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(225,245,255,1)'); gr.addColorStop(0.22, 'rgba(200,235,255,.45)'); gr.addColorStop(1, 'rgba(180,220,255,0)');
      sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64); this.sprite = sp;
      // Reflet : instants où le centre de la bande croise chaque ancre (étoile).
      this.stars = STARS.map(o => {
        const [u, v] = o.uv, uc = u + (v - 0.5) * (H / W) * TAN15;           // centre de bande requis à mi-hauteur
        const p = ((uc - 0.17) / 0.34 * 100 + 110) / 410;
        return { ...o, X: G.left + u * W, Y: G.top + v * H, tc: GLINT[0] + (GLINT[1] - GLINT[0]) * sheenInv(p) };
      });
    },
    render(S) {
      const t = S.t, E = NX.ease, sm = NX.smooth, tau = t - HIT, ctx = NX.fx.ctx;
      // Sortie : pris dans la lumière (LIFT : monte de 120 px et recule de 700 px), tout s'éteint entre 6,90 et 7,15.
      // Le chrome (img, 6,94–7,10) s'efface d'abord ; la feuille lum (plus-lighter, qui ajoute aussi de l'alpha) le
      // relaie : le logo devient une silhouette de lumière, qui s'éteint à son tour (7,02–7,15) avec le halo.
      // Jamais d'opacité de groupe, qui griserait le logo blanc sur le ciel sombre.
      const q = E.lift(NX.seg(t, EXIT[0], EXIT[1]));
      const tr = q > 0 ? `translate3d(0,${(-120 * q).toFixed(2)}px,${(-700 * q).toFixed(2)}px)` : '';
      const fade = 1 - sm(FADE[0], FADE[1], t), imgFade = 1 - sm(6.94, 7.10, t), lightFade = 1 - sm(7.02, FADE[1], t);
      this.box.style.transform = tr; this.halo.style.transform = tr;
      // Écriture : front local dans la boîte ; silhouette forge 0 → 0,24 (inQuad) puis → 0,30, effacée par le front.
      const full = this.tFull ?? Infinity, writing = t >= 4.2 && t < full;
      const front = writing ? NX.light.local(G.left, G.top, ZL, NX.FRONT.hook(t), t) : null;
      const forge = t >= full ? 0 : 0.24 * E.inQuad(NX.seg(t, 4.0, 4.5)) + 0.06 * NX.seg(t, 4.5, 4.8);
      const lum = (tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0) + 0.45 * sm(EXIT[0], 6.95, t);
      const gp = NX.seg(t, GLINT[0], GLINT[1]), sweepP = gp > 0 && gp < 1 ? E.sheen(gp) : -1;
      this.L.frame({ front, written: t >= full, forge, hot: t >= 4.3 && t < 5.4 ? 1 : 0, lum: lum * lightFade, sweepP, sweepA: SWEEP_A, lead: 0 });
      if (imgFade < 1) this.L.img.style.opacity = imgFade.toFixed(4);
      // Halo (dégradé de la v6) : entre 4,6–5,0 et respire après l'impact.
      this.halo.style.opacity = (sm(4.6, 5.0, t) * (0.6 + 0.4 * (tau >= 0 ? Math.exp(-3 * tau) : 1)) * fade).toFixed(4);
      if (!this.sparks) return;
      const c = NX.camState;
      // Étincelles : carrés de lumière additifs, alpha (1 − u)², toutes éteintes à 6,5 s.
      if (t < 6.5) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const p of this.sparks) {
          const age = t - p.te; if (age < 0 || age >= p.life) continue;
          const u = age / p.life, pr = NX.cam.project(p.X + NX.noise(p.n, t) * 6, p.Y - p.rise * E.outCubic(u), ZL, c), z = p.s * pr.s;
          const a = (1 - u) * (1 - u), R = 2.8 * z + 2;
          ctx.globalAlpha = 0.24 * a; ctx.drawImage(this.sprite, pr.x - R, pr.y - R, 2 * R, 2 * R);
          ctx.globalAlpha = a; ctx.fillStyle = p.fill; ctx.fillRect(pr.x - z / 2, pr.y - z / 2, z, z);
        }
        ctx.restore();
      }
      // Montée vers l'impact (bible §2.5 « cores grow ») : le cœur de l'emblème, écrit dès 4,42, grandit sous
      // l'écriture (alpha ≤ 0,25 tant que la ligne 1 se lit) ; sur 4,8 l'impact prend le relais : halo de cœur
      // et une seule traînée anamorphique au centre de l'anneau.
      if (t > 4.42 && tau < 1.5) {
        const pr = NX.cam.project(RING[0], RING[1], ZL, c), g = E.inQuad(NX.seg(t, 4.42, HIT));
        if (tau < 0) NX.lk.glow(pr.x, pr.y, (80 + 240 * g) * pr.s, [200, 240, 255], 0.28 * g);
        else NX.hit(t, HIT, pr.x, pr.y, { core: 420, coreA: 0.40, flare: 0.6 });
      }
      // Reflet : halo de lumière doux (6 %, 30 % de la boîte) qui suit la bande, et une étoile par ancre croisée.
      if (sweepP > 0) {
        const pr = NX.cam.project(G.left + sweepAt(sweepP) * W, G.top + H / 2, ZL, c), a = 0.06 * sm(0, 0.12, gp) * (1 - sm(0.88, 1, gp));
        if (a > 0.002) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setTransform(0.15 * W * pr.s, 0, 0, 0.62 * H * pr.s, pr.x, pr.y);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, `rgba(205,240,255,${a.toFixed(4)})`); g.addColorStop(0.45, `rgba(190,225,255,${(a * 0.55).toFixed(4)})`); g.addColorStop(1, 'rgba(190,225,255,0)');
          ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
        }
      }
      // Sortie : la lumière du cœur grandit et absorbe le logo qui monte (pendant de l'éclair de 4,8), éteinte à 7,15.
      const xg = E.sine(NX.seg(t, 6.72, 7.04)) * (1 - E.sine(NX.seg(t, 7.04, FADE[1])));
      if (xg > 0.002) {
        const pr = NX.cam.project(RING[0], RING[1] - 120 * q, ZL - 700 * q, c);
        NX.lk.glow(pr.x, pr.y, (240 + 300 * E.sine(NX.seg(t, 6.72, 7.10))) * pr.s, [200, 240, 255], 0.42 * xg);
      }
      if (this.stars && t > GLINT[0] && t < EXIT[0] + 0.3) for (const s of this.stars) {
        const g = s.g * (t < s.tc ? sm(s.tc - 0.07, s.tc, t) : Math.exp(-6 * (t - s.tc))) * fade;
        if (g > 0.004) { const pr = NX.cam.project(s.X, s.Y - 120 * q, ZL - 700 * q, c); NX.lk.star(pr.x, pr.y, g, { size: s.size }); }
      }
    },
  });
})();
