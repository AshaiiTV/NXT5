/* S6–S8 « Outils » (bible §4, amendement v7.1) : quatre cartes de verre en pile, éclairées d'en haut.
 * NX.T.tools (13,2) : la lumière redescend sur la carte avant, qui s'allume. Chaque outil fini est pris dans la lumière
 * pendant que le suivant avance, sur les cloches 16,8 / 20,4 / 24,0 (NX.T.tools + k·NX.T.tool). La pile tient quatre
 * cartes dont trois seulement sont visibles : la quatrième (planning) entre au cran du fond quand la première part.
 * À NX.T.end (27,6), le front de lumière de la fin (avance 100 px) brûle la dernière carte et la colonne de titre
 * pendant que l'emblème revient (fin.js).
 * Toutes les heures sont relatives à NX.T : S6 et S7 sont celles de la v7 décalées de −4,8 s, S8 de −1,2 s.
 * Données de la démo publique (équipe fictive) : textes et valeurs des trois cartes de la v7 inchangés ; le débrief
 * montre des points numérotés (pas des cases à cocher) et le planning des créneaux à l'heure (Scrim, Débrief, Match).
 * La carte « Drafter » reprend le vocabulaire de l'espace draft du produit (DraftWorkspace.jsx : composition,
 * maîtrise, « x/5 champions » ; workspace-shared.jsx : COMP_ROLES, POOL_TIER_LABELS) et la composition de l'équipe
 * de démonstration (demo-data.js : Gnar, Vi, Ahri, Jinx, Braum). Jamais d'image de champion : du texte et nos icônes
 * de rôle, les mêmes que les tuiles des rôles (S3′). */
