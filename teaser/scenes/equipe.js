/* S3′ Rôles, une transition (bible v7.1, amendement « S3′ » ; fusion §3.9), 7,2–9,6 s.
 * Le logo s'est résorbé dans le cœur de son anneau (au plus tard 7,15, logo.js) et le ciel a pris sa lumière. Les cinq
 * rôles en naissent, un par croche (NX.beats.bells : Top 7,2, Jungle 7,5, Mid 7,8, ADC 8,1, Support 8,4), directement à
 * leur place sur le pentagone de l'emblème (NX.G.pent, échelle 0,62) : la petite tuile de verre de la v7, avec l'icône
 * et la couleur du rôle, se lève dans sa lumière et un faisceau de cloche descend de la source. Top naît d'abord en
 * lumière, sous le logo qui se résorbe, puis devient verre ; la lumière absorbée reste au centre du cercle (éclat du
 * cœur) et les places des rôles à venir attendent sous une orbe faible. Dès le cinquième rôle, la fusion : les cinq se
 * penchent vers le cœur, se dissolvent en particules de leur couleur qui rejoignent leur secteur de l'emblème (l'anneau
 * d'abord), un émail pointilliste se lit, et « direction » résout le PNG sur l'impact de 9,6 ; la lumière de scène passe
 * au halo de « direction » en fondu enchaîné. Cinq deviennent un. Ni titre, ni étiquettes, ni ligne de lien.
 * Interfaces : « direction » possède le PNG de l'emblème (fondu 9,48–9,62) et NX.hit(9,6) ; « ciel » possède l'onde
 * de choc, la poussière et le relais de lumière 7,11–7,8. Cette scène ne dessine jamais le PNG : elle possède ses
 * particules (éclatement jusqu'à 9,95, braises jusqu'à 11,7 comme l'écart accepté de la v7 ; aucun élément DOM
 * après 8,9).
 * Fonction pure de t : échantillons, appariement, sources et tirages sont bâtis une fois dans prepare(). */
