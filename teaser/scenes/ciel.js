/* Fond continu de tout le film : nébuleuse, rayons venus du haut, poussière d'étoiles.
 * C'est lui qui garantit une seule direction artistique : il ne s'éteint jamais. */
NX.scene({
  id: 'ciel', start: 0, end: NX.DURATION, z: -10,
  render(S) {
    const t = S.t, T = NX.T;
    // Groove : le fond respire au tempo une fois la batterie entrée.
    const groove = NX.smooth(T.tools - 0.2, T.tools, t) * (1 - NX.smooth(T.end + 2.4, T.end + 4, t));
    NX.bgMix({
      nebula: 0.58, warp: 0.6, rays: 0.9, rayX: 0, rayY: 0.6, rayStrength: 1, stars: 0.32,
      hue: 0.12 + 0.55 * NX.smooth(0, NX.DURATION, t),
      zoom: 1 + 0.12 * NX.smooth(0, NX.DURATION, t),
      speed: 1, intensity: 1,
    }, 1);
    NX.bg.pulse = groove * NX.pulse(t, NX.BEAT, 7, 0);
    // Impacts : un éclair doux sur le fond et une petite secousse, jamais d'écran blanc ni noir.
    let flash = 0, shake = 0;
    for (const h of T.hits) if (t >= h) { const e = Math.exp(-(t - h) * 5.5); flash += e; shake += Math.exp(-(t - h) * 9); }
    NX.bg.flash = 0.22 * flash;
    NX.post.flash = 0.16 * flash;
    NX.post.shake = 7 * shake;
    NX.post.vignette = 0.8;
  },
});
