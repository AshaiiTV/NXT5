/* Équipe : cinq étincelles quittent le logo et deviennent les cinq rôles, un par temps.
 * « Toute ton équipe. » puis fusion : les rôles convergent et l'emblème NXT5 naît. « Une même direction. » */
(function () {
  const ROLES = [
    { id: 'TOP', label: 'Top', color: '#67E8F9', svg: '<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>' },
    { id: 'JGL', label: 'Jungle', color: '#818CF8', svg: '<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.760-6.966-9-9,3.868,3.136,4.422,7.520,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.670,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.480,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>' },
    { id: 'MID', label: 'Mid', color: '#F3F7FF', svg: '<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>' },
    { id: 'ADC', label: 'ADC', color: '#A78BFA', svg: '<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>' },
    { id: 'SUP', label: 'Support', color: '#E879F9', svg: '<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>' },
  ];
  const CX = 960, CY = 430, GAP = 250, SIZE = 128;
  const ORIGIN = { x: 960, y: 520 };

  NX.css(`
  .eq-role{position:absolute;width:220px;margin-left:-110px;text-align:center}
  .eq-icon{width:${SIZE}px;height:${SIZE}px;margin:0 auto;display:block}
  .eq-label{margin-top:22px;font-weight:700;font-size:28px;letter-spacing:.2em;text-transform:uppercase;color:var(--text2)}
  `);

  NX.scene({
    id: 'equipe', start: NX.T.roles - 0.7, end: NX.T.tools + 0.2, z: 1,
    build(root) {
      this.roles = ROLES.map((r, i) => {
        const el = NX.el(`<div class="eq-role"><svg class="eq-icon" viewBox="0 0 34 34" fill="${r.color}">${r.svg}</svg><div class="eq-label">${r.label}</div></div>`, root);
        return { ...r, el, icon: el.querySelector('svg'), label: el.querySelector('.eq-label'), x: CX + (i - 2) * GAP, y: CY };
      });
      this.emblem = NX.el(`<img src="../public/assets/nxt5-loader-favicon.png" alt="" style="position:absolute;left:${CX - 230}px;top:${CY - 230}px;width:460px;height:460px">`, root);
      this.team = NX.el(`<div class="tz-center" style="top:690px"><div class="tz-title">Toute ton <span class="nx-spec">équipe.</span></div></div>`, root);
      this.dir = NX.el(`<div class="tz-center" style="top:720px"><div class="tz-title">Une même <span class="nx-spec">direction.</span></div></div>`, root);
      this.wTeam = NX.split(this.team.firstElementChild, 'words').words;
      this.wDir = NX.split(this.dir.firstElementChild, 'words').words;
    },
    render(S) {
      const t = S.t, T = NX.T, B = NX.BEAT;
      const c = NX.fx.ctx; c.globalCompositeOperation = 'lighter';
      const fuseP = NX.ease.inOutCubic(NX.seg(t, T.fuse + 0.2, T.emblem));
      this.roles.forEach((r, i) => {
        const land = T.roles + i * B;
        const leave = land - 0.6;
        // Étincelle : du logo vers la place du rôle, sur une courbe.
        if (t >= leave && t < land + 0.05) {
          const e = NX.ease.inOutCubic(NX.seg(t, leave, land));
          const pos = u => { const mx = (ORIGIN.x + r.x) / 2, my = 250; const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u; return [a * ORIGIN.x + b * mx + d * r.x, a * ORIGIN.y + b * my + d * r.y]; };
          for (let k = 8; k >= 0; k--) {
            const u = Math.max(0, e - k * 0.035); const [x, y] = pos(u);
            NX.fx.glow(x, y, 26 - k * 2, r.color, (1 - k / 9) * 0.8);
          }
        }
        // Pose du rôle
        const p = NX.seg(t, land, land + 0.5);
        const pop = p <= 0 ? 0 : NX.ease.outBack(p, 1.6);
        const ring = t >= land ? Math.exp(-(t - land) * 4) : 0;
        // Fusion : chaque rôle part vers le centre en tournant légèrement.
        const ang = (i - 2) * 0.5 * fuseP;
        const fx = NX.lerp(r.x, CX, fuseP) + Math.sin(ang) * 60 * fuseP * (1 - fuseP);
        const fy = NX.lerp(r.y, CY, fuseP) - Math.abs(i - 2) * 40 * Math.sin(Math.PI * fuseP);
        const scale = pop * NX.lerp(1, 0.55, fuseP);
        r.el.style.left = fx + 'px';
        r.el.style.top = fy - SIZE / 2 + 'px';
        r.el.style.opacity = NX.clamp(p * 3) * (1 - NX.smooth(0.88, 1, fuseP));
        r.icon.style.transform = `scale(${scale})`;
        r.icon.style.filter = `drop-shadow(0 0 ${14 + 30 * ring}px ${r.color})`;
        r.label.style.opacity = NX.ease.outCubic(NX.seg(t, land + 0.15, land + 0.6)) * (1 - NX.seg(t, T.fuse - 0.1, T.fuse + 0.25));
        if (ring > 0.01 && fuseP === 0) NX.fx.glow(r.x, r.y, 120 + 60 * (1 - ring), r.color, ring * 0.45);
        // Traînées pendant la fusion
        if (fuseP > 0 && fuseP < 1) {
          // Traînée lumineuse derrière chaque rôle pendant qu'il converge
          for (let k = 1; k <= 6; k++) {
            const u = Math.max(0, fuseP - k * 0.05);
            const tx = NX.lerp(r.x, CX, u) + Math.sin((i - 2) * 0.5 * u) * 60 * u * (1 - u);
            const ty = NX.lerp(r.y, CY, u) - Math.abs(i - 2) * 40 * Math.sin(Math.PI * u);
            NX.fx.glow(tx, ty, 46 - k * 4, r.color, 0.5 * (1 - k / 7) * Math.sin(Math.PI * Math.min(1, fuseP * 1.2)));
          }
        }
      });
      // Textes
      NX.wordsIn(this.wTeam, t, T.team, 0.16);
      this.team.style.display = t < T.fuse + 0.5 ? 'block' : 'none';
      NX.blockOut(this.team, t, T.fuse - 0.15, T.fuse + 0.3);
      // Emblème : naît de la fusion, puis s'élève vers la lumière avant les outils.
      const ep = NX.ease.outCubic(NX.seg(t, T.emblem - 0.05, T.emblem + 0.7));
      const eo = NX.ease.inOutCubic(NX.seg(t, T.tools - 0.6, T.tools));
      const flash = t >= T.emblem ? Math.exp(-(t - T.emblem) * 5) : 0;
      this.emblem.style.opacity = Math.min(ep, 1 - eo);
      this.emblem.style.transform = `translateY(${-120 * eo}px) scale(${NX.lerp(1.3, 1, ep) * NX.lerp(1, 0.7, eo)})`;
      this.emblem.style.filter = `${ep < 1 ? `blur(${(1 - ep) * 18}px) ` : ''}drop-shadow(0 0 ${30 + 60 * flash}px rgba(129,140,248,${0.5 + 0.4 * flash}))`;
      // Le cœur de la fusion grossit jusqu'à la naissance de l'emblème
      if (fuseP > 0 && t < T.emblem + 0.1) NX.fx.glow(CX, CY, 60 + 220 * fuseP, 'rgba(165,243,252,1)', 0.15 + 0.5 * fuseP);
      if (flash > 0.01) NX.fx.glow(CX, CY, 380, 'rgba(165,243,252,1)', flash * 0.5);
      NX.wordsIn(this.wDir, t, T.emblem + 0.3, 0.16);
      this.dir.style.display = t > T.emblem ? 'block' : 'none';
      NX.blockOut(this.dir, t, T.tools - 0.45, T.tools - 0.05);
    },
  });
})();
