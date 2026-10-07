/* S5 Direction (bible v7 §4 S5 et amendement v7.1 : tous les temps −4,8 s), fenêtre 9,45–13,3 s, z 1,2 :
 * « Une même direction. ». Chaque instant est écrit par rapport à NX.T (frise ci-dessous) : la naissance et la tenue
 * suivent l'emblème (T.emblem, 9,6), la condensation, la montée et la sortie suivent le drop (T.tools, 13,2).
 * 9,48–9,62 : l'emblème (PNG) apparaît sous les particules d'equipe.js ; 9,6 : impact sobre au centre de l'anneau.
 * 9,75 : le titre monte. 9,8–12,6 : l'emblème respire (−10 px, ×1,025). 10,8 : un faisceau part de la pointe de la
 * lance vers la source (tracé 10,8–11,7), il pulse sur 12,0. 11,35–12,05 : un seul reflet passe sur le chrome.
 * 12,60–12,95 : l'emblème se condense en sa flèche : le masque horizontal doux se referme sur l'axe et efface l'anneau
 * et les ailes de l'extérieur vers l'intérieur ; ce qu'il laisse autour de la flèche s'éteint 12,70–12,80, si bien qu'à
 * 12,80 il ne reste que la flèche entière (pointe, ailerons, hampe, empennage), qui s'éclaire.
 * 12,70–13,18 : elle monte le long du faisceau, dont le pied la suit, et s'efface dans la lumière ; le titre sort par le
 * haut (12,80 / 12,85 / 12,90, EXIT 0,30 : le dernier mot disparaît exactement à 13,20, image du drop).
 * 13,2 : le faisceau s'éteint, la lumière redescend sur la première carte (outils.js).
 * Interfaces : equipe.js possède les particules et ne dessine jamais le PNG ; cette scène possède l'emblème et
 * NX.hit(9,6) ; « ciel » possède l'onde de choc, le resserrement des rayons, la montée et la poussière.
 * Le logo n'est jamais tourné ni filtré : masques doux, translation, échelle uniforme, feuilles de lumière.
 * Fonction pure de t : masque de la flèche, instant de l'étoile et toile annexe sont préparés une fois.
 * Vérification (bible §6.8, §6.10) : NX.dirDebug = { leavesOff } coupe toute lumière ajoutée sur l'emblème,
 * { noHalo } retire le halo, { noMask } désactive le masque de condensation. */
