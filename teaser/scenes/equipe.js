/* S3 Rôles et S4 Équipe et fusion (bible v7 : §4 S3, §4 S4, §3.9).
 * 7,2–9,6 : cinq tuiles de verre naissent dans leur lumière, une par cloche, face caméra sur le temps.
 * 9,6–14,4 : « Toute ton équipe. », la ligne de lumière relie l'équipe, les tuiles se rassemblent en
 * pentagone puis se dissolvent en ~5 000 particules qui composent l'emblème : cinq deviennent un.
 * Interfaces : lumières d'attente dès 6,80 et tuile Top visible dès 6,95 (logo) ; « direction » possède le PNG
 * de l'emblème (14,28–14,42) et NX.hit(14,4) ; « ciel » possède l'onde de choc et la poussière.
 * Cette scène ne dessine jamais le PNG : elle possède les particules jusqu'à 14,75 et leurs braises jusqu'à 16,5
 * (post 1,7 s : seul le canvas des braises reste actif après 14,8, aucun élément DOM).
 * Fonction pure de t : échantillons, appariement et tirages sont bâtis une fois dans prepare(). */
(function () {
  const ROLES = [
    { label: 'Top', color: '#67E8F9', svg: '<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>' },
    { label: 'Jungle', color: '#818CF8', svg: '<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>' },
    { label: 'Mid', color: '#F3F7FF', svg: '<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>' },
    { label: 'ADC', color: '#A78BFA', svg: '<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>' },
    { label: 'Support', color: '#E879F9', svg: '<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>' },
  ];
  const FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G, ROW = G.roles, PENT = G.pent, E5 = G.E5, FV = G.FAV;
  const [CX, CY] = PENT.c;                               // centre de l'emblème S5 (960, 441,7)
  const RAD = Math.PI / 180, TAU = Math.PI * 2, D = NX.cam.D;
  const HALF = ROW.tile / 2;                             // 108 : demi-tuile
  const ICON = ROW.icon;                                 // 132 : icône
  const ZR = 1 * 0.5;                                    // décalage en z de la racine (z de scène × 0,5 px, moteur)
  const ZICON = 1 + 14;                                  // .gl-content translateZ(1px) + icône translateZ(14px)
  const ZRIM = 2;                                        // liseré translateZ(2px)
  const BELL = i => NX.T.roles + i * NX.BEAT;            // Tᵢ = 7,2 + 0,6 i
  const REL = [13.45, 13.40, 13.35, 13.40, 13.45];       // libération : Mid, puis Jungle et ADC, puis Top et Support
  const HEAD = [12.2, 11.5, 10.8, 11.5, 12.2];           // la tête de la ligne atteint le centre de la tuile
  const GATHER = [12.5, 13.55];                          // rassemblement en pentagone (SINE), échelle 1 → 0,62
  /* Rassemblement par axe, toujours SINE dans la fenêtre 12,50–13,55 (mêmes extrémités, même échelle) :
   * sur un trajet droit commun, Top et Support passaient sur Jungle et ADC (jusqu'à 62 px de recouvrement,
   * 12,93–13,13 : deux paires empilées au lieu de cinq tuiles qui glissent en cercle). Top et Support descendent
   * d'abord (y 12,50–13,10) puis glissent sous Jungle et ADC (x 12,55–13,55) ; Jungle et ADC rentrent d'abord vers
   * le centre (x 12,50–13,10) pour leur laisser la place. Aucun recouvrement (écart minimal ≈ 12 px entre plaques),
   * pointe 782 px/s mesurée sur les plaques (bible ≈ 787), bord bas 687 px monde (haut des capitales du titre ≈ 716).
   * Mid suit la courbe commune. */
  const GX = [[12.55, 13.55], [12.5, 13.1], GATHER, [12.5, 13.1], [12.55, 13.55]];
  const GY = [[12.5, 13.1], GATHER, GATHER, GATHER, [12.5, 13.1]];
  const E = NX.ease, seg = NX.seg, sm = NX.smooth, clamp = NX.clamp;
  const SINE = E.sine, GLIDE = E.glide, ENTER = E.enter, IOC = E.inOutCubic;
  const SPRING = p => E.spring(p, 1.0, 6.2);
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const RGB = ROLES.map(r => hex(r.color));
  const X0 = ROLES.map((r, i) => ROW.x(i));
  // Sommets du pentagone (repère écran, y vers le bas) et départ du rassemblement après l'anticipation (6 px vers C).
  const PX = PENT.deg.map(a => CX + PENT.r * Math.cos(a * RAD)), PY = PENT.deg.map(a => CY + PENT.r * Math.sin(a * RAD));
  const DIR = X0.map(x => { const dx = CX - x, dy = CY - ROW.y, l = Math.hypot(dx, dy); return [dx / l, dy / l]; });
  const SX = X0.map((x, i) => x + 6 * DIR[i][0]), SY = X0.map((x, i) => ROW.y + 6 * DIR[i][1]);
  const LEAN = X0.map(x => Math.sign(CX - x));          // penche vers C : +1 à gauche, −1 à droite, 0 pour Mid

  NX.css(`
  .eq-tile{transform-origin:50% 100%}
  .eq-ic{position:absolute;left:${HALF - ICON / 2}px;top:${HALF - ICON / 2}px;width:${ICON}px;height:${ICON}px;transform:translateZ(14px)}
  .eq-hot{padding:1.5px;opacity:0;transform:translateZ(2.5px);mix-blend-mode:plus-lighter;background:linear-gradient(var(--rim,180deg),rgba(186,240,255,.75),rgba(129,140,248,.22) 30%,rgba(154,182,218,.10) 65%,rgba(232,121,249,.30));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
  .eq-lab{position:absolute;top:${ROW.labelTop}px;width:400px;text-align:center;font-weight:700;font-size:34px;line-height:1.2;text-transform:uppercase;color:var(--text2);white-space:nowrap;transform-origin:200px ${ROW.y + HALF - ROW.labelTop}px}
  `);

  /** Progression du rassemblement de la tuile i : x, y (par axe) et échelle s, chacune SINE. */
  const gather = (i, t) => ({ x: SINE(seg(t, GX[i][0], GX[i][1])), y: SINE(seg(t, GY[i][0], GY[i][1])), s: SINE(seg(t, GATHER[0], GATHER[1])) });

  /** Pose monde de la tuile i : centre de sa place (x, y), montée depuis la profondeur (dy, z), échelle s,
   *  rotateX th (lever sur ressort), inclinaison lean (anticipation), en degrés. */
  function pose(i, t) {
    const T = BELL(i);
    const m = GLIDE(seg(t, T - 0.30, T + 0.20));
    const u = seg(t, T - 0.225, T + 0.675);
    const amp = 4 * SINE(seg(t, 9.6, 10.0)) * (1 - SINE(seg(t, 11.9, 12.3)));
    const br = amp > 0 ? amp * Math.sin(TAU * (t - 9.6) / 2.4 - 0.6 * i) : 0;
    const an = SINE(seg(t, 12.3, 12.5));
    const g = gather(i, t);
    const sx = X0[i] + 6 * an * DIR[i][0], sy = ROW.y + br + 6 * an * DIR[i][1];
    return {
      x: sx + (PX[i] - sx) * g.x, y: sy + (PY[i] - sy) * g.y,
      dy: 18 * (1 - m), z: -120 * (1 - m), s: 1 - (1 - PENT.scale) * g.s,
      th: u >= 1 ? 0 : 55 * (1 - SPRING(u)), an,
      lean: 4 * an * LEAN[i] * (1 - SINE(seg(t, 12.8, 13.3))),
    };
  }
  /** Centre réel de la tuile (avec lever et inclinaison), point monde. Pivot = bas-centre de la tuile. */
  function centre(P) {
    const c = Math.cos(P.th * RAD), l = P.lean * RAD;
    const py = P.y + P.dy + HALF * P.s;                  // pivot
    return [P.x + HALF * P.s * c * Math.sin(l), py - HALF * P.s * c * Math.cos(l), P.z - HALF * Math.sin(P.th * RAD)];
  }
  /** Faisceau de cloche à extrémité douce : NX.lk.beam tracé sur la toile annexe, puis fondu sur sa fin
   *  (le bout plat dépassait à côté des tuiles extérieures, faisceau oblique), puis ajouté en lumière. */
  function eqBeam(dst, o, x0, y0, x1, y1, w0, w1, a, rgb, fade) {
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len, h0 = w0 / 2, h1 = w1 / 2;
    const xs = [x0 + nx * h0, x0 - nx * h0, x1 + nx * h1, x1 - nx * h1], ys = [y0 + ny * h0, y0 - ny * h0, y1 + ny * h1, y1 - ny * h1];
    const bx = Math.max(0, Math.floor(Math.min(...xs)) - 2), by = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const bw = Math.min(NX.W, Math.ceil(Math.max(...xs)) + 2) - bx, bh = Math.min(NX.H, Math.ceil(Math.max(...ys)) + 2) - by;
    if (bw <= 0 || bh <= 0) return;
    o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.clearRect(bx, by, bw, bh);
    NX.lk.beam(x0, y0, x1, y1, w0, w1, 1, rgb, o);
    const g = o.createLinearGradient(x0, y0, x1, y1), f = clamp(1 - fade / len, 0, 1);
    g.addColorStop(0, '#000'); g.addColorStop(f, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.globalCompositeOperation = 'destination-in'; o.fillStyle = g; o.fillRect(bx, by, bw, bh);
    o.restore();
    dst.save(); dst.globalCompositeOperation = 'lighter'; dst.globalAlpha = clamp(a);
    dst.drawImage(o.canvas, bx, by, bw, bh, bx, by, bw, bh);
    dst.restore();
  }
  /** Flash de cloche : monte en inQuad sur 0,12 s jusqu'à Tᵢ, puis e^(−6τ). */
  const bellFlash = (i, t) => { const T = BELL(i); return t < T - 0.12 ? 0 : t < T ? E.inQuad(seg(t, T - 0.12, T)) : Math.exp(-6 * (t - T)); };

  /** Point du pourtour arrondi (rayon 16) de la tuile, au milieu du liseré ; f ∈ [0,1) → [lx, ly] en px de tuile. */
  function rimPoint(f) {
    const h = HALF - 0.75, rc = 15.25, L = 2 * (h - rc), A = Math.PI / 2 * rc;
    let d = f * 4 * (L + A), side = 0, x, y;
    while (d >= L + A && side < 3) { d -= L + A; side++; }
    if (d < L) { x = -h + rc + d; y = -h; } else { const a = (d - L) / rc; x = h - rc + rc * Math.sin(a); y = -h + rc - rc * Math.cos(a); }
    for (let k = 0; k < side; k++) [x, y] = [-y, x];   // quart de tour horaire (écran)
    return [x, y];
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  /** Traînée effilée dans le tampon NX.px : même énergie totale que NX.px.line (2×), répartie en v² de la queue
   *  (xa, ya) vers la tête (xb, yb) ; une traînée uniforme se lisait comme des poils, celle-ci comme une comète. */
  const TAILW = [null];                                  // table fixe, bâtie au chargement (pas de cache en rendu)
  for (let n = 1; n <= 96; n++) { const w = []; let s = 0; for (let k = 0; k < n; k++) { const v = (k + 1) / n; w.push(v * v); s += v * v; } TAILW.push(w.map(v => 2 * v / s)); }
  function eqTail(xa, ya, xb, yb, r, g, b) {
    const n = Math.min(96, Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya)))), w = TAILW[n];
    for (let k = 0; k < n; k++) { const u = k / n, f = w[k]; NX.px.dot(xa + (xb - xa) * u, ya + (yb - ya) * u, r * f, g * f, b * f); }
  }

  /* Couches de la ligne de lien : halo doux (0,22 au cœur, ≈ 0,13 au bord des 14 px, fondu jusqu'à 22 px)
   * au lieu d'une bande plate à bords durs, puis cœur 2,5 px à 0,85. */
  const LINK_LAYERS = [[22, 0.05], [14, 0.08], [8, 0.09], [2.5, 0.85]];
  const LINK_COL = RGB.map(([r, g, b]) => `rgb(${r},${g},${b})`);

  NX.scene({
    id: 'equipe', start: 6.7, end: 14.8, post: 1.7, z: 1,
    build(root) {
      this.fav = NX.image(FAV);                          // échantillonné seulement : jamais affiché ici
      this.tiles = ROLES.map((r, i) => {
        const g = NX.glass(`<svg class="eq-ic" viewBox="0 0 34 34" aria-hidden="true"><defs><linearGradient id="eq-ig${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="34"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".38" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color}" stop-opacity=".85"/></linearGradient></defs><g fill="url(#eq-ig${i})">${r.svg}</g></svg>`, { w: ROW.tile, h: ROW.tile, color: r.color + '30' });
        g.el.classList.add('eq-tile');
        g.el.style.left = `${X0[i] - HALF}px`; g.el.style.top = `${ROW.y - HALF}px`;
        const hot = NX.el('<div class="eq-hot"></div>', g.el);  // liseré additionnel : flashs au-delà de l'opacité 1
        root.appendChild(g.el);
        const lab = NX.el(`<div class="eq-lab" style="left:${X0[i] - 200}px">${r.label}</div>`, root);
        return { g, hot, icon: g.content.querySelector('.eq-ic'), lab };
      });
      this.title = NX.el(`<div class="tz-center" style="top:700px"><div class="tz-title"><span class="tz-line">Toute ton <span class="nx-spec">équipe.</span></span></div></div>`, root);
      this.words = NX.type.prepare(this.title).words;
      this.spec = this.title.querySelector('.nx-spec');
      // Toile annexe de la ligne de lien (tracé opaque, puis ajout en lumière).
      const oc = document.createElement('canvas'); oc.width = NX.W; oc.height = NX.H;
      this.oc = oc.getContext('2d');
      this.P = [];
    },

    /* Fusion (§3.9) : cibles dans l'emblème S5, secteurs par rôle, sources dans l'icône et le liseré, appariement
     * par angle autour de C. Tout dépend des images et de graines fixes. */
    prepare() {
      const img = this.fav;
      if (!img.naturalWidth) { console.warn('equipe : emblème non décodé'); return; }
      const tg = NX.sample(img, 5000, 4242, 256, 0.28).map(p => {
        const x = E5.left + p.u * E5.size, y = E5.top + p.v * E5.size;
        const fr = Math.hypot(p.u * FV.W - FV.ringC[0], p.v * FV.W - FV.ringC[1]);
        return { x, y, rgb: p.rgb, re: Math.hypot(x - CX, y - CY), pe: Math.atan2(y - CY, x - CX), ring: fr >= 140 && fr <= 190 };
      });
      const R = NX.rng(901), P = [];
      ROLES.forEach((r, k) => {
        const c = (PENT.deg[k] + 20) * RAD, rel = a => wrap(a - c);
        const mine = tg.filter(e => { const d = rel(e.pe); return d >= -36 * RAD && d < 36 * RAD; })
          .sort((a, b) => rel(a.pe) - rel(b.pe));
        const n = mine.length, nIcon = Math.round(n * 0.85), src = [];
        for (const p of NX.sampleSvg(r.svg, nIcon, 100 + k)) src.push({ lx: (p.u - 0.5) * ICON, ly: (p.v - 0.5) * ICON, lz: ZICON });
        const rr = NX.rng(300 + k);
        while (src.length < n) { const [lx, ly] = rimPoint(rr()); src.push({ lx, ly, lz: ZRIM }); }
        for (const v of src) v.a = rel(Math.atan2(PY[k] + PENT.scale * v.ly - CY, PX[k] + PENT.scale * v.lx - CX));
        src.sort((a, b) => a.a - b.a);
        mine.forEach((e, j) => {
          const v = src[j], h = R(), h2 = R(), zA = -60 + 220 * R(), ph = R() * TAU, bv = 100 + 300 * R(), ember = R() < 0.08;
          const dl = Math.hypot(e.x - CX, e.y - CY) || 1;
          P.push({ k, lx: v.lx, ly: v.ly, lz: v.lz, tx: e.x, ty: e.y, re: e.re, pe: e.pe, ux: (e.x - CX) / dl, uy: (e.y - CY) / dl,
            te: REL[k] + 0.08 * h, ta: e.ring ? 14.00 + 0.06 * h2 : 14.08 + 0.10 * h2, ring: e.ring, zA, ph, bv, ember,
            r0: RGB[k][0], g0: RGB[k][1], b0: RGB[k][2], r1: e.rgb[0], g1: e.rgb[1], b1: e.rgb[2] });
        });
      });
      this.P = P;
      // Garde-fou de vitesse (§2.6) : vitesse écran de pointe de chaque vol, mesurée avec la vraie caméra sur une grille
      // fixe de 1/240 s. Les rares particules (liseré, fenêtre courte) au-delà de 1 150 px/s reçoivent la fenêtre la plus
      // longue permise par la bible (te = rel, ta au plus tard) : même trajet, pointe ≈ −25 %.
      const dt = 1 / 240, cams = [];
      for (let t = 13.35; t <= 14.19; t += dt) cams.push([t, NX.cam.at(t)]);
      const peak = q => {
        let mx = 0, px = null, py = 0;
        for (const [t, c] of cams) {
          if (t < q.te || t > q.ta) { px = null; continue; }
          const w = this.world(q, t), pr = NX.cam.project(w[0], w[1], w[2] + ZR, c);
          if (px !== null) mx = Math.max(mx, Math.hypot(pr.x - px, pr.y - py) / dt);
          px = pr.x; py = pr.y;
        }
        return mx;
      };
      for (const q of P) if (peak(q) > 1150) { q.te = REL[q.k]; q.ta = q.ring ? 14.06 : 14.18; }
    },

    /** Position monde [x, y, z] d'une particule au temps t, ou null si elle n'existe pas (aussi pour la sonde de vitesse). */
    world(q, t) {
      if (t < q.te) return null;
      if (t >= NX.T.emblem) {                             // éclatement depuis la cible, braises qui montent
        const tau = t - NX.T.emblem, f = (1 - Math.exp(-3 * tau)) / 3;
        return [q.tx + q.ux * q.bv * f, q.ty + q.uy * q.bv * f - (q.ember ? 50 * tau : 0), 0];
      }
      if (t >= q.ta) return [q.tx, q.ty, 0];
      // Vol : la source suit sa tuile jusqu'à la fin du rassemblement (pas d'écart entre l'icône qui s'efface et ses particules).
      const k = q.k, g = gather(k, Math.min(t, GATHER[1])), s = 1 - (1 - PENT.scale) * g.s;
      const sx = SX[k] + (PX[k] - SX[k]) * g.x + s * q.lx - CX, sy = SY[k] + (PY[k] - SY[k]) * g.y + s * q.ly - CY;
      const rs = Math.hypot(sx, sy), ps = Math.atan2(sy, sx), dp = Math.atan2(Math.sin(q.pe - ps), Math.cos(q.pe - ps));
      const u = (t - q.te) / (q.ta - q.te), er = IOC(u), ea = SINE(u);
      const r = rs + (q.re - rs) * er, a = ps + dp * ea;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a), q.lz * (1 - er) + q.zA * Math.sin(Math.PI * u)];
    },

    render(S) {
      const t = S.t, c = NX.camState, bctx = NX.fxBack.ctx, fctx = NX.fx.ctx;
      const pj = (X, Y, Z = 0) => NX.cam.project(X, Y, Z + ZR, c);
      const dom = t < 14.8;

      /* ---------------- S3 : lumière de scène, lumières d'attente, faisceaux de cloche ---------------- */
      if (t < 13.4) {
        const on = sm(6.80, 7.10, t) * (1 - sm(12.5, 13.4, t));   // « on » de la bible avec d = 0 (centre de la rangée)
        if (on > 0.002) {
          const q = pj(960, ROW.y);
          bctx.save(); bctx.translate(q.x, q.y); bctx.scale(1, 0.36);
          NX.lk.glow(0, 0, 1050 * q.s, [120, 170, 255], 0.14 * on, bctx);
          bctx.restore();
        }
      }
      const src = NX.light.src(t), yaw = c.yaw;
      const CEN = [];                                    // centres réels des tuiles (monde), pour la ligne de lien
      this.tiles.forEach((T, i) => {
        const P = pose(i, t), Ti = BELL(i), cen = centre(P);
        CEN.push(cen);
        const flash = bellFlash(i, t);
        // Lumière d'attente : orbe douce sur la place, suit le rassemblement, s'éteint 13,45–13,75.
        const d = Math.abs(i - 2), onL = sm(6.80 + 0.08 * d, 7.10 + 0.08 * d, t) * (1 - sm(13.45, 13.75, t));
        if (onL > 0.002) {
          const q = pj(P.x, P.y);
          NX.lk.glow(q.x, q.y, 210 * q.s, RGB[i], (0.22 + 0.24 * flash) * (1 + 0.4 * P.an) * onL, bctx);
        }
        // Faisceau de cloche : de la source au centre de la tuile + 60·s, derrière la tuile ; fin fondue sous la tuile.
        if (flash > 0.006) {
          const q = pj(cen[0], cen[1], cen[2]);
          eqBeam(bctx, this.oc, src.x, src.y, q.x, q.y + 60 * q.s, 8, 300 * q.s, 0.45 * flash, RGB[i].map(v => (v + 255) >> 1), 170 * q.s);
        }
        // Tuile de verre.
        const a = dom ? sm(Ti - 0.25, Ti - 0.05, t) * (1 - sm(REL[i], REL[i] + 0.20, t)) : 0;
        const el = T.g.el;
        if (a <= 0) { el.style.display = 'none'; T.lab.style.display = 'none'; return; }
        el.style.display = '';
        const X = P.x - X0[i], Y = P.y + P.dy - ROW.y - HALF * (1 - P.s);
        const tf = `translate3d(${X.toFixed(2)}px,${Y.toFixed(2)}px,${P.z.toFixed(2)}px) scale(${P.s.toFixed(4)})`;
        el.style.transform = `${tf} rotateZ(${P.lean.toFixed(3)}deg) rotateX(${P.th.toFixed(3)}deg)`;
        NX.glassFade(T.g, a);
        T.g.content.style.opacity = '';                  // .gl-content est preserve-3d : on fond la feuille icône, jamais le conteneur
        T.icon.style.opacity = a;
        const link = t >= HEAD[i] ? 0.8 * Math.exp(-6 * (t - HEAD[i])) : 0, kick = 0.5 * NX.beatPulse(t, [13.2], 6);
        NX.glassLight(T.g, { pos: -0.43 * yaw, lit: 1, rimAngle: 180 + 6 * yaw, rimGain: 1, glow: (0.6 + 0.4 * flash) * (1 + 0.4 * P.an) });
        T.hot.style.setProperty('--rim', `${(180 + 6 * yaw).toFixed(1)}deg`);
        T.hot.style.opacity = clamp(0.6 * flash + link + kick) * a;
        // Étiquette : suit la tuile (même pivot, translation et échelle) mais reste horizontale pendant l'inclinaison ;
        // interlettrage .6 → .2em.
        const le = ENTER(seg(t, Ti + 0.12, Ti + 0.70)), lo = le * (1 - sm(12.55, 12.80, t));
        if (lo <= 0.001) { T.lab.style.display = 'none'; return; }
        T.lab.style.display = '';
        const ls = `${NX.lerp(0.6, 0.2, le).toFixed(4)}em`;
        T.lab.style.letterSpacing = ls; T.lab.style.textIndent = ls;
        T.lab.style.opacity = lo;
        T.lab.style.transform = tf;
      });

      /* ---------------- S4 : ligne de lien (fxback, derrière les tuiles) ---------------- */
      const draw = SINE(seg(t, 10.8, 12.2)), relax = SINE(seg(t, 13.5, 14.0));
      const la = sm(10.8, 10.95, t) * (1 - sm(14.0, 14.2, t)) * (1 + 0.3 * NX.beatPulse(t, [13.2], 6));
      if (la > 0.002 && draw > 0) this.link(bctx, pj, CEN, draw, relax, la);

      /* ---------------- Titre « Toute ton équipe. » ---------------- */
      if (t >= 9.6 && t < 14.35) {
        this.title.style.display = '';
        NX.type.rise(this.words, t, 9.70, 0.14, 0.8);
        NX.type.sink(this.words, t, 13.90, 0.05, 0.30);
        NX.type.sheen(this.spec, t, 10.5, 11.3, 0.35);
      } else this.title.style.display = 'none';

      /* ---------------- Fusion : particules (fx, devant le DOM) ---------------- */
      if (t >= 13.35 && t < 16.5 && this.P.length) this.particles(t, c, fctx);

      /* ---------------- Cœur de la fusion (fx) ---------------- */
      if (t >= 13.8 && t < NX.T.emblem) {
        const g = E.inQuad(seg(t, 13.8, 14.4)), q = pj(CX, CY);
        NX.lk.glow(q.x, q.y, (40 + 130 * g) * q.s, [200, 245, 255], (0.12 + 0.33 * g) * sm(13.8, 13.9, t), fctx);
      }
    },

    /** Ligne de lumière : polyligne par les centres des tuiles dans l'ordre des rôles, tracée depuis Mid vers
     *  l'extérieur, puis détendue en arc centré sur C (rayon 200 → 158,1, angles 148° → 392°, ouvert en bas).
     *  Chaque tronçon a son dégradé entre deux couleurs de rôle ; tracée opaque sur une toile annexe
     *  (aucune surbrillance aux jointures), puis ajoutée en lumière couche par couche. */
    link(bctx, pj, CEN, draw, relax, la) {
      const rArc = 200 + (158.1 - 200) * relax;
      const at = u => {
        const j = Math.min(3, Math.floor(u * 4)), f = u * 4 - j, A = CEN[j], B = CEN[j + 1];
        let x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f, z = A[2] + (B[2] - A[2]) * f;
        if (relax > 0) { const ang = (148 + 244 * u) * RAD; x += (CX + rArc * Math.cos(ang) - x) * relax; y += (CY + rArc * Math.sin(ang) - y) * relax; z -= z * relax; }
        return pj(x, y, z);
      };
      const ua = 0.5 - draw / 2, ub = 0.5 + draw / 2, segs = [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let j = 0; j < 4; j++) {
        const lo = Math.max(j / 4, ua), hi = Math.min((j + 1) / 4, ub);
        if (hi <= lo) continue;
        const n = relax > 0 ? Math.max(2, Math.ceil(24 * (hi - lo) * 4)) : 1, pts = [];
        for (let k = 0; k <= n; k++) { const q = at(lo + (hi - lo) * k / n); pts.push(q); if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
        segs.push({ pts, g0: at(j / 4), g1: at((j + 1) / 4 - 1e-6), c0: LINK_COL[j], c1: LINK_COL[j + 1] });
      }
      if (!segs.length) return;
      const m = 12, bx = Math.max(0, Math.floor(x0 - m)), by = Math.max(0, Math.floor(y0 - m));
      const bw = Math.min(NX.W, Math.ceil(x1 + m)) - bx, bh = Math.min(NX.H, Math.ceil(y1 + m)) - by;
      if (bw <= 0 || bh <= 0) return;
      const o = this.oc;
      o.lineCap = 'round'; o.lineJoin = 'round';
      for (const [w, a] of LINK_LAYERS) {
        o.clearRect(bx, by, bw, bh);
        o.lineWidth = w;
        for (const s of segs) {
          const gr = o.createLinearGradient(s.g0.x, s.g0.y, s.g1.x, s.g1.y);
          gr.addColorStop(0, s.c0); gr.addColorStop(1, s.c1);
          o.strokeStyle = gr; o.beginPath();
          s.pts.forEach((q, k) => (k ? o.lineTo(q.x, q.y) : o.moveTo(q.x, q.y)));
          o.stroke();
        }
        bctx.save(); bctx.globalCompositeOperation = 'lighter'; bctx.globalAlpha = clamp(a * la);
        bctx.drawImage(o.canvas, bx, by, bw, bh, bx, by, bw, bh);
        bctx.restore();
      }
    },

    /** Vol des particules (§3.9), émail pointilliste, éclatement à 14,4 et braises. Tampon additif NX.px. */
    particles(t, c, ctx) {
      const cyw = Math.cos(c.yaw * RAD), syw = Math.sin(c.yaw * RAD), cp = Math.cos(c.pitch * RAD), sp = Math.sin(c.pitch * RAD);
      const cr = Math.cos(c.roll * RAD), sr = Math.sin(c.roll * RAD);
      let qx = 0, qy = 0;
      const proj = (X, Y, Z) => {                        // mêmes calculs que NX.cam.project, sans allocation
        const x = X - 960 - c.x, y = Y - 540 - c.y, z = Z + ZR + c.z - D;
        const x2 = x * cyw + z * syw, z2 = -x * syw + z * cyw, y2 = y * cp - z2 * sp, z3 = y * sp + z2 * cp;
        const s = D / Math.max(1, -z3);
        qx = 960 + (x2 * cr - y2 * sr) * s; qy = 540 + (x2 * sr + y2 * cr) * s;
      };
      const H = NX.T.emblem, tau = t - H, lit = 1 + 0.35 * sm(14.12, 14.36, t);
      const burstOut = 1 - sm(14.6, 14.75, t), emberOut = 1 - sm(15.9, 16.5, t);
      const fb = tau >= 0 ? (1 - Math.exp(-3 * tau)) / 3 : 0;   // déplacement d'éclatement (px) par px/s de vitesse initiale
      NX.px.begin();
      for (const q of this.P) {
        if (t < q.te) continue;
        let a, m = 1, tail = false, locked = false;
        if (tau >= 0) {
          // Éclatement : chaque point ne s'allume qu'en quittant son trait (déplacement d = bv·(1 − e^(−3τ))/3, 1,5 → 6 px).
          // Sur l'image de l'impact le PNG de « direction » est seul, complet et net ; l'éclatement naît des traits.
          a = (q.ember ? Math.exp(-1.2 * tau) * emberOut : 1.4 * Math.exp(-6 * tau) * burstOut) * sm(1.5, 6, q.bv * fb);
        } else if (t >= q.ta) {
          // Verrouillage : la traînée du vol (2 des 3,67 unités d'énergie du point) ne disparaît plus d'un coup ; elle est
          // rendue au point et s'éteint en e^(−4τ), sous l'étincelle de la bible (0,8·e^(−12τ)) : l'émail pointilliste
          // garde son éclat jusqu'à la montée ×1,35 au lieu de s'assombrir pendant la montée vers l'impact.
          const dl = t - q.ta;
          a = (0.85 + 0.15 * Math.sin(q.ph + 14 * t)) * lit + 0.8 * Math.exp(-12 * dl) + 1.3 * Math.exp(-4 * dl);
          locked = true;
        } else {
          const u = (t - q.te) / (q.ta - q.te);
          a = sm(q.te, q.te + 0.08, t); m = sm(0.7, 1, u); tail = u > 0.02;
        }
        if (a < 0.01) continue;
        const w = this.world(q, t);
        proj(w[0], w[1], w[2]);
        const X = qx, Y = qy, k = a * 1.3 / 255;
        const r = q.r0 + (q.r1 - q.r0) * m, g = q.g0 + (q.g1 - q.g0) * m, b = q.b0 + (q.b1 - q.b0) * m;
        const R = r * k, Gc = g * k, B = b * k;
        // Cœur surexposé (points verrouillés) : NX.px écrête chaque pixel en gardant la teinte, donc l'énergie au-delà de
        // la saturation (étincelle, énergie rendue de la traînée, montée ×1,35) serait perdue. L'excès (au plus 1,5) devient
        // un cœur blanc d'un pixel au centre du point, comme une lumière surexposée ; la frange garde la couleur du PNG.
        const ex = locked ? a * 1.3 * Math.max(r, g, b) / 255 : 0;
        const hot = ex > 1 ? Math.min(1.5, ex - 1) : 0;
        if (tail) {                                      // traînée depuis u − 0,02, effilée vers la queue (comète, pas un trait)
          const w0 = this.world(q, t - 0.02 * (q.ta - q.te));
          proj(w0[0], w0[1], w0[2]);
          eqTail(qx, qy, X, Y, R, Gc, B);
        }
        NX.px.blob(X, Y, 1.3, R, Gc, B);                 // énergie k = 1,3/255 · alpha, telle quelle (bible §3.9)
        if (hot > 0) NX.px.dot(X, Y, hot, hot, hot);
      }
      NX.px.end(ctx);
    },
  });
})();
