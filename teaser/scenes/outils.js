/* Trois outils, 3,6 s chacun : un titre court à gauche, un seul écran agrandi à droite.
 * Données de la démo publique (équipe fictive), aucune statistique inventée. */
(function () {
  NX.css(`
  .ou-left{position:absolute;left:140px;top:330px;width:820px}
  .ou-left .tz-title{white-space:normal;font-size:100px}
  .ou-left .tz-kicker{margin-bottom:30px}
  .ou-card{position:absolute;left:960px;top:250px;width:850px;padding:48px 52px;background:rgba(9,19,34,.92);border:1px solid var(--border-strong);border-radius:16px;box-shadow:0 40px 120px -20px rgba(0,0,0,.8),0 0 80px -10px rgba(129,140,248,.25)}
  .ou-card .rule{position:absolute;left:0;right:0;top:0;height:4px;border-radius:16px 16px 0 0;background:var(--primary)}
  .ou-h{font-weight:700;font-size:40px;letter-spacing:-.01em;color:var(--text)}
  .ou-sub{margin-top:8px;font-size:26px;color:var(--text2)}
  .ou-lab{font-weight:700;font-size:28px;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan)}
  .ou-badge{display:inline-block;margin-left:18px;padding:6px 14px;border-radius:6px;font-size:22px;font-weight:700;color:#6EE7B7;background:rgba(110,231,183,.14);vertical-align:middle}
  .ou-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px}
  .ou-stat{padding:26px 28px;border-radius:12px;background:var(--raised);border:1px solid var(--border)}
  .ou-stat .k{font-size:34px;color:var(--text2)}
  .ou-stat .v{margin-top:6px;font-weight:800;font-size:76px;letter-spacing:-.03em;color:#6EE7B7;font-variant-numeric:tabular-nums}
  .ou-q{margin-top:18px;font-weight:700;font-size:42px;line-height:1.25;color:var(--text)}
  .ou-sep{height:1px;background:var(--border-strong);margin:38px 0 30px}
  .ou-item{display:flex;align-items:center;gap:22px;margin-top:22px;font-size:38px;color:var(--text)}
  .ou-box{flex:none;width:46px;height:46px;border-radius:50%;border:2px solid var(--border-strong);position:relative;overflow:hidden}
  .ou-box i{position:absolute;inset:0;background:var(--primary)}
  .ou-box b{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:24px;color:#020611}
  .ou-week{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:34px}
  .ou-day{font-weight:700;font-size:28px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:14px}
  .ou-col{height:300px;border-radius:12px;background:var(--raised);border:1px solid var(--border);padding:12px;position:relative}
  .ou-slot{position:absolute;left:6px;right:6px;padding:12px 8px;border-radius:10px;font-weight:700;font-size:30px;color:var(--text);transform-origin:50% 0}
  .ou-slot small{display:block;margin-top:6px;font-weight:600;font-size:24px;color:var(--text2)}
  `);
  const slot = (top, color, name, time) => `<div class="ou-slot" style="top:${top}px;background:${color}29;box-shadow:inset 4px 0 0 ${color}">${name}<small>${time}</small></div>`;
  const PANELS = [
    {
      kicker: '01 · Analyser', title: 'Comprends tes<br><span class="nx-spec">parties.</span>',
      card: `<div class="rule"></div><div class="ou-h">Scrim 3 · Aurore<span class="ou-badge">Victoire</span></div>
        <div class="ou-sub">Équipe Horizon · démo fictive</div>
        <div class="ou-stats"><div class="ou-stat"><div class="k">Écart d’or</div><div class="v" data-n="4000">+4 000</div></div>
        <div class="ou-stat"><div class="k">Écart de vision</div><div class="v" data-n="20">+20</div></div></div>`,
    },
    {
      kicker: '02 · Débriefer', title: 'Prépare tes<br><span class="nx-spec">débriefs.</span>',
      card: `<div class="rule"></div><div class="ou-lab">Question du débrief</div>
        <div class="ou-q">La vision a-t-elle facilité nos décisions ?</div>
        <div class="ou-sep"></div><div class="ou-lab">Points à travailler</div>
        <div class="ou-item"><span class="ou-box"><i></i><b>1</b></span>Revoir un objectif dans le replay</div>
        <div class="ou-item"><span class="ou-box"><i></i><b>2</b></span>Choisir une consigne commune</div>`,
    },
    {
      kicker: '03 · Planifier', title: 'Organise tes<br><span class="nx-spec">entraînements.</span>',
      card: `<div class="rule"></div><div class="ou-h">Planning de l’équipe</div>
        <div class="ou-week">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d, i) => `<div><div class="ou-day">${d}</div><div class="ou-col">${
          [slot(12, '#E879F9', 'Scrim', '19:00'), '', slot(12, '#A78BFA', 'Débrief', '19:00'), slot(120, '#67E8F9', 'Match', '20:00'), slot(12, '#E879F9', 'Scrim', '19:00')][i]
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
      const t = S.t, T = NX.T, n = this.panels.length;
      this.panels.forEach((P, k) => {
        const a = T.tools + k * T.tool, b = a + T.tool;
        const first = k === 0, last = k === n - 1;
        const visible = t >= a - 0.3 && t < b + (last ? 0.15 : 0.3);
        P.left.style.display = P.card.style.display = visible ? 'block' : 'none';
        if (!visible) return;
        // Entrée. Le premier outil arrive sur l'impact ; les suivants commencent juste avant la cloche,
        // pendant que la carte précédente glisse encore : il y a toujours un élément net à l'écran.
        const kp = NX.ease.outCubic(first ? NX.seg(t, a, a + 0.5) : NX.seg(t, a - 0.15, a + 0.3));
        P.kicker.style.opacity = kp; P.kicker.style.transform = `translateX(${(1 - kp) * -30}px)`;
        NX.wordsIn(P.words, t, first ? a + 0.1 : a - 0.1, first ? 0.16 : 0.14);
        const cp = NX.ease.outQuart(NX.seg(t, a + 0.05, a + (first ? 0.85 : 0.75)));
        // Sortie. Le titre part d'abord, la carte reste nette jusqu'à la coupe puis glisse à gauche.
        // Le dernier outil s'efface sur place pour laisser venir la carte finale.
        const lq = NX.ease.inOutCubic(last ? NX.seg(t, b - 0.35, b + 0.05) : NX.seg(t, b - 0.45, b - 0.15));
        const q = NX.ease.inOutCubic(last ? NX.seg(t, b - 0.3, b + 0.1) : NX.seg(t, b - 0.15, b + 0.25));
        // L'ancienne carte s'efface plus vite qu'elle ne glisse : pas de double exposition avec la suivante.
        const qo = last ? q : NX.ease.inOutCubic(NX.seg(t, b - 0.15, b + 0.1));
        P.card.style.opacity = Math.min(cp, 1 - qo);
        P.card.style.transform = `translateX(${(1 - cp) * 180 - q * (last ? 0 : 240)}px) scale(${NX.lerp(0.96, 1, cp) * (last ? NX.lerp(1, 0.94, q) : 1)})`;
        const cblur = (1 - cp) * (first ? 10 : 5) + q * (last ? 10 : 4);
        P.card.style.filter = cblur > 0.02 ? `blur(${cblur}px)` : '';
        P.left.style.opacity = 1 - lq;
        P.left.style.transform = `translateX(${-lq * 60}px)`;
        P.left.style.filter = lq > 0.002 ? `blur(${lq * (last ? 10 : 4)}px)` : '';
        // Détails animés, lents : les chiffres montent, les points s'allument, le planning se remplit.
        // Les compteurs avancent par image entière, sinon le flou de mouvement superpose plusieurs nombres.
        const tf = Math.round(t * NX.FPS) / NX.FPS;
        P.nums.forEach((el, i) => {
          const v = +el.dataset.n, e = NX.ease.outCubic(NX.seg(tf, a + 0.5 + i * 0.3, a + 1.7 + i * 0.3));
          el.textContent = '+' + NX.fmt(v * e);
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