(function () {
  const ROLES = [
    { label: 'Top', color: '#67E8F9', svg: '<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>' },
    { label: 'Jungle', color: '#818CF8', svg: '<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>' },
    { label: 'Mid', color: '#F3F7FF', svg: '<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>' },
    { label: 'ADC', color: '#A78BFA', svg: '<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>' },
    { label: 'Support', color: '#E879F9', svg: '<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>' },
  ];
  const FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G, PENT = G.pent, E5 = G.E5, FV = G.FAV;
  const [CX, CY] = PENT.c;                               // centre de l'emblème S5 (960, 441,7)
  const RAD = Math.PI / 180, TAU = Math.PI * 2, D = NX.cam.D;
  const SIZE = G.roles.tile, HALF = SIZE / 2;            // tuile de verre de la v7 (216 px), posée à l'échelle 0,62
  const SC = PENT.scale;                                 // 0,62 : 134 px dans le monde
  const ICON = G.roles.icon;                             // 132 : icône (82 px à l'échelle du pentagone)
  const ZR = 1 * 0.5;                                    // décalage en z de la racine (z de scène × 0,5 px, moteur)
  const ZICON = 1 + 14;                                  // .gl-content translateZ(1px) + icône translateZ(14px)
  const ZRIM = 2;                                        // liseré translateZ(2px)

  /* Frise (amendement v7.1). Tout est relatif à NX.T : rôles, fusion et impact. */
  const at = (a, d) => Math.round((a + d) * 1e6) / 1e6;  // instant relatif à un repère de NX.T, sans résidu flottant
  const ROLES0 = NX.T.roles;                             // 7,2 : premier rôle (Top), sur la première croche
  const HIT = NX.T.emblem;                               // 9,6 : naissance de l'emblème (PNG de « direction »)
  const FUSE = NX.T.fuse;                                // 8,4 : cinquième rôle posé, la fusion commence
  const BELL = NX.beats.bells.slice(0, 5);               // 7,2 / 7,5 / 7,8 / 8,1 / 8,4 : un rôle par croche
  // Relais avec « logo » (S2, logo.js) : le logo blanchi se résorbe dans le cœur de son anneau (ABSORB, masque radial
  // qui se resserre, fini à 7,15 ; lumière du cœur au plus haut à 7,13 ; toutes ses feuilles à 0 à 7,15). La place de
  // Top est sous l'ancien mot-symbole : ce masque ne la libère que vers 7,115 (ABSORB 7,04–7,15 en SINE ; 7,137 avec
  // l'ancienne courbe 7,085–7,15). Avant, rien de sombre (plaque, icône, ombre) ne s'y pose : Top naît d'abord en
  // lumière (liseré chaud additif et halo, 7,08–7,18), sa plaque et son icône viennent ensuite (SINE 7,14–7,32).
  // Si logo.js allonge son absorption au-delà de 7,15, TOP_GLASS doit rester après le passage du masque sur Top.
  const WIN0 = at(ROLES0, -0.20);                        // 7,0 : ouverture de la scène (rien n'est dessiné avant 7,04)
  const STAGE_IN = [at(ROLES0, -0.16), at(ROLES0, 0.06)];   // 7,04–7,26 : la lumière de scène monte sous l'absorption
  const TOP_LIGHT = [at(ROLES0, -0.12), at(ROLES0, -0.02)]; // 7,08–7,18 : Top en lumière (feuilles additives seules, SINE)
  const TOP_GLASS = [at(ROLES0, -0.06), at(ROLES0, 0.12)];  // 7,14–7,32 : plaque et icône de Top (SINE)
  const TOP_HOT = 0.9, TOP_HALO = 0.8;                   // liseré chaud et halo de verre de Top pendant sa naissance
  // Éclat du cœur : la lumière absorbée se rassemble au centre C pendant que le logo se résorbe, y reste et passe la
  // main au faisceau de Top (+0,25, SINE 7,06–7,14, au pic de la lumière du cœur du logo, puis e^(−6τ)). Avec
  // l'absorption visible de logo.js (7,04–7,15), un éclat plus tardif (7,10–7,17) laissait l'image 7,133 creuse puis
  // remontait de 2,3 de luminance en une image.
  const FLARE = [at(ROLES0, -0.14), at(ROLES0, -0.06)], FLARE_A = 0.25;
  // Places en attente (la grammaire v7 « cinq lumières marquent les places ») : une fois le logo parti, une orbe faible
  // de la couleur de chaque rôle à venir (pic 0,09, soit 0,15 sous la lumière de sa tuile ; rayon 160·s ; 7,15–7,35),
  // qui se fond dans la lumière de sa tuile quand celle-ci s'allume (Tᵢ − 0,30).
  const WAIT = [at(ROLES0, -0.05), at(ROLES0, 0.15)], WAIT_A = 0.09, WAIT_R = 160;
  // L'équipe au complet : sur la cinquième cloche, les cinq s'allument ensemble (lumière +40 %, liseré +0,3) et se
  // rapprochent de 12 px du cœur (SINE, fini avant la première dissolution : les particules partent d'une tuile
  // immobile), puis se dissolvent dans l'ordre de leur naissance (0,04 s d'écart, + 0,08 s de dispersion par
  // particule) : le cercle se referme.
  const LEAN = [FUSE - 0.10, FUSE + 0.10], LEAN_PX = 12;
  const REL = BELL.map((b, i) => FUSE + 0.10 + 0.04 * i);   // 8,50 / 8,54 / 8,58 / 8,62 / 8,66
  // Apparition de la plaque de chaque tuile (bible §4 S3 : Tᵢ − 0,25 → Tᵢ − 0,05, smoothstep ; Top : TOP_GLASS, SINE)
  // et lumière de sa place (Tᵢ − 0,30 → Tᵢ − 0,05 ; Top 7,075 → 7,2, derrière le logo qui se résorbe).
  const APPEAR = BELL.map((T, i) => (i === 0 ? TOP_GLASS : [T - 0.25, T - 0.05]));
  const LIGHT_IN = BELL.map((T, i) => (i === 0 ? [at(ROLES0, -0.125), ROLES0] : [T - 0.30, T - 0.05]));
  // Verrouillage (mêmes écarts à l'impact que la v7) : anneau 9,20–9,26, le reste 9,28–9,38 ; émail pointilliste
  // 9,32–9,56 ; cœur de la fusion 9,0–9,6 ; éclatement 9,60–9,95 ; braises éteintes 11,1–11,7.
  const LOCK_RING = HIT - 0.40, LOCK_REST = HIT - 0.32;
  const POINT = [HIT - 0.28, HIT - 0.04], CORE = [HIT - 0.6, HIT];
  const BURST_OUT = [HIT + 0.2, HIT + 0.35], EMBER_OUT = [HIT + 1.5, HIT + 2.1];
  // Lumière de scène : bassin (ellipse douce autour du pentagone) et cœur (au centre C), de la résorption du logo
  // jusqu'au halo de « direction » (SINE 9,62–10,2). Le cœur s'éteint sous l'émail (9,52–9,92) : rien de plus sous le
  // PNG net ; le bassin s'éteint en fondu enchaîné avec ce halo (SINE 9,52–10,2) : l'impact passe la lumière au lieu
  // de retomber dans un creux.
  const HEART_OUT = [HIT - 0.08, HIT + 0.32], POOL_OUT = [HIT - 0.08, HIT + 0.60];
  const POOL_R = 980, POOL_SY = 0.62, POOL_A = 0.15, POOL_RGB = [120, 170, 255];
  const HEART_R = 340, HEART_A = 0.20, HEART_RGB = [175, 220, 255];

  const E = NX.ease, seg = NX.seg, sm = NX.smooth, clamp = NX.clamp;
  const SINE = E.sine, GLIDE = E.glide, IOC = E.inOutCubic;
  const SPRING = p => E.spring(p, 1.0, 6.2);
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const RGB = ROLES.map(r => hex(r.color));
  const BEAMRGB = RGB.map(c => c.map(v => (v + 255) >> 1));
  // Sommets du pentagone (repère écran, y vers le bas : Mid en haut, Top en bas à gauche, Support en bas à droite)
  // et direction de chaque place vers le cœur C.
  const PX = PENT.deg.map(a => CX + PENT.r * Math.cos(a * RAD)), PY = PENT.deg.map(a => CY + PENT.r * Math.sin(a * RAD));
  const DIR = PX.map((x, i) => { const dx = CX - x, dy = CY - PY[i], l = Math.hypot(dx, dy); return [dx / l, dy / l]; });

  NX.css(`
  .eq-tile{transform-origin:50% 100%}
  .eq-ic{position:absolute;left:${HALF - ICON / 2}px;top:${HALF - ICON / 2}px;width:${ICON}px;height:${ICON}px;transform:translateZ(14px)}
  .eq-hot{padding:1.5px;opacity:0;transform:translateZ(2.5px);mix-blend-mode:plus-lighter;background:linear-gradient(var(--rim,180deg),rgba(186,240,255,.75),rgba(129,140,248,.22) 30%,rgba(154,182,218,.10) 65%,rgba(232,121,249,.30));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
  `);

  /** Pose monde de la tuile i : centre de sa place (x, y), montée depuis la profondeur (dy, z), échelle s,
   *  rotateX th (lever sur ressort, face caméra exactement sur sa cloche), rapprochement an ∈ [0, 1]. */
  function pose(i, t) {
    const T = BELL[i];
    const m = GLIDE(seg(t, T - 0.30, T + 0.20));
    const u = seg(t, T - 0.225, T + 0.675);
    const an = SINE(seg(t, LEAN[0], LEAN[1]));
    return {
      x: PX[i] + LEAN_PX * an * DIR[i][0], y: PY[i] + LEAN_PX * an * DIR[i][1],
      dy: 18 * SC * (1 - m), z: -120 * (1 - m), s: SC,
      th: u >= 1 ? 0 : 55 * (1 - SPRING(u)), an,
    };
  }
  /** Point local (lx, ly, lz) de la tuile (px de la tuile de 216, origine au centre) → point monde, pour la pose P.
   *  Même calcul que le CSS : translate3d · rotateX · scale autour du pivot bas-centre (scale n'agit pas sur z). */
  function tilePoint(P, lx, ly, lz) {
    const c = Math.cos(P.th * RAD), sn = Math.sin(P.th * RAD), yy = P.s * (ly - HALF);
    return [P.x + P.s * lx, P.y + P.dy + HALF * P.s + yy * c - lz * sn, P.z + yy * sn + lz * c];
  }
  /** Faisceau de cloche à extrémité douce : NX.lk.beam tracé sur la toile annexe, puis fondu sur sa fin
   *  (le bout plat dépassait à côté des tuiles, faisceau oblique), puis ajouté en lumière. */
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
  const bellFlash = (i, t) => { const T = BELL[i]; return t < T - 0.12 ? 0 : t < T ? E.inQuad(seg(t, T - 0.12, T)) : Math.exp(-6 * (t - T)); };
  /** Orbe d'attente : disque de lumière additif au profil en cloche a·(1 − u²)², u = d/r (plateau doux, aucun bord ;
   *  à pic égal, deux fois plus de lumière à mi-rayon que NX.lk.glow, si bien qu'elle se lit encore sur un téléphone). */
  const ORB_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1].map(u => [u, (1 - u * u) ** 2]);
  function eqOrb(ctx, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 0.5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [u, k] of ORB_STOPS) g.addColorStop(u, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * k).toFixed(4)})`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }

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

  NX.scene({
    id: 'equipe', start: WIN0, end: HIT, post: EMBER_OUT[1] - HIT, z: 1,
    build(root) {
      this.fav = NX.image(FAV);                          // échantillonné seulement : jamais affiché ici
      this.tiles = ROLES.map((r, i) => {
        const g = NX.glass(`<svg class="eq-ic" viewBox="0 0 34 34" aria-hidden="true"><defs><linearGradient id="eq-ig${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="34"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".38" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color}" stop-opacity=".85"/></linearGradient></defs><g fill="url(#eq-ig${i})">${r.svg}</g></svg>`, { w: SIZE, h: SIZE, color: r.color + '30' });
        g.el.classList.add('eq-tile');
        g.el.style.left = `${(PX[i] - HALF).toFixed(2)}px`; g.el.style.top = `${(PY[i] - HALF).toFixed(2)}px`;
        g.fog.style.display = 'none';                    // jamais de brouillard sur ces tuiles
        const hot = NX.el('<div class="eq-hot"></div>', g.el);  // liseré additionnel : flashs au-delà de l'opacité 1
        root.appendChild(g.el);
        return { g, hot, icon: g.content.querySelector('.eq-ic') };
      });
      // Toile annexe des faisceaux de cloche (tracé opaque, fondu, puis ajout en lumière).
      const oc = document.createElement('canvas'); oc.width = NX.W; oc.height = NX.H;
      this.oc = oc.getContext('2d');
      this.P = [];
    },

    /* Fusion (§3.9) : cibles dans l'emblème S5, secteurs par rôle, sources dans l'icône et le liseré, appariement
     * par angle autour de C. Les tuiles ne bougent plus pendant les vols : la source de chaque particule est le point
     * de sa tuile à l'instant où elle s'en détache (pose exacte, lever et rapprochement compris), calculée ici une fois.
     * Tout dépend des images, de la frise et de graines fixes. */
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
        for (const v of src) v.a = rel(Math.atan2(PY[k] + SC * v.ly - CY, PX[k] + SC * v.lx - CX));
        src.sort((a, b) => a.a - b.a);
        mine.forEach((e, j) => {
          const v = src[j], h = R(), h2 = R(), zA = -60 + 220 * R(), ph = R() * TAU, bv = 100 + 300 * R(), ember = R() < 0.08;
          const dl = Math.hypot(e.x - CX, e.y - CY) || 1;
          P.push({ k, lx: v.lx, ly: v.ly, lz: v.lz, tx: e.x, ty: e.y, re: e.re, pe: e.pe, ux: (e.x - CX) / dl, uy: (e.y - CY) / dl,
            te: REL[k] + 0.08 * h, ta: e.ring ? LOCK_RING + 0.06 * h2 : LOCK_REST + 0.10 * h2, ring: e.ring, zA, ph, bv, ember,
            r0: RGB[k][0], g0: RGB[k][1], b0: RGB[k][2], r1: e.rgb[0], g1: e.rgb[1], b1: e.rgb[2] });
        });
      });
      for (const q of P) this.source(q);
      this.P = P;
      // Garde-fou de vitesse (§2.6) : vitesse écran de pointe de chaque vol, mesurée avec la vraie caméra sur une grille
      // fixe de 1/240 s. Les rares particules au-delà de 1 150 px/s reçoivent la fenêtre la plus longue permise
      // (départ au plus tôt, verrouillage au plus tard) : même trajet, pointe plus basse.
      const dt = 1 / 240, cams = [], t0 = REL[0], t1 = LOCK_REST + 0.11;
      for (let i = 0, t = t0; t <= t1; i++, t = t0 + i * dt) cams.push([t, NX.cam.at(t)]);
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
      let slow = 0;
      for (const q of P) if (peak(q) > 1150) { q.te = REL[q.k]; q.ta = q.ring ? LOCK_RING + 0.06 : LOCK_REST + 0.10; this.source(q); slow++; }
      this.slowed = slow;
    },

    /** Source d'une particule : son point sur la tuile à l'instant te (coordonnées polaires autour de C, angle à
     *  parcourir jusqu'à la cible, profondeur de départ). */
    source(q) {
      const w = tilePoint(pose(q.k, q.te), q.lx, q.ly, q.lz), sx = w[0] - CX, sy = w[1] - CY;
      q.rs = Math.hypot(sx, sy); q.ps = Math.atan2(sy, sx); q.dp = wrap(q.pe - q.ps); q.sz = w[2];
    },

    /** Coins et centre (points monde) de la tuile i au temps t : pour les sondes de vitesse et d'alignement. */
    tileCorners(i, t) {
      const P = pose(i, t), h = HALF;
      return [[-h, -h], [h, -h], [h, h], [-h, h], [0, 0]].map(([lx, ly]) => tilePoint(P, lx, ly, 0));
    },

    /** Position monde [x, y, z] d'une particule au temps t, ou null si elle n'existe pas (aussi pour la sonde de vitesse). */
    world(q, t) {
      if (t < q.te) return null;
      if (t >= HIT) {                                    // éclatement depuis la cible, braises qui montent
        const tau = t - HIT, f = (1 - Math.exp(-3 * tau)) / 3;
        return [q.tx + q.ux * q.bv * f, q.ty + q.uy * q.bv * f - (q.ember ? 50 * tau : 0), 0];
      }
      if (t >= q.ta) return [q.tx, q.ty, 0];
      const u = (t - q.te) / (q.ta - q.te), er = IOC(u), ea = SINE(u);
      const r = q.rs + (q.re - q.rs) * er, a = q.ps + q.dp * ea;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a), q.sz * (1 - er) + q.zA * Math.sin(Math.PI * u)];
    },

    render(S) {
      const t = S.t, c = NX.camState, bctx = NX.fxBack.ctx, fctx = NX.fx.ctx;
      const pj = (X, Y, Z = 0) => NX.cam.project(X, Y, Z + ZR, c);

      /* ---------------- Lumière de scène (fxBack, derrière les tuiles) ----------------
       * Le cœur prend le relais de la lumière où le logo s'est résorbé (éclat 7,06–7,14) : les rôles naissent autour
       * de lui. Un bassin doux éclaire le cercle ; pendant la fusion, bassin et cœur se resserrent vers le centre, puis
       * rendent la main au halo et à l'impact de « direction » (9,6). */
      const onIn = sm(STAGE_IN[0], STAGE_IN[1], t);
      const onPool = onIn * (1 - SINE(seg(t, POOL_OUT[0], POOL_OUT[1])));
      const onHeart = onIn * (1 - sm(HEART_OUT[0], HEART_OUT[1], t));
      const flare = t < FLARE[0] ? 0 : FLARE_A * (t < FLARE[1] ? SINE(seg(t, FLARE[0], FLARE[1])) : Math.exp(-6 * (t - FLARE[1])));
      if (onPool > 0.002 || onHeart > 0.002 || flare > 0.002) {
        // Le cœur grandit avec l'équipe : chaque rôle qui arrive lui ajoute un peu de lumière (0,7 → 1).
        let team = 0; for (let i = 0; i < 5; i++) team += sm(APPEAR[i][0], APPEAR[i][1] + 0.15, t);
        const gq = SINE(seg(t, REL[0], HIT)), q = pj(CX, CY), heart = HEART_A * (0.7 + 0.06 * team);
        bctx.save(); bctx.translate(q.x, q.y); bctx.scale(1, POOL_SY);
        const pr = 1 - 0.25 * gq;                        // le bassin se resserre (rayon × 0,75) en gardant son énergie
        NX.lk.glow(0, 0, POOL_R * pr * q.s, POOL_RGB, POOL_A / (pr * pr) * onPool, bctx);
        bctx.restore();
        NX.lk.glow(q.x, q.y, (HEART_R - 60 * gq) * q.s, HEART_RGB, (heart + 0.10 * gq) * onHeart + flare, bctx);
      }

      /* ---------------- Tuiles, lumière de leur place, faisceaux de cloche ---------------- */
      const src = NX.light.src(t), yaw = c.yaw;
      this.tiles.forEach((T, i) => {
        const P = pose(i, t), flash = bellFlash(i, t);
        // Lumière de sa place : orbe douce qui s'allume avec sa tuile (Tᵢ − 0,30 → Tᵢ − 0,05 ; Top derrière le logo
        // qui se résorbe) et s'éteint pendant la dissolution. Les rôles à venir attendent déjà sous une orbe faible
        // (WAIT, 0,15 sous la lumière de leur tuile) qui grandit en elle : le pentagone s'annonce dès le départ du logo.
        const gL = sm(LIGHT_IN[i][0], LIGHT_IN[i][1], t), out = 1 - sm(REL[i], REL[i] + 0.35, t);
        const wait = i ? WAIT_A * sm(WAIT[0], WAIT[1], t) * (1 - gL) : 0, onL = (0.24 + 0.24 * flash) * (1 + 0.4 * P.an) * gL * out;
        if (wait > 0.002 || onL > 0.002) {
          const q = pj(P.x, P.y);
          eqOrb(bctx, q.x, q.y, WAIT_R * q.s, RGB[i], wait);
          NX.lk.glow(q.x, q.y, 200 * q.s, RGB[i], onL, bctx);
        }
        // Faisceau de cloche : de la source au centre de la tuile + 37·s, derrière la tuile ; fin fondue sous la tuile.
        if (flash > 0.006) {
          const w = tilePoint(P, 0, 0, 0), q = pj(w[0], w[1], w[2]);
          eqBeam(bctx, this.oc, src.x, src.y, q.x, q.y + 37 * q.s, 8, 186 * q.s, 0.45 * flash, BEAMRGB[i], 105 * q.s);
        }
        // Tuile de verre. Top naît d'abord en lumière : seules ses feuilles additives (liseré chaud, halo de verre) se
        // lèvent pendant que le logo se résorbe (TOP_LIGHT) ; sa plaque, son icône et son ombre viennent ensuite
        // (TOP_GLASS, SINE) et reprennent la main sur cette lumière à mesure qu'elles s'opacifient.
        const ap = i ? sm(APPEAR[i][0], APPEAR[i][1], t) : SINE(seg(t, TOP_GLASS[0], TOP_GLASS[1]));
        const a = ap * (1 - sm(REL[i], REL[i] + 0.20, t));
        const lt = i ? 0 : SINE(seg(t, TOP_LIGHT[0], TOP_LIGHT[1])) * (1 - ap);
        const el = T.g.el;
        if (a <= 0 && lt <= 0.002) { el.style.display = 'none'; return; }
        el.style.display = '';
        const X = P.x - PX[i], Y = P.y - PY[i] + P.dy - HALF * (1 - P.s);
        el.style.transform = `translate3d(${X.toFixed(2)}px,${Y.toFixed(2)}px,${P.z.toFixed(2)}px) rotateX(${P.th.toFixed(3)}deg) scale(${P.s.toFixed(4)})`;
        NX.glassFade(T.g, a);
        T.g.content.style.opacity = '';                  // .gl-content est preserve-3d : on fond la feuille icône, jamais le conteneur
        T.icon.style.opacity = a;
        const glow = (0.6 + 0.4 * flash) * (1 + 0.4 * P.an);
        NX.glassLight(T.g, { pos: -0.43 * yaw, lit: 1, rimAngle: 180 + 6 * yaw, rimGain: 1, glow });
        if (lt > 0) T.g.glow.style.opacity = clamp(glow * a + TOP_HALO * lt);
        if (!i) {                                        // Top en lumière : ses feuilles sombres, encore nulles, sont retirées
          const d = a > 0 ? '' : 'none';                 // (règle ENGINE : aucune feuille transparente affichée)
          for (const k of ['shadow', 'plate', 'content', 'sheen', 'rim']) T.g[k].style.display = d;
        }
        const hot = clamp((0.6 * flash + 0.3 * P.an) * a + TOP_HOT * lt);
        if (hot > 0.002) {
          T.hot.style.display = '';
          T.hot.style.setProperty('--rim', `${(180 + 6 * yaw).toFixed(1)}deg`);
          T.hot.style.opacity = hot.toFixed(4);
        } else T.hot.style.display = 'none';
      });

      /* ---------------- Fusion : particules (fx, devant le DOM) ---------------- */
      if (t >= REL[0] && t < EMBER_OUT[1] && this.P.length) this.particles(t, c, fctx);

      /* ---------------- Cœur de la fusion (fx) ---------------- */
      if (t >= CORE[0] && t < CORE[1]) {
        const g = E.inQuad(seg(t, CORE[0], CORE[1])), q = pj(CX, CY);
        NX.lk.glow(q.x, q.y, (40 + 130 * g) * q.s, [200, 245, 255], (0.12 + 0.33 * g) * sm(CORE[0], CORE[0] + 0.1, t), fctx);
      }
    },

    /** Vol des particules (§3.9), émail pointilliste, éclatement à 9,6 et braises. Tampon additif NX.px. */
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
      const tau = t - HIT, lit = 1 + 0.35 * sm(POINT[0], POINT[1], t);
      const burstOut = 1 - sm(BURST_OUT[0], BURST_OUT[1], t), emberOut = 1 - sm(EMBER_OUT[0], EMBER_OUT[1], t);
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
          // Verrouillage : la traînée du vol (2 des 3,67 unités d'énergie du point) ne disparaît pas d'un coup ; elle est
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
