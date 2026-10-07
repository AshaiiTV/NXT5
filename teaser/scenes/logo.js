/* S2 Logo (bible v7 §4 S2 ; amendement v7.2 « un seul moment du logo, 4,8–13,2 »), 4,0–7,18 s : le logo complet, le
 * même qu'en carte finale, n'entre que par la lumière. Dès 4,0 s une silhouette de lumière froide (feuille forge, sur
 * tout le logo) luit derrière la question ; le front elliptique NX.FRONT.hook l'écrit ensuite de la pointe de la lance
 * jusqu'à la devise (fondu 70 px), une bande blanche court sur le chrome au bord du front et libère 240 étincelles.
 * Pendant que la question brûle, la silhouette prend sa lumière (forge 0,30 → 0,42) et le halo fleurit avec l'emblème.
 * Impact sobre sur 4,8 s, halo qui respire, un seul reflet diagonal (5,95–6,65) avec son halo de lumière et deux étoiles.
 * Ce choix et ces temps sont ceux de la v7.1 ; seule la boîte est maintenant écrite à 2× (voir SS).
 * v7.2 (le logo n'est écrit qu'une fois) : à la sortie, seuls le mot-symbole, la devise, les rails et la plaque sombre
 * sont pris dans la lumière ; les traits de l'emblème restent, nets et immobiles. Geste inverse de l'écriture : la part
 * qui part blanchit (6,65–6,95), puis le même front elliptique remonte vers la source et la reprend de bas en haut avec
 * sa bande blanche (6,78–7,17). Revue M : la plaque des lignes de l'emblème et de son disque s'efface avant (6,80–6,98),
 * ciel encore sombre, et la lumière reprise (6,95 → 7,12) passe surtout à la scène des rôles autour de l'emblème
 * (equipe.js) et, plus doucement, à son cœur (#fxback, derrière lui). L'emblème du logo passe ensuite à l'emblème seul
 * (favicon, scène « direction ») par un fondu enchaîné de 0,15 s (NX.M72.DISSOLVE, 7,10–7,25) : même géométrie (favicon
 * × 1,1425 en (335,5 ; 48,5) px du logo), même chaîne de rendu (boîtes écrites à 2× puis réduites de moitié, coin de
 * boîte au px entier) ; la part qui reste est le logo masqué par l'alpha même du favicon, si bien que ses bords et ses
 * franges sont ceux du favicon (contrôle §6.9 inversé : out/v72/M/tools/swapcheck.mjs).
 * Ce fichier porte aussi NX.M72, le trajet de l'emblème partagé par equipe.js et direction.js (voir plus bas).
 * Le logo n'est jamais tourné ni filtré : masques, échelle uniforme et feuilles de lumière seulement.
 * La boîte et le halo reçoivent display:none quand ils ne montrent rien (règle ENGINE.md) ; les feuilles de lumière
 * restent à opacité 0 hors de leurs fenêtres (voir render).
 * Vérification : NX.logoDebug = { stay } ne montre que la part qui reste, { fav } retire la boîte dès DISSOLVE[0] − 0,1
 * (et direction.js montre l'emblème seul, opaque), { lock } garde le logo seul jusqu'à DISSOLVE[1] (favicon retenu),
 * { leavesOff } coupe toute lumière ajoutée, { noCore } la lumière du cœur. */