(function () {
  const SRC = '../public/assets/nxt5-loader-favicon.png';
  const G5 = NX.G.E5, FV = NX.G.FAV, BOX = G5.size, K = BOX / FV.W;   // 460 px monde pour 512 px d'image
  // Boîte de l'emblème écrite à 2× puis réduite de moitié (échelle uniforme, comme fin.js) : sous la caméra tournée,
  // une boîte à 1× est agrandie de 6 % après rastérisation et s'adoucit ; à 2× elle n'est que réduite (traits nets).
  const SS = 2;
  const E = NX.ease, seg = NX.seg, sm = NX.smooth, SINE = E.sine;
  const ZR = 1.2 * 0.5;                          // le moteur décale la racine de la scène (z 1,2) de 0,6 px
  const ZH = 0, ZB = 2, ZT = 3;                  // plan du halo (toile), emblème et titre relevés (jamais coplanaires)
  const OX = FV.ringC[0] * K, OY = FV.ringC[1] * K;     // centre de l'anneau dans la boîte (227,75 ; 241,68)
  const CX = G5.left + OX, CY = G5.top + OY;     // C = (960 ; 441,7), centre de l'anneau en monde
  const TIPV = FV.spearTip[1] * K;               // pointe de la lance : y 46,7 dans la boîte (monde 246,7)
  const HALO = 900;                              // halo : disque radial de 900 px centré sur C

  /* Frise (bible §4 S5, amendement v7.1). Les valeurs en commentaire sont celles de la frise v7.1 (v7 − 4,8 s). */
  const at = (a, d) => Math.round((a + d) * 1e6) / 1e6;   // instant relatif à un repère de NX.T, sans résidu flottant
  const HIT = NX.T.emblem;                       // 9,6 : naissance de l'emblème
  const DROP = NX.T.tools;                       // 13,2 : drop, la lumière redescend sur la première carte
  const WIN = [at(HIT, -0.15), at(DROP, 0.10)];  // fenêtre de la scène 9,45–13,3
  const BIRTH = [at(HIT, -0.12), at(HIT, 0.02)]; // 9,48–9,62 : opacité de l'emblème sous les particules
  const HALO_IN = [at(HIT, 0.02), at(HIT, 0.60)];    // 9,62–10,2 : le halo s'épanouit pendant que l'éclair retombe (SINE)
  const TITLE_IN = at(HIT, 0.15), TITLE_STEP = 0.12, TITLE_DUR = 0.8;   // 9,75 / 9,87 / 9,99 (ENTER) : complet 10,79
  // Sortie 12,80 / 12,85 / 12,90, EXIT 0,30 (écart de la bible : v7 17,62 / 17,67 / 17,72, EXIT 0,32, sorti à 18,04,
  // soit 12,82 … 13,24 en v7.1) : le dernier mot disparaît exactement sur l'image du drop (13,20), où la carte 1
  // s'allume, donc jamais sur son contenu ; et il reste à l'écran (≈ 0,6 à 13,167) jusqu'à l'image qui précède le drop,
  // sans image vide avant le temps fort. 0,30 s reste dans la plage des titres (§2.2). L'EXIT part si lentement que le
  // titre est entier jusqu'à 12,90 : fenêtre de lecture 10,27–12,90 (2,63 s, v6 2,41 s).
  const TITLE_OUT = at(DROP, -0.40), OUT_STEP = 0.05, OUT_DUR = 0.30;
  const TITLE_GONE = at(TITLE_OUT, 2 * OUT_STEP + OUT_DUR);        // 13,20 : dernier mot sorti
  const BREATH = [at(HIT, 0.20), at(DROP, -0.60)];   // 9,8–12,6 : respiration, y −10 px, échelle 1 → 1,025 (SINE)
  const KICKS = NX.beats.lightKicks.slice();     // 10,8 et 12,0 (emblème + 2 et + 4 temps) : halo +20 % (décroissance 2,5)
  const SHEEN_T = [at(HIT, 0.90), at(HIT, 1.70)];    // 10,5–11,3 : reflet du mot « direction. »
  const DRAW = [at(KICKS[0], 0), at(KICKS[0], 0.90)];   // 10,8–11,7 : tracé du faisceau sur le premier temps (SINE)
  const GLINT = [at(HIT, 1.75), at(HIT, 2.45)];  // 11,35–12,05 : reflet unique de la tenue (SHEEN)
  const COND = [at(DROP, -0.60), at(DROP, -0.25)];   // 12,6–12,95 : condensation en flèche (GLIDE), bande à pleine force
  // Ce que la bande laisse autour de la flèche s'éteint 12,70–12,80 (écart : la bande seule n'atteint les colonnes de
  // la lance qu'à 12,95 et, à 12,80, trancherait encore les ailes en fragments et laisserait les bouts de l'anneau en
  // petites marques près de la pointe). Le balayage convergent se lit 12,60–12,75 ; à 12,80 il ne reste que la flèche.
  const DIM = [at(DROP, -0.50), at(DROP, -0.40)];
  const SPEAR_LUM = [at(DROP, -0.55), at(DROP, -0.20)];  // 12,65–13,0 : lumière froide sur la flèche 0 → 0,5
  const RISE = [at(DROP, -0.50), at(DROP, -0.02)];   // 12,7–13,18 : montée de 260 px le long du faisceau (LIFT)
  const FADE = [at(DROP, -0.25), at(DROP, -0.02)];   // 12,95–13,18 : la flèche s'efface dans la lumière
  const SWELL = [at(DROP, -0.60), at(DROP, -0.05)];  // 12,6–13,15 : le faisceau se renforce (+0,4) vers le drop
  const OFF = DROP;                              // 13,2 : faisceau éteint, relais au faisceau du drop
  const COLS = [44.5, 54.7];                     // colonnes de la lance (en % de la boîte), bords doux de 3 %
  const ART = [48 / 512, 457 / 512];            // étendue horizontale du dessin (boîte alpha du PNG, bible annexe B)
  // Plafond de marque (bible §2.3) : au plus 0,30 de lumière ajoutée ; le cœur du reflet vaut 0,95.
  const SWEEP_A = 0.30 / 0.95;
  // Bande du reflet : la même que S2 et S9 (cœur spéculaire net, épaules douces), pour que les trois logos se répondent.
  const SWEEP_BAND = 'linear-gradient(105deg,transparent 0%,rgba(150,215,255,.10) 28%,rgba(185,232,255,.38) 43%,rgba(255,255,255,.95) 48.5%,rgba(255,255,255,.95) 51.5%,rgba(205,192,255,.38) 57%,rgba(196,181,253,.10) 72%,transparent 100%)';
  const BEAM_CORE = [200, 240, 255], BEAM_GLOW = [167, 200, 255];
  // Volume du faisceau (écart de la bible, qui ne donne que le cœur et le halo étroit) : colonne gaussienne de 180 px au
  // plus, 0,22k au centre (≈ +15 de luminance sur l'axe à k = 0,5, ≈ +25 sur la pulsation de 12,0 : #fxback est posé
  // sur le ciel en source-over), qui prend toute sa force 60 px au-dessus de la pointe ; tête fondue sur 120 px.
  // Sans elle, le faisceau de la tenue n'est qu'un fil, presque invisible sur téléphone.
  const VOL_W = 180, VOL_A = 0.22, VOL_F0 = 60, HEAD_FADE = 120;
  const TAN15 = Math.tan(15 * Math.PI / 180);
  // Halo (bible : radial rgba(129,140,248,.35) → transparent, 900 px). Profil 1 − smoothstep, pic 0,42 = 0,35 × 1,2 :
  // l'opacité de repos 1/1,2 donne 0,35, les temps 10,8 et 12,0 montent à +20 %. Ni pointe au centre, ni bord visible.
  // Le halo est tracé sur #fxback (derrière tout le DOM, donc derrière l'emblème et le titre) et non par un div :
  // avec la rastérisation GPU, le dégradé d'un grand div dépendait des images rendues avant (±1 niveau selon l'ordre,
  // bible §6.8) ; sur la toile, il est retracé à chaque image (pixels identiques dans tout ordre), et il se resserre
  // sur la flèche pendant la condensation.
  const HALO_PEAK = 0.42;
  const HALO_STOPS = Array.from({ length: 11 }, (_, i) => { const u = i / 10; return [u, HALO_PEAK * (1 - u * u * (3 - 2 * u))]; });

  NX.css(`
  .dir-box{position:absolute;left:${G5.left}px;top:${G5.top}px;width:${BOX * SS}px;height:${BOX * SS}px;transform-origin:0 0;isolation:isolate;opacity:0}
  .dir-title{top:700px;transform:translateZ(${ZT}px)}
  `);

  /** Pose de l'emblème : respiration (−10 px, ×1,025, SINE) puis montée de 260 px (LIFT) ; échelle autour de C.
   *  dyB : la seule respiration (point de départ de la tête du faisceau pendant son tracé), dy : avec la montée. */
  const dirPose = t => {
    const br = SINE(seg(t, BREATH[0], BREATH[1])), up = E.lift(seg(t, RISE[0], RISE[1]));
    return { s: 1 + 0.025 * br, dyB: -10 * br, dy: -10 * br - 260 * up };
  };
  /** Point (u, v) de la boîte en px monde (1×) → point écran ; rise = false : sans la montée. */
  const dirProj = (P, u, v, rise = true) => NX.cam.project(CX + (u - OX) * P.s, CY + (v - OY) * P.s + (rise ? P.dy : P.dyB), ZR + ZB);
  /** Centre de la bande de reflet (gradient 105°, 34 % de large, translateX −110 % → 300 %) à mi-hauteur, en u. */
  const sweepAt = p => (NX.lerp(-110, 300, p) / 100) * 0.34 + 0.17;
  const sheenInv = y => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (E.sheen(m) < y) a = m; else b = m; } return (a + b) / 2; };

  /** Masque à plusieurs couches (même convention que le kit) : intersection par défaut, union avec 'add'. */
  function dirMask(el, layers, op = 'intersect') {
    const m = layers.filter(Boolean), v = m.join(','), many = m.length > 1;
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = m.map(() => '100% 100%').join(','); el.style.webkitMaskSize = el.style.maskSize;
    el.style.maskRepeat = 'no-repeat'; el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = many ? op : ''; el.style.webkitMaskComposite = many ? (op === 'add' ? 'source-over' : 'source-in') : '';
  }

  /** Masque doux de la flèche seule (pointe, ailerons, hampe, empennage), bâti une fois depuis l'alpha du PNG :
   *  composante connexe de l'axe (alpha > 100/255) dans la colonne de la lance, élargie de 2 px puis adoucie (≈ 4 px).
   *  Les bouts de l'anneau (à 5–9 px de la pointe) et les ailes n'en font pas partie : la condensation ne laisse
   *  aucune marque coupée, et la flèche n'est jamais tranchée. Retourne une couche de masque CSS, ou null. */
  function dirSpearMask(img) {
    const N = FV.W, THR = 100, DIL = 2, BL = 2;
    if (!img.naturalWidth) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, N, N);
    const im = c.getImageData(0, 0, N, N), d = im.data;
    // Colonne de la lance (px de l'image) : la tête et ses ailerons au-dessus de y 238, la hampe en dessous,
    // l'empennage (où les ailes rejoignent la hampe) au-delà de y 372.
    const inCol = (x, y) => y >= 40 && y <= 432 && (y <= 238 ? x >= 192 && x <= 316 : y < 372 ? x >= 226 && x <= 280 : x >= 224 && x <= 286);
    const m = new Uint8Array(N * N), st = [];
    for (let y = 70; y <= 400; y += 2) { const i = y * N + 254; if (d[i * 4 + 3] > THR && !m[i]) { m[i] = 1; st.push(i); } }
    while (st.length) {
      const i = st.pop(), x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, j = Y * N + X;
        if (X < 0 || Y < 0 || X >= N || Y >= N || m[j] || !inCol(X, Y) || d[j * 4 + 3] <= THR) continue;
        m[j] = 1; st.push(j);
      }
    }
    let n = 0; for (let i = 0; i < N * N; i++) n += m[i];
    if (n < 8000 || n > 30000) { console.warn('direction : masque de la flèche hors gabarit', n); return null; }
    let a = new Float32Array(N * N), b = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!m[y * N + x]) continue;
      for (let j = -DIL; j <= DIL; j++) for (let i = -DIL; i <= DIL; i++) {
        const X = x + i, Y = y + j;
        if (i * i + j * j <= DIL * DIL + 0.5 && X >= 0 && Y >= 0 && X < N && Y < N) a[Y * N + X] = 1;
      }
    }
    // Deux flous boîte séparables de rayon 2 (profil en tente) : bord doux d'environ 4 px.
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, k = 0; for (let o = -BL; o <= BL; o++) { const X = x + o; if (X >= 0 && X < N) { s += a[y * N + X]; k++; } } b[y * N + x] = s / k; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, k = 0; for (let o = -BL; o <= BL; o++) { const Y = y + o; if (Y >= 0 && Y < N) { s += b[Y * N + x]; k++; } } a[y * N + x] = s / k; }
    }
    for (let i = 0; i < N * N; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(255 * a[i]); }
    c.putImageData(im, 0, 0);
    return `url(${cv.toDataURL('image/png')})`;
  }

  /** Une passe de faisceau : draw(o) trace la couche sur la toile annexe o (demi-largeur au plus half), qui est fondue à
   *  ses deux bouts (f0 px au pied, f1 px à la tête, rampes en smoothstep : ni arête ni barre coupée), puis ajoutée en
   *  lumière sur dst. La tête qui monte se lit ainsi comme de la lumière. */
  function dirBeamPass(dst, oc, x0, y0, x1, y1, half, f0, f1, draw) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) return;
    const W = oc.width, H = oc.height, pad = half + 2;
    const bx = Math.max(0, Math.floor(Math.min(x0, x1) - pad)), by = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
    const bw = Math.min(W, Math.ceil(Math.max(x0, x1) + pad)) - bx, bh = Math.min(H, Math.ceil(Math.max(y0, y1) + pad)) - by;
    if (bw <= 0 || bh <= 0) return;
    const o = oc.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    o.clearRect(bx, by, bw, bh);
    draw(o);
    let a0 = f0 / len, a1 = f1 / len;
    if (a0 + a1 > 1) { const q = 1 / (a0 + a1); a0 *= q; a1 *= q; }
    const g = o.createLinearGradient(x0, y0, x1, y1), ss = u => (u * u * (3 - 2 * u)).toFixed(4);
    for (const u of [0, 0.25, 0.5, 0.75]) g.addColorStop(a0 * u, `rgba(0,0,0,${ss(u)})`);
    g.addColorStop(a0, '#000'); g.addColorStop(Math.max(a0, 1 - a1), '#000');
    for (const u of [0.75, 0.5, 0.25, 0]) g.addColorStop(1 - a1 * u, `rgba(0,0,0,${ss(u)})`);
    o.globalCompositeOperation = 'destination-in'; o.fillStyle = g; o.fillRect(bx, by, bw, bh);
    o.globalCompositeOperation = 'source-over';
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0); dst.globalCompositeOperation = 'lighter'; dst.globalAlpha = 1;
    dst.drawImage(oc, bx, by, bw, bh, bx, by, bw, bh);
    dst.restore();
  }
  /** Volume du faisceau : bande de largeur constante w, profil transversal gaussien (σ ≈ w/6), alpha a au centre. */
  const VOL_PROFILE = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(u => [u, u === 0 || u === 1 ? 0 : Math.exp(-0.5 * Math.pow((u - 0.5) / 0.16, 2))]);
  function dirVolume(o, x0, y0, x1, y1, w, a, rgb) {
    if (a <= 0.002) return;
    o.save(); o.globalCompositeOperation = 'lighter'; o.translate(x0, y0); o.rotate(Math.atan2(y1 - y0, x1 - x0));
    const g = o.createLinearGradient(0, -w / 2, 0, w / 2);
    for (const [u, k] of VOL_PROFILE) g.addColorStop(u, `rgba(${rgb},${(a * k).toFixed(4)})`);
    o.fillStyle = g; o.fillRect(0, -w / 2, Math.hypot(x1 - x0, y1 - y0), w);
    o.restore();
  }

  NX.scene({
    id: 'direction', start: WIN[0], end: WIN[1], z: 1.2,
    build(root) {
      this.box = NX.el('<div class="dir-box"></div>', root);
      this.L = NX.logoLight(this.box, SRC);
      this.L.band.style.background = SWEEP_BAND;
      this.title = NX.el(`<div class="tz-center dir-title"><div class="tz-title"><span class="tz-line">Une même <span class="nx-spec">direction.</span></span></div></div>`, root);
      this.words = NX.type.prepare(this.title).words;
      this.spec = this.title.querySelector('.nx-spec');
      this.oc = document.createElement('canvas'); this.oc.width = NX.W; this.oc.height = NX.H;
      // Halo : dégradé radial unitaire (rayon 1), mis à l'échelle par la transformation de la toile à chaque image.
      this.haloGrad = NX.fxBack.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [u, a] of HALO_STOPS) this.haloGrad.addColorStop(u, `rgba(129,140,248,${a.toFixed(4)})`);
    },
    async prepare() {
      await this.L.prepare();
      this.spear = dirSpearMask(this.L.img);
      // Étoile du reflet : instant où la ligne claire (penchée de 15°) croise la pointe de la lance (ancre u .494, v .102).
      const [u, v] = FV.star, uc = u + (v - 0.5) * TAN15, p = ((uc - 0.17) / 0.34 * 100 + 110) / 410;
      this.starT = GLINT[0] + (GLINT[1] - GLINT[0]) * sheenInv(p);
    },
    render(S) {
      const t = S.t, fx = NX.fx.ctx, bk = NX.fxBack.ctx, tau = t - HIT, dbg = NX.dirDebug || {};
      const P = dirPose(t);

      /* ---------------- Emblème : naissance, respiration, condensation, montée ---------------- */
      const out = 1 - sm(FADE[0], FADE[1], t), vis = sm(BIRTH[0], BIRTH[1], t) * out;
      const cond = E.glide(seg(t, COND[0], COND[1]));
      const box = this.box;
      if (vis <= 0.001) box.style.display = 'none';
      else {
        box.style.display = '';
        box.style.opacity = vis.toFixed(4);
        // Boîte 2× réduite de moitié, l'échelle de respiration autour de C : le centre de l'anneau reste en (CX, CY + dy).
        const k = P.s / SS, tx = OX * (1 - P.s), ty = OY * (1 - P.s) + P.dy;
        box.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,${ZB}px) scale(${k.toFixed(5)})`;
        // Condensation (bible) : la bande horizontale douce se referme sur l'axe à pleine force et efface l'anneau et
        // les ailes de l'extérieur vers l'intérieur ; elle est unie au masque de la flèche, qui n'est donc jamais coupée.
        // Ce qu'elle laisse autour de la flèche (ailes, bouts de l'anneau) s'éteint 12,70–12,80 (DIM), puis la flèche seule.
        // Le masque n'est posé que lorsqu'il mord sur le dessin : avant, il ne changerait aucun pixel et ne ferait
        // qu'ajouter une passe de masque à chaque image de la tenue.
        const l = COLS[0] * cond, r = 100 - (100 - COLS[1]) * cond, a = this.spear ? 1 - sm(DIM[0], DIM[1], t) : 1;
        if (dbg.noMask || !(cond > 0 && (l > ART[0] * 100 || r < ART[1] * 100 || a < 1))) dirMask(box, []);
        else if (a <= 0) dirMask(box, [this.spear]);   // dès 12,80 : la flèche seule
        else {
          const c = `rgba(0,0,0,${a.toFixed(4)})`;
          const band = `linear-gradient(to right,transparent ${(l - 3).toFixed(3)}%,${c} ${l.toFixed(3)}%,${c} ${r.toFixed(3)}%,transparent ${(r + 3).toFixed(3)}%)`;
          dirMask(box, [this.spear, band], 'add');
        }
        // Lumière ajoutée sur les traits clairs (bible) : l'éclair de l'impact 0,30·e^(−6τ), la lumière froide de la
        // flèche 0 → 0,5 (12,65–13,00), et le reflet unique de la tenue (SHEEN 11,35–12,05, plafond 0,30). La feuille
        // n'est éteinte que sous 1/255 (τ ≈ 0,72) : marche invisible. Avec la rastérisation logicielle des outils, une
        // feuille allumée n'adoucit plus l'emblème (mesuré : écart ≤ 1 niveau, la lumière elle-même).
        const hitLum = tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0;
        const lumRaw = hitLum + 0.5 * sm(SPEAR_LUM[0], SPEAR_LUM[1], t), lum = lumRaw > 0.004 ? lumRaw : 0;
        const gp = seg(t, GLINT[0], GLINT[1]), sweepP = gp > 0 && gp < 1 ? E.sheen(gp) : -1;
        if (dbg.leavesOff) this.L.frame({ front: null, written: true });
        else this.L.frame({ front: null, written: true, lum, sweepP, sweepA: SWEEP_A });
      }

      /* ---------------- Halo : monte avec l'emblème, +20 % sur 10,8 et 12,0, se resserre sur la flèche ---------------- */
      const hA = SINE(seg(t, HALO_IN[0], HALO_IN[1])) * (1 + 0.2 * NX.beatPulse(t, KICKS, 2.5)) / 1.2 * out;
      if (hA > 0.002 && !dbg.noHalo) {
        const q = NX.cam.project(CX, CY + P.dy, ZR + ZH), r = HALO / 2 * q.s * P.s;
        bk.save(); bk.globalCompositeOperation = 'lighter'; bk.globalAlpha = Math.min(1, hA);
        bk.setTransform(r * (1 - 0.6 * cond), 0, 0, r * (1 - 0.1 * cond), q.x, q.y);
        bk.fillStyle = this.haloGrad; bk.fillRect(-1, -1, 2, 2);
        bk.restore();
      }

      /* ---------------- Titre « Une même direction. » ---------------- */
      if (t >= TITLE_IN && t < TITLE_GONE) {
        this.title.style.display = '';
        NX.type.rise(this.words, t, TITLE_IN, TITLE_STEP, TITLE_DUR);
        NX.type.sink(this.words, t, TITLE_OUT, OUT_STEP, OUT_DUR);
        NX.type.sheen(this.spec, t, SHEEN_T[0], SHEEN_T[1], 0.35);
      } else this.title.style.display = 'none';

      /* ---------------- Impact de 9,6 au centre de l'anneau : cœur et une traînée violette ---------------- */
      if (tau >= 0 && tau < 1.5) {
        const q = dirProj(P, OX, OY);
        NX.hit(t, HIT, q.x, q.y, { core: 400, coreA: 0.40, flare: 0.6, tint: [167, 139, 250] });
      }

      /* ---------------- Faisceau « direction » (#fxback, derrière l'emblème), de la pointe vers la source ---------------- */
      if (t >= DRAW[0] && t < OFF) {
        const d = SINE(seg(t, DRAW[0], DRAW[1]));
        const k = (0.5 + 0.3 * NX.beatPulse(t, [KICKS[1]], 3) + 0.4 * sm(SWELL[0], SWELL[1], t)) * (1 + 0.4 * sm(RISE[0], RISE[0] + 0.3, t));
        // La tête part de la pointe telle qu'elle respire (pas de montée pendant le tracé) et rejoint la source.
        // Pied 10 px sous la pointe (dans la lance), fondu sur 26 px : le faisceau sort de la pointe. Pendant la montée,
        // le pied suit la flèche : le faisceau se retire dans la source avec elle (prise dans la lumière), et c'est le
        // faisceau du drop qui ramène la lumière à 13,20 au lieu d'un fil resté suspendu dans le vide.
        const tip = dirProj(P, OX, TIPV, false), foot = dirProj(P, OX, TIPV + 10, true), s = NX.light.src(t);
        const hx = tip.x + (s.x - tip.x) * d, hy = tip.y + (s.y - tip.y) * d;
        // Volume : sa largeur suit la longueur tracée (jamais plus large que 0,8 × la longueur, 30 px au moins) et il
        // monte avec le tracé : au coup de 10,8, aucune barre de lumière horizontale avant que la colonne n'existe.
        const len = Math.hypot(hx - foot.x, hy - foot.y), vw = Math.min(VOL_W, Math.max(30, 0.8 * len));
        dirBeamPass(bk, this.oc, foot.x, foot.y, hx, hy, vw / 2, VOL_F0, HEAD_FADE, o => dirVolume(o, foot.x, foot.y, hx, hy, vw, VOL_A * k * sm(0.05, 0.35, d), BEAM_GLOW));
        dirBeamPass(bk, this.oc, foot.x, foot.y, hx, hy, 15, 26 * tip.s, HEAD_FADE, o => {
          NX.lk.beam(foot.x, foot.y, hx, hy, 24, 24 + 6 * d, 0.16 * k, BEAM_GLOW, o);
          NX.lk.beam(foot.x, foot.y, hx, hy, 3, 3, 0.6 * k, BEAM_CORE, o);
        });
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
      if (this.starT && t > this.starT - 0.07 && t < this.starT + 1) {
        const g = 0.7 * (t < this.starT ? sm(this.starT - 0.07, this.starT, t) : Math.exp(-6 * (t - this.starT)));
        if (g > 0.004) { const q = dirProj(P, FV.star[0] * BOX, FV.star[1] * BOX); NX.lk.star(q.x, q.y, g, { size: 0.7 * q.s }); }
      }
    },
  });
})();
