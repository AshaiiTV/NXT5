/* Trois outils, 3,6 s chacun : un titre court à gauche, un seul écran agrandi à droite.
 * Données de la démo publique (équipe fictive), aucune statistique inventée. */
(function () {
  NX.css(`
  .ou-left{position:absolute;left:140px;top:330px;width:820px}
  .ou-left .tz-title{white-space:normal;font-size:100px}
  .ou-left .tz-kicker{margin-bottom:30px}
  .ou-card{position:absolute;left:1010px;top:250px;width:780px;padding:48px 52px;background:rgba(9,19,34,.92);border:1px solid var(--border-strong);border-radius:16px;box-shadow:0 40px 120px -20px rgba(0,0,0,.8),0 0 80px -10px rgba(129,140,248,.25)}
  .ou-card .rule{position:absolute;left:0;right:0;top:0;height:4px;border-radius:16px 16px 0 0;background:var(--primary)}
  .ou-h{font-weight:700;font-size:40px;letter-spacing:-.01em;color:var(--text)}
  .ou-sub{margin-top:8px;font-size:24px;color:var(--muted)}
  .ou-lab{font-weight:700;font-size:22px;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan)}
  .ou-badge{display:inline-block;margin-left:18px;padding:6px 14px;border-radius:6px;font-size:22px;font-weight:700;color:#6EE7B7;background:rgba(110,231,183,.14);vertical-align:middle}
  .ou-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px}
  .ou-stat{padding:26px 28px;border-radius:12px;background:var(--raised);border:1px solid var(--border)}
  .ou-stat .k{font-size:24px;color:var(--text2)}
  .ou-stat .v{margin-top:6px;font-weight:800;font-size:76px;letter-spacing:-.03em;color:#6EE7B7;font-variant-numeric:tabular-nums}
  .ou-q{margin-top:18px;font-weight:700;font-size:42px;line-height:1.25;color:var(--text)}
  .ou-sep{height:1px;background:var(--border-strong);margin:38px 0 30px}
  .ou-item{display:flex;align-items:center;gap:22px;margin-top:22px;font-size:30px;color:var(--text)}
  .ou-box{flex:none;width:40px;height:40px;border-radius:4px;border:2px solid var(--border-strong);position:relative;overflow:hidden}
  .ou-box i{position:absolute;inset:0;background:var(--primary)}
  .ou-box svg{position:absolute;inset:6px}
  .ou-week{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:34px}
  .ou-day{font-weight:700;font-size:22px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:14px}
  .ou-col{height:300px;border-radius:12px;background:var(--raised);border:1px solid var(--border);padding:12px;position:relative}
  .ou-slot{position:absolute;left:10px;right:10px;padding:14px 12px;border-radius:10px;font-weight:700;font-size:24px;color:var(--text);transform-origin:50% 0}
  .ou-slot small{display:block;margin-top:6px;font-weight:600;font-size:19px;color:var(--text2)}
  `);
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="#020611" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const slot = (top, color, name, time) => `<div class="ou-slot" style="top:${top}px;background:${color}29;box-shadow:inset 4px 0 0 ${color}">${name}<small>${time}</small></div>`;
  const PANELS = [
    {
      kicker: '01 · Analyser', title: 'Comprends <span class="nx-spec">tes parties.</span>',
      card: `<div class="rule"></div><div class="ou-h">Scrim 3 · Aurore<span class="ou-badge">Victoire</span></div>
        <div class="ou-sub">Équipe Horizon · démo fictive</div>
        <div class="ou-stats"><div class="ou-stat"><div class="k">Écart d’or</div><div class="v" data-n="4000">+4 000</div></div>
        <div class="ou-stat"><div class="k">Écart de vision</div><div class="v" data-n="20">+20</div></div></div>`,
    },
    {
      kicker: '02 · Débriefer', title: 'Prépare <span class="nx-spec">tes débriefs.</span>',
      card: `<div class="rule"></div><div class="ou-lab">Question du débrief</div>
        <div class="ou-q">La vision a-t-elle facilité nos décisions ?</div>
        <div class="ou-sep"></div><div class="ou-lab">Points à travailler</div>
        <div class="ou-item"><span class="ou-box"><i></i>${check}</span>Revoir un objectif dans le replay</div>
        <div class="ou-item"><span class="ou-box"><i></i>${check}</span>Choisir une consigne commune</div>`,
    },
    {
      kicker: '03 · Planifier', title: 'Organise <span class="nx-spec">tes entraînements.</span>',
      card: `<div class="rule"></div><div class="ou-h">Planning de l’équipe</div>
        <div class="ou-week">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d, i) => `<div><div class="ou-day">${d}</div><div class="ou-col">${
          [slot(12, '#67E8F9', 'Scrim', '19:00'), '', slot(12, '#A78BFA', 'Débrief', '18:30'), slot(120, '#818CF8', 'Draft', '20:00'), slot(12, '#67E8F9', 'Scrim', '19:00')][i]
        }</div></div>`).join('')}</div>`,
    },
  ];

  NX.scene({
    id: 'outils', start: NX.T.tools - 0.3, end: NX.T.end + 0.2, z: 2,
    build(root) {
      this.panels = PANELS.map(P => {
        const left = NX.el(`<div class="ou-left"><div class="tz-kicker">${P.kicker}</div><div class="tz-title">${P.title}</div></div>`, root);
        const card = NX.el(`<div class="ou-card">${P.card}</div>`, root);
        return {
          left, card, kicker: left.firstElementChild,
          words: NX.split(left.querySelector('.tz-title'), 'words').words,
          nums: [...card.querySelectorAll('.v[data-n]')],
          boxes: [...card.querySelectorAll('.ou-box')],
          slots: [...card.querySelectorAll('.ou-slot')],
        };
      });
    },
    render(S) {
      const t = S.t, T = NX.T;
      this.panels.forEach((P, k) => {
        const a = T.tools + k * T.tool, b = a + T.tool;
        const visible = t >= a - 0.3 && t < b + 0.15;
        const last = k === this.panels.length - 1;
        P.left.style.display = P.card.style.display = visible ? 'block' : 'none';
        if (!visible) return;
        // Entrée : le titre mot à mot, l'écran glisse depuis la droite.
        const kp = NX.ease.outCubic(NX.seg(t, a, a + 0.5));
        P.kicker.style.opacity = kp; P.kicker.style.transform = `translateX(${(1 - kp) * -30}px)`;
        NX.wordsIn(P.words, t, a + 0.1, 0.16);
        const cp = NX.ease.outQuart(NX.seg(t, a + 0.05, a + 0.85));
        // Sortie vers la gauche, sauf le dernier qui laisse place à la carte finale.
        const q = NX.ease.inOutCubic(NX.seg(t, b - (last ? 0.3 : 0.35), b + (last ? 0.1 : 0.05)));
        P.card.style.opacity = Math.min(cp, 1 - q);
        P.card.style.transform = `translateX(${(1 - cp) * 180 - q * (last ? 0 : 160)}px) scale(${NX.lerp(0.96, 1, cp) * (last ? NX.lerp(1, 0.94, q) : 1)})`;
        P.card.style.filter = (1 - cp) + q > 0.002 ? `blur(${((1 - cp) + q) * 10}px)` : '';
        const lq = NX.ease.inOutCubic(NX.seg(t, b - 0.35, b + 0.05));
        P.left.style.opacity = 1 - lq;
        P.left.style.transform = `translateX(${-lq * 60}px)`;
        P.left.style.filter = lq > 0.002 ? `blur(${lq * 10}px)` : '';
        // Détails animés, lents : les chiffres montent, les cases se cochent, le planning se remplit.
        P.nums.forEach((el, i) => {
          const n = +el.dataset.n, e = NX.ease.outCubic(NX.seg(t, a + 0.5 + i * 0.3, a + 1.7 + i * 0.3));
          el.textContent = '+' + NX.fmt(n * e);
        });
        P.boxes.forEach((el, i) => {
          const e = NX.ease.outBack(NX.seg(t, a + 1.2 + i * 0.6, a + 1.5 + i * 0.6));
          el.firstElementChild.style.opacity = NX.clamp(e);
          el.lastElementChild.style.transform = `scale(${Math.max(0, e)})`;
        });
        P.slots.forEach((el, i) => {
          const e = NX.seg(t, a + 0.7 + i * 0.3, a + 1.1 + i * 0.3);
          el.style.opacity = NX.clamp(e * 2);
          el.style.transform = `scaleY(${NX.ease.outBack(e)})`;
        });
      });
    },
  });
})();