(function () {
  const SRC = '../public/assets/nxt5-logo.png', SRC_FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G.L2, LG = NX.G.LOGO, FV = NX.G.FAV, W = G.w, H = W * LG.H / LG.W, K = W / LG.W;
  const ZL = -0.5;                                                       // racine de scène à translateZ(z·0,5 px), z = −1
  const RING = [G.left + LG.ringC[0] * K, G.top + LG.ringC[1] * K];     // centre de l'anneau, monde (958.7, 452.1)
  const HIT = NX.T.hookEnd;                                              // 4,8
  const GLINT = [5.95, 6.65];
  /* Boîte du logo écrite à 2× puis réduite de moitié (échelle uniforme, comme fin.js et direction.js) : sous la caméra
   * en perspective, Chrome rastérise un calque 3D à son échelle locale 1 puis le rééchantillonne ; à 1× le logo était
   * agrandi de 6 % après rastérisation (énergie de détail de l'emblème 2,71 contre 2,94 pour l'emblème de S5). À 2× il
   * n'est que réduit, comme l'emblème de « direction » : l'emblème garde la même netteté de 4,8 à 13,2 (échange inclus). */
  const SS = 2;
  /* Sortie v7.2 : la part qui part (mot-symbole, devise, rails, plaque : tout sauf l'emblème) est prise dans la lumière,
   * l'emblème reste. Geste inverse de l'écriture de 4,8 : la part qui part blanchit (lum, ≤ 0,45 sur ses seuls traits,
   * 6,65–6,95), puis le même front elliptique, centré sur la source des rayons, remonte (UNWRITE, rayon 1 070 → 590 px
   * écran, pointe 1 499 px/s, sous la limite de 1 600) et la reprend de bas en haut ; sa bande blanche (profil de
   * NX.light.band) court sur ses traits au bord du front : chaque lettre devient lumière blanche et disparaît avec lui,
   * sans jamais passer par une transparence grise. Le front part de 1 070 px : sa plume (r − 70) passe alors au-delà du
   * pixel du logo le plus éloigné de la source (lueur du chevron, 992 px), si bien que son entrée ne change aucun pixel ;
   * la bande, dont le dégradé commence 170 px en deçà du front, monte en 0,08 s (à 1 010 px, l'entrée blanchissait le
   * chevron et la devise d'un coup : jusqu'à +51 niveaux en une sous-image). À 7,17 il ne reste que l'emblème. */
  const WHITEN = [6.65, 6.95, 0.45];
  const UNWRITE = NX.track([[6.78, 1070], [6.95, 905], [7.08, 720], [7.17, 590]]), UNWRITE_T = [6.78, 7.17];
  const BAND_IN = 0.08;
  /* Revue M (v7.2) : aucune lumière ne monte derrière une plaque translucide (alpha 0,1–0,6 : elle y faisait des taches
   * grises), et rien de clair ne part par opacité (traits gris). La part qui part est donc découpée en trois, une fois,
   * dans prepare() (masques cuits, px du PNG) :
   * - la région haute R : les lignes de l'emblème au-dessus des rails (y < YCUT, fondu ± YCUT_F) et, plus bas, la plaque
   *   du disque de l'emblème (anneau du favicon élargi de 12 px, fondu ± DISC_F, hors traits clairs). Sa plaque s'efface
   *   tôt (EARLY, 6,80–6,98), ciel encore sombre derrière, avant toute lumière de relais (6,95 → 7,12) ; ses détails clairs
   *   (les bords de traits que le favicon n'a pas) fondent pendant le fondu enchaîné des deux emblèmes (NX.M72.DISSOLVE),
   *   sous le favicon qui arrive ;
   * - tout le reste (mot-symbole, devise, rails, bouts d'arcs, leur plaque) n'est repris que par le front, avec sa bande
   *   blanche sur les traits clairs (masque leaveFront), jamais par une opacité. La bande reste pleine jusqu'à ce que son
   *   bord extérieur ait dépassé le dernier trait clair (this.hotOff, mesuré dans prepare()).
   * Masque du chrome pendant la sortie (empilement CSS, de bas en haut) :
   *   reste ∪ [ front ∩ ( (1 − R) ∪ ( fondu ∩ ( tôt ∪ clair ) ) ) ]. */
  const EARLY = [6.80, 6.98];
  const YCUT = 395, YCUT_F = 8;                          // px du PNG du logo : juste au-dessus des rails et des bouts d'arcs
  const DISC_F = 10;                                     // fondu du disque de l'emblème (px du PNG)
  // Pour la plaque seule, la limite de la région haute est un long fondu (YCUT − 8 → YCUT + 70, disque + 50 px) : quand la
  // lumière de relais monte, la plaque qui attend le front n'a plus de bord visible (bande sombre derrière les rails).
  const PLATE_FY = 70, PLATE_FD = 50;
  const FADE = [6.98, 7.30];             // halo du logo : il passe à la lumière de scène des rôles (equipe.js, 6,95–7,12)
  // Relais (revue M) : une part de la lumière que le front reprend passe au cœur de l'emblème, derrière lui (#fxback),
  // dont la plaque est déjà partie (6,98) : profil plat, montée lente (6,92 → 7,30) pour que ses jours s'éclairent sans
  // à-coup et restent sous ses traits ; elle se fond ensuite dans le cœur de scène des rôles (7,30–7,60). Le reste de la
  // lumière des lettres passe à la scène autour de l'emblème (equipe.js, anneau du relais, en phase avec le front).
  const CORE = [6.92, 7.30, 7.30, 7.60], CORE_A = 0.08, CORE_R = 300;
  /* Pendant que la question brûle (4,44–4,81), la lumière qu'elle rendait passe au logo : la silhouette froide monte
   * de 0,30 à 0,42 (SINE 4,55–4,78) et le halo fleurit avec l'écriture de l'emblème (moitié, SINE 4,42–4,78) avant de
   * s'achever avec l'impact (SINE 4,78–5,10) ; il respire ensuite ×(0,7 + 0,3·e^(−3τ)). */
  const FORGE_SWELL = [4.55, 4.78, 0.12], HALO_IN = [4.42, 4.78, 5.10], HALO_REST = 0.7;
  const SWEEP_A = 0.30 / 0.95;           // pic du reflet = 0,30 de lumière ajoutée sur le chrome (plafond de marque)
  const STARS = [{ uv: LG.stars.spear, g: 0.7, size: 0.75 }, { uv: LG.stars.five, g: 0.55, size: 0.6 }];
  const MW = Math.ceil(LG.W / 4), MH = Math.ceil(LG.H / 4);             // masque basse définition (cellules de 4 px)

  /* ================================================================================================================
   * NX.M72 : trajet unique de l'emblème du moment continu 4,8–13,2 (amendement v7.2), partagé par equipe.js (centre du
   * pentagone, cibles des particules) et direction.js (l'emblème lui-même). Fonctions pures de t.
   * - De SWAP à GROW[0], l'emblème est le favicon posé exactement sur l'emblème du logo : × 1,1425 en (335,5 ; 48,5)
   *   px du logo NX.G.L2, soit 0,7289 px monde par px du favicon, anneau en (958,80 ; 452,01), plan du logo (z −0,5).
   * - De GROW[0] à l'impact (9,6), il rejoint la géométrie NX.G.E5 (0,8984, anneau (960 ; 441,68), plan 2,6 de la
   *   v7.1) en SINE, sans rotation, sans filtre : il grandit pendant que les rôles le chargent de leur lumière.
   * pose(t) → { cx, cy (centre de l'anneau, monde), s (px monde par px du favicon), z (plan monde), g (avancée 0..1) }.
   * ================================================================================================================ */
  const T2L = FV.toLockup;
  const S0 = T2L.s * K, BOX0 = { left: G.left + T2L.x * K, top: G.top + T2L.y * K };     // 0,72887 ; (774,04 ; 255,94)
  const C0 = [BOX0.left + FV.ringC[0] * S0, BOX0.top + FV.ringC[1] * S0];             // (958,80 ; 452,01)
  const E5 = NX.G.E5, S1 = E5.size / FV.W, C1 = [E5.left + FV.ringC[0] * S1, E5.top + FV.ringC[1] * S1];
  const Z0 = ZL, Z1 = 1.2 * 0.5 + 2;                                                   // plan du logo → plan de S5
  const SWAP0 = Math.round((NX.T.roles - 1 / 60) * 1e6) / 1e6;   // 7,1833
  NX.M72 = {
    SWAP: SWAP0,                                          // 7,1833 : centre nominal de l'échange (entre deux images)
    /* Fondu enchaîné des deux emblèmes (revue M) : les deux PNG ne portent pas le même détail fin (le favicon est ≈ 8 %
     * plus net, ses franges plus sombres) ; un échange en une sous-image faisait un saut de netteté. Le favicon
     * (direction.js) arrive par-dessus, 2 px devant (projection inchangée), en SINE sur 0,15 s (≈ 4,5 images) ; les
     * détails clairs propres au logo fondent dessous, et la part qui reste s'efface sur les 0,04 dernières secondes
     * (fond jamais visible à travers les traits) ; puis la boîte du logo est retirée (display:none). */
    DISSOLVE: [Math.round((SWAP0 - 0.0833) * 1e6) / 1e6, Math.round((SWAP0 + 0.0667) * 1e6) / 1e6],   // 7,10 → 7,25
    LIFT: 2,                                              // le favicon vole 2 px devant le plan du logo jusqu'à la croissance
    GROW: [Math.round((NX.T.emblem - 1.0) * 1e6) / 1e6, NX.T.emblem],   // 8,6 → 9,6 : croissance jusqu'à E5
    /** Opacité du favicon pendant le fondu enchaîné (0 → 1, SINE). */
    dissolve(t) { return NX.ease.sine(NX.seg(t, this.DISSOLVE[0], this.DISSOLVE[1])); },
    S0, S1, C0, C1, Z0, Z1, BOX0,
    /* Centre optique de l'emblème (centre de la boîte alpha du favicon, (252,5 ; 239,5) px du favicon) : le pentagone des
     * rôles est centré dessus (le centre de l'anneau est 21,5 px monde plus bas, sous la lance). */
    OPT: [252.5 - FV.ringC[0], 239.5 - FV.ringC[1]],
    grow(t) { return NX.ease.sine(NX.seg(t, this.GROW[0], this.GROW[1])); },
    pose(t) {
      const g = this.grow(t);
      return { cx: C0[0] + (C1[0] - C0[0]) * g, cy: C0[1] + (C1[1] - C0[1]) * g, s: S0 + (S1 - S0) * g, z: Z0 + (Z1 - Z0) * g, g };
    },
  };
  const STAY_OUT = 0.04;                                 // dernière part du fondu enchaîné : la part qui reste s'efface

  NX.css(`
  .logo-halo{position:absolute;left:310px;top:40px;width:1300px;height:1000px;transform:translateZ(-2px);background:radial-gradient(closest-side,rgba(103,232,249,.20),rgba(129,140,248,.10) 45%,transparent)}
  .logo-box{position:absolute;left:${G.left}px;top:${G.top}px;width:${W * SS}px;height:${(H * SS).toFixed(3)}px;transform-origin:0 0;transform:scale(${1 / SS});isolation:isolate}
  `);

  /** Masque d'une feuille (même règle que le setMask interne du kit) : couches à 100 % × 100 %. ops : opérateur de
   *  chaque couche avec celles qui sont dessous ('intersect' par défaut, 'add' pour une union). */
  const LOGO_WK = { intersect: 'source-in', add: 'source-over' };
  const logoSetMask = (el, layers, ops = null) => {
    const v = layers.join(','), n = layers.length, op = layers.map((_, i) => (ops && ops[i]) || 'intersect');
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = el.style.webkitMaskSize = layers.map(() => '100% 100%').join(',');
    el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = n > 1 ? op.join(',') : '';
    el.style.webkitMaskComposite = n > 1 ? op.map(o => LOGO_WK[o]).join(',') : '';
  };
  /* Front de lumière dans la boîte à SS px locaux par px monde : mêmes dégradés que le kit (bible §3.3, RM = 3000,
   * ellipse K·RM × RM), toutes les longueurs multipliées par SS, ce qui garde à l'écran la plume de 70 px, le bord de
   * brûlure de 60 px et le profil de la bande blanche de la v7.1. */
  const RM = 3000 * SS, pc = v => (100 * v / RM).toFixed(3) + '%';
  const shape = L => `ellipse ${(NX.light.K * RM).toFixed(1)}px ${RM.toFixed(1)}px at ${L.cx.toFixed(1)}px ${L.cy.toFixed(1)}px`;
  const logoLocal = (R, t) => { const L = NX.light.local(G.left, G.top, ZL, R, t); return { cx: L.cx * SS, cy: L.cy * SS, r: L.r * SS }; };
  const logoWrite = L => `radial-gradient(${shape(L)},#000 ${pc(L.r - 70 * SS)},transparent ${pc(L.r + 10 * SS)})`;
  const logoBurn = L => `radial-gradient(${shape(L)},transparent ${pc(L.r - 10 * SS)},#000 ${pc(L.r + 60 * SS)})`;
  const logoBand = L => `radial-gradient(${shape(L)},transparent ${pc(L.r - 170 * SS)},rgba(150,215,255,.28) ${pc(L.r - 70 * SS)},rgba(200,240,255,.75) ${pc(L.r - 18 * SS)},#fff ${pc(L.r - 3 * SS)},transparent ${pc(L.r + 12 * SS)})`;
  /** Couche de masque uniforme d'opacité a. */
  const logoUni = a => `linear-gradient(rgba(0,0,0,${a.toFixed(4)}),rgba(0,0,0,${a.toFixed(4)}))`;

  /** Masques locaux tirés des PNG, construits une fois dans prepare() (aux px du PNG du logo) :
   *  - max : alpha × smoothstep(0,45, 0,75, max(r,g,b)), tout le logo comme lumière, traits violets et fuchsia compris
   *    (le masque de luminance du kit ne garde que la moitié cyan, des contours et « DRAFT. ») ; c'est aussi la couche
   *    « clair » du masque de sortie (la part claire de la région haute attend le fondu enchaîné) ;
   *  - lo : le masque de luminance du kit, maximum par cellule de 4 px puis dilaté d'une cellule (étincelles) ;
   *  - stay : l'alpha du favicon posé sur l'emblème du logo (× 1,1425 en (335,5 ; 48,5)) : la part du logo qui reste,
   *    bords et franges sombres du favicon compris ; ailleurs (mot-symbole, devise, rails, plaque) tout part ;
   *  - notR : 1 − R, R = max(lignes hautes (y < YCUT, fondu), disque de l'emblème × (1 − max)) : la région dont la plaque
   *    s'efface tôt (voir EARLY) ;
   *  - leaveFront : max × (1 − stay) × (1 − R), les traits clairs que le front reprend (blanchiment et bande blanche).
   *  Retourne aussi rFront : pour chaque px que seul le front efface (part qui part × (1 − R) > 1 %), son point du logo ;
   *  et rBright : les mêmes pour les traits clairs (leaveFront > 2 %) — voir prepare(). */
  const logoMasks = (img, fav) => {
    const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingQuality = 'high';
    c.setTransform(T2L.s, 0, 0, T2L.s, T2L.x, T2L.y); c.drawImage(fav, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
    const fa = c.getImageData(0, 0, w, h).data;
    c.clearRect(0, 0, w, h); c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, w, h).data, cell = new Float32Array(MW * MH), lo = new Float32Array(MW * MH);
    const mMax = c.createImageData(w, h), mStay = c.createImageData(w, h), mNotR = c.createImageData(w, h), mLeave = c.createImageData(w, h);
    // Disque de l'emblème : anneau du favicon (rayon extérieur 186 px du favicon) élargi de 12 px du logo.
    const DX = T2L.x + FV.ringC[0] * T2L.s, DY = T2L.y + FV.ringC[1] * T2L.s, DR = FV.ringBand[1] * T2L.s + 12;
    const rFront = [], rBright = [];
    for (let y = 0; y < h; y++) {
      const U = 1 - NX.smooth(YCUT - YCUT_F, YCUT + YCUT_F, y + 0.5), Up = 1 - NX.smooth(YCUT - YCUT_F, YCUT + PLATE_FY, y + 0.5);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, a = d[i + 3] / 255, o = (y >> 2) * MW + (x >> 2);
        cell[o] = Math.max(cell[o], NX.smooth(0.35, 0.65, (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) * a);
        const k = NX.smooth(0.45, 0.75, Math.max(d[i], d[i + 1], d[i + 2]) / 255) * a, st = fa[i + 3] / 255;
        const r = Math.hypot(x + 0.5 - DX, y + 0.5 - DY), Dd = 1 - NX.smooth(DR - DISC_F, DR + PLATE_FD, r);
        // Traits clairs : coupe nette (U) ; plaque : long fondu (Up) et disque élargi (Dd).
        const R = k * U + (1 - k) * Math.max(Up, Dd), lf = k * (1 - st) * (1 - R);
        for (const m of [mMax, mStay, mNotR, mLeave]) m.data[i] = m.data[i + 1] = m.data[i + 2] = 255;
        mMax.data[i + 3] = Math.round(k * 255); mStay.data[i + 3] = fa[i + 3];
        mNotR.data[i + 3] = Math.round((1 - R) * 255); mLeave.data[i + 3] = Math.round(lf * 255);
        if (!(x & 1) && !(y & 1)) {
          if (a * (1 - st) * (1 - R) > 0.01) rFront.push(x + 0.5, y + 0.5);
          if (lf > 0.02) rBright.push(x + 0.5, y + 0.5);
        }
      }
    }
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      let m = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const jj = j + dj, ii = i + di; if (jj >= 0 && jj < MH && ii >= 0 && ii < MW) m = Math.max(m, cell[jj * MW + ii]);
      }
      lo[j * MW + i] = m;
    }
    const url = im => { c.putImageData(im, 0, 0); return `url(${cv.toDataURL('image/png')})`; };
    return { url: url(mMax), stay: url(mStay), notR: url(mNotR), leave: url(mLeave), lo, rFront, rBright };
  };
  /** Valeur bilinéaire du masque basse définition au point (u, v) de la boîte (0 hors du logo). */
  const logoLoAt = (lo, u, v) => {
    const x = NX.clamp(u * MW - 0.5, 0, MW - 1.001), y = NX.clamp(v * MH - 0.5, 0, MH - 1.001);
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, o = j * MW + i;
    return (lo[o] * (1 - fx) + lo[o + 1] * fx) * (1 - fy) + (lo[o + MW] * (1 - fx) + lo[o + MW + 1] * fx) * fy;
  };

  /** Lumière douce additive au profil plat au centre, a·(1 − u²)², u = d/r : derrière l'emblème, aucune pointe au centre
   *  de l'anneau (une lueur pointue s'y lisait comme une tache claire entre les traits). */
  const LOGO_ORB = [0, 0.2, 0.4, 0.6, 0.8, 1].map(u => [u, (1 - u * u) ** 2]);
  const logoOrb = (ctx, x, y, r, rgb, a) => {
    if (a <= 0.002 || r <= 0.5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [u, k] of LOGO_ORB) g.addColorStop(u, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * k).toFixed(4)})`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
  };
  // Centre de la bande de reflet (gradient 105°, 34 % de large, translateX −110 % → 300 %) au point (u, v) de la boîte.
  const TAN15 = Math.tan(15 * Math.PI / 180);
  const sweepAt = p => (NX.lerp(-110, 300, p) / 100) * 0.34 + 0.17;             // abscisse u du centre, à mi-hauteur
  const sheenInv = y => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (NX.ease.sheen(m) < y) a = m; else b = m; } return (a + b) / 2; };

  NX.scene({
    // Rendue jusqu'à la fin de la lumière du cœur (#fxback, CORE[3]) : coupée plus tôt, elle tomberait en une sous-image.
    // Après le fondu enchaîné (NX.M72.DISSOLVE), la boîte et le halo sont en display:none.
    id: 'logo', start: 4.0, end: NX.T.roles, post: Math.round((CORE[3] + 0.01 - NX.T.roles) * 1e6) / 1e6, z: -1,
    build(root) {
      this.halo = NX.el('<div class="logo-halo"></div>', root);
      this.box = NX.el('<div class="logo-box"></div>', root);
      this.L = NX.logoLight(this.box, SRC);
      this.fav = NX.image(SRC_FAV);                     // lu seulement (masque de la part qui reste) : jamais affiché ici
      // Reflet : même bande de 34 % que le kit, mais un cœur spéculaire net et des épaules douces, pour qu'il se lise
      // comme un éclat sur le chrome sans dépasser le plafond de 0,30 de lumière ajoutée.
      this.L.band.style.background = 'linear-gradient(105deg,transparent 0%,rgba(150,215,255,.10) 28%,rgba(185,232,255,.38) 43%,rgba(255,255,255,.95) 48.5%,rgba(255,255,255,.95) 51.5%,rgba(205,192,255,.38) 57%,rgba(196,181,253,.10) 72%,transparent 100%)';
    },
    async prepare() {
      await this.L.prepare();
      await this.fav.decode().catch(() => {});
      if (this.fav.naturalWidth) {
        const M = logoMasks(this.L.img, this.fav);
        this.maxUrl = M.url; this.lo = M.lo; this.stayUrl = M.stay; this.notRUrl = M.notR; this.leaveUrl = M.leave;
        logoSetMask(this.L.forge, [this.maxUrl]);                        // chargé dès la préparation
        /* Sortie : rayon du front (px écran) au-delà duquel plus rien n'est visible des points donnés (px du PNG) : effacé
         * quand le rayon local r + 10 (bord transparent du masque d'écriture) est passé, hors bande quand r + 12 l'est. */
        const KK = W / LG.W, reach = (pts, t, off) => {
          const cam = NX.cam.at(t), o = NX.cam.project(G.left, G.top, ZL, cam), s = NX.light.src(t);
          const cx = (s.x - o.x) / o.s, cy = (s.y - o.y) / o.s; let m = Infinity;
          for (let i = 0; i < pts.length; i += 2) m = Math.min(m, Math.hypot((pts[i] * KK - cx) / NX.light.K, pts[i + 1] * KK - cy));
          return (m - off) * o.s;
        };
        // Bande éteinte quand son bord extérieur a dépassé le dernier trait clair repris par le front (rien ne change alors).
        this.hotOff = UNWRITE_T[1];
        for (let t = 6.9; t <= UNWRITE_T[1]; t += 0.001) if (UNWRITE(t) <= reach(M.rBright, t, 12) - 1) { this.hotOff = Math.round(t * 1e3) / 1e3; break; }
        // Garde : à la fin du front, tout ce que lui seul efface l'est (sinon la boîte retirée ferait un saut).
        const need = reach(M.rFront, UNWRITE_T[1], 10);
        if (UNWRITE(UNWRITE_T[1]) > need) console.warn(`logo : le front s'arrête à ${UNWRITE(UNWRITE_T[1])} px, il faudrait ${need.toFixed(1)}`);
        this.frontNeed = need;
      } else console.warn('logo : emblème non décodé');
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
      const t = S.t, E = NX.ease, sm = NX.smooth, seg = NX.seg, tau = t - HIT, ctx = NX.fx.ctx, bk = NX.fxBack.ctx, c = NX.camState;
      const Lk = this.L, dbg = NX.logoDebug || {}, [D0, D1] = NX.M72.DISSOLVE;
      // L'emblème du logo est devenu l'emblème seul (direction.js) : plus rien de cette scène n'est dans la boîte.
      // { fav } (contrôle §6.9 inversé) : la boîte est retirée dès D0 − 0,1 ; { lock } : elle reste jusqu'à D1, seule.
      const out = t >= D1 || (dbg.fav && t >= D0 - 0.1);
      this.box.style.display = out ? 'none' : '';
      // La part qui reste s'efface sur les 0,04 dernières secondes du fondu enchaîné, sous le favicon déjà presque opaque
      // (≥ 0,96) : sa frange ne laisse aucun reste quand la boîte est retirée, et le fond ne passe jamais à travers les traits.
      const stayA = dbg.lock || dbg.stay ? 1 : 1 - E.sine(seg(t, D1 - STAY_OUT, D1));
      this.box.style.opacity = !out && stayA < 1 ? stayA.toFixed(4) : '';
      // Sans masques (prepare() en échec), les feuilles de lumière resteraient des rectangles pleins : elles s'éteignent
      // et seul le chrome, écrit par le front, apparaît.
      const lit = this.maxUrl ? 1 : 0;
      const full = this.tFull ?? Infinity, writing = t >= 4.2 && t < full;
      const front = writing ? logoLocal(NX.FRONT.hook(t), t) : null;
      const exit = !out && t >= WHITEN[0] && lit;
      if (!out) {
        // ---- Chrome (img) : écrit par le front ; à la sortie, la part qui part (tout sauf l'alpha du favicon) est reprise
        // par le front qui remonte (masque d'écriture du kit au rayon UNWRITE), sauf la région haute R (voir EARLY) ; la
        // part qui reste (l'alpha du favicon) ne change jamais : ses pixels sont ceux du favicon qui arrive par-dessus.
        // { stay } : rendu de contrôle §6.9 (la seule part qui reste).
        // Masque de sortie : reste ∪ [ front ∩ ( (1 − R) ∪ ( fondu ∩ ( tôt ∪ clair ) ) ) ], couches de haut en bas ; les
        // couches devenues neutres (valeur 1) sont omises.
        const un = exit && t >= UNWRITE_T[0] ? logoLocal(UNWRITE(t), t) : null;
        const pE = 1 - E.sine(seg(t, EARLY[0], EARLY[1])), pD = 1 - NX.M72.dissolve(t);
        if (front) logoSetMask(Lk.img, [logoWrite(front)]);
        else if (dbg.stay && lit) logoSetMask(Lk.img, [this.stayUrl]);
        else if (un) {
          const L = [this.stayUrl, logoWrite(un)], ops = ['add', 'intersect'];
          if (pE < 1) {                                              // la région haute commence à partir
            L.push(this.notRUrl); ops.push('add');
            if (pD < 1) { L.push(logoUni(pD)); ops.push('intersect'); }
            if (pE > 0) { L.push(logoUni(pE)); ops.push('add'); }
            L.push(this.maxUrl);
          }
          logoSetMask(Lk.img, L, ops);
        } else logoSetMask(Lk.img, []);
        Lk.img.style.opacity = t >= full || writing ? 1 : 0;

        // ---- Silhouette de lumière froide (forge) : tout le logo jusqu'à l'écriture (0 → 0,24 inQuad 4,0–4,5, puis →
        // 0,30 par une approche exponentielle qui part avec la pente de fin de l'inQuad, + la lumière de la question qui
        // brûle 0,12), effacée par le front. Éteinte ensuite : à la sortie, une traînée de lumière sous le front qui
        // remonte montrait les lettres à toutes les intensités à la fois (lettres grises) ; la lumière reprise passe au
        // cœur de l'emblème et au ciel.
        const forge = dbg.leavesOff || t >= full ? 0 : lit * ((t < 4.5 ? 0.24 * E.inQuad(seg(t, 4.0, 4.5)) : 0.24 + 0.06 * (1 - Math.exp(-4.8 * seg(t, 4.5, 4.8))) / (1 - Math.exp(-4.8)))
          + FORGE_SWELL[2] * E.sine(seg(t, FORGE_SWELL[0], FORGE_SWELL[1])));
        Lk.forge.style.opacity = NX.clamp(forge).toFixed(4);
        if (forge > 0) logoSetMask(Lk.forge, front ? [this.maxUrl, logoBurn(front)] : [this.maxUrl]);
        // ---- Bande blanche au bord du front : celui qui écrit (4,3–5,4, chrome clair, masque du kit), puis celui qui
        // reprend la part qui part (ses seuls traits) : elle monte en 0,08 s (BAND_IN) et s'éteint quand le front a
        // dépassé les rails (7,10–7,17).
        // Revue M : pleine jusqu'à ce que son bord extérieur ait dépassé le dernier trait clair repris (hotOff) : chaque
        // trait part blanc avec le front, jamais gris ; ensuite elle ne couvre plus rien et s'éteint sans rien changer.
        const hotOn = !dbg.leavesOff && lit && ((front && t >= 4.3 && t < 5.4) || (un && t < this.hotOff));
        const hotA = un ? sm(UNWRITE_T[0], UNWRITE_T[0] + BAND_IN, t) : 1;
        Lk.hot.style.opacity = hotOn ? hotA.toFixed(4) : 0;
        Lk.hot.style.display = hotOn ? '' : 'none';
        if (hotOn) {
          Lk.hot.style.background = logoBand(un || front);
          logoSetMask(Lk.hot, [un ? this.leaveUrl : Lk.url]);
        }
        // ---- Lumière ajoutée (lum) : surexposition de l'impact (≤ 0,30, e^(−6τ)) sur le chrome déjà écrit ; à la sortie,
        // le blanchiment de la part qui part seulement (l'emblème garde son chrome), repris avec elle par le front.
        const hitLum = tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0, exitLum = exit ? WHITEN[2] * sm(WHITEN[0], WHITEN[1], t) : 0;
        // Le blanchiment n'a plus rien à éclairer quand le front a repris le dernier trait clair (hotOff).
        let lum = dbg.leavesOff || (exit && t >= this.hotOff) ? 0 : lit * (exit ? exitLum : hitLum);
        if (lum < 0.002) lum = 0;                                      // éteinte : son masque n'a plus d'effet
        Lk.lum.style.opacity = lum.toFixed(4);
        if (lum > 0) logoSetMask(Lk.lum, exit ? (un ? [this.leaveUrl, logoWrite(un)] : [this.leaveUrl]) : front ? [Lk.url, logoWrite(front)] : [Lk.url]);
        // ---- Reflet unique de la tenue (SHEEN 5,95–6,65).
        const gp = seg(t, GLINT[0], GLINT[1]), on = !dbg.leavesOff && lit && gp > 0 && gp < 1;
        Lk.sweep.style.opacity = on ? SWEEP_A.toFixed(4) : 0;
        if (on) Lk.band.style.transform = `translateX(${NX.lerp(-110, 300, E.sheen(gp)).toFixed(2)}%)`;
      }

      // Halo (dégradé de la v6) : fleurit avec l'emblème, s'achève avec l'impact, puis respire (au repos 0,7) ; il s'éteint
      // pendant que le front reprend le mot-symbole (6,95–7,20), relayé par la lumière de scène des rôles.
      const fade = 1 - sm(FADE[0], FADE[1], t);
      const bloom = 0.5 * E.sine(seg(t, HALO_IN[0], HALO_IN[1])) + 0.5 * E.sine(seg(t, HALO_IN[1], HALO_IN[2]));
      const haloA = bloom * (tau >= 0 ? HALO_REST + (1 - HALO_REST) * Math.exp(-3 * tau) : 1) * fade;
      this.halo.style.opacity = haloA.toFixed(4);
      this.halo.style.display = haloA < 0.002 ? 'none' : '';
      if (dbg.leavesOff) return;
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
      const gp = seg(t, GLINT[0], GLINT[1]), sweepP = lit && gp > 0 && gp < 1 ? E.sheen(gp) : -1;
      if (sweepP > 0) {
        const pr = NX.cam.project(G.left + sweepAt(sweepP) * W, G.top + H / 2, ZL, c), a = 0.06 * sm(0, 0.12, gp) * (1 - sm(0.88, 1, gp));
        if (a > 0.002) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.setTransform(0.15 * W * pr.s, 0, 0, 0.62 * H * pr.s, pr.x, pr.y);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, `rgba(205,240,255,${a.toFixed(4)})`); g.addColorStop(0.45, `rgba(190,225,255,${(a * 0.55).toFixed(4)})`); g.addColorStop(1, 'rgba(190,225,255,0)');
          ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
        }
      }
      if (this.stars && t > GLINT[0] && t < GLINT[1] + 0.3) for (const s of this.stars) {
        const g = s.g * (t < s.tc ? sm(s.tc - 0.07, s.tc, t) : Math.exp(-6 * (t - s.tc))) * fade;
        if (g > 0.004) { const pr = NX.cam.project(s.X, s.Y, ZL, c); NX.lk.star(pr.x, pr.y, g, { size: s.size }); }
      }
      // Sortie : la lumière que le front reprend passe au cœur de l'emblème, derrière lui (#fxback, jamais de voile sur ses
      // traits), dont la plaque est déjà partie (6,98) : elle monte pendant que le front reprend le mot-symbole (6,95 →
      // 7,12, en phase avec la lumière de scène des rôles), tient, puis se fond dans le cœur de scène (7,25–7,50).
      const xg = dbg.noCore ? 0 : E.sine(seg(t, CORE[0], CORE[1])) * (1 - E.sine(seg(t, CORE[2], CORE[3])));
      if (xg > 0.002) { const pr = NX.cam.project(RING[0], RING[1], ZL, c); logoOrb(bk, pr.x, pr.y, CORE_R * pr.s, [200, 240, 255], CORE_A * xg); }
    },
  });
})();
