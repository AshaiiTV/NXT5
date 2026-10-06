/* Socle commun du teaser v6 : frise des temps forts, typographie et animations de texte partagées.
 * Une seule direction artistique : nébuleuse et rayons venus du haut, grands titres Inter 800 centrés
 * ou alignés à gauche, accent en dégradé de marque, panneaux arrondis. */
(function () {
  const B = NX.BEAT, BAR = NX.BAR;
  /* Temps forts en secondes de film (grille de 0,6 s). La musique et l'image lisent la même frise.
   * v7.1 : les rôles deviennent une transition (une croche chacun, puis la fusion), et quatre outils. */
  NX.T = {
    hookEnd: 2 * BAR,            // 4,8 : fin de l'accroche, apparition du logo
    roles: 3 * BAR,              // 7,2 : les cinq rôles jaillissent de la lumière du logo, un par croche
    team: 3 * BAR + 2 * B,       // 8,4 : cinquième rôle posé
    fuse: 3 * BAR + 2 * B,       // 8,4 : la fusion commence (1,2 s)
    emblem: 4 * BAR,             // 9,6 : l'emblème naît de la fusion, « Une même direction. »
    tools: 5.5 * BAR,            // 13,2 : premier outil, la batterie entre
    tool: 1.5 * BAR,             // 3,6 s par outil, quatre outils
    end: 11.5 * BAR,             // 27,6 : carte finale
  };
  /* Impacts partagés par l'image et le son. */
  NX.T.hits = [NX.T.hookEnd, NX.T.emblem, NX.T.tools, NX.T.end];

  NX.css(`
  .tz-title{font-weight:800;font-size:96px;line-height:1.06;letter-spacing:-.032em;color:var(--text);white-space:nowrap;display:flow-root}
  /* flow-root : les marges négatives des masques .tz-line ne fusionnent plus d'une ligne à l'autre (interligne 1,06). */
  .tz-kicker{font-weight:700;font-size:32px;letter-spacing:.28em;text-transform:uppercase;color:var(--cyan)}
  .tz-center{position:absolute;left:0;right:0;text-align:center}
  `);

  /** Entrée mot à mot : chaque mot monte, se précise et apparaît (0,55 s par mot). */
  NX.wordsIn = (words, t, start, stagger = 0.14, dur = 0.55) => {
    words.forEach((w, i) => {
      const p = NX.ease.outCubic(NX.seg(t, start + i * stagger, start + i * stagger + dur));
      w.style.opacity = p;
      w.style.transform = `translateY(${(1 - p) * 30}px)`;
      w.style.filter = p < 0.999 ? `blur(${(1 - p) * 10}px)` : '';
    });
  };
  /** Sortie d'un bloc : il s'élève légèrement, se floute et s'efface. */
  NX.blockOut = (el, t, a, b, { rise = 24, scale = 1 } = {}) => {
    const q = NX.ease.inOutCubic(NX.seg(t, a, b));
    el.style.opacity = 1 - q;
    el.style.filter = q > 0.001 ? `blur(${q * 10}px)` : '';
    el.style.transform = `translateY(${-q * rise}px) scale(${1 + (scale - 1) * q})`;
    return q;
  };
  /* Géométrie partagée de la v7 (bible §3.10), mesurée sur les PNG. Gelée : toute scène lit ces valeurs. */
  NX.G = {
    hook: { top: 400 },
    LOGO: { W: 1254, H: 989, axisX: 625, ringC: [625, 356], spearTip: [625, 106],
            rows: { emblem: [106, 439], wordmark: [440, 759], tagline: [760, 802] },
            stars: { spear: [0.498, 0.107], five: [0.86, 0.46] } },
    FAV: { W: 512, ringC: [253.5, 269.0], ringR: 176, ringBand: [168, 186], innerBand: [144, 158],
           arcDeg: [148, 392], spearCols: [0.445, 0.547], spearTip: [253, 52], spearBottom: [254, 415],
           toLockup: { s: 1.1425, x: 335.5, y: 48.5 }, star: [0.494, 0.102] },
    L2: { left: 560, top: 225, w: 800 },           // logo de S2, h 631, centre de l'anneau monde (958.7, 452.1)
    L9: { left: 650, top: 70, w: 620 },            // logo de S9, h 489, centre de l'anneau monde (959.1, 246.0)
    dock: { left: 815.9, top: 94.0, size: 289.2 }, // emblème posé exactement sur celui du logo final
    E5: { left: 732.25, top: 200, size: 460 },     // emblème de S5 ; centre C = (960, 441.7), rayon de l'anneau 158.1
    roles: { y: 430, x: i => 960 + (i - 2) * 300, tile: 216, icon: 132, labelTop: 562 },
    pent: { c: [960, 441.7], r: 200, deg: [126, 198, 270, 342, 54], scale: 0.62 },
    tools: { col: { left: 190, top: 360, z: 40 },
             stack: { left: 975, top: 300, w: 830, h: 540, z: -60, rotY: 10, rotX: 2, origin: '0 0',
                      slots: [[0, 0, 0], [0, -46, -150], [0, -92, -300]], fog: [0, 0.42, 0.84] } },
    end: { buttonTop: 600, line1Top: 770, line2Top: 850 },
  };
  /* Fronts de lumière (rayon vertical en px écran) : l'écriture du logo à 4,8 s et le retour à 27,6 s.
   * L'onde de l'accroche part à 4,18 s (bible : 4,20) pour rester sous 1 600 px/s (pointe 1 498 au lieu de 1 653). */
  NX.FRONT = {
    hook: NX.track([[4.18, 40], [4.42, 392], [4.52, 520], [4.80, 735], [5.02, 960], [5.30, 1090], [5.55, 1115]]),
    end: NX.track([[27.10, 120], [27.35, 330], [27.60, 560], [27.90, 880], [28.25, 1200], [28.60, 1300]]),
  };
  /** Format français des milliers avec espace fine insécable. */
  NX.fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
})();
