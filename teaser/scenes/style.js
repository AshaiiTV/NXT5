/* Socle commun du teaser v6 : frise des temps forts, typographie et animations de texte partagées.
 * Une seule direction artistique : nébuleuse et rayons venus du haut, grands titres Inter 800 centrés
 * ou alignés à gauche, accent en dégradé de marque, panneaux arrondis. */
(function () {
  const B = NX.BEAT, BAR = NX.BAR;
  /* Temps forts en secondes de film (grille de 0,6 s). La musique et l'image lisent la même frise. */
  NX.T = {
    hookEnd: 2 * BAR,            // 4,8 : fin de l'accroche, apparition du logo
    roles: 3 * BAR,              // 7,2 : premier rôle posé, puis un rôle par temps
    team: 4 * BAR,               // 9,6 : « Toute ton équipe. », tenu pendant la fusion
    fuse: 5 * BAR + B,           // 12,6 : début de la fusion (1,8 s)
    emblem: 6 * BAR,             // 14,4 : l'emblème naît de la fusion, « Une même direction. »
    tools: 7.5 * BAR,            // 18,0 : premier outil, la batterie entre
    tool: 1.5 * BAR,             // 3,6 s par outil
    end: 12 * BAR,               // 28,8 : carte finale
  };
  /* Impacts partagés par l'image et le son. */
  NX.T.hits = [NX.T.hookEnd, NX.T.emblem, NX.T.tools, NX.T.end];

  NX.css(`
  .tz-title{font-weight:800;font-size:96px;line-height:1.06;letter-spacing:-.032em;color:var(--text);white-space:nowrap}
  .tz-title .nx-word{will-change:transform,opacity,filter}
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
  /** Format français des milliers avec espace fine insécable. */
  NX.fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
})();
