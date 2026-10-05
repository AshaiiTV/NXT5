/* Accroche : la question, mot à mot, puis tenue longue pour être lue. */
NX.scene({
  id: 'accroche', start: 0, end: NX.T.hookEnd + 0.1,
  build(root) {
    this.box = NX.el(`<div class="tz-center" style="top:400px">
      <div class="tz-title" data-l="1">Envie d’analyser tes games</div>
      <div class="tz-title" data-l="2">et de <span class="nx-spec">comprendre ton équipe</span> ?</div>
    </div>`, root);
    const [l1, l2] = this.box.querySelectorAll('.tz-title');
    this.w1 = NX.split(l1, 'words').words;
    this.w2 = NX.split(l2, 'words').words;
  },
  render(S) {
    const t = S.t, end = NX.T.hookEnd;
    // La première image montre déjà le premier mot : pas d'écran vide.
    NX.wordsIn(this.w1, t, -0.3, 0.16);
    NX.wordsIn(this.w2, t, 1.5, 0.14);
    const push = NX.lerp(0.97, 1, NX.ease.outCubic(NX.seg(t, 0, end)));
    const q = NX.ease.inOutCubic(NX.seg(t, end - 0.3, end + 0.05));
    this.box.style.opacity = 1 - q;
    this.box.style.filter = q > 0.001 ? `blur(${q * 14}px)` : '';
    this.box.style.transform = `scale(${push * (1 + 0.08 * q)})`;
  },
});
