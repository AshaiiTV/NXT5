/* Carte finale : le même logo qu'à l'ouverture, l'adresse, la cible et l'accès gratuit, tenus longtemps. */
NX.scene({
  id: 'fin', start: NX.T.end - 0.2, end: NX.DURATION, z: 3,
  build(root) {
    this.halo = NX.el(`<div style="position:absolute;left:50%;top:320px;width:1300px;height:900px;margin:-450px 0 0 -650px;background:radial-gradient(closest-side,rgba(103,232,249,.18),rgba(129,140,248,.08) 45%,transparent)"></div>`, root);
    this.logo = NX.el(`<img src="../public/assets/nxt5-logo.png" alt="" style="position:absolute;left:50%;top:70px;width:620px;margin-left:-310px">`, root);
    this.url = NX.el(`<div class="tz-center" style="top:600px"><span class="nx-cta" style="font-size:56px;padding:22px 64px">nxt5.org</span></div>`, root);
    this.line1 = NX.el(`<div class="tz-center" style="top:770px;font-weight:700;font-size:48px;letter-spacing:-.01em;color:var(--text)">Pour les équipes et coachs League of Legends</div>`, root);
    this.line2 = NX.el(`<div class="tz-center" style="top:850px;font-weight:600;font-size:40px;color:var(--text2)">Accès actuellement gratuit</div>`, root);
  },
  render(S) {
    const t = S.t, a = NX.T.end;
    // Le logo commence à apparaître juste avant l'impact : aucun écran vide entre les outils et la fin.
    const p = NX.ease.outCubic(NX.seg(t, a - 0.15, a + 0.8));
    const flash = t >= a ? Math.exp(-(t - a) * 3) : 0;
    this.logo.style.opacity = p;
    this.logo.style.transform = `scale(${NX.lerp(1.12, 1, p) * (1 + 0.025 * NX.seg(t, a, NX.DURATION))})`;
    this.logo.style.filter = `${p < 1 ? `blur(${(1 - p) * 24}px) ` : ''}drop-shadow(0 0 ${30 + 50 * flash}px rgba(129,140,248,${0.45 + 0.4 * flash}))`;
    this.halo.style.opacity = p * (0.6 + 0.4 * flash);
    const rise = (el, s) => { const e = NX.ease.outCubic(NX.seg(t, s, s + 0.6)); el.style.opacity = e; el.style.transform = `translateY(${(1 - e) * 24}px)`; el.style.filter = e < 1 ? `blur(${(1 - e) * 8}px)` : ''; };
    rise(this.url, a + 0.6); rise(this.line1, a + 1.0); rise(this.line2, a + 1.3);
  },
});
