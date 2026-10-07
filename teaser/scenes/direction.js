/* S5 Direction (bible v7 §4 S5, amendements v7.1 et v7.2), fenêtre 7,0–13,3 s, z 1,2 : l'emblème du moment continu
 * du logo, puis « Une même direction. ». Chaque instant est écrit par rapport à NX.T (frise ci-dessous) : l'emblème et
 * la tenue suivent T.emblem (9,6), la condensation, la montée et la sortie suivent le drop (T.tools, 13,2).
 * v7.2 : l'emblème n'est plus créé à 9,6. Il est l'emblème même du logo de S2 : quand il ne reste du logo que les
 * traits de son emblème (logo.js), cet emblème (le favicon, à la même place et à la même échelle : × 1,1425 en
 * (335,5 ; 48,5) px du logo, plan du logo) arrive par-dessus en un fondu enchaîné de 0,15 s (NX.M72.DISSOLVE, 7,10–7,25,
 * revue M ; 2 px devant le plan du logo, projection inchangée). Il suit ensuite le trajet de NX.M72 : immobile pendant
 * la naissance des rôles autour de lui (equipe.js ; sur chaque cloche, le secteur tourné vers la place du rôle
 * s'éclaire), il grandit en SINE (8,6–9,6) jusqu'à la géométrie E5 pendant que leurs particules y entrent ; chaque
 * secteur se charge de leur lumière (feuille des secteurs ≤ 0,22, plafond de marque 0,30), les secteurs du bas d'abord,
 * la lance en dernier, de plus en plus vite jusqu'à l'impact de 9,6 qui la relâche : cœur, une traînée, l'onde de choc
 * (ciel).
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
 * Le logo n'est jamais tourné ni filtré : masques doux, translation, échelle uniforme, feuilles de lumière. Il est
 * affiché depuis une copie fixe du PNG sur une toile (pixels du PNG, même plan que l'<img> du kit) : rendu identique
 * dans tout ordre de rendu (bible §6.8).
 * Fonction pure de t : masque de la flèche, copie de l'emblème, instant de l'étoile et toile annexe sont préparés une fois.
 * Vérification (bible §6.8, §6.10) : NX.dirDebug = { leavesOff } coupe toute lumière ajoutée sur l'emblème,
 * { noSec } la feuille des secteurs, { noHalo } retire le halo, { noMask } désactive le masque de condensation ;
 * NX.logoDebug = { fav } / { lock } : contrôle §6.9 inversé du fondu enchaîné (voir logo.js). */
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
  // Coin de la boîte posé au px entier : Chrome cale la position de mise en page d'un calque composé sur le px entier
  // avant d'appliquer sa transformation (mesuré : 732,25 → 0,23 px à gauche de la géométrie voulue) ; la fraction
  // passe dans le translate3d, exact. Sans cela l'emblème seul était décalé de 0,3 px par rapport à celui du logo.
  const BL = Math.floor(G5.left), BT = Math.floor(G5.top), FXL = G5.left - BL, FXT = G5.top - BT;

  /* Frise (bible §4 S5, amendement v7.1). Les valeurs en commentaire sont celles de la frise v7.1 (v7 − 4,8 s). */
  const at = (a, d) => Math.round((a + d) * 1e6) / 1e6;   // instant relatif à un repère de NX.T, sans résidu flottant
  const HIT = NX.T.emblem;                       // 9,6 : impact (l'emblème, déjà là, est résolu à la géométrie E5)
  const DROP = NX.T.tools;                       // 13,2 : drop, la lumière redescend sur la première carte
  const M72 = NX.M72;                            // trajet de l'emblème du moment continu (logo.js)
  const [DIS0, DIS1] = M72.DISSOLVE;            // 7,10 → 7,25 : fondu enchaîné de l'emblème du logo vers cet emblème
  const WIN = [at(DIS0, -0.10), at(DROP, 0.10)]; // fenêtre de la scène 7,0–13,3
  /* Lumière par secteur (revue M) : une feuille plus-lighter de plus, masquée par les traits clairs, dont le fond est un
   * dégradé conique autour du centre de l'anneau qui donne à chacun des cinq secteurs des rôles sa propre lumière
   * (fondus de ± SEC_F° entre secteurs, lumière froide). Deux usages, jamais en même temps :
   * - cloches des rôles (7,2–8,4) : sur la cloche de chaque rôle, le secteur tourné vers sa place s'éclaire (BELL_A, forme
   *   du flash de cloche) : chaque joueur naît de la lumière de l'emblème ;
   * - charge (9,20–9,6) : chaque secteur reçoit la lumière de ses particules à mesure qu'elles s'y fondent (part absorbée
   *   NX.M72.absorbed, tables d'equipe.js), sous une enveloppe qui accélère jusqu'à l'impact (inQuad) : les secteurs du bas
   *   d'abord, la lance (Mid) en dernier, complète sur 9,6. L'impact (0,30·e^(−6τ), feuille lum du kit) prend alors le
   *   relais : jamais plus de 0,30 (plafond de marque). */
  const CHARGE = [at(HIT, -0.40), HIT], CHARGE_A = 0.22, BELL_A = 0.12, SEC_F = 8, SPIN = 20;
  const PENT_DEG = NX.G.pent.deg, BELLS = NX.beats.bells.slice(0, 5);
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
  .dir-box{position:absolute;left:${BL}px;top:${BT}px;width:${BOX * SS}px;height:${BOX * SS}px;transform-origin:0 0;isolation:isolate;opacity:0}
  .dir-img{position:absolute;inset:0;width:100%;height:100%;transform:translateZ(2px)}
  .dir-sec{position:absolute;inset:0;mix-blend-mode:plus-lighter;transform:translateZ(3.6px);display:none}
  .dir-title{top:700px;transform:translateZ(${ZT}px)}
  `);

  /** Pose de l'emblème : trajet NX.M72 (de l'emblème du logo à E5, 7,18–9,6 ; échelle relative à E5, décalage du centre
   *  de l'anneau, plan), puis respiration (−10 px, ×1,025, SINE) et montée de 260 px (LIFT) ; échelle autour de C.
   *  dyB : sans la montée (point de départ de la tête du faisceau pendant son tracé), dy : avec la montée.
   *  zb : translateZ de la boîte dans la racine (plan du logo −0,5 à SWAP, plan 2,6 de la v7.1 dès 9,6). */
  const dirPose = t => {
    const m = M72.pose(t), br = SINE(seg(t, BREATH[0], BREATH[1])), up = E.lift(seg(t, RISE[0], RISE[1]));
    const dyB = m.cy - CY - 10 * br;
    return { s: m.s / M72.S1 * (1 + 0.025 * br), dx: m.cx - CX, dyB, dy: dyB - 260 * up, zb: m.z - ZR };
  };
  /** Point (u, v) de la boîte en px monde (1×) → point écran ; rise = false : sans la montée. */
  const dirProj = (P, u, v, rise = true) => NX.cam.project(CX + P.dx + (u - OX) * P.s, CY + (v - OY) * P.s + (rise ? P.dy : P.dyB), ZR + P.zb);
  /** Centre de la bande de reflet (gradient 105°, 34 % de large, translateX −110 % → 300 %) à mi-hauteur, en u. */
  const sweepAt = p => (NX.lerp(-110, 300, p) / 100) * 0.34 + 0.17;
  const sheenInv = y => { let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (E.sheen(m) < y) a = m; else b = m; } return (a + b) / 2; };

  /** Flash de cloche du rôle i (même forme qu'equipe.js) : inQuad sur 0,12 s jusqu'à sa cloche, puis e^(−6τ). */
  const dirBell = (i, t) => { const T = BELLS[i]; return t < T - 0.12 ? 0 : t < T ? E.inQuad(seg(t, T - 0.12, T)) : Math.exp(-6 * (t - T)); };
  /** Fond de la feuille par secteur : dégradé conique (0° en haut, sens horaire) autour du centre de l'anneau, chaque
   *  secteur des rôles (centré sur l'angle du pentagone + spin, ± 36°) à sa propre intensité a[k], fondus de ± SEC_F°.
   *  Angles écran (y vers le bas, 0° à droite) → angles CSS : + 90°. */
  const SEC_C = [OX * SS, OY * SS];                   // centre de l'anneau dans la boîte 2×
  // Les cinq secteurs se suivent tous les 72° : dans l'ordre des angles, Top 126, Jungle 198, Mid 270, ADC 342, Support 54.
  const SEC_ORDER = PENT_DEG.map((d, k) => [((d % 360) + 360) % 360, k]).sort((x, y) => x[0] - y[0]).map(p => p[1]);
  function dirSecBg(a, spin) {
    // Le dégradé part du milieu du premier secteur : la couture du tour complet tombe dans une zone uniforme.
    const k0 = SEC_ORDER[0], from = PENT_DEG[k0] + spin + 90, col = k => `rgba(200,240,255,${NX.clamp(a[k]).toFixed(4)})`;
    const stops = [`${col(k0)} 0deg`];
    SEC_ORDER.forEach((k, i) => {
      const n = SEC_ORDER[(i + 1) % 5], b = 36 + 72 * i;
      stops.push(`${col(k)} ${b - SEC_F}deg`, `${col(n)} ${b + SEC_F}deg`);
    });
    stops.push(`${col(k0)} 360deg`);
    return `conic-gradient(from ${(((from % 360) + 360) % 360).toFixed(2)}deg at ${SEC_C[0].toFixed(2)}px ${SEC_C[1].toFixed(2)}px,${stops.join(',')})`;
  }

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

  /** Emblème affiché depuis une toile : copie exacte du PNG à sa taille native (512 px), faite une fois et posée à la
   *  place de l'<img> du kit (même plan translateZ(2px), même rang sous les feuilles de lumière, qui restent celles du
   *  kit). L'<img> composée seule dépendait de l'histoire de rendu : après les rôles, 3 à 6 px de l'emblème changeaient
   *  d'un niveau (tools/determinism.mjs échouait à 9,6, bible §6.8) ; et Chromium la rastérisait par moments à une
   *  échelle réduite (traits 4 à 5 % plus mous vers 10,4–11,2 et 12,2–12,5, nets ailleurs : de petits sauts de netteté
   *  pendant la tenue). La toile est une texture fixe : mêmes pixels dans tout ordre, la même netteté dans toute la
   *  tenue. Aucun pixel du logo n'est redessiné ni recoloré (drawImage 1:1, sans filtre). Sans image décodée, l'<img>
   *  reste affichée. */
  function dirCanvas(img) {
    if (!img.naturalWidth) return null;
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.className = 'dir-img';
    cv.getContext('2d').drawImage(img, 0, 0);
    img.after(cv); img.style.display = 'none';
    return cv;
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
      this.sec = NX.el('<div class="dir-sec"></div>', this.box);   // lumière par secteur (cloches, charge)
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
      if (this.L.url) dirMask(this.sec, [this.L.url]);             // traits clairs du favicon (masque du kit)
      this.cv = dirCanvas(this.L.img);
      this.spear = dirSpearMask(this.L.img);
      // Étoile du reflet : instant où la ligne claire (penchée de 15°) croise la pointe de la lance (ancre u .494, v .102).
      const [u, v] = FV.star, uc = u + (v - 0.5) * TAN15, p = ((uc - 0.17) / 0.34 * 100 + 110) / 410;
      this.starT = GLINT[0] + (GLINT[1] - GLINT[0]) * sheenInv(p);
    },
    render(S) {
      const t = S.t, fx = NX.fx.ctx, bk = NX.fxBack.ctx, tau = t - HIT, dbg = NX.dirDebug || {};
      const P = dirPose(t);

      /* ---------------- Emblème : fondu enchaîné (7,10–7,25), croissance, charge, respiration, condensation, montée ----
       * Revue M : il arrive par-dessus l'emblème du logo (logo.js), dont il a les pixels (§6.9), en SINE sur 0,15 s, 2 px
       * devant son plan (projection inchangée, voir plus bas) ; le logo est retiré à la fin du fondu.
       * { fav } (NX.logoDebug, contrôle §6.9 inversé) : l'emblème seul, opaque, dès DIS0 − 0,1, le logo retiré ;
       * { lock } : l'emblème du logo seul jusqu'à DIS1. */
      const out = 1 - sm(FADE[0], FADE[1], t), lg = NX.logoDebug || {};
      const arrive = lg.lock ? (t >= DIS1 ? 1 : 0) : lg.fav && t >= DIS0 - 0.1 ? 1 : M72.dissolve(t);
      const vis = arrive * out;
      const cond = E.glide(seg(t, COND[0], COND[1]));
      const box = this.box;
      if (vis <= 0.001) box.style.display = 'none';
      else {
        box.style.display = '';
        box.style.opacity = vis >= 1 ? '1' : vis.toFixed(4);   // la règle .dir-box pose opacity:0
        // Boîte 2× réduite de moitié, l'échelle autour du centre de l'anneau (CX + dx, CY + dy), sur le plan zb.
        // Revue M : pendant le fondu enchaîné et jusqu'à la croissance, la boîte est relevée de M72.LIFT px vers la caméra
        // (jamais coplanaire avec l'emblème du logo) et ramenée par une homothétie centrée au pied de l'œil sur ce plan
        // (comme fin.js) : sa projection reste exactement celle du trajet NX.M72. Le relevé s'annule avec la croissance.
        let k = P.s / SS, tx = FXL + OX * (1 - P.s) + P.dx, ty = FXT + OY * (1 - P.s) + P.dy, zb = P.zb;
        const lift = M72.LIFT * (1 - M72.grow(t)), cam = NX.camState;
        if (lift > 0 && cam) {
          const ex = NX.W / 2 + cam.x, ey = NX.H / 2 + cam.y, pz = NX.cam.D - cam.z, Zw = ZR + P.zb, ke = (pz - Zw - lift) / (pz - Zw);
          tx = ex + (BL + tx - ex) * ke - BL; ty = ey + (BT + ty - ey) * ke - BT; k *= ke; zb += lift;
        }
        box.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,${zb.toFixed(3)}px) scale(${k.toFixed(5)})`;
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
        // v7.2 (revue M) : avant l'impact, la lumière ajoutée passe par la feuille des secteurs (cloches, charge, voir
        // CHARGE) ; l'impact (0,30, au-dessus de la charge 0,22) la relaie sur tout l'emblème.
        const hitLum = tau >= 0 ? 0.30 * Math.exp(-6 * tau) : 0;
        const lumRaw = hitLum + 0.5 * sm(SPEAR_LUM[0], SPEAR_LUM[1], t), lum = lumRaw > 0.004 ? lumRaw : 0;
        // Feuille des secteurs : cloches des rôles (secteur tourné vers chaque place) puis charge (secteurs des particules,
        // tournés de SPIN), sous une enveloppe qui accélère jusqu'à l'impact. Éteinte (display:none) quand elle est nulle.
        const sec = [0, 0, 0, 0, 0];
        let spin = 0, secMax = 0;
        if (!dbg.leavesOff && !dbg.noSec && tau < 0) {
          if (t < CHARGE[0]) for (let i = 0; i < 5; i++) sec[i] = BELL_A * dirBell(i, t);
          else {
            spin = SPIN;
            const env = 0.35 + 0.65 * E.inQuad(seg(t, CHARGE[0], CHARGE[1])), F = M72.absorbed;
            for (let i = 0; i < 5; i++) sec[i] = CHARGE_A * env * (F ? F(i, t) : SINE(seg(t, CHARGE[0], CHARGE[1])));
          }
          secMax = Math.max(...sec);
        }
        if (secMax > 0.002) {
          this.sec.style.display = 'block';               // la règle .dir-sec pose display:none
          this.sec.style.background = dirSecBg(sec, spin);
        } else this.sec.style.display = 'none';
        const gp = seg(t, GLINT[0], GLINT[1]), sweepP = gp > 0 && gp < 1 ? E.sheen(gp) : -1;
        if (dbg.leavesOff) this.L.frame({ front: null, written: true });
        else this.L.frame({ front: null, written: true, lum, sweepP, sweepA: SWEEP_A });
      }

      /* ---------------- Halo : monte avec l'emblème, +20 % sur 10,8 et 12,0, se resserre sur la flèche ---------------- */
      const hA = SINE(seg(t, HALO_IN[0], HALO_IN[1])) * (1 + 0.2 * NX.beatPulse(t, KICKS, 2.5)) / 1.2 * out;
      if (hA > 0.002 && !dbg.noHalo) {
        const q = NX.cam.project(CX + P.dx, CY + P.dy, ZR + ZH), r = HALO / 2 * q.s * P.s;
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
