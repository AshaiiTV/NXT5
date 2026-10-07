/* S1 Accroche (bible v7.1 : amendement S1, §4 S1), 0–4,8 s : la question monte mot à mot à travers ses masques de
 * ligne, en trois lignes (« Envie d’analyser tes games / et de comprendre ton équipe / sur League of Legends ? »), son
 * interlettrage se resserre pendant la tenue, un seul reflet passe sur « comprendre ton équipe », puis le front de lumière
 * venu de la source la brûle ligne à ligne (fondu 60 px) pendant qu'il écrit NXT5 derrière elle (silhouette et écriture
 * du logo : logo.js). Chaque mot s'allume au passage du bord de brûlure.
 * Fonction pure de t : la géométrie est mesurée dans layout(), les fenêtres de brûlure dans prepare(). */
(function () {
  /* Position (v7.1) : le bloc de trois lignes monte de 50 px (haut 350, bas 656 px monde ; encre 362–661) pour garder
   * le centre optique du bloc de deux lignes de la v7 (≈ 40 px au-dessus du centre de l'image, à 4 px près). */
  const DY = -50, TOP = NX.G.hook.top + DY, FEATHER = 60;
  /* Brûlure (v7.1) : la ligne 3 recouvre le milieu de NXT5, que le même front écrit vers 4,74–4,86. Le bord de brûlure
   * part avec une avance nulle sur NX.FRONT.hook (ligne 1, comme en v7) puis prend de l'avance (SINE 4,58–4,80, jusqu'à
   * 90 px) : un seul bord continu qui accélère sur la ligne 3 (≤ 1 400 px/s, sous la limite des fronts), si bien que la
   * question a disparu sur 4,80 (4,81 aux extrémités) avant que les lettres de NXT5 n'aient besoin de sa place, sans
   * double exposition sur l'impact. */
  const LMAX = 90, LEAD = t => LMAX * NX.ease.sine(NX.seg(t, 4.58, 4.80));
  const RB = t => NX.FRONT.hook(t) + LEAD(t);
  /* Cadence (bible §2.2) : ligne 1 au pas de 0,16 s de la v6 ; lignes 2 et 3 au pas de 0,14 s, la ligne 3 enchaînée
   * après un court souffle (0,24 s). Les trois lignes sont complètes à 3,36 s (amendement v7.1 : « vers 3,4 s »). */
  const RISE = [[-0.30, 0.16], [1.20, 0.14], [2.00, 0.14]];
  const SHEEN = [2.70, 3.50];            // le reflet traverse le dégradé vers 2,95–3,3, quand la ligne 3 se pose
  // Interligne 1,06, interlettrage −0,032em et flow-root viennent de .tz-title (style.js) ; seule la position est locale.
  NX.css(`
  .accroche-q{top:${TOP}px}
  `);

  NX.scene({
    id: 'accroche', start: 0, end: 5.6, z: 0,
    build(root) {
      // La ligne 3 garde la couleur du texte : l'accent spectral reste sur « comprendre ton équipe ». Espace insécable
      // avant « ? ».
      this.q = NX.el(`<div class="tz-center accroche-q">
        <div class="tz-title"><span class="tz-line">Envie d’analyser tes games</span></div>
        <div class="tz-title"><span class="tz-line">et de <span class="nx-spec">comprendre ton équipe</span></span></div>
        <div class="tz-title"><span class="tz-line">sur League of Legends&nbsp;?</span></div>
      </div>`, root);
      this.titles = [...this.q.querySelectorAll('.tz-title')];
      this.lineEls = [...this.q.querySelectorAll('.tz-line')];
      // [[Envie, d’analyser, tes, games], [et, de, comprendre, ton, équipe], [sur, League, of, Legends, ?]]
      this.lines = NX.type.prepare(this.q).lines;
      this.words = this.lines.flat();
      this.spec = this.q.querySelector('.nx-spec');
    },
    // Mesures en px monde (racine de scène = origine), à l'interlettrage final −0,032em comme le veut la bible.
    layout(root) {
      const pos = el => { let x = 0, y = 0; for (let e = el; e && e !== root; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
      this.lineBox = this.lineEls.map(l => { const [x, y] = pos(l); return { x, y }; });
      this.wordBox = this.words.map(w => { const [x, y] = pos(w); return { x, y, w: w.offsetWidth, h: w.offsetHeight }; });
      this.centres = this.wordBox.map(b => [b.x + b.w / 2, b.y + b.h / 2, 0]);
    },
    // Fenêtres de brûlure par ligne, calculées une fois avec la vraie caméra et le vrai bord de brûlure.
    prepare() {
      const o = { t0: 4.0, t1: 5.6 };
      this.win = this.lines.map(ws => {
        const bs = ws.map(w => this.wordBox[this.words.indexOf(w)]);
        let on = Infinity, gone = -Infinity;
        for (const b of bs) {
          // Haut des mots : le masque doit être posé un peu avant que le bord de brûlure (r + 60) ne les touche.
          for (const fx of [0, 0.5, 1]) on = Math.min(on, NX.light.when(RB, b.x + fx * b.w, b.y, 0, { ...o, off: FEATHER + 40 }));
          // Bas des mots : la ligne est entièrement brûlée quand r − 10 a dépassé tous ses coins bas.
          for (const fx of [0, 1]) gone = Math.max(gone, NX.light.when(RB, b.x + fx * b.w, b.y + b.h, 0, { ...o, off: -14 }));
        }
        return { on, gone };
      });
      this.allGone = Math.max(...this.win.map(w => w.gone));
    },
    render(S) {
      const t = S.t;
      // Bloc vide (toutes les lignes brûlées) : display:none, pour qu'aucune texture de calque ne survive (ENGINE.md).
      const empty = this.allGone !== undefined && t >= this.allGone;
      this.q.style.display = empty ? 'none' : '';
      if (empty) return;
      // Entrée : les mots montent à travers le masque de leur ligne (ENTER 0,8 s). « Envie » est à 93 % à t = 0.
      this.lines.forEach((ws, k) => NX.type.rise(ws, t, RISE[k][0], RISE[k][1], 0.8));
      // Tenue : interlettrage −0,012em → −0,032em (outCubic) sur chaque ligne, un seul reflet sur les mots en dégradé.
      for (const el of this.titles) NX.type.track(el, t, 0.20, 3.60, -0.012, -0.032);
      NX.type.sheen(this.spec, t, SHEEN[0], SHEEN[1], 0.35);
      // Sortie : le bord de brûlure (front + avance) efface chaque ligne ; chaque mot s'allume quand il le traverse.
      const R = NX.FRONT.hook(t), lead = LEAD(t);
      this.lineEls.forEach((el, k) => {
        const w = this.win ? this.win[k] : { on: Infinity, gone: Infinity };
        el.style.visibility = t >= w.gone ? 'hidden' : '';
        if (t < w.on || t >= w.gone) { NX.light.clear(el); return; }
        const b = this.lineBox[k], L = NX.light.local(b.x, b.y, 0, R, t);
        NX.light.burn(el, L, { feather: FEATHER, lead: lead * L.r / R });   // avance convertie en px locaux
      });
      NX.light.wordGlow(this.words, this.centres, R, t, lead);
    },
  });
})();
