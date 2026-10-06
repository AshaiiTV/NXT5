/* S2 Logo (bible v7 §4 S2), 4,0–7,2 s : le logo complet, le même qu'en carte finale, n'entre que par la lumière.
 * Dès 4,0 s une silhouette de lumière froide (feuille forge, sur tout le logo) luit derrière la question ; le front
 * elliptique NX.FRONT.hook l'écrit ensuite de la pointe de la lance jusqu'à la devise (fondu 70 px), une bande blanche
 * court sur le chrome au bord du front et libère 240 étincelles. Impact sobre sur 4,8 s, halo qui respire,
 * un seul reflet diagonal (5,95–6,65) avec son halo de lumière et deux étoiles, puis le logo est pris dans
 * la lumière (LIFT 6,65–7,15) : il blanchit, son chrome redevient la silhouette de lumière froide du début, et cette
 * lumière se resserre dans la lumière de son cœur pendant que les cinq lumières des rôles s'allument (equipe.js).
 * Le logo n'est jamais tourné ni filtré : masques, profondeur, échelle uniforme et feuilles de lumière seulement. */
(function () {
  const SRC = '../public/assets/nxt5-logo.png';
  const G = NX.G.L2, LG = NX.G.LOGO, W = G.w, H = W * LG.H / LG.W, K = W / LG.W;
  const ZL = -0.5;                                                       // racine de scène à translateZ(z·0,5 px), z = −1
  const RING = [G.left + LG.ringC[0] * K, G.top + LG.ringC[1] * K];     // centre de l'anneau, monde (958.7, 452.1)
  const HIT = NX.T.hookEnd;                                              // 4,8
  const GLINT = [5.95, 6.65], EXIT = [6.65, 7.15], FADE = [6.90, 7.15];
  // Sortie « prise dans la lumière » (bible §2.3, recede and brighten), tout éteint dans la fenêtre 6,90–7,15 :
  const TOLIGHT = [7.00, 7.10];          // le chrome (img) passe de 1 à 0 (smoothstep)…
  const FORGE_X = [6.97, 7.07, 0.85];    // … pendant que sa silhouette de lumière froide (forge) monte à 0,85 sous lui
  const ABSORB = [7.085, 7.15];          // puis cette lumière se resserre dans le cœur de l'anneau (masque radial, inQuad)
  const XPEAK = 7.13;                    // la lumière du cœur culmine pendant l'absorption ; éteinte à 7,18
  const SWEEP_A = 0.30 / 0.95;           // pic du reflet = 0,30 de lumière ajoutée sur le chrome (plafond de marque)
  const STARS = [{ uv: LG.stars.spear, g: 0.7, size: 0.75 }, { uv: LG.stars.five, g: 0.55, size: 0.6 }];
  const MW = Math.ceil(LG.W / 4), MH = Math.ceil(LG.H / 4);             // masque basse définition (cellules de 4 px)
  NX.css(`
  .logo-halo{position:absolute;left:310px;top:40px;width:1300px;height:1000px;transform:translateZ(-2px);background:radial-gradient(closest-side,rgba(103,232,249,.20),rgba(129,140,248,.10) 45%,transparent)}
  .logo-box{position:absolute;left:${G.left}px;top:${G.top}px;width:${W}px;height:${H.toFixed(2)}px;isolation:isolate}
  `);

  /** Masque d'une feuille (même règle que le setMask interne du kit) : couches à 100 % × 100 %, intersectées. */
  const logoSetMask = (el, layers) => {
    const v = layers.join(','), n = layers.length;
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = el.style.webkitMaskSize = layers.map(() => '100% 100%').join(',');
    el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = n > 1 ? 'intersect' : '';
    el.style.webkitMaskComposite = n > 1 ? 'source-in' : '';
  };
  /** Masques locaux tirés du PNG, construits une fois dans prepare() (même méthode que le brightMask du kit) :
   *  - url : alpha × smoothstep(0,45, 0,75, max(r,g,b)), tout le logo comme lumière, traits violets et fuchsia compris
   *    (le masque de luminance du kit ne garde que la moitié cyan, des contours et « DRAFT. ») ;
   *  - lo : le masque de luminance du kit, maximum par cellule de 4 px puis dilaté d'une cellule : vaut 1 sur tout
   *    trait clair, même fin (étincelles). */
  const logoMasks = img => {
    const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
    const im = c.getImageData(0, 0, w, h), d = im.data, cell = new Float32Array(MW * MH), lo = new Float32Array(MW * MH);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3] / 255, o = (y >> 2) * MW + (x >> 2);
      cell[o] = Math.max(cell[o], NX.smooth(0.35, 0.65, (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) * a);
      const k = NX.smooth(0.45, 0.75, Math.max(d[i], d[i + 1], d[i + 2]) / 255) * a;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(k * 255);
    }
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      let m = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const jj = j + dj, ii = i + di; if (jj >= 0 && jj < MH && ii >= 0 && ii < MW) m = Math.max(m, cell[jj * MW + ii]);
      }
      lo[j * MW + i] = m;
    }
    c.putImageData(im, 0, 0);
    return { url: `url(${cv.toDataURL('image/png')})`, lo };
  };
  /** Valeur bilinéaire du masque basse définition au point (u, v) de la boîte (0 hors du logo). */
  const logoLoAt = (lo, u, v) => {
    const x = NX.clamp(u * MW - 0.5, 0, MW - 1.001), y = NX.clamp(v * MH - 0.5, 0, MH - 1.001);
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, o = j * MW + i;
    return (lo[o] * (1 - fx) + lo[o + 1] * fx) * (1 - fy) + (lo[o + MW] * (1 - fx) + lo[o + MW + 1] * fx) * fy;
  };

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
      const M = logoMasks(this.L.img);
      this.maxUrl = M.url; this.lo = M.lo;
      logoSetMask(this.L.forge, [this.maxUrl]);                          // chargé dès la préparation
      const track = NX.FRONT.hook, win = { t0: 4.2, t1: 5.6 };
      // Fin de l'écriture : le masque d'écriture (opaque à r − 70) couvre les quatre coins de la boîte.
      this.tFull = Math.max(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => NX.light.when(track, G.left + u * W, G.top + v * H, ZL, { ...win, off: -82 })));
      // Étincelles : 240 points clairs du logo, émis quand le front les atteint, montée 40–120 px, vie 0,8–1,5 s.
      this.sparks = NX.sample(this.L.img, 240, 77, 400, 0.45).map((p, i) => {
        const r = NX.rng(500 + i), X = G.left + p.u * W, Y = G.top + p.v * H;
        const life = 0.8 + 0.7 * r(), rise = 40 + 80 * r(), s = 1.5 + 1.5 * r(), n = 13.7 * i + 50 * r();
        const te = NX.light.when(track, X, Y, ZL, win);
        const col = p.rgb.map(v => Math.min(255, Math.round(v * 0.7 + 77)));
        return { X, Y, te, life: Math.min(life, 6.5 - te), rise, s, n, col };
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
      const t = S.t, E = NX.ease, sm = NX.smooth, seg = NX.seg, tau = t - HIT, ctx = NX.fx.ctx, c = NX.camState;
      // Sortie : pris dans la lumière (LIFT : monte de 120 px et recule de 700 px). Le logo blanchit (lum +0,45 sur tout
      // le logo, 6,65–6,95), puis son chrome passe à sa silhouette de lumière froide (la feuille forge du début, 0,85,
      // sous le lum) : sa luminance ne baisse jamais, il n'y a pas d'image grise. Cette lumière se resserre ensuite dans
      // le cœur de l'anneau au pic de la lumière du cœur ; tout est éteint à 7,15. Jamais d'opacité de groupe ; le halo,
      // derrière (translateZ −2 px), s'éteint 6,90–7,15.
      const q = E.lift(seg(t, EXIT[0], EXIT[1])), dy = -120 * q, dz = -700 * q;
      this.box.style.transform = q > 0 ? `translate3d(0,${dy.toFixed(2)}px,${dz.toFixed(2)}px)` : '';
      this.halo.style.transform = `translate3d(0,${dy.toFixed(2)}px,${(dz - 2).toFixed(2)}px)`;
      const fade = 1 - sm(FADE[0], FADE[1], t), out = t >= ABSORB[1];
      const chrome = out ? 0 : 1 - sm(TOLIGHT[0], TOLIGHT[1], t);
      // Écriture : front local dans la boîte ; silhouette forge 0 → 0,24 (inQuad, 4,0–4,5) puis → 0,30 (4,5–4,8) par une
      // approche exponentielle qui part avec la pente de fin de l'inQuad (0,96 /s) : une seule courbe, sans cassure ni
      // segment linéaire. Elle est effacée par le front.
      // Sans masques (prepare() en échec), les feuilles de lumière resteraient des rectangles pleins : elles s'éteignent
      // et seul le chrome, écrit par le front, apparaît.
      const lit = this.maxUrl ? 1 : 0;
      const full = this.tFull ?? Infinity, writing = t >= 4.2 && t < full;
      const front = writing ? NX.light.local(G.left, G.top, ZL, NX.FRONT.hook(t), t) : null;
      const forge = lit * (t >= full ? (out ? 0 : FORGE_X[2] * sm(FORGE_X[0], FORGE_X[1], t))
        : t < 4.5 ? 0.24 * E.inQuad(seg(t, 4.0, 4.5)) : 0.24 + 0.06 * (1 - Math.exp(-4.8 * seg(t, 4.5, 4.8))) / (1 - Math.exp(-4.8)));
      const lumRaw = out ? 0 : lit * ((tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0) + 0.45 * sm(EXIT[0], 6.95, t));
      const lum = lumRaw < 0.002 ? 0 : lumRaw;                       // éteinte : son masque n'a plus d'effet
      const gp = seg(t, GLINT[0], GLINT[1]), sweepP = lit && gp > 0 && gp < 1 ? E.sheen(gp) : -1;
      this.L.frame({ front, written: t >= full, forge, hot: lit && t >= 4.3 && t < 5.4 ? 1 : 0, lum, sweepP, sweepA: SWEEP_A, lead: 0 });
      if (chrome < 1) this.L.img.style.opacity = chrome.toFixed(4);
      // Masques locaux, posés seulement quand la feuille est visible (une feuille à opacité 0 n'en dépend pas).
      if (this.maxUrl && forge > 0) {
        // forge : tout le logo ; pendant l'écriture, effacé là où le front a déjà écrit le chrome ; à la sortie, la
        // silhouette de lumière qui remplace le chrome.
        logoSetMask(this.L.forge, front ? [this.maxUrl, NX.light.mask(front, 'burn', { feather: 60, lead: 0 })] : [this.maxUrl]);
      }
      if (this.maxUrl && lum > 0) {
        // lum : la surexposition de l'impact (masque de luminance du kit) ne touche que le chrome déjà écrit ;
        // la sortie blanchit tout le logo.
        logoSetMask(this.L.lum, t >= EXIT[0] ? [this.maxUrl] : front ? [this.L.url, NX.light.mask(front, 'write', { feather: 70 })] : [this.L.url]);
      }
      // Absorption : une ellipse douce centrée sur le cœur de l'anneau (opaque jusqu'à 35 % de son rayon) se resserre
      // sur les trois feuilles visibles ; à son début elle couvre tout le logo, à 7,15 elle est nulle.
      if (this.maxUrl && t > ABSORB[0] && !out) {
        const k = 1 - E.inQuad(seg(t, ABSORB[0], ABSORB[1])), rx = Math.max(1, 1.7 * W * k), ry = Math.max(1, 1.36 * H * k);
        const rg = `radial-gradient(ellipse ${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${(RING[0] - G.left).toFixed(1)}px ${(RING[1] - G.top).toFixed(1)}px,#000 35%,transparent)`;
        logoSetMask(this.L.img, [rg]); logoSetMask(this.L.forge, [this.maxUrl, rg]); logoSetMask(this.L.lum, [this.maxUrl, rg]);
      }
      // Halo (dégradé de la v6) : entre 4,6–5,0 et respire après l'impact.
      this.halo.style.opacity = (sm(4.6, 5.0, t) * (0.6 + 0.4 * (tau >= 0 ? Math.exp(-3 * tau) : 1)) * fade).toFixed(4);
      // Étincelles : carrés de lumière additifs, alpha (1 − u)², toutes éteintes à 6,5 s. Le canvas fx se pose sur le DOM
      // (source-over) : une étincelle pâle sur le chrome blanc y ferait une poussière grise. Sur un trait clair (m = masque
      // de luminance au point de la boîte) le carré monte donc vers le blanc et son halo doux s'efface (× (1 − 0,9 m)) :
      // jamais plus sombre que le chrome, elle s'y lit comme un éclat net ; sur le ciel elle garde la couleur du pixel
      // d'origine et son halo.
      if (this.sparks && t < 6.5) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const p of this.sparks) {
          const age = t - p.te; if (age < 0 || age >= p.life) continue;
          const u = age / p.life, X = p.X + NX.noise(p.n, t) * 6, Y = p.Y - p.rise * E.outCubic(u), a = (1 - u) * (1 - u);
          const m = this.lo ? logoLoAt(this.lo, (X - G.left) / W, (Y - G.top) / H) : 0, k = v => Math.round(v + (255 - v) * m);
          const pr = NX.cam.project(X, Y, ZL, c), z = p.s * pr.s, R = 2.8 * z + 2;
          ctx.globalAlpha = 0.24 * a * (1 - 0.9 * m); ctx.drawImage(this.sprite, pr.x - R, pr.y - R, 2 * R, 2 * R);
          ctx.globalAlpha = a; ctx.fillStyle = `rgb(${k(p.col[0])},${k(p.col[1])},${k(p.col[2])})`; ctx.fillRect(pr.x - z / 2, pr.y - z / 2, z, z);
        }
        ctx.restore();
      }
      // Montée vers l'impact (bible §2.5 « cores grow ») : le cœur de l'emblème, écrit dès 4,42, grandit sous
      // l'écriture (alpha ≤ 0,25 tant que la ligne 1 se lit) ; sur 4,8 l'impact prend le relais : halo de cœur
      // et une seule traînée anamorphique au centre de l'anneau.
      if (t > 4.42 && tau < 1.5) {
        const pr = NX.cam.project(RING[0], RING[1], ZL, c), g = E.inQuad(seg(t, 4.42, HIT));
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
      // Sortie : la lumière du cœur grandit, culmine à 7,13 pendant que la silhouette se resserre en elle (pendant de
      // l'éclair de 4,8), puis se dissipe en s'élargissant ; éteinte à 7,18.
      const xg = E.sine(seg(t, 6.72, XPEAK)) * (1 - E.sine(seg(t, XPEAK, 7.18)));
      if (xg > 0.002) {
        const pr = NX.cam.project(RING[0], RING[1] + dy, ZL + dz, c);
        NX.lk.glow(pr.x, pr.y, (240 + 320 * E.sine(seg(t, 6.72, 7.18))) * pr.s, [200, 240, 255], 0.45 * xg);
      }
      if (this.stars && t > GLINT[0] && t < EXIT[0] + 0.3) for (const s of this.stars) {
        const g = s.g * (t < s.tc ? sm(s.tc - 0.07, s.tc, t) : Math.exp(-6 * (t - s.tc))) * fade;
        if (g > 0.004) { const pr = NX.cam.project(s.X, s.Y + dy, ZL + dz, c); NX.lk.star(pr.x, pr.y, g, { size: s.size }); }
      }
    },
  });
})();
