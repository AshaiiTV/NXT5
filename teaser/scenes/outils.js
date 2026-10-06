/* S6–S8 « Outils » de la v7 (bible §4) : trois cartes de verre en pile, éclairées d'en haut.
 * 18,0 : la lumière redescend sur la carte avant, qui s'allume. Chaque outil fini est pris dans la lumière
 * pendant que le suivant avance ; à 28,8 le front de lumière de la fin (avance 100 px) brûle la dernière carte
 * et la colonne de titre pendant que l'emblème revient (fin.js).
 * Données de la démo publique (équipe fictive) : textes et valeurs identiques à la v6 ; le débrief montre des
 * points numérotés (pas des cases à cocher) et le planning des créneaux à l'heure (Scrim, Débrief, Match). */
(function () {
  const TL = NX.G.tools, ST = TL.stack, COL = TL.col;
  const E = NX.ease, seg = NX.seg, clamp = NX.clamp, lerp = NX.lerp, sine = NX.ease.sine;
  const RAD = Math.PI / 180;
  const ROOTZ = 1;                               // le moteur décale la racine de la scène (z 2) de 2 × 0,5 px
  const LEAD = 100;                              // la brûlure précède l'écriture du logo final (bible §3.3)
  const DROP = NX.T.tools;                       // 18,0 : la lumière redescend
  const BELL = [NX.T.tools + NX.T.tool, NX.T.tools + 2 * NX.T.tool];   // 21,6 et 25,2
  const LIFT = [21.30, 24.90];                   // cartes 1 et 2 prises dans la lumière (0,6 s)
  const SPRING = p => E.spring(p, 1.0, 6.2);
  const DROPIN = NX.bezier(0.2, 1.2, 0.3, 1);    // chute des créneaux (rebond ≈ 1,3 %, ≤ 4 %)
  const tq = t => Math.round(t * NX.FPS) / NX.FPS; // compteurs calés sur l'image : pas de chiffres fantômes
  const NB = ' ';                           // espace fine insécable (typographie de la v6)
  const [, SDY, SDZ] = ST.slots[1];              // un cran de pile : y −46, z −150 (les crans sont linéaires)
  const PAD = 44;                                // marge de la colonne : le masque de brûlure ne rogne pas la lueur des glyphes

  /* ---------- Géométrie : repère local de la pile → monde (mêmes calculs que le CSS de .ou-stack) ---------- */
  const CX = Math.cos(ST.rotX * RAD), SX = Math.sin(ST.rotX * RAD), CY = Math.cos(ST.rotY * RAD), SY = Math.sin(ST.rotY * RAD);
  /** Point local de la pile (px, y vers le bas, z vers le spectateur) → point monde [X, Y, Z]. */
  const ouWorld = (x, y, z = 0) => {
    const y1 = y * CX - z * SX, z1 = y * SX + z * CX;          // rotateX(2°)
    const x2 = x * CY + z1 * SY, z2 = -x * SY + z1 * CY;       // rotateY(10°)
    return [ST.left + x2, ST.top + y1, ST.z + z2 + ROOTZ];     // translateZ(−60 px), origine 0 0
  };
  const ouProj = (x, y, z = 0) => { const w = ouWorld(x, y, z); return NX.cam.project(w[0], w[1], w[2]); };

  /* ---------- Masque d'anneau du liseré (copie du CSS du kit) avec, en option, la brûlure par-dessus ---------- */
  const RING = 'linear-gradient(#000 0 0)';
  function ouRimMask(el, burn) {
    const imgs = burn ? [burn, RING, RING] : [RING, RING];
    const box = burn ? 'border-box,content-box,border-box' : 'content-box,border-box';
    el.style.maskImage = el.style.webkitMaskImage = imgs.join(',');
    el.style.maskOrigin = el.style.webkitMaskOrigin = box;
    el.style.maskClip = el.style.webkitMaskClip = box;
    el.style.maskSize = el.style.webkitMaskSize = imgs.map(() => '100% 100%').join(',');
    el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = burn ? 'intersect,exclude,add' : 'exclude,add';
    el.style.webkitMaskComposite = burn ? 'source-in,xor,source-over' : 'xor,source-over';
  }

  /** Masque neutre (opaque partout). Les feuilles que la brûlure masque gardent toujours un masque : sans lui,
   *  Chromium rend le texte de ces calques avec un écart de 1/255 sur quelques pixels selon les images rendues
   *  avant (constaté sur la colonne et la carte 3) ; avec un masque constant, le rendu ne dépend que de t. */
  const SOLID = 'linear-gradient(#000,#000)';
  function ouMaskOff(el) {
    el.style.maskImage = el.style.webkitMaskImage = SOLID;
    el.style.maskSize = el.style.webkitMaskSize = '100% 100%';
    el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = el.style.webkitMaskComposite = '';
  }

  /* ---------- Contenu (textes et données de la v6) ---------- */
  const TITLES = [['Comprends tes', 'parties.'], ['Prépare tes', 'débriefs.'], ['Organise tes', 'entraînements.']];
  const VERBS = ['Analyser', 'Débriefer', 'Planifier'];
  const disc = n => `<span class="ou-disc"><b class="ou-n0">${n}</b><i class="ou-dfill"></i><b class="ou-n1">${n}</b></span>`;
  const DAYS = [ // jour, couleur, type, heure, haut (px), temps de chute
    ['Lun', '#E879F9', 'Scrim', '19:00', 12, 25.80],
    ['Mar'],
    ['Mer', '#A78BFA', 'Débrief', '19:00', 12, 26.10],
    ['Jeu', '#67E8F9', 'Match', '20:00', 120, 26.40],
    ['Ven', '#E879F9', 'Scrim', '19:00', 12, 26.70],
  ];
  const CARDS = [
    `<div class="ou-in ou-in0">
      <div class="ou-h ou-row">Scrim 3 · Aurore<span class="ou-badge">Victoire</span></div>
      <div class="ou-sub ou-row">Équipe Horizon · démo fictive</div>
      <div class="ou-stats">
        <div class="ou-stat ou-row"><div class="k">Écart d’or</div><div class="v">+0</div><i class="ou-tglow"></i></div>
        <div class="ou-stat ou-row"><div class="k">Écart de vision</div><div class="v">+0</div><i class="ou-tglow"></i><i class="ou-focus"></i></div>
      </div></div>`,
    `<div class="ou-in ou-in1">
      <div class="ou-lab ou-row">Question du débrief</div>
      <div class="ou-q ou-q1 ou-row">La vision a-t-elle facilité</div>
      <div class="ou-q ou-row">nos décisions${NB}?</div>
      <div class="ou-sep ou-row"></div>
      <div class="ou-lab ou-row">Points à travailler</div>
      <div class="ou-item ou-row">${disc(1)}<span>Revoir un objectif dans le replay</span><i class="ou-glint"><i></i></i></div>
      <div class="ou-item ou-row">${disc(2)}<span>Choisir une consigne commune</span><i class="ou-glint"><i></i></i></div>
    </div>`,
    `<div class="ou-in ou-in2">
      <div class="ou-h ou-row">Planning de l’équipe</div>
      <div class="ou-week">${DAYS.map(([d, c, name, hour, top]) => `<div class="ou-day"><div class="ou-dl">${d}</div><div class="ou-dc"><i class="ou-dbg"></i>${c
        ? `<div class="ou-slot" style="top:${top}px;background:${c}29;box-shadow:inset 4px 0 0 ${c}">${name}<small>${hour}</small><i class="ou-sglow" style="box-shadow:0 0 22px ${c}99,inset 0 0 0 1.5px ${c}cc"></i></div>` : ''}</div></div>`).join('')}</div>
    </div>`,
  ];

  NX.css(`
  .ou-col{position:absolute;left:${COL.left - PAD}px;top:${COL.top - PAD}px;width:${760 + 2 * PAD}px;padding:${PAD}px;transform:translateZ(${COL.z}px)}
  .ou-col .tz-kicker{margin-bottom:30px;white-space:nowrap}
  .ou-kt{display:inline-block}
  .ou-verbs{display:inline-grid;vertical-align:top;overflow:hidden;padding:.14em .08em .24em;margin:-.14em -.08em -.24em}
  .ou-verbs>span{grid-area:1/1;display:block}
  .ou-titles{position:relative;height:${(2 * 96 * 1.06).toFixed(2)}px}
  .ou-title{position:absolute;left:0;top:0}
  .ou-stack{position:absolute;left:${ST.left}px;top:${ST.top}px;width:${ST.w}px;height:${ST.h}px;transform-style:preserve-3d;transform-origin:${ST.origin};transform:translateZ(${ST.z}px) rotateY(${ST.rotY}deg) rotateX(${ST.rotX}deg)}
  .ou-card{left:0;top:0}
  .ou-rule{background:var(--primary) top/100% 4px no-repeat;transform:translateZ(3px)}
  .ou-sw{overflow:hidden;mix-blend-mode:plus-lighter;transform:translateZ(2.5px);opacity:0}
  .ou-sw i{position:absolute;top:-25%;bottom:-25%;left:0;width:40%;background:linear-gradient(90deg,transparent,rgba(160,215,255,.05) 25%,rgba(232,247,255,.22) 50%,rgba(196,181,253,.05) 75%,transparent)}
  .ou-band{mix-blend-mode:plus-lighter;transform:translateZ(3.5px);opacity:0}
  .ou-in{position:absolute;inset:0;padding:48px 44px;display:flex;flex-direction:column;transform-style:preserve-3d}
  .ou-row{position:relative}
  .ou-h{font-weight:700;font-size:44px;line-height:1.2;letter-spacing:-.01em;color:var(--text);white-space:nowrap}
  .ou-badge{display:inline-block;margin-left:18px;padding:6px 14px;border-radius:6px;font-size:22px;line-height:1.2;font-weight:700;color:#6EE7B7;background:rgba(110,231,183,.14);vertical-align:middle}
  .ou-sub{margin-top:8px;font-size:28px;line-height:1.3;color:var(--text2)}
  .ou-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:auto;transform-style:preserve-3d}
  .ou-stat{padding:32px 31px 34px;border-radius:12px;background:linear-gradient(180deg,#13233B,#0D1A2D);border:1px solid rgba(154,182,218,.16);box-shadow:0 22px 34px -16px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06)}
  .ou-stat .k{font-size:36px;line-height:1.2;color:var(--text2)}
  .ou-stat .v{margin-top:8px;font-weight:800;font-size:80px;line-height:1.05;letter-spacing:-.03em;color:#6EE7B7;font-variant-numeric:tabular-nums;white-space:nowrap}
  .ou-tglow,.ou-focus{position:absolute;inset:-1px;border-radius:12px;opacity:0}
  .ou-tglow{box-shadow:inset 0 0 0 1px rgba(110,231,183,.55),inset 0 0 26px rgba(110,231,183,.14),0 0 26px rgba(110,231,183,.28)}
  .ou-focus{box-shadow:inset 0 0 0 2px #67E8F9,0 0 24px rgba(103,232,249,.45)}
  .ou-lab{font-weight:700;font-size:28px;line-height:1.2;letter-spacing:.2em;text-transform:uppercase;color:var(--cyan)}
  .ou-q{font-weight:700;font-size:44px;line-height:1.25;letter-spacing:-.01em;color:var(--text);white-space:nowrap}
  .ou-q1{margin-top:18px}
  .ou-sep{height:2px;margin:40px 0 34px;background:rgba(154,182,218,.24);transform-origin:0 50%}
  .ou-item{display:flex;align-items:center;gap:22px;margin-top:24px;font-size:40px;line-height:1.2;color:var(--text);white-space:nowrap}
  .ou-disc{position:relative;flex:none;width:50px;height:50px;border-radius:50%;background:linear-gradient(180deg,#13233B,#0D1A2D);box-shadow:inset 0 0 0 2px rgba(154,182,218,.30)}
  .ou-dfill{position:absolute;inset:0;border-radius:50%;background:var(--primary)}
  .ou-disc b{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:26px;line-height:1}
  .ou-n0{color:var(--text2)}
  .ou-n1{color:#020611}
  .ou-glint{position:absolute;inset:-8px -14px;border-radius:12px;overflow:hidden;mix-blend-mode:plus-lighter}
  .ou-glint i{position:absolute;top:0;bottom:0;left:0;width:28%;background:linear-gradient(100deg,transparent,rgba(205,242,255,.16) 50%,transparent)}
  .ou-week{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:34px;transform-style:preserve-3d}
  .ou-day{position:relative;transform-style:preserve-3d}
  .ou-dl{font-weight:700;font-size:28px;line-height:1.2;letter-spacing:.12em;padding:24px 24px 24px calc(24px + .12em);margin:-24px -24px -10px;text-transform:uppercase;color:var(--muted);text-align:center}
  .ou-in2>.ou-h{padding:30px 44px;margin:-30px -44px}
  .ou-dc{position:relative;height:300px;transform-style:preserve-3d}
  .ou-dbg{position:absolute;inset:0;border-radius:12px;background:linear-gradient(180deg,#13233B,#0D1A2D);border:1px solid rgba(154,182,218,.16)}
  .ou-slot{position:absolute;left:6px;right:6px;padding:12px 6px;border-radius:10px;font-weight:700;font-size:30px;line-height:1.2;color:var(--text)}
  .ou-slot small{display:block;margin-top:6px;font-weight:600;font-size:24px;line-height:1.2;color:var(--text2)}
  .ou-sglow{position:absolute;inset:0;border-radius:10px;opacity:0}
  `);

  /* ---------- Rangées d'interface : montée (ENTER 0,5) puis sortie vers le haut (EXIT 0,25) ---------- */
  function ouRow(t, rise, sink, dy = 28) {
    let y = 0, a = 1;
    if (rise != null) { const e = E.enter(seg(t, rise, rise + 0.5)); y = (1 - e) * dy; a = clamp(e * 1.8); }
    if (sink != null && t > sink) { const e = E.exit(seg(t, sink, sink + 0.25)); y -= e * dy; a *= 1 - NX.smooth(0.3, 1, e); }
    return { y, a };
  }
  const tr3 = (y, z) => `translate3d(0px,${y.toFixed(2)}px,${z.toFixed(2)}px)`;
  /** Balayage événementiel (bible §3.7) : centre de la bande de 1,1 à −0,1 (largeur de carte), SHEEN. */
  function ouSweep(t, a, b) {
    const p = seg(t, a, b); if (p <= 0 || p >= 1) return null;
    return { u: lerp(1.1, -0.1, E.sheen(p)), a: NX.smooth(0, 0.12, p) * (1 - NX.smooth(0.88, 1, p)) };
  }

  NX.scene({
    id: 'outils', start: 17.7, end: 29.9, z: 2,
    build(root) {
      // Colonne de titre : filet, surtitre (compteur à rouleau, verbes empilés), trois titres empilés.
      this.col = NX.el(`<div class="ou-col">
        <div class="tz-kicker ou-kick"><i class="tz-hair"></i><span class="ou-kt">0</span><span class="tz-odo ou-kt"><b>1</b><b>2</b><b>3</b></span><span class="ou-kt"> · </span><span class="ou-verbs ou-kt">${VERBS.map(v => `<span>${v}</span>`).join('')}</span></div>
        <div class="ou-titles">${TITLES.map(([a, b]) => `<div class="tz-title ou-title"><span class="tz-line">${a}</span><span class="tz-line"><span class="nx-spec">${b}</span></span></div>`).join('')}</div>
      </div>`, root);
      this.dbg = { ouWorld, PAD };                     // pour les sondes de vérification (aucun état)
      this.hair = this.col.querySelector('.tz-hair');
      this.kick = this.col.querySelector('.ou-kick');
      this.kparts = [...this.col.querySelectorAll('.ou-kt')];
      this.odo = this.col.querySelector('.tz-odo');
      this.verbs = [...this.col.querySelectorAll('.ou-verbs > span')];
      this.titles = [...this.col.querySelectorAll('.ou-title')].map(el => {
        const { lines, words } = NX.type.prepare(el);
        const spec = el.querySelector('.nx-spec');
        // NX.type.sheen laisse background-repeat à « no-repeat,no-repeat » après son passage : on le fixe dès le départ
        // pour que le rendu d'un mot dégradé ne dépende pas d'un reflet rendu auparavant.
        for (const w of spec.querySelectorAll('.nx-word')) w.style.backgroundRepeat = 'no-repeat';
        return { el, lines, words, spec, lineEls: [...el.querySelectorAll('.tz-line')] };
      });
      // Pile de trois cartes de verre (bible §3.7, NX.G.tools.stack).
      this.stack = NX.el('<div class="ou-stack"></div>', root);
      this.cards = CARDS.map((html, k) => {
        const g = NX.glass(html, { w: ST.w, h: ST.h, wash: true });
        g.el.classList.add('ou-card');
        g.fog.style.transform = 'translateZ(1.5px)';   // brume sous le liseré et le filet : les cartes du fond gardent leur contour
        g.rule = NX.el('<div class="ou-rule"></div>', g.el);
        g.sw = NX.el('<div class="ou-sw"><i></i></div>', g.el); g.swBand = g.sw.firstElementChild;
        if (k === 2) g.burnBand = NX.el('<div class="ou-band"></div>', g.el);   // (g.band est la bande de reflet du kit)
        ouRimMask(g.rim, null);
        g.rows = [...g.el.querySelectorAll('.ou-row')];
        this.stack.appendChild(g.el);
        return g;
      });
      const [c0, c1, c2] = this.cards;
      c0.badge = c0.el.querySelector('.ou-badge');
      c0.tiles = [...c0.el.querySelectorAll('.ou-stat')];
      c0.vals = c0.tiles.map(x => x.querySelector('.v'));
      c0.tglow = c0.tiles.map(x => x.querySelector('.ou-tglow'));
      c0.focus = c0.el.querySelector('.ou-focus');
      c1.sep = c1.el.querySelector('.ou-sep');
      c1.items = [...c1.el.querySelectorAll('.ou-item')].map(el => ({ el, fill: el.querySelector('.ou-dfill'), n1: el.querySelector('.ou-n1'), glint: el.querySelector('.ou-glint'), gband: el.querySelector('.ou-glint i') }));
      c2.head = c2.el.querySelector('.ou-h');
      c2.days = [...c2.el.querySelectorAll('.ou-day')].map((el, i) => ({ el, lab: el.querySelector('.ou-dl'), bg: el.querySelector('.ou-dbg'), slot: el.querySelector('.ou-slot'), glow: el.querySelector('.ou-sglow'), drop: DAYS[i][5] }));
    },
    layout() {
      // Décalages (px locaux, sans transformation) : feuilles de la carte 3 pour la brûlure, mots pour la lueur.
      const off = (el, anc) => { let x = 0, y = 0; for (let e = el; e && e !== anc; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
      const c2 = this.cards[2];
      const leaves = [c2.shadow, c2.glow, c2.plate, c2.sheen, c2.wash, c2.rule, c2.sw, c2.head, ...c2.days.flatMap(d => [d.lab, d.bg, d.slot].filter(Boolean))];
      this.burnLeaves = leaves.map(el => { const [x, y] = off(el, c2.el); return { el, x, y }; });
      this.glowEls = [this.kick, ...this.titles[2].words];
      this.glowC = this.glowEls.map(el => { const [x, y] = off(el, this.col); return [COL.left - PAD + x + el.offsetWidth / 2, COL.top - PAD + y + el.offsetHeight / 2, COL.z + ROOTZ]; });
      // Textes de la carte 3 : centres monde (carte au cran 0 pendant la brûlure ; z du contenu, des colonnes, des créneaux).
      const cardText = [[c2.head, 1], ...c2.days.map(d => [d.lab, 19]), ...c2.days.filter(d => d.slot).map(d => [d.slot, 21])];
      this.cardGlowEls = cardText.map(([el]) => el);
      this.cardGlowC = cardText.map(([el, z]) => { const [x, y] = off(el, c2.el); return ouWorld(x + el.offsetWidth / 2, y + el.offsetHeight / 2, z); });
    },
    prepare() {
      this.snares = NX.beats.dropSnares.slice();
    },
    render(S) {
      const t = S.t, cam = NX.camState || NX.cam.at(t);
      const [c0, c1, c2] = this.cards;
      const burning = t >= 28.25;

      /* ===== Lumière du drop (#fx) : le faisceau redescend sur le coin de la carte avant ===== */
      const tau = t - DROP;
      if (tau >= 0 && tau < 1.5) {
        const src = NX.light.src(t), corner = ouProj(0, 0), h = ouProj(60, 0);
        NX.lk.beam(src.x, src.y, corner.x, corner.y, 6, 40, 0.8 * Math.exp(-5 * tau), [210, 245, 255], NX.fx.ctx);
        NX.hit(t, DROP, h.x, h.y, { flare: 0.5, width: 0.5, core: 160, coreA: 0.3 });
      }

      /* ===== Pile ===== */
      const showStack = t >= 17.8 && t < 29.3;
      this.stack.style.display = showStack ? '' : 'none';
      if (showStack) {
        const rimAngle = 180 + 6 * cam.yaw, pos = -0.43 * cam.yaw;
        const snare = t >= DROP ? 1 + 0.25 * NX.beatPulse(t, this.snares, 7) : 1;
        const pre = 0.25 * sine(seg(t, 17.80, 17.98));                 // contours d'anticipation (bible : 0,25)
        const onF = E.enter(seg(t, DROP, DROP + 0.10));                   // mise sous tension de la carte avant
        const onB = E.enter(seg(t, DROP + 0.05, DROP + 0.25));            // cartes du fond, sous la brume
        const tB = t - (DROP + 0.05);
        const depth = [0, 1 - E.advance(seg(t, 21.38, 22.12)), 2 - E.advance(seg(t, 21.46, 22.20)) - E.advance(seg(t, 24.98, 25.72))];
        const sweeps = [ouSweep(t, 18.60, 19.20), ouSweep(t, BELL[0], BELL[0] + 0.65), ouSweep(t, BELL[1], BELL[1] + 0.65) || ouSweep(t, 27.60, 28.20)];
        this.cards.forEach((g, k) => {
          const L0 = LIFT[k], e = k < 2 ? E.lift(seg(t, L0, L0 + 0.6)) : 0;
          const vis = k < 2 ? 1 - sine(seg(t, L0 + 0.25, L0 + 0.6)) : 1;
          const visible = t >= 17.8 && (k === 2 ? t < 29.3 : t < L0 + 0.6);
          g.el.style.display = visible ? '' : 'none';
          if (!visible) return;
          const p = depth[k], pd = Math.max(0, p);
          g.el.style.transform = `translate3d(0px,${(SDY * p - 300 * e).toFixed(2)}px,${(SDZ * p - 360 * e).toFixed(2)}px)${e > 0 ? ` rotateX(${(-18 * e).toFixed(3)}deg)` : ''}`;
          const on = k === 0 ? onF : onB;
          let gain = snare * (k === 0 ? (tau >= 0 ? 1 + 1.5 * Math.exp(-3 * tau) : 1) : (tB >= 0 ? 1 + 0.6 * Math.exp(-3 * tB) : 1));
          if (k > 0 && t >= BELL[k - 1]) gain *= 1 + 0.6 * Math.exp(-4 * (t - BELL[k - 1]));
          const rimLit = clamp((0.7 - 0.1 * pd) * gain), ruleLit = 1 - 0.22 * pd;
          const rim = k === 0 ? (t < DROP ? pre : rimLit) : lerp(pre, rimLit, on);
          const rule = k === 0 ? (t < DROP ? pre : ruleLit) : lerp(pre, ruleLit, on);
          let wash = 0;
          // Voile de la carte prise dans la lumière : +0,45 (bible : +0,3) pour tenir Y ≥ 15 dans le creux 24,75–25,25
          // (mesuré 14,94 à 25,07 avec +0,3 : aucun titre à l'écran entre 25,04 et 25,15 dans la frise de la bible).
          const LW = 0.45;
          if (k === 0) wash = (tau >= 0 ? Math.exp(-5 * tau) : 0) + LW * sine(seg(t, LIFT[0], LIFT[0] + 0.25));
          else wash = (tB >= 0 ? 0.4 * Math.exp(-5 * tB) : 0) + (k === 1 ? LW * sine(seg(t, LIFT[1], LIFT[1] + 0.25)) : 0);
          // La lumière passe à la carte qui avance : même voile que la carte prise dans la lumière au moment où elles se
          // croisent en profondeur (21,52 et 25,12), puis il s'éteint avant la lecture. Sans lui, l'échange des plaques clignote.
          const A0 = k === 1 ? 21.38 : k === 2 ? 24.98 : null;
          if (A0 != null) wash += 0.45 * sine(seg(t, A0 + 0.02, A0 + 0.14)) * (1 - sine(seg(t, A0 + 0.30, A0 + 0.80)));
          const front = 1 - Math.min(1, pd);
          const glow = front * (0.10 + (k === 0 && tau >= 0 ? 0.45 * Math.exp(-3 * tau) : 0));
          const lit = Math.min(1, 0.5 * (1 - 0.3 * pd) + (k === 0 && tau >= 0 ? 0.5 * Math.exp(-3 * tau) : 0));
          NX.glassFade(g, on * vis);
          NX.glassLight(g, { pos, lit, rimAngle, rimGain: 1, fog: 0.42 * pd, glow, wash });
          g.content.style.opacity = '';                                      // preserve-3d : jamais d'opacité ici
          g.rim.style.opacity = (rim * vis).toFixed(3);
          g.rule.style.opacity = (rule * vis).toFixed(3);
          const sw = sweeps[k];
          g.sw.style.opacity = sw ? (sw.a * on * vis).toFixed(3) : 0;
          if (sw) g.swBand.style.transform = `translateX(${((sw.u - 0.2) / 0.4 * 100).toFixed(2)}%) skewX(-20deg)`;
        });

        /* --- Carte 1 « Analyser » : allumée au drop, compteurs, badge, mise au point, puis sortie --- */
        if (t < LIFT[0] + 0.6) {
          // Sorties 21,20 + 0,03 i, la tuile vision en dernier. Elle part à 21,29 et non 21,40 (bible) : la carte 2,
          // qui avance plus vite que la carte 1 ne recule, la dépasse en profondeur à 21,52 (tuile : 21,57) ; partie
          // plus tard, la tuile serait coupée net par la plaque de la carte 2 et resterait visible à travers elle.
          const SINK = [21.20, 21.23, 21.26, 21.29];
          const zT = [26 * E.glide(seg(t, 18.30, 18.80)), 26 * E.glide(seg(t, 18.42, 18.92)) + 20 * E.glide(seg(t, 21.00, 21.35))];
          c0.rows.forEach((el, i) => {
            const r = ouRow(t, null, SINK[i]);
            el.style.opacity = (onF * r.a).toFixed(3);
            el.style.transform = tr3(r.y, i >= 2 ? zT[i - 2] : 0);
          });
          const bs = SPRING(seg(t, 18.60, 19.10)), bg = t >= 18.60 ? 0.55 * Math.exp(-3.5 * (t - 18.60)) : 0;
          c0.badge.style.opacity = sine(seg(t, 18.60, 18.68)).toFixed(3);
          c0.badge.style.transform = `scale(${(0.85 + 0.15 * bs).toFixed(4)})`;
          c0.badge.style.boxShadow = bg > 0.01 ? `0 0 18px rgba(110,231,183,${bg.toFixed(3)})` : '';
          const tf = tq(t);
          c0.vals[0].textContent = '+' + NX.fmt(4000 * E.outCubic(seg(tf, 18.75, 19.80)));
          c0.vals[1].textContent = '+' + NX.fmt(20 * E.outCubic(seg(tf, 19.30, 20.40)));
          c0.tglow[0].style.opacity = t >= 19.80 ? Math.exp(-4 * (t - 19.80)).toFixed(3) : 0;
          c0.tglow[1].style.opacity = t >= 20.40 ? Math.exp(-4 * (t - 20.40)).toFixed(3) : 0;
          c0.focus.style.opacity = sine(seg(t, 21.00, 21.20)).toFixed(3);
        }

        /* --- Carte 2 « Débriefer » : rangées qui montent pendant qu'elle avance, pastilles numérotées --- */
        if (t < LIFT[1] + 0.6) {
          const RISE = [21.55, 21.62, 21.69, null, 22.05, 22.15, 22.30];
          // Sorties 24,70 + 0,03 i (bible : 24,80) : la carte 3 dépasse la carte 2 en profondeur à 25,12 ; à 24,80 les
          // quatre dernières rangées seraient encore là et disparaîtraient d'un coup derrière sa plaque.
          const SK = i => 24.70 + 0.03 * i;
          c1.rows.forEach((el, i) => {
            const r = ouRow(t, RISE[i], SK(i));
            el.style.opacity = (i === 3 ? (t >= 21.95 ? r.a : 0) : r.a).toFixed(3);
            el.style.transform = tr3(r.y, i >= 5 ? 18 : 0);
          });
          c1.sep.style.transform = `${tr3(ouRow(t, null, SK(3)).y, 0)} scaleX(${E.glide(seg(t, 21.95, 22.35)).toFixed(4)})`;
          c1.items.forEach((it, i) => {
            const F = [22.80, 23.40][i];
            const a = 360 * E.outCubic(seg(t, F, F + 0.25));
            it.fill.style.opacity = a > 0 ? 1 : 0;
            const m = a >= 360 ? '' : `conic-gradient(#000 ${a.toFixed(2)}deg,transparent ${(a + 1.2).toFixed(2)}deg)`;
            it.fill.style.maskImage = it.fill.style.webkitMaskImage = m;
            const s = SPRING(seg(t, F, F + 0.5));
            it.n1.style.opacity = sine(seg(t, F, F + 0.08)).toFixed(3);
            it.n1.style.transform = `scale(${(0.55 + 0.45 * s).toFixed(4)})`;
            const gp = seg(t, F, F + 0.4), on = gp > 0 && gp < 1;
            it.glint.style.opacity = on ? (NX.smooth(0, 0.15, gp) * (1 - NX.smooth(0.85, 1, gp))).toFixed(3) : 0;
            it.gband.style.transform = `translateX(${lerp(-100, 357, E.sheen(gp)).toFixed(2)}%)`;
          });
        }

        /* --- Carte 3 « Planifier » : en-tête, colonnes des jours, créneaux qui tombent sur les temps --- */
        {
          const hr = ouRow(t, 25.15, null);
          c2.head.style.opacity = hr.a.toFixed(3);
          c2.head.style.transform = tr3(hr.y, 0);
          c2.days.forEach((d, i) => {
            const e = E.enter(seg(t, 25.25 + 0.06 * i, 25.75 + 0.06 * i));
            d.el.style.transform = tr3((1 - e) * 28, 18 * e);
            d.lab.style.opacity = d.bg.style.opacity = clamp(e * 1.8).toFixed(3);
            if (!d.slot) return;
            const p = seg(t, d.drop, d.drop + 0.30), q = DROPIN(p);
            d.slot.style.opacity = sine(seg(t, d.drop, d.drop + 0.10)).toFixed(3);
            d.slot.style.transform = tr3(-16 * (1 - q), 2 + 60 * (1 - q));
            const gp = seg(t, d.drop, d.drop + 0.5);
            d.glow.style.opacity = gp > 0 && gp < 1 ? Math.pow(Math.sin(Math.PI * gp), 1.5).toFixed(3) : 0;
          });
        }

        /* --- Brûlure de la carte 3 par le front de la fin (avance 100 px) --- */
        if (burning) {
          const R = NX.FRONT.end(t), o = ouProj(0, 0), c = ouProj(ST.w / 2, ST.h / 2);
          const Lc = NX.light.localCard(o, c.s, R, t);
          for (const lf of this.burnLeaves) NX.light.burn(lf.el, { cx: Lc.cx - lf.x, cy: Lc.cy - lf.y, r: Lc.r }, { feather: 60, lead: LEAD });
          ouRimMask(c2.rim, NX.light.mask(Lc, 'burn', { feather: 60, lead: LEAD }));
          c2.burnBand.style.display = '';
          c2.burnBand.style.background = NX.light.band(Lc, LEAD);
          // Alpha 0,6 (bible) ; la bande s'éteint quand le bord quitte le bas de la carte : pas de barre de lumière seule.
          const rem = Math.hypot((ST.w / 2 - Lc.cx) / NX.light.K, ST.h - Lc.cy) - (Lc.r + LEAD);
          c2.burnBand.style.opacity = (0.6 * NX.smooth(0, 160, rem)).toFixed(3);
          // Sur une carte plate (sans masque de traits clairs comme les logos), la traîne de la bande est raccourcie :
          // un bord chaud et une lueur courte au lieu d'un voile de 170 px sur toute la silhouette.
          const sh = `ellipse ${(NX.light.K * 3000).toFixed(1)}px 3000px at ${Lc.cx.toFixed(1)}px ${Lc.cy.toFixed(1)}px`, pc = v => (v / 30).toFixed(3) + '%';
          const bm = `radial-gradient(${sh},transparent ${pc(Lc.r + LEAD - 125)},#000 ${pc(Lc.r + LEAD - 40)})`;
          c2.burnBand.style.maskImage = c2.burnBand.style.webkitMaskImage = bm;
          NX.light.wordGlow(this.cardGlowEls, this.cardGlowC, R, t, LEAD);
        } else {
          for (const lf of this.burnLeaves) ouMaskOff(lf.el);
          ouRimMask(c2.rim, null);
          c2.burnBand.style.opacity = 0;
          c2.burnBand.style.display = 'none';
          for (const el of this.cardGlowEls) el.style.textShadow = '';
        }
      }

      /* ===== Colonne de titre ===== */
      const showCol = t >= DROP && t < 29.1;
      this.col.style.display = showCol ? '' : 'none';
      if (!showCol) return;
      this.hair.style.transform = `scaleX(${E.glide(seg(t, DROP, DROP + 0.35)).toFixed(4)})`;
      const kp = E.enter(seg(t, 18.10, 18.60));
      this.kick.style.letterSpacing = `${lerp(0.6, 0.28, kp).toFixed(4)}em`;
      for (const el of this.kparts) el.style.opacity = kp.toFixed(3);
      NX.type.odometer(this.odo, t, t < 25.0 ? 21.40 : 25.00, t < 25.0 ? 1 : 2, t < 25.0 ? 2 : 3, 0.45);
      const [v0, v1, v2] = this.verbs;
      v0.style.transform = ''; v0.style.opacity = 1;
      NX.type.sink([v0], t, 21.35, 0, 0.25);
      NX.type.rise([v1], t, 21.55, 0, 0.5); NX.type.sink([v1], t, 24.95, 0, 0.25);
      NX.type.rise([v2], t, 25.15, 0, 0.5);
      // Titres : montée par les masques de ligne (ENTER 0,8, décalage 0,14), sortie par lignes (EXIT 0,30).
      const TW = [[18.12, 21.10, 21.16, 19.30], [21.45, 24.70, 24.76, 22.60], [25.05, null, null, 26.40]];
      this.titles.forEach((T, k) => {
        const [r0, s1, s2, sh] = TW[k], end = s2 == null ? 99 : s2 + 0.36;
        const on = t >= r0 && t < end;
        T.el.style.display = on ? '' : 'none';
        if (!on) return;
        NX.type.rise(T.words, t, r0, 0.14, 0.8);
        if (s1 != null) { NX.type.sink(T.lines[0], t, s1, 0.05, 0.30); NX.type.sink(T.lines[1], t, s2, 0.05, 0.30); }
        NX.type.sheen(T.spec, t, sh, sh + 0.8, 0.35);
      });
      // Brûlure de la colonne (local exact : la colonne est plate, face à la caméra) et lueur des glyphes.
      // Les masques de ligne s'ouvrent pendant la brûlure (mots au repos) : la lueur des glyphes n'est pas rognée.
      const open = burning ? 'visible' : '';
      for (const el of this.titles[2].lineEls) el.style.overflow = open;
      this.verbs[0].parentElement.style.overflow = open; this.odo.style.overflow = open;
      [...this.odo.children].forEach((b, i) => { b.style.opacity = burning && i !== 2 ? 0 : ''; });
      if (burning) {
        const R = NX.FRONT.end(t);
        NX.light.burn(this.col, NX.light.local(COL.left - PAD, COL.top - PAD, COL.z + ROOTZ, R, t), { feather: 60, lead: LEAD });
        NX.light.wordGlow(this.glowEls, this.glowC, R, t, LEAD);
      } else {
        ouMaskOff(this.col);
        for (const el of this.glowEls) el.style.textShadow = '';
      }
    },
  });
})();
