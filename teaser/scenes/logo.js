/* Logo complet, le même qu'en carte finale. Il naît de la lumière sur l'impact de 4,8 s. */
NX.scene({
  id: 'logo', start: NX.T.hookEnd - 0.3, end: NX.T.roles + 0.3,
  build(root) {
    this.halo = NX.el(`<div style="position:absolute;left:50%;top:50%;width:1300px;height:1000px;margin:-500px 0 0 -650px;background:radial-gradient(closest-side,rgba(103,232,249,.20),rgba(129,140,248,.10) 45%,transparent)"></div>`, root);
    this.img = NX.el(`<img src="../public/assets/nxt5-logo.png" alt="" style="position:absolute;left:50%;top:50%;width:860px;margin-left:-430px;margin-top:-339px">`, root);
  },
  render(S) {
    const t = S.t, a = NX.T.hookEnd, out = NX.T.roles - 0.45;
    // Le logo se forme déjà derrière la question qui s'efface : pas de creux à 4,8 s.
    const p = NX.ease.outCubic(NX.seg(t, a - 0.2, a + 0.7));
    const q = NX.ease.inOutCubic(NX.seg(t, out, out + 0.55));
    const scale = NX.lerp(1.14, 1, p) * NX.lerp(1, 0.82, q) * (1 + 0.02 * NX.seg(t, a, out));
    this.img.style.opacity = Math.min(p, 1 - q);
    this.img.style.transform = `translateY(${-30 * q}px) scale(${scale})`;
    const blur = (1 - p) * 14 + q * 12;
    const glow = 0.35 + 0.65 * Math.exp(-Math.max(0, t - a) * 3);
    this.img.style.filter = `${blur > 0.05 ? `blur(${blur}px) ` : ''}drop-shadow(0 0 ${40 * glow}px rgba(129,140,248,${0.55 * glow}))`;
    this.halo.style.opacity = Math.min(p, 1 - q) * (0.6 + 0.4 * glow);
  },
});