(function () {
  const TL = NX.G.tools, ST = TL.stack, COL = TL.col;
  const E = NX.ease, seg = NX.seg, clamp = NX.clamp, lerp = NX.lerp, sine = NX.ease.sine;
  const RAD = Math.PI / 180;
  const ROOTZ = 1;                               // le moteur décale la racine de la scène (z 2) de 2 × 0,5 px
  const LEAD = 100;                              // la brûlure précède l'écriture du logo final (bible §3.3)
  /* Frise, relative à NX.T (amendement v7.1) : B[0] drop, B[1..3] cloches des changements d'outil. */
  const T = NX.T;
  const DROP = T.tools;                          // 13,2 : la lumière redescend
  const B = [0, 1, 2, 3].map(k => T.tools + k * T.tool);   // 13,2 · 16,8 · 20,4 · 24,0
  const END = T.end;                             // 27,6 : retour de l'emblème, brûlure
  const LIFT = [B[1] - 0.30, B[2] - 0.30, B[3] - 0.30];    // cartes 1, 2 et 3 prises dans la lumière (0,6 s)
  const BURN = END - 0.55;                       // 27,05 : le front de la fin commence à brûler (avance 100 px)
  const LAST = 3;                                // la carte « Planifier », brûlée par le front
  const SPRING = p => E.spring(p, 1.0, 6.2);
  const DROPIN = NX.bezier(0.2, 1.2, 0.3, 1);    // chute des créneaux et des choix (rebond ≈ 1,3 %, ≤ 4 %)
  const tq = t => Math.round(t * NX.FPS) / NX.FPS; // compteurs calés sur l'image : pas de chiffres fantômes
  const NB = ' ';                           // espace fine insécable (typographie de la v6)
  const [, SDY, SDZ] = ST.slots[1];              // un cran de pile : y −46, z −150 (les crans sont linéaires)
  const PAD = 44;                                // marge de la colonne : le masque de brûlure ne rogne pas la lueur des glyphes
  /* Micro-événements de la carte « Drafter » : les cinq choix tombent sur les coups de batterie de la mesure qui suit la
   * cloche de 20,4 (caisse claire 21,0 ; grosses caisses 21,6 et 21,9 ; caisse claire 22,2 ; premier temps 22,8), puis
   * le badge de maîtrise saute juste après le cinquième. */
  const PICK_T = [0.6, 1.2, 1.5, 1.8, 2.4].map(o => B[2] + o);
  const BADGE_T = PICK_T[4] + 0.10;
  /* Créneaux du planning : la v7 décalée de −1,2 s, sauf vendredi. Le décalage d'une demi-mesure posait vendredi
   * (v7 : grosse caisse 26,7) sur un charleston (25,5) ; il tombe sur la caisse claire suivante (25,8). */
  const SLOT_T = [0.6, 0.9, 1.2, 1.8].map(o => B[3] + o);  // Lun caisse claire, Mer charleston accentué, Jeu 1er temps, Ven caisse claire

  /* ---------- Géométrie : repère local de la pile → monde (mêmes calculs que le CSS de .ou-stack) ---------- */
  const CX = Math.cos(ST.rotX * RAD), SX = Math.sin(ST.rotX * RAD), CY = Math.cos(ST.rotY * RAD), SY = Math.sin(ST.rotY * RAD);
  /** Point local de la pile (px, y vers le bas, z vers le spectateur) → point monde [X, Y, Z]. */
  const ouWorld = (x, y, z = 0) => {
    const y1 = y * CX - z * SX, z1 = y * SX + z * CX;          // rotateX(2°)
    const x2 = x * CY + z1 * SY, z2 = -x * SY + z1 * CY;       // rotateY(10°)
    return [ST.left + x2, ST.top + y1, ST.z + z2 + ROOTZ];     // translateZ(−60 px), origine 0 0
  };
  const ouProj = (x, y, z = 0) => { const w = ouWorld(x, y, z); return NX.cam.project(w[0], w[1], w[2]); };
  /** Point local d'une carte → écran, avec sa pose : translate3d(0, ty, tz) rotateX(rx°) autour de son centre
   *  (transform-origin 50 % 50 %), mêmes calculs que le CSS de .ou-card. */
  const ouCardProj = (x, y, z, ty, tz, rx) => {
    const a = rx * RAD, dy = y - ST.h / 2;
    return ouProj(x, ST.h / 2 + dy * Math.cos(a) - z * Math.sin(a) + ty, dy * Math.sin(a) + z * Math.cos(a) + tz);
  };
  /** Profondeur de la carte k dans la pile (0 devant) : à chaque cloche j ≤ k, elle avance d'un cran (ADVANCE 0,74 s),
   *  en cascade de 0,08 s derrière la carte qui la précède (v7 : 21,38 puis 21,46 ; 24,98). */
  const ouDepth = (k, t) => { let p = k; for (let j = 1; j <= k; j++) { const a = B[j] - 0.22 + 0.08 * (k - j); p -= E.advance(seg(t, a, a + 0.74)); } return p; };
  /* Ombre de la carte, dessinée sur #fxback (derrière le DOM) avec la géométrie exacte de la feuille .gl-shadow du kit :
   * boîte (−83 ; 421,2)–(913 ; 637,2) à translateZ(−30), dégradé radial « closest-side » rgba(0,0,0,.55) → transparent.
   * La feuille DOM est masquée dans cette scène : sous la caméra 3D, son dégradé sombre se rastérisait à 1/255 près
   * selon les images rendues avant (déterminisme, bible §6.8) ; le canvas 2D est une fonction pure de t. */
  const SH = { cx: ST.w / 2, cy: ST.h * 1.18 - ST.h * 0.2, rx: ST.w * 0.6, ry: ST.h * 0.2, z: -30, a: 0.55 };
  function ouShadow(ctx, a, ty, tz, rx) {
    if (a <= 0.002) return;
    const c = ouCardProj(SH.cx, SH.cy, SH.z, ty, tz, rx), u = ouCardProj(SH.cx + SH.rx, SH.cy, SH.z, ty, tz, rx), v = ouCardProj(SH.cx, SH.cy + SH.ry, SH.z, ty, tz, rx);
    ctx.save();
    ctx.setTransform(u.x - c.x, u.y - c.y, v.x - c.x, v.y - c.y, c.x, c.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(0,0,0,${(SH.a * a).toFixed(4)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  /** Halo de couleur d'un élément qui se pose (#fx, additif) : ellipse douce de rx × ry px à l'échelle s. */
  function ouSlotGlow(ctx, x, y, s, rgb, a, rx = 105, ry = 78) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.setTransform(rx * s, 0, 0, ry * s, x, y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1), c = rgb.join(',');
    g.addColorStop(0, `rgba(${c},${(0.20 * a).toFixed(4)})`); g.addColorStop(0.6, `rgba(${c},${(0.13 * a).toFixed(4)})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

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
   *  avant (constaté sur la colonne et la dernière carte) ; avec un masque constant, le rendu ne dépend que de t. */
  const SOLID = 'linear-gradient(#000,#000)';
  function ouMaskOff(el) {
    el.style.maskImage = el.style.webkitMaskImage = SOLID;
    el.style.maskSize = el.style.webkitMaskSize = '100% 100%';
    el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = el.style.webkitMaskComposite = '';
  }

  /* ---------- Contenu ---------- */
  const TITLES = [['Comprends tes', 'parties.'], ['Prépare tes', 'débriefs.'], ['Compose ta', 'draft.'], ['Organise tes', 'entraînements.']];
  const VERBS = ['Analyser', 'Débriefer', 'Drafter', 'Planifier'];
  const disc = n => `<span class="ou-disc"><b class="ou-n0">${n}</b><i class="ou-dfill"></i><b class="ou-n1">${n}</b></span>`;
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  /* Icônes de rôle (ENGINE.md, viewBox 0 0 34 34), dans les couleurs et le dégradé des tuiles de S3′ (equipe.js). */
  const ROLE_SVG = {
    TOP: '<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>',
    JGL: '<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>',
    MID: '<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>',
    ADC: '<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>',
    SUP: '<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>',
  };
  /* Paliers du produit (POOL_TIER_LABELS) et leurs tons (championPoolStatusTone : lock vert, pocket jaune). Quatre
   * « Confiance » (100) et un « Situationnel » (78) donnent 96 ≥ 82 : « Très maîtrisée » (compositionMastery). */
  const TIERS = { lock: ['Confiance', '#6EE7B7'], pocket: ['Situationnel', '#FCD34D'] };
  /* Le liseré de Mid (blanc) est posé à 0,5 au lieu de 0,7 : à alpha égal, il brillait plus que les liserés colorés. */
  const DRAFT = [ // rôle (COMP_ROLES), couleur du rôle (S3′), champion de l'équipe de démonstration, palier
    ['TOP', '#67E8F9', 'Gnar', 'lock'],
    ['JGL', '#818CF8', 'Vi', 'lock'],
    ['MID', '#F3F7FF', 'Ahri', 'pocket'],
    ['ADC', '#A78BFA', 'Jinx', 'lock'],
    ['SUP', '#E879F9', 'Braum', 'lock'],
  ];
  const DAYS = [ // jour, couleur, type, heure, haut (px), temps de chute
    ['Lun', '#E879F9', 'Scrim', '19:00', 12, SLOT_T[0]],
    ['Mar'],
    ['Mer', '#A78BFA', 'Débrief', '19:00', 12, SLOT_T[1]],
    ['Jeu', '#67E8F9', 'Match', '20:00', 120, SLOT_T[2]],
    ['Ven', '#E879F9', 'Scrim', '19:00', 12, SLOT_T[3]],
  ];
  const CARDS = [
    `<div class="ou-in ou-in0">
      <div class="ou-h ou-row">Scrim 3 · Aurore<span class="ou-bwrap"><i class="ou-bglow"></i><span class="ou-badge">Victoire</span></span></div>
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
      <div class="ou-h ou-row">Composition principale<span class="ou-bwrap"><i class="ou-bglow"></i><span class="ou-badge">Très maîtrisée</span></span></div>
      <div class="ou-sub ou-dsub ou-row"><span>Équipe Horizon · démo fictive</span><span class="ou-cnt"><b class="ou-cn">0</b>/5 champions</span></div>
      <div class="ou-pks">${DRAFT.map(([role, c, champ, tier], i) => `<div class="ou-pk ou-row"><i class="ou-pbg"></i><i class="ou-pring" style="box-shadow:inset 0 0 0 1.5px ${c}${role === 'MID' ? '80' : 'b3'}"></i><span class="ou-ricw"><svg class="ou-ric" viewBox="0 0 34 34" aria-hidden="true"><defs><linearGradient id="ou-ig${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="34"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".38" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></linearGradient></defs><g fill="url(#ou-ig${i})">${ROLE_SVG[role]}</g></svg></span><span class="ou-rl">${role}</span><span class="ou-ch">${champ}</span><span class="ou-ti" style="color:${TIERS[tier][1]}">${TIERS[tier][0]}</span></div>`).join('')}</div>
    </div>`,
    `<div class="ou-in ou-in3">
      <div class="ou-h ou-row">Planning de l’équipe</div>
      <div class="ou-week">${DAYS.map(([d, c, name, hour, top]) => `<div class="ou-day"><div class="ou-dl">${d}</div><div class="ou-dc"><i class="ou-dbg"></i>${c
        ? `<div class="ou-slot" style="top:${top}px;background:${c}29;box-shadow:inset 4px 0 0 ${c}">${name}<small>${hour}</small><i class="ou-sglow" style="box-shadow:inset 0 0 0 1.5px ${c}cc"></i></div>` : ''}</div></div>`).join('')}</div>
    </div>`,
  ];

  NX.css(`
  .ou-col{position:absolute;left:${COL.left - PAD}px;top:${COL.top - PAD}px;width:${760 + 2 * PAD}px;padding:${PAD}px;transform:translateZ(${COL.z}px)}
  .ou-col .tz-kicker{margin-bottom:30px;white-space:nowrap}
  .ou-kt{display:inline-block}
  .ou-ksep{white-space:pre}
  /* pre : un inline-block retire les espaces de bord ; le séparateur garde les siennes (« 01 · ANALYSER », copie v6) */
  .ou-verbs{display:inline-grid;vertical-align:top;overflow:hidden;padding:.14em .08em .24em;margin:-.14em -.08em -.24em}
  .ou-verbs>span{grid-area:1/1;display:block}
  .ou-titles{position:relative;height:${(2 * 96 * 1.06).toFixed(2)}px}
  .ou-title{position:absolute;left:0;top:0}
  .ou-stack{position:absolute;left:${ST.left}px;top:${ST.top}px;width:${ST.w}px;height:${ST.h}px;transform-style:preserve-3d;transform-origin:${ST.origin};transform:translateZ(${ST.z}px) rotateY(${ST.rotY}deg) rotateX(${ST.rotX}deg)}
  .ou-card{left:0;top:0}
  .ou-card>.gl-shadow{display:none}
  .ou-rule{background:var(--primary) top/100% 4px no-repeat;transform:translateZ(3px)}
  .ou-sw{overflow:hidden;mix-blend-mode:plus-lighter;transform:translateZ(2.5px);opacity:0}
  .ou-sw i{position:absolute;top:-25%;bottom:-25%;left:0;width:40%;background:linear-gradient(90deg,transparent,rgba(160,215,255,.05) 25%,rgba(232,247,255,.22) 50%,rgba(196,181,253,.05) 75%,transparent)}
  .ou-band{mix-blend-mode:plus-lighter;transform:translateZ(3.5px);opacity:0}
  .ou-in{position:absolute;inset:0;padding:48px 44px;display:flex;flex-direction:column;transform-style:preserve-3d}
  .ou-row{position:relative;-webkit-mask:linear-gradient(#000,#000) no-clip;mask:linear-gradient(#000,#000) no-clip}
  .ou-h{font-weight:700;font-size:44px;line-height:1.2;letter-spacing:-.01em;color:var(--text);white-space:nowrap}
  .ou-bwrap{position:relative;display:inline-block;margin-left:18px;vertical-align:middle}
  .ou-badge{position:relative;display:block;padding:6px 14px;border-radius:6px;font-size:22px;line-height:1.2;font-weight:700;color:#6EE7B7;background:rgba(110,231,183,.14);vertical-align:middle}
  .ou-bglow{position:absolute;inset:0;border-radius:6px;box-shadow:0 0 18px rgba(110,231,183,.55);opacity:0}
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
  .ou-dsub{display:flex;align-items:baseline;justify-content:space-between;white-space:nowrap}
  .ou-cnt{font-variant-numeric:tabular-nums}
  .ou-cn{display:inline-block;font-weight:700;color:var(--text);transform-origin:50% 60%}
  .ou-pks{display:flex;flex-direction:column;gap:7px;margin-top:auto;transform-style:preserve-3d}
  .ou-pk{display:flex;align-items:center;height:56px;padding:0 22px 0 14px;white-space:nowrap}
  .ou-pbg,.ou-pring{position:absolute;inset:0;border-radius:12px}
  .ou-pbg{background:linear-gradient(180deg,#13233B,#0D1A2D);border:1px solid rgba(154,182,218,.16)}
  .ou-pring{opacity:0}
  .ou-ricw{position:relative;flex:none;width:38px;height:38px}
  .ou-ric{display:block;width:38px;height:38px}
  .ou-rl{position:relative;flex:none;width:90px;margin-left:16px;font-weight:700;font-size:28px;line-height:1.2;letter-spacing:.1em;color:var(--muted)}
  .ou-ch{position:relative;font-weight:700;font-size:36px;line-height:1.2;letter-spacing:-.01em;color:var(--text)}
  .ou-ti{position:relative;margin-left:auto;font-weight:700;font-size:28px;line-height:1.2;transform-origin:100% 50%}
  .ou-week{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:34px;transform-style:preserve-3d}
  .ou-day{position:relative;transform-style:preserve-3d}
  .ou-dl{font-weight:700;font-size:28px;line-height:1.2;letter-spacing:.12em;padding:24px 24px 24px calc(24px + .12em);margin:-24px -24px -10px;text-transform:uppercase;color:var(--muted);text-align:center}
  .ou-in3>.ou-h{padding:30px 44px;margin:-30px -44px}
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
  /** Opacité d'un détail de carte. Pas de display:none ici (contrairement aux cartes, titres et calques entiers) : le
   *  badge qui réapparaissait ainsi au milieu de son ressort se rastérisait à 24/255 près selon les images rendues avant
   *  (déterminisme, bible §6.8) ; à opacité seule, comme le badge « Victoire » et les créneaux, le rendu ne dépend que de t. */
  const ouFade = (el, a) => { el.style.opacity = a.toFixed(3); };
  /** Bande de la brûlure sur le verre (bible : NX.light.band) : un bord chauffé à blanc, étroit (r − 3 à r + 1,
   *  r = rayon + avance), dans un halo cyan qui mord le verre restant, et une traîne courte côté brûlé. La traîne de
   *  170 px du kit, faite pour l'écriture des logos (elle n'y éclaire que les traits écrits), éclairait ici la partie
   *  déjà brûlée sur toute la largeur : un fantôme lumineux de la carte. Un cœur large et neutre se lisait en gris. */
  function ouBurnBand(L, lead) {
    const r = L.r + lead, pc = v => (v / 30).toFixed(3) + '%';
    const sh = `ellipse ${(NX.light.K * 3000).toFixed(1)}px 3000px at ${L.cx.toFixed(1)}px ${L.cy.toFixed(1)}px`;
    return `radial-gradient(${sh},transparent ${pc(r - 26)},rgba(103,232,249,.30) ${pc(r - 14)},#fff ${pc(r - 3)},#fff ${pc(r + 1)},`
      + `rgba(165,243,252,.70) ${pc(r + 9)},rgba(103,232,249,.22) ${pc(r + 30)},rgba(129,140,248,.08) ${pc(r + 52)},transparent ${pc(r + 72)})`;
  }
  /** Balayage événementiel (bible §3.7) : centre de la bande de 1,1 à −0,1 (largeur de carte), SHEEN. */
  function ouSweep(t, a, b) {
    const p = seg(t, a, b); if (p <= 0 || p >= 1) return null;
    return { u: lerp(1.1, -0.1, E.sheen(p)), a: NX.smooth(0, 0.12, p) * (1 - NX.smooth(0.88, 1, p)) };
  }

  NX.scene({
    id: 'outils', start: DROP - 0.3, end: END + 1.1, z: 2,
    build(root) {
      // Colonne de titre : filet, surtitre (compteur à rouleau, verbes empilés), quatre titres empilés.
      this.col = NX.el(`<div class="ou-col">
        <div class="tz-kicker ou-kick"><i class="tz-hair"></i><span class="ou-kt">0</span><span class="tz-odo ou-kt"><b>1</b><b>2</b><b>3</b><b>4</b></span><span class="ou-kt ou-ksep"> · </span><span class="ou-verbs ou-kt">${VERBS.map(v => `<span>${v}</span>`).join('')}</span></div>
        <div class="ou-titles">${TITLES.map(([a, b]) => `<div class="tz-title ou-title"><span class="tz-line">${a}</span><span class="tz-line"><span class="nx-spec">${b}</span></span></div>`).join('')}</div>
      </div>`, root);
      this.dbg = { ouWorld, PAD, B, PICK_T, SLOT_T };   // pour les sondes de vérification (aucun état)
      this.hair = this.col.querySelector('.tz-hair');
      this.kick = this.col.querySelector('.ou-kick');
      this.kparts = [...this.col.querySelectorAll('.ou-kt')];
      this.odo = this.col.querySelector('.tz-odo');
      this.verbs = [...this.col.querySelectorAll('.ou-verbs > span')];
      this.titles = [...this.col.querySelectorAll('.ou-title')].map(el => {
        const { lines, words } = NX.type.prepare(el);
        const spec = el.querySelector('.nx-spec');
        return { el, lines, words, spec, lineEls: [...el.querySelectorAll('.tz-line')] };
      });
      // Pile de quatre cartes de verre (bible §3.7, NX.G.tools.stack) : trois visibles à la fois.
      this.stack = NX.el('<div class="ou-stack"></div>', root);
      this.cards = CARDS.map((html, k) => {
        const g = NX.glass(html, { w: ST.w, h: ST.h, wash: true });
        g.el.classList.add('ou-card');
        g.fog.style.transform = 'translateZ(1.5px)';   // brume sous le liseré et le filet : les cartes du fond gardent leur contour
        g.rule = NX.el('<div class="ou-rule"></div>', g.el);
        g.sw = NX.el('<div class="ou-sw"><i></i></div>', g.el); g.swBand = g.sw.firstElementChild;
        if (k === LAST) g.burnBand = NX.el('<div class="ou-band"></div>', g.el);   // (g.band est la bande de reflet du kit)
        ouRimMask(g.rim, null);
        g.rows = [...g.el.querySelectorAll('.ou-row')];
        this.stack.appendChild(g.el);
        return g;
      });
      const [c0, c1, c2, c3] = this.cards;
      c0.badge = c0.el.querySelector('.ou-badge'); c0.bglow = c0.el.querySelector('.ou-bglow');
      c0.tiles = [...c0.el.querySelectorAll('.ou-stat')];
      c0.vals = c0.tiles.map(x => x.querySelector('.v'));
      c0.tglow = c0.tiles.map(x => x.querySelector('.ou-tglow'));
      c0.focus = c0.el.querySelector('.ou-focus');
      c1.sep = c1.el.querySelector('.ou-sep');
      c1.items = [...c1.el.querySelectorAll('.ou-item')].map(el => ({ el, fill: el.querySelector('.ou-dfill'), n1: el.querySelector('.ou-n1'), glint: el.querySelector('.ou-glint'), gband: el.querySelector('.ou-glint i') }));
      c2.badge = c2.el.querySelector('.ou-badge'); c2.bglow = c2.el.querySelector('.ou-bglow');
      c2.cn = c2.el.querySelector('.ou-cn');
      c2.picks = [...c2.el.querySelectorAll('.ou-pk')].map((el, i) => ({ el, icon: el.querySelector('.ou-ricw'), ch: el.querySelector('.ou-ch'), ti: el.querySelector('.ou-ti'), ring: el.querySelector('.ou-pring'), rgb: hex(DRAFT[i][1]) }));
      c3.head = c3.el.querySelector('.ou-h');
      c3.days = [...c3.el.querySelectorAll('.ou-day')].map((el, i) => ({ el, lab: el.querySelector('.ou-dl'), bg: el.querySelector('.ou-dbg'), slot: el.querySelector('.ou-slot'), glow: el.querySelector('.ou-sglow'), drop: DAYS[i][5], rgb: DAYS[i][1] ? hex(DAYS[i][1]) : null }));
    },
    layout() {
      // Décalages (px locaux, sans transformation) : feuilles de la dernière carte pour la brûlure, mots pour la lueur.
      // Le halo (.gl-glow) n'est pas brûlé mais éteint en opacité avant le passage du front (voir render) : masqué
      // pendant la brûlure, ce grand calque faisait réapparaître, selon les images rendues avant, une texture périmée
      // (une rangée de la carte précédente et des traînées blanches sous la dernière carte).
      const off = (el, anc) => { let x = 0, y = 0; for (let e = el; e && e !== anc; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return [x, y]; };
      const c2 = this.cards[2], c3 = this.cards[LAST];
      const leaves = [c3.plate, c3.sheen, c3.wash, c3.rule, c3.sw, c3.head, ...c3.days.flatMap(d => [d.lab, d.bg, d.slot].filter(Boolean))];
      this.burnLeaves = leaves.map(el => { const [x, y] = off(el, c3.el); return { el, x, y }; });
      this.glowEls = [this.kick, ...this.titles[LAST].words];
      this.glowC = this.glowEls.map(el => { const [x, y] = off(el, this.col); return [COL.left - PAD + x + el.offsetWidth / 2, COL.top - PAD + y + el.offsetHeight / 2, COL.z + ROOTZ]; });
      // Textes de la dernière carte : centres monde (carte au cran 0 pendant la brûlure ; z du contenu, des colonnes, des créneaux).
      const cardText = [[c3.head, 1], ...c3.days.map(d => [d.lab, 19]), ...c3.days.filter(d => d.slot).map(d => [d.slot, 21])];
      this.cardGlowEls = cardText.map(([el]) => el);
      this.cardGlowC = cardText.map(([el, z]) => { const [x, y] = off(el, c3.el); return ouWorld(x + el.offsetWidth / 2, y + el.offsetHeight / 2, z); });
      // Centres des créneaux (px locaux de la carte, sans transformation) pour leur halo.
      this.slotC = c3.days.map(d => { if (!d.slot) return null; const [x, y] = off(d.slot, c3.el); return [x + d.slot.offsetWidth / 2, y + d.slot.offsetHeight / 2]; });
      // Centres des icônes de rôle de la carte « Drafter » (px locaux) pour le halo de chaque choix.
      this.pickC = c2.picks.map(p => { const [x, y] = off(p.icon, c2.el); return [x + p.icon.offsetWidth / 2, y + p.icon.offsetHeight / 2]; });
    },
    prepare() {
      this.snares = NX.beats.dropSnares.slice();
      // Contrôle de la frise : chaque micro-événement tombe sur une grosse caisse ou une caisse claire (bible §2.5),
      // sauf le créneau du mercredi (charleston accentué, exception de la bible). Un recalage de NX.T le signale ici.
      const hits = NX.beats.dropKicks.concat(NX.beats.dropSnares), on = x => hits.some(h => Math.abs(h - x) < 1e-6);
      const events = [DROP + 0.6, DROP + 1.8, DROP + 2.4, B[1] - 0.6, B[1] + 1.2, B[1] + 1.8, ...PICK_T, SLOT_T[0], SLOT_T[2], SLOT_T[3]];
      const off = events.filter(x => !on(x));
      if (off.length) console.warn(`outils : micro-événements hors des coups de batterie : ${off.map(x => x.toFixed(2)).join(', ')}`);
    },
    render(S) {
      const t = S.t, cam = NX.camState || NX.cam.at(t);
      const [c0, c1, c2, c3] = this.cards;
      const burning = t >= BURN;

      /* ===== Lumière du drop (#fx) : le faisceau redescend sur le coin de la carte avant ===== */
      const tau = t - DROP;
      if (tau >= 0 && tau < 1.5) {
        const src = NX.light.src(t), corner = ouProj(0, 0), h = ouProj(60, 0);
        NX.lk.beam(src.x, src.y, corner.x, corner.y, 6, 40, 0.8 * Math.exp(-5 * tau), [210, 245, 255], NX.fx.ctx);
        NX.hit(t, DROP, h.x, h.y, { flare: 0.5, width: 0.5, core: 160, coreA: 0.3 });
      }

      /* ===== Pile ===== */
      const showStack = t >= DROP - 0.2 && t < END + 0.5;
      this.stack.style.display = showStack ? '' : 'none';
      if (showStack) {
        const rimAngle = 180 + 6 * cam.yaw, pos = -0.43 * cam.yaw;
        const snare = t >= DROP ? 1 + 0.25 * NX.beatPulse(t, this.snares, 7) : 1;
        // Contours d'anticipation (bible : 0,25), seuls, sans plaque ni contenu, sur les trois cartes de la pile.
        // ENTER : ils se lisent pendant que la lance monte encore (acceptation S5).
        const pre = 0.25 * E.enter(seg(t, DROP - 0.20, DROP - 0.02));
        // Mise sous tension de la carte avant (0,10 s, ENTER) avancée d'une demi-image (bible : drop → drop + 0,10) :
        // l'obturateur de l'image du temps fort ne voyait la carte qu'à 15 % et le pic de lumière tombait sur l'image
        // suivante. Le faisceau et NX.hit restent sur le temps fort.
        const onF = E.enter(seg(t, DROP - 0.015, DROP + 0.085));
        const onB = E.enter(seg(t, DROP + 0.05, DROP + 0.25));            // cartes du fond, sous la brume
        const tB = t - (DROP + 0.05);
        // La quatrième carte entre au cran du fond quand la première part (cloche 16,8) : elle avance de l'arrière
        // (cran 3 → 2, sous la brume) en s'allumant, pendant que la première s'efface dans la lumière.
        const onE = sine(seg(t, B[1] - 0.02, B[1] + 0.48));
        const poses = [];                                                  // pose de chaque carte visible, pour ses halos
        const sweeps = [ouSweep(t, DROP + 0.60, DROP + 1.20), ouSweep(t, B[1], B[1] + 0.65), ouSweep(t, B[2], B[2] + 0.65),
          ouSweep(t, B[3], B[3] + 0.65) || ouSweep(t, END - 1.20, END - 0.60)];
        this.cards.forEach((g, k) => {
          const L0 = LIFT[k], lifts = k < LAST, e = lifts ? E.lift(seg(t, L0, L0 + 0.6)) : 0;
          const vis = lifts ? 1 - sine(seg(t, L0 + 0.25, L0 + 0.6)) : 1;
          const visible = k === LAST ? t >= B[1] - 0.02 && t < END + 0.5 : t >= DROP - 0.2 && t < L0 + 0.6;
          g.el.style.display = visible ? '' : 'none';
          if (!visible) return;
          const p = ouDepth(k, t), pd = Math.max(0, p), ty = SDY * p - 300 * e, tz = SDZ * p - 360 * e;
          g.el.style.transform = `translate3d(0px,${ty.toFixed(2)}px,${tz.toFixed(2)}px)${e > 0 ? ` rotateX(${(-18 * e).toFixed(3)}deg)` : ''}`;
          const on = k === 0 ? onF : k === LAST ? onE : onB;
          let gain = snare * (k === 0 ? (tau >= 0 ? 1 + 1.5 * Math.exp(-3 * tau) : 1) : k < LAST && tB >= 0 ? 1 + 0.6 * Math.exp(-3 * tB) : 1);
          if (k > 0 && t >= B[k]) gain *= 1 + 0.6 * Math.exp(-4 * (t - B[k]));
          const rimLit = clamp((0.7 - 0.1 * pd) * gain), ruleLit = clamp(1 - 0.22 * pd);
          const pre0 = k === LAST ? 0 : pre;
          const rim = k === 0 ? (t < DROP ? pre : rimLit) : lerp(pre0, rimLit, on);
          const rule = k === 0 ? (t < DROP ? pre : ruleLit) : lerp(pre0, ruleLit, on);
          let wash = 0;
          // Voile de la carte prise dans la lumière : +0,45 (bible : +0,3) pour tenir Y ≥ 15 dans les creux des passages.
          const LW = 0.45;
          if (k === 0) wash = (tau >= 0 ? Math.exp(-5 * tau) : 0) + LW * sine(seg(t, L0, L0 + 0.25));
          else if (lifts) wash = (tB >= 0 ? 0.4 * Math.exp(-5 * tB) : 0) + LW * sine(seg(t, L0, L0 + 0.25));
          // La lumière passe à la carte qui avance : même voile que la carte prise dans la lumière au moment où elles se
          // croisent en profondeur (cloche − 0,09 à − 0,04), puis il s'éteint en 0,24 s, avant la lecture. Sans lui,
          // l'échange des plaques clignote ; plus long, il faisait sauter la luminance de 5,5 en un échantillon.
          if (k > 0) { const A0 = B[k] - 0.22; wash += 0.45 * sine(seg(t, A0 + 0.02, A0 + 0.14)) * (1 - sine(seg(t, A0 + 0.18, A0 + 0.42))); }
          const front = 1 - Math.min(1, pd);
          const glow = front * (0.10 + (k === 0 && tau >= 0 ? 0.45 * Math.exp(-3 * tau) : 0));
          const lit = Math.min(1, 0.5 * (1 - 0.3 * pd) + (k === 0 && tau >= 0 ? 0.5 * Math.exp(-3 * tau) : 0));
          NX.glassFade(g, on * vis);
          NX.glassLight(g, { pos, lit, rimAngle, rimGain: 1, fog: 0.42 * pd, glow, wash });
          // Halo de la dernière carte (alpha effectif ≈ 0,035) éteint avant que le front n'atteigne la carte.
          if (k === LAST) g.glow.style.opacity = (clamp(glow * g.a) * (1 - NX.smooth(END - 0.40, END - 0.20, t))).toFixed(3);
          // Ombre (canvas arrière) : même opacité que la feuille du kit ; celle de la dernière carte part avec la brûlure.
          let shA = g.a;
          if (k === LAST && burning) {
            const R = NX.FRONT.end(t), src = NX.light.src(t), d = (x, y) => { const q = ouProj(x, y, SH.z); return NX.light.dist(q.x, q.y, src); };
            shA *= 1 - NX.smooth(d(SH.cx, SH.cy - SH.ry) - 10, d(SH.cx, SH.cy + SH.ry) + 60, R + LEAD);
          }
          ouShadow(NX.fxBack.ctx, shA, ty, tz, -18 * e);
          g.content.style.opacity = '';                                      // preserve-3d : jamais d'opacité ici
          g.rim.style.opacity = (rim * vis).toFixed(3);
          g.rule.style.opacity = (rule * vis).toFixed(3);
          const sw = sweeps[k];
          g.sw.style.opacity = sw ? (sw.a * on * vis).toFixed(3) : 0;
          // Toujours posé (hors balayage : bande garée hors de la carte) : aucun style ne dépend des images rendues avant.
          const su = sw ? sw.u : -0.3;
          g.swBand.style.transform = `translateX(${((su - 0.2) / 0.4 * 100).toFixed(2)}%) skewX(-20deg)`;
          poses[k] = { ty, tz, rx: -18 * e };
        });

        /* --- Carte 1 « Analyser » : allumée au drop, compteurs, badge, mise au point, puis sortie --- */
        if (t < LIFT[0] + 0.6) {
          // Sorties en cascade de 0,03 s, la tuile vision en dernier (bible : cloche − 0,40 + 0,03 i, tuile à − 0,20). La
          // cascade part à cloche − 0,45 et la tuile à − 0,36 : la plaque de la carte 2, qui avance plus vite que la
          // carte 1 ne recule, passe devant la face de la carte 1 à cloche − 0,09 (tuile : − 0,04) ; une rangée encore là
          // serait coupée net par elle. Ainsi la carte 1 est vide à cloche − 0,10 et la tuile vision lisible jusqu'à − 0,20.
          const SINK = [0, 1, 2, 3].map(i => B[1] - 0.45 + 0.03 * i);
          const zT = [26 * E.glide(seg(t, DROP + 0.30, DROP + 0.80)), 26 * E.glide(seg(t, DROP + 0.42, DROP + 0.92)) + 20 * E.glide(seg(t, B[1] - 0.60, B[1] - 0.25))];
          c0.rows.forEach((el, i) => {
            const r = ouRow(t, null, SINK[i]);
            el.style.opacity = (onF * r.a).toFixed(3);
            el.style.transform = tr3(r.y, i >= 2 ? zT[i - 2] : 0);
          });
          const BG0 = DROP + 0.60;                                            // caisse claire : « Victoire »
          const bs = SPRING(seg(t, BG0, BG0 + 0.50)), bg = t >= BG0 ? 0.55 * Math.exp(-3.5 * (t - BG0)) : 0;
          c0.badge.style.opacity = sine(seg(t, BG0, BG0 + 0.08)).toFixed(3);
          // La lueur est une feuille fixe (taille finale du badge, flou constant) dont seule l'opacité varie : un
          // box-shadow redessiné à chaque image sous l'échelle du ressort se rastérisait à 4/255 près selon les images
          // rendues avant (déterminisme, bible §6.8).
          c0.badge.style.transform = `scale(${(0.85 + 0.15 * bs).toFixed(4)})`;
          c0.bglow.style.opacity = (bg / 0.55 * sine(seg(t, BG0, BG0 + 0.08))).toFixed(3);
          const tf = tq(t);
          c0.vals[0].textContent = '+' + NX.fmt(4000 * E.outCubic(seg(tf, DROP + 0.75, DROP + 1.80)));   // pose sur la caisse claire
          c0.vals[1].textContent = '+' + NX.fmt(20 * E.outCubic(seg(tf, DROP + 1.30, DROP + 2.40)));     // pose sur le 1er temps
          c0.tglow[0].style.opacity = t >= DROP + 1.80 ? Math.exp(-4 * (t - DROP - 1.80)).toFixed(3) : 0;
          c0.tglow[1].style.opacity = t >= DROP + 2.40 ? Math.exp(-4 * (t - DROP - 2.40)).toFixed(3) : 0;
          // Mise au point sur la caisse claire (cloche − 0,6) : liseré cyan de 2 px et lueur de 24 px en 0,2 s (ENTER).
          c0.focus.style.opacity = E.enter(seg(t, B[1] - 0.60, B[1] - 0.40)).toFixed(3);
        }

        /* --- Carte 2 « Débriefer » : rangées qui montent pendant qu'elle avance, pastilles numérotées --- */
        if (t < LIFT[1] + 0.6) {
          const RISE = [0, 0.07, 0.14, null, 0.50, 0.60, 0.75].map(o => o == null ? null : B[1] - 0.05 + o);
          // Sorties cloche suivante − 0,50 + 0,03 i (bible : − 0,40) : la carte 3 dépasse la carte 2 en profondeur à
          // cloche − 0,08 ; plus tard, les dernières rangées disparaîtraient d'un coup derrière sa plaque.
          const SK = i => B[2] - 0.50 + 0.03 * i, SEP = B[1] + 0.35;
          c1.rows.forEach((el, i) => {
            const r = ouRow(t, RISE[i], SK(i));
            el.style.opacity = (i === 3 ? (t >= SEP ? r.a : 0) : r.a).toFixed(3);
            el.style.transform = tr3(r.y, i >= 5 ? 18 : 0);
          });
          c1.sep.style.transform = `${tr3(ouRow(t, null, SK(3)).y, 0)} scaleX(${E.glide(seg(t, SEP, SEP + 0.40)).toFixed(4)})`;
          c1.items.forEach((it, i) => {
            const F = B[1] + [1.2, 1.8][i];                                   // 1er temps, puis caisse claire
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

        /* --- Carte 3 « Drafter » : même grammaire que la carte 2. Les rangées montent pendant qu'elle avance ; les cinq
         *     choix tombent un par coup de batterie (compteur 1/5 → 5/5 calé sur l'image), puis le badge saute. --- */
        if (t < LIFT[2] + 0.6) {
          const R0 = B[2] - 0.05, SK = i => B[3] - 0.50 + 0.03 * i;
          c2.rows.forEach((el, i) => {
            const r = ouRow(t, R0 + 0.07 * i, SK(i));
            el.style.opacity = r.a.toFixed(3);
            el.style.transform = tr3(r.y, i >= 2 ? 18 : 0);
          });
          const tf = tq(t), pose = poses[2];
          let n = 0;
          c2.picks.forEach((pk, i) => {
            const P = PICK_T[i];
            if (tf >= P - 1e-6) n++;
            // Le champion tombe dans son créneau (même chute que les créneaux du planning, à plat dans sa rangée) ;
            // son palier suit d'un souffle et se pose sur le ressort des badges.
            const q = DROPIN(seg(t, P, P + 0.30));
            ouFade(pk.ch, sine(seg(t, P, P + 0.10)));
            pk.ch.style.transform = `translateY(${(-16 * (1 - q)).toFixed(2)}px) scale(${(1 + 0.04 * (1 - q)).toFixed(4)})`;
            const P2 = P + 0.05, s = SPRING(seg(t, P2, P2 + 0.5));
            ouFade(pk.ti, sine(seg(t, P2, P2 + 0.08)));
            pk.ti.style.transform = `scale(${(0.85 + 0.15 * s).toFixed(4)})`;
            // Lueur de la couleur du rôle une fois (0,5 s) : liseré intérieur (DOM, sans flou) et halo doux sur #fx
            // autour de l'icône, la même que celle des tuiles de S3′.
            const gp = seg(t, P, P + 0.5), ga = gp > 0 && gp < 1 ? Math.pow(Math.sin(Math.PI * gp), 1.5) : 0;
            ouFade(pk.ring, ga);
            // Le rôle s'allume quand son champion arrive, comme les tuiles de S3′ sur leur cloche : icône à 0,45 tant
            // que le créneau attend, pleine en 0,25 s.
            pk.icon.style.opacity = (0.45 + 0.55 * sine(seg(t, P, P + 0.25))).toFixed(3);
            if (ga > 0.004 && pose) {
              const [ix, iy] = this.pickC[i], Q = ouCardProj(ix, iy, 19, pose.ty, pose.tz, pose.rx);
              ouSlotGlow(NX.fx.ctx, Q.x, Q.y, Q.s, pk.rgb, ga, 74, 62);
            }
          });
          // Compteur calé sur l'image ; chaque nouveau chiffre se pose sur le ressort des badges.
          c2.cn.textContent = String(n);
          const cs = n ? SPRING(seg(t, PICK_T[n - 1], PICK_T[n - 1] + 0.5)) : 1;
          c2.cn.style.transform = `scale(${(0.85 + 0.15 * cs).toFixed(4)})`;
          // Badge de maîtrise : même geste que « Victoire » (ressort, lueur fixe qui s'éteint).
          const bs = SPRING(seg(t, BADGE_T, BADGE_T + 0.50)), bg = t >= BADGE_T ? Math.exp(-3.5 * (t - BADGE_T)) : 0, ba = sine(seg(t, BADGE_T, BADGE_T + 0.08));
          ouFade(c2.badge, ba);
          c2.badge.style.transform = `scale(${(0.85 + 0.15 * bs).toFixed(4)})`;
          ouFade(c2.bglow, bg * ba);
        }

        /* --- Carte 4 « Planifier » : en-tête, colonnes des jours, créneaux qui tombent sur les temps --- */
        {
          const hr = ouRow(t, B[3] - 0.05, null);
          c3.head.style.opacity = hr.a.toFixed(3);
          c3.head.style.transform = tr3(hr.y, 0);
          c3.days.forEach((d, i) => {
            const e = E.enter(seg(t, B[3] + 0.05 + 0.06 * i, B[3] + 0.55 + 0.06 * i));
            d.el.style.transform = tr3((1 - e) * 28, 18 * e);
            d.lab.style.opacity = d.bg.style.opacity = clamp(e * 1.8).toFixed(3);
            if (!d.slot) return;
            const p = seg(t, d.drop, d.drop + 0.30), q = DROPIN(p);
            d.slot.style.opacity = sine(seg(t, d.drop, d.drop + 0.10)).toFixed(3);
            d.slot.style.transform = tr3(-16 * (1 - q), 2 + 60 * (1 - q));
            // Lueur de couleur une fois (0,5 s) : liseré intérieur (DOM, sans flou) et halo doux sur #fx, centré sur le
            // créneau projeté (un box-shadow flou sur un calque qui descend en z se rastérisait selon l'historique).
            const gp = seg(t, d.drop, d.drop + 0.5), ga = gp > 0 && gp < 1 ? Math.pow(Math.sin(Math.PI * gp), 1.5) : 0;
            d.glow.style.opacity = ga.toFixed(3);
            if (ga > 0.004) {
              const [sx, sy] = this.slotC[i], P = ouProj(sx, sy - 16 * (1 - q), 21 + 60 * (1 - q));
              ouSlotGlow(NX.fx.ctx, P.x, P.y, P.s, d.rgb, ga);
            }
          });
        }

        /* --- Brûlure de la dernière carte par le front de la fin (avance 100 px) --- */
        if (burning) {
          const R = NX.FRONT.end(t), o = ouProj(0, 0), c = ouProj(ST.w / 2, ST.h / 2);
          const Lc = NX.light.localCard(o, c.s, R, t);
          for (const lf of this.burnLeaves) NX.light.burn(lf.el, { cx: Lc.cx - lf.x, cy: Lc.cy - lf.y, r: Lc.r }, { feather: 60, lead: LEAD });
          ouRimMask(c3.rim, NX.light.mask(Lc, 'burn', { feather: 60, lead: LEAD }));
          c3.burnBand.style.display = '';
          c3.burnBand.style.background = ouBurnBand(Lc, LEAD);
          // Alpha 0,85 (bible : 0,6) : à 0,6 le cœur blanc, posé en plus-lighter sur le verre sombre, plafonnait vers
          // 130/255, un gris neutre (règle de scanner, mesurée #828691). La bande s'éteint sur les 100 derniers px de
          // sa course : elle a fini son travail en quittant le bas des colonnes et ne glisse plus, pleine, sur la bande
          // de verre vide pendant que le logo est complet.
          const far = Math.hypot((ST.w - Lc.cx) / NX.light.K, ST.h - Lc.cy) - (Lc.r + LEAD);
          c3.burnBand.style.opacity = (0.85 * NX.smooth(-10, 90, far)).toFixed(3);
          // La lumière décroît avec la distance à la source (px locaux : coin proche ≈ 505, coin opposé ≈ 1325) : pleine
          // près de l'axe des rayons, aux trois quarts au bout de la carte. Uniforme sur 830 px, la bande se lisait
          // comme le trait d'un scanner.
          const fall = `radial-gradient(circle at ${Lc.cx.toFixed(1)}px ${Lc.cy.toFixed(1)}px,#000 600px,rgba(0,0,0,.75) 1330px)`;
          c3.burnBand.style.maskImage = c3.burnBand.style.webkitMaskImage = fall;
          NX.light.wordGlow(this.cardGlowEls, this.cardGlowC, R, t, LEAD);
        } else {
          for (const lf of this.burnLeaves) ouMaskOff(lf.el);
          ouRimMask(c3.rim, null);
          c3.burnBand.style.opacity = 0;
          c3.burnBand.style.display = 'none';
          c3.burnBand.style.background = c3.burnBand.style.maskImage = c3.burnBand.style.webkitMaskImage = '';
          for (const el of this.cardGlowEls) el.style.textShadow = '';
        }
      }

      /* ===== Colonne de titre ===== */
      const showCol = t >= DROP && t < END + 0.3;
      this.col.style.display = showCol ? '' : 'none';
      if (!showCol) return;
      this.hair.style.transform = `scaleX(${E.glide(seg(t, DROP, DROP + 0.35)).toFixed(4)})`;
      const kp = E.enter(seg(t, DROP + 0.10, DROP + 0.60));
      this.kick.style.letterSpacing = `${lerp(0.6, 0.28, kp).toFixed(4)}em`;
      for (const el of this.kparts) el.style.opacity = kp.toFixed(3);
      // Compteur à rouleau (SINE 0,45) : 1 → 2 à cloche − 0,20 ; 2 → 3 et 3 → 4 à cloche − 0,25 (v7 : 24,95), pour
      // que le nouveau chiffre soit roulé à 92 % 0,1 s après la cloche.
      const odo = t < B[2] - 0.3 ? [B[1] - 0.20, 1, 2] : t < B[3] - 0.3 ? [B[2] - 0.25, 2, 3] : [B[3] - 0.25, 3, 4];
      NX.type.odometer(this.odo, t, odo[0], odo[1], odo[2], 0.45);
      // Verbes : chacun sort à cloche − 0,25 pendant que le suivant monte à cloche − 0,05.
      this.verbs.forEach((v, k) => {
        if (k === 0) { v.style.transform = ''; v.style.opacity = 1; } else NX.type.rise([v], t, B[k] - 0.05, 0, 0.5);
        if (k < LAST) NX.type.sink([v], t, B[k + 1] - 0.25, 0, 0.25);
      });
      // Titres : montée par les masques de ligne (ENTER 0,8, décalage 0,14), sortie par lignes (EXIT 0,30).
      // Chaque titre suivant monte à cloche − 0,20 (bible : − 0,15) : à cloche − 0,10 la carte sortante est vide
      // (acceptation) et l'image n'avait plus assez de contenu (énergie de contours E 0,90 < 1,0, bible §6.5).
      const TW = [[DROP + 0.12, B[1] - 0.50, B[1] - 0.44, DROP + 1.30], [B[1] - 0.20, B[2] - 0.50, B[2] - 0.44, B[1] + 1.00],
        [B[2] - 0.20, B[3] - 0.50, B[3] - 0.44, B[2] + 1.00], [B[3] - 0.20, null, null, B[3] + 1.20]];
      this.titles.forEach((Ti, k) => {
        const [r0, s1, s2, sh] = TW[k], end = s2 == null ? 99 : s2 + 0.36;
        const on = t >= r0 && t < end;
        Ti.el.style.display = on ? '' : 'none';
        // Mots posés même cachés : aucun style ne dépend des images rendues avant (déterminisme).
        NX.type.rise(Ti.words, t, r0, 0.14, 0.8);
        if (s1 != null) { NX.type.sink(Ti.lines[0], t, s1, 0.05, 0.30); NX.type.sink(Ti.lines[1], t, s2, 0.05, 0.30); }
        NX.type.sheen(Ti.spec, t, sh, sh + 0.8, 0.35);
      });
      // Brûlure de la colonne (local exact : la colonne est plate, face à la caméra) et lueur des glyphes.
      // Les masques de ligne s'ouvrent pendant la brûlure (mots au repos) : la lueur des glyphes n'est pas rognée.
      const open = burning ? 'visible' : '';
      for (const el of this.titles[LAST].lineEls) el.style.overflow = open;
      this.verbs[0].parentElement.style.overflow = open; this.odo.style.overflow = open;
      [...this.odo.children].forEach((b, i) => { b.style.opacity = burning && i !== LAST ? 0 : ''; });
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
