/* S1 Accroche (bible v7 §4 S1), 0–4,8 s : la question monte mot à mot à travers ses masques de ligne,
 * son interlettrage se resserre pendant la tenue, un seul reflet passe sur « comprendre ton équipe »,
 * puis le front de lumière venu de la source la brûle ligne à ligne (avance 0, fondu 60 px) pendant qu'il
 * écrit NXT5 derrière elle (silhouette et écriture du logo : logo.js). Chaque mot s'allume au passage du front.
 * Fonction pure de t : la géométrie est mesurée dans layout(), les fenêtres de brûlure dans prepare(). */
(function () {
  const TOP = NX.G.hook.top, FEATHER = 60, LEAD = 0;
  /** Reflet des mots en dégradé (version locale de NX.type.sheen) : courbe SHEEN et course limitée à la largeur
   *  des mots (centre de bande −0,12 → 1,12 de la boîte), de gauche à droite. La version du kit (inOutCubic,
   *  course de 3,2 largeurs) ne passe que 0,11 s sur les mots et se lit comme un clignement. */
  const accrocheSheen = (spec, t, a, b, strength) => {
    const p = NX.seg(t, a, b), on = p > 0 && p < 1;
    for (const w of spec.querySelectorAll('.nx-word')) {
      const d = w.dataset; if (!d.bw) continue;
      if (!on) { w.style.backgroundImage = 'var(--spectrum-text)'; w.style.backgroundSize = `${d.bw}px ${d.bh}px`; w.style.backgroundPosition = `${d.dx}px ${d.dy}px`; w.style.backgroundRepeat = ''; continue; }
      const bw = +d.bw, sx = +d.dx + NX.lerp(-0.62, 0.62, NX.ease.sheen(p)) * bw;
      w.style.backgroundImage = `linear-gradient(100deg,transparent 40%,rgba(255,255,255,${strength}) 50%,transparent 60%),var(--spectrum-text)`;
      w.style.backgroundSize = `${bw}px ${d.bh}px,${bw}px ${d.bh}px`;
      w.style.backgroundPosition = `${sx.toFixed(2)}px ${d.dy}px,${d.dx}px ${d.dy}px`;
      w.style.backgroundRepeat = 'no-repeat,no-repeat';
    }
  };
  // flow-root : les marges négatives du masque .tz-line ne traversent plus la ligne de titre, sinon elles
  // fusionnent d'une ligne à l'autre et l'interligne passe de 1,06 (101,8 px, comme la v6) à 115 px.
  NX.css(`
  .accroche-q{top:${TOP}px}
  .accroche-q .tz-title{letter-spacing:-.032em;display:flow-root}
  `);

  NX.scene({
    id: 'accroche', start: 0, end: 5.6, z: 0,
    build(root) {
      this.q = NX.el(`<div class="tz-center accroche-q">
        <div class="tz-title"><span class="tz-line">Envie d’analyser tes games</span></div>
        <div class="tz-title"><span class="tz-line">et de <span class="nx-spec">comprendre ton équipe</span>&nbsp;?</span></div>
      </div>`, root);
      this.titles = [...this.q.querySelectorAll('.tz-title')];
      this.lineEls = [...this.q.querySelectorAll('.tz-line')];
      this.lines = NX.type.prepare(this.q).lines;   // [[Envie, d’analyser, tes, games], [et, de, comprendre, ton, équipe, ?]]
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
    // Fenêtres de brûlure par ligne, calculées une fois avec la vraie caméra et la vraie piste du front.
    prepare() {
      const track = NX.FRONT.hook, o = { t0: 4.0, t1: 5.6 };
      this.win = this.lines.map(ws => {
        const bs = ws.map(w => this.wordBox[this.words.indexOf(w)]);
        let on = Infinity, gone = -Infinity;
        for (const b of bs) {
          // Haut des mots : le masque doit être posé un peu avant que le bord du front (r + 60) ne les touche.
          for (const fx of [0, 0.5, 1]) on = Math.min(on, NX.light.when(track, b.x + fx * b.w, b.y, 0, { ...o, off: FEATHER + LEAD + 40 }));
          // Bas des mots : la ligne est entièrement brûlée quand r − 10 a dépassé tous ses coins bas.
          for (const fx of [0, 1]) gone = Math.max(gone, NX.light.when(track, b.x + fx * b.w, b.y + b.h, 0, { ...o, off: LEAD - 14 }));
        }
        return { on, gone };
      });
    },
    render(S) {
      const t = S.t;
      // Entrée : les mots montent à travers le masque de leur ligne (ENTER 0,8 s). « Envie » est à 93 % à t = 0.
      NX.type.rise(this.lines[0], t, -0.30, 0.16, 0.8);
      NX.type.rise(this.lines[1], t, 1.50, 0.14, 0.8);
      // Tenue : interlettrage −0,012em → −0,032em (outCubic) sur chaque ligne, un seul reflet sur les mots en dégradé.
      for (const el of this.titles) NX.type.track(el, t, 0.20, 3.60, -0.012, -0.032);
      accrocheSheen(this.spec, t, 2.70, 3.50, 0.35);
      // Sortie : le front elliptique brûle chaque ligne ; chaque mot s'allume quand le front le traverse.
      const R = NX.FRONT.hook(t);
      this.lineEls.forEach((el, k) => {
        const w = this.win ? this.win[k] : { on: Infinity, gone: Infinity };
        el.style.visibility = t >= w.gone ? 'hidden' : '';
        if (t < w.on || t >= w.gone) { NX.light.clear(el); return; }
        const b = this.lineBox[k];
        NX.light.burn(el, NX.light.local(b.x, b.y, 0, R, t), { feather: FEATHER, lead: LEAD });
      });
      NX.light.wordGlow(this.words, this.centres, R, t, LEAD);
    },
  });
})();
