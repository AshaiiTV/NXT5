/* S3′ Rôles, une transition (bible v7.1, amendement « S3′ » ; fusion §3.9 ; amendement v7.2), 7,2–9,6 s.
 * v7.2 : un seul moment du logo. L'emblème du logo n'est pas repris par la lumière : il reste (logo.js, puis
 * direction.js par un fondu enchaîné 7,10–7,25, trajet NX.M72) et les cinq rôles naissent autour de lui, de sa lumière,
 * un par croche (NX.beats.bells : Top 7,2, Jungle 7,5, Mid 7,8, ADC 8,1, Support 8,4), directement à leur place sur un
 * pentagone centré sur le centre optique de l'emblème (angles de NX.G.pent ; rayon PENT_R = 262, qui garde chaque tuile
 * hors de l'anneau, de ses coches et de la pointe de la lance ; échelle 0,62) : la petite tuile de verre de la v7, avec
 * l'icône et la couleur du rôle, se lève dans sa lumière, un faisceau de cloche descend de la source et le secteur de
 * l'emblème tourné vers sa place s'éclaire (direction.js). Top naît d'abord en lumière, pendant que le front de la sortie
 * reprend le mot-symbole, puis devient verre ; la lumière reprise passe à la scène autour de l'emblème et à son cœur
 * (lumière de scène, qui grandit avec chaque rôle) et les places des rôles à venir attendent sous une orbe faible. Dès le
 * cinquième rôle, la fusion : les cinq se penchent vers l'emblème et se dissolvent en particules de leur couleur qui
 * rejoignent leur secteur de l'emblème pendant qu'il grandit jusqu'à la géométrie E5. Revue M : elles ne se posent plus
 * sur ses traits ; elles entrent dans l'emblème (derrière ses traits, visibles seulement entre eux) et s'y éteignent, et
 * leur lumière passe à leur secteur (direction.js) : les secteurs du bas d'abord, la lance (Mid) en dernier, complète sur
 * l'impact de 9,6. Cinq deviennent un. Ni titre, ni étiquettes, ni ligne de lien, ni émail pointilliste.
 * Interfaces : « direction » possède l'emblème, sa charge (d'après NX.M72.absorbed, tables bâties ici) et NX.hit(9,6) ;
 * « ciel » possède l'onde de choc et la poussière (le relais « take » 7,11–7,8 est à retirer : correctif proposé dans
 * out/v72/M/lead-patch). Cette scène ne dessine jamais le PNG : elle possède ses particules (éclatement jusqu'à 9,95,
 * braises jusqu'à 11,7 comme l'écart accepté de la v7 ; aucun élément DOM après 8,9).
 * Fonction pure de t : échantillons, appariement, sources, tirages et tables sont bâtis une fois dans prepare(). */
(function () {
  const ROLES = [
    { label: 'Top', color: '#67E8F9', svg: '<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>' },
    { label: 'Jungle', color: '#818CF8', svg: '<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>' },
    { label: 'Mid', color: '#F3F7FF', svg: '<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>' },
    { label: 'ADC', color: '#A78BFA', svg: '<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>' },
    { label: 'Support', color: '#E879F9', svg: '<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>' },
  ];
  const FAV = '../public/assets/nxt5-loader-favicon.png';
  const G = NX.G, PENT = G.pent, FV = G.FAV, M72 = NX.M72;
  const [CX0, CY0] = M72.C0;                             // centre de l'anneau de l'emblème pendant les naissances (958,8 ; 452,0)
  // Centre optique de l'emblème (centre de sa boîte alpha, M72.OPT) : (958,07 ; 430,51) pendant les naissances.
  const OPX = CX0 + M72.S0 * M72.OPT[0], OPY = CY0 + M72.S0 * M72.OPT[1];
  const RAD = Math.PI / 180, TAU = Math.PI * 2, D = NX.cam.D;
  const SIZE = G.roles.tile, HALF = SIZE / 2;            // tuile de verre de la v7 (216 px), posée à l'échelle 0,62
  const SC = PENT.scale;                                 // 0,62 : 134 px dans le monde
  const ICON = G.roles.icon;                             // 132 : icône (82 px à l'échelle du pentagone)
  const ZR = 1 * 0.5;                                    // décalage en z de la racine (z de scène × 0,5 px, moteur)
  const ZICON = 1 + 14;                                  // .gl-content translateZ(1px) + icône translateZ(14px)
  const ZRIM = 2;                                        // liseré translateZ(2px)
  /* Pentagone (v7.2, revue M) : rayon 262 px monde autour du centre optique de l'emblème (centre de la boîte alpha du
   * favicon, 21,5 px au-dessus du centre de l'anneau : centré sur l'anneau, Mid touchait presque la pointe de la lance et
   * Top et Support flottaient loin de l'emblème). Le r = 200 de la v7.1 posait les tuiles sur l'anneau. Dégagements et
   * cadre de sécurité mesurés avec la vraie caméra (out/v72/M/tools/clearance.mjs), voir le rapport du paquet M. */
  const PENT_R = 262;

  /* Frise (amendement v7.1). Tout est relatif à NX.T : rôles, fusion et impact. */
  const at = (a, d) => Math.round((a + d) * 1e6) / 1e6;  // instant relatif à un repère de NX.T, sans résidu flottant
  const ROLES0 = NX.T.roles;                             // 7,2 : premier rôle (Top), sur la première croche
  const HIT = NX.T.emblem;                               // 9,6 : impact, l'emblème résolu à la géométrie E5
  const FUSE = NX.T.fuse;                                // 8,4 : cinquième rôle posé, la fusion commence
  const BELL = NX.beats.bells.slice(0, 5);               // 7,2 / 7,5 / 7,8 / 8,1 / 8,4 : un rôle par croche
  // Relais avec « logo » (S2, logo.js) : le front de la sortie remonte vers la source et reprend le mot-symbole blanchi,
  // la devise et les rails de bas en haut (6,78–7,17). La place de Top est sous l'ancien mot-symbole : le front la libère
  // vers 7,05–7,10. Avant, rien de sombre (plaque, icône, ombre) ne s'y pose : Top naît d'abord en lumière (liseré chaud
  // additif et halo, 7,08–7,18), sa plaque et son icône viennent ensuite (SINE 7,14–7,32).
  // Revue M : la lumière de scène monte en phase avec le front qui reprend le mot-symbole (6,95 → 7,12, SINE) : elle
  // remplace la lumière des lettres à mesure qu'elles partent, sans creux puis éclat (la plaque de l'emblème est déjà
  // partie à 6,98, logo.js).
  const STAGE_IN = [at(ROLES0, -0.25), at(ROLES0, -0.08)];  // 6,95–7,12
  const WIN0 = STAGE_IN[0];                              // 6,95 : ouverture de la scène, avec la lumière de scène (nulle à 6,95)
  const TOP_LIGHT = [at(ROLES0, -0.12), at(ROLES0, -0.02)]; // 7,08–7,18 : Top en lumière (feuilles additives seules, SINE)
  const TOP_GLASS = [at(ROLES0, -0.06), at(ROLES0, 0.12)];  // 7,14–7,32 : plaque et icône de Top (SINE)
  const TOP_HOT = 0.9, TOP_HALO = 0.8;                   // liseré chaud et halo de verre de Top pendant sa naissance
  // Places en attente (la grammaire v7 « cinq lumières marquent les places ») : une fois le mot-symbole parti, une orbe
  // faible de la couleur de chaque rôle à venir (pic 0,09 ; rayon 160·s ; 7,15–7,35), qui se fond dans la lumière de sa
  // tuile quand celle-ci s'allume (Tᵢ − 0,30).
  const WAIT = [at(ROLES0, -0.05), at(ROLES0, 0.15)], WAIT_A = 0.09, WAIT_R = 160;
  // L'équipe au complet : sur la cinquième cloche, les cinq s'allument ensemble (lumière +40 %, liseré +0,3) et se
  // rapprochent de 12 px de l'emblème (SINE, fini avant la première dissolution : les particules partent d'une tuile
  // immobile), puis se dissolvent dans l'ordre de leur naissance (0,035 s d'écart, + 0,08 s de dispersion par
  // particule) : le cercle se referme. v7.2 : 0,04 s plus tôt qu'en v7.1 (8,50 + 0,04 s par rôle), car les vols sont
  // plus longs (pentagone de 262 px) : les vitesses restent sous les plafonds de §2.6.
  const LEAN = [FUSE - 0.12, FUSE + 0.06], LEAN_PX = 12;
  const REL = BELL.map((b, i) => FUSE + 0.06 + 0.035 * i);  // 8,46 / 8,495 / 8,53 / 8,565 / 8,60
  // Apparition de la plaque de chaque tuile (bible §4 S3 : Tᵢ − 0,25 → Tᵢ − 0,05, smoothstep ; Top : TOP_GLASS, SINE)
  // et lumière de sa place (Tᵢ − 0,30 → Tᵢ − 0,05 ; Top 7,075 → 7,2, pendant que le front reprend le mot-symbole).
  const APPEAR = BELL.map((T, i) => (i === 0 ? TOP_GLASS : [T - 0.25, T - 0.05]));
  const LIGHT_IN = BELL.map((T, i) => (i === 0 ? [at(ROLES0, -0.125), ROLES0] : [T - 0.30, T - 0.05]));
  /* Arrivée (v7.2, revue M) : les particules ne se posent plus sur l'emblème (des points sur un logo net se lisaient
   * comme un grain, puis des paillettes). Elles y entrent : dans son empreinte (disque de l'anneau, traits élargis), elles
   * passent derrière lui (#fxback) et ne se voient plus qu'entre ses traits ; elles s'éteignent sur les derniers 20 % de
   * leur vol (ABSORB) et à l'approche de leur cible (NEAR), rentrée dans le trait opaque, et leur lumière passe à leur
   * secteur de l'emblème (direction.js, feuille des secteurs, d'après la part absorbée NX.M72.absorbed). Ordre des
   * secteurs : ceux du bas d'abord (Top, Support), puis les côtés (Jungle, ADC), la lance (Mid) en dernier, complète sur
   * l'impact ; dans chaque secteur, l'anneau d'abord.
   * Fenêtres d'arrivée [début, largeur] (instant ta de chaque cible = début + largeur·h). Vols de 0,6 à 1,1 s. */
  const ARRIVE = [
    { ring: [HIT - 0.34, 0.08], rest: [HIT - 0.30, 0.12] },     // Top     9,26–9,34 ; 9,30–9,42
    { ring: [HIT - 0.30, 0.08], rest: [HIT - 0.24, 0.12] },     // Jungle  9,30–9,38 ; 9,36–9,48
    { ring: [HIT - 0.24, 0.08], rest: [HIT - 0.16, 0.145] },    // Mid     9,36–9,44 ; 9,44–9,585
    { ring: [HIT - 0.30, 0.08], rest: [HIT - 0.24, 0.12] },     // ADC
    { ring: [HIT - 0.34, 0.08], rest: [HIT - 0.30, 0.12] },     // Support
  ];
  const ABSORB = 0.20;                                   // part finale du vol sur laquelle la particule s'éteint dans l'emblème
  // … et à l'approche de sa cible (rentrée dans le trait) : éteinte à moins de NEAR[0] px écran, pleine au-delà de NEAR[1].
  // Sans cela, les particules qui finissent leur glissement angulaire le long d'un trait le bordaient de points.
  const NEAR = [3, 16];
  const FOOT_N = 128, FOOT_DIL = 6, FOOT_RING = 190;     // empreinte : grille 4 px du favicon, traits élargis de 6 px, disque 190 px
  const SLOW_V = 950;                                    // garde-fou de vitesse (px/s, voir prepare)
  const CORE = [HIT - 0.6, HIT], CORE_A = [0.06, 0.16];  // cœur de la fusion, derrière l'emblème : 0,06 + 0,16·inQuad
  const BURST_OUT = [HIT + 0.2, HIT + 0.35], EMBER_OUT = [HIT + 1.5, HIT + 2.1];
  // Lumière de scène : bassin (ellipse douce autour du pentagone) et cœur (au centre de l'emblème, derrière lui), de la
  // reprise du mot-symbole par le front jusqu'au halo de « direction » (SINE 9,62–10,2). Le cœur s'éteint pendant l'impact
  // (9,52–9,92) ; le bassin s'éteint en fondu enchaîné avec ce halo (SINE 9,52–10,2) : l'impact passe la lumière au lieu
  // de retomber dans un creux.
  const HEART_OUT = [HIT - 0.08, HIT + 0.32], POOL_OUT = [HIT - 0.08, HIT + 0.60];
  const POOL_R = 980, POOL_SY = 0.62, POOL_A = 0.15, POOL_RGB = [120, 170, 255];
  // Inspiration avant l'impact (revue M) : le bassin s'intensifie (inQuad 9,25 → 9,6) pendant que l'emblème se charge, puis
  // l'impact le relâche (e^(−5τ)) : la lumière de l'image monte vers l'impact au lieu de s'y affaisser.
  const INHALE = [HIT - 0.35, HIT], INHALE_A = 0.6;
  /* Relais (revue M) : pendant que le front reprend le mot-symbole, sa lumière passe à la scène des rôles : un anneau de
   * lumière autour de l'emblème, là où les rôles vont naître (rayon SWELL_R·s, sombre au centre : l'intérieur de l'anneau
   * de l'emblème n'en reçoit rien), même forme que la reprise (monte 6,96 → 7,10, rendu 7,12 → 7,62). Le cœur, derrière
   * l'emblème, monte plus lentement (HEART_IN, 6,92 → 7,30) : ses jours s'éclairent sans à-coup. */
  const SWELL_R = 720, SWELL_A = 0.06, TAKE_IN = [6.96, 7.10], TAKE_OUT = [7.12, 7.62], HEART_IN = [6.92, 7.30];
  const SWELL_STOPS = [[0, 0], [0.22, 0], [0.38, 1], [0.6, 0.45], [0.8, 0.12], [1, 0]];
  const HEART_R = 340, HEART_A = 0.20, HEART_RGB = [175, 220, 255], HEART_BEAT = 0.06, HEART_FLAT = 0.35;
  // Faisceaux de cloche de Top et Support : trou doux autour de l'anneau (rayon r × 186 px du favicon, bord ± f px écran),
  // où il ne reste que keep de leur lumière.
  const BEAM_HOLE = { r: 1.1, f: 20, keep: 0.25 };

  const E = NX.ease, seg = NX.seg, sm = NX.smooth, clamp = NX.clamp;
  const SINE = E.sine, GLIDE = E.glide, IOC = E.inOutCubic;
  const SPRING = p => E.spring(p, 1.0, 6.2);
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const RGB = ROLES.map(r => hex(r.color));
  const BEAMRGB = RGB.map(c => c.map(v => (v + 255) >> 1));
  // Sommets du pentagone autour du centre optique de l'emblème (repère écran, y vers le bas : Mid en haut, Top en bas à
  // gauche, Support en bas à droite) et direction de chaque place vers ce centre (rapprochement de l'équipe).
  const PX = PENT.deg.map(a => OPX + PENT_R * Math.cos(a * RAD)), PY = PENT.deg.map(a => OPY + PENT_R * Math.sin(a * RAD));
  const DIR = PX.map((x, i) => { const dx = OPX - x, dy = OPY - PY[i], l = Math.hypot(dx, dy); return [dx / l, dy / l]; });

  NX.css(`
  .eq-tile{transform-origin:50% 100%}
  .eq-ic{position:absolute;left:${HALF - ICON / 2}px;top:${HALF - ICON / 2}px;width:${ICON}px;height:${ICON}px;transform:translateZ(14px)}
  .eq-hot{padding:1.5px;opacity:0;transform:translateZ(2.5px);mix-blend-mode:plus-lighter;background:linear-gradient(var(--rim,180deg),rgba(186,240,255,.75),rgba(129,140,248,.22) 30%,rgba(154,182,218,.10) 65%,rgba(232,121,249,.30));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
  `);

  /** Pose monde de la tuile i : centre de sa place (x, y ; le pentagone suit le centre de l'emblème), montée depuis la
   *  profondeur (dy, z), échelle s, rotateX th (lever sur ressort, face caméra exactement sur sa cloche), rapprochement
   *  an ∈ [0, 1]. */
  function pose(i, t) {
    const T = BELL[i], m = M72.pose(t);
    const g = GLIDE(seg(t, T - 0.30, T + 0.20));
    const u = seg(t, T - 0.225, T + 0.675);
    const an = SINE(seg(t, LEAN[0], LEAN[1]));
    // Le pentagone suit le centre optique de l'emblème (immobile jusqu'à la croissance, 8,6).
    const ox = m.cx + m.s * M72.OPT[0] - OPX, oy = m.cy + m.s * M72.OPT[1] - OPY;
    return {
      x: PX[i] + ox + LEAN_PX * an * DIR[i][0], y: PY[i] + oy + LEAN_PX * an * DIR[i][1],
      dy: 18 * SC * (1 - g), z: -120 * (1 - g), s: SC,
      th: u >= 1 ? 0 : 55 * (1 - SPRING(u)), an,
    };
  }
  /** Point local (lx, ly, lz) de la tuile (px de la tuile de 216, origine au centre) → point monde, pour la pose P.
   *  Même calcul que le CSS : translate3d · rotateX · scale autour du pivot bas-centre (scale n'agit pas sur z). */
  function tilePoint(P, lx, ly, lz) {
    const c = Math.cos(P.th * RAD), sn = Math.sin(P.th * RAD), yy = P.s * (ly - HALF);
    return [P.x + P.s * lx, P.y + P.dy + HALF * P.s + yy * c - lz * sn, P.z + yy * sn + lz * c];
  }
  /** Faisceau de cloche à extrémité douce : NX.lk.beam tracé sur la toile annexe, puis fondu sur sa fin
   *  (le bout plat dépassait à côté des tuiles, faisceau oblique), puis ajouté en lumière.
   *  hole { x, y, r, f, keep } (revue M) : les faisceaux de Top et Support passent derrière l'emblème ; dans un disque doux
   *  (bord de 2f px) autour de son anneau, il n'en reste que keep : il passe derrière lui sans remplir ses jours. */
  function eqBeam(dst, o, x0, y0, x1, y1, w0, w1, a, rgb, fade, hole = null) {
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len, h0 = w0 / 2, h1 = w1 / 2;
    const xs = [x0 + nx * h0, x0 - nx * h0, x1 + nx * h1, x1 - nx * h1], ys = [y0 + ny * h0, y0 - ny * h0, y1 + ny * h1, y1 - ny * h1];
    const bx = Math.max(0, Math.floor(Math.min(...xs)) - 2), by = Math.max(0, Math.floor(Math.min(...ys)) - 2);
    const bw = Math.min(NX.W, Math.ceil(Math.max(...xs)) + 2) - bx, bh = Math.min(NX.H, Math.ceil(Math.max(...ys)) + 2) - by;
    if (bw <= 0 || bh <= 0) return;
    o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.clearRect(bx, by, bw, bh);
    NX.lk.beam(x0, y0, x1, y1, w0, w1, 1, rgb, o);
    const g = o.createLinearGradient(x0, y0, x1, y1), f = clamp(1 - fade / len, 0, 1);
    g.addColorStop(0, '#000'); g.addColorStop(f, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.globalCompositeOperation = 'destination-in'; o.fillStyle = g; o.fillRect(bx, by, bw, bh);
    if (hole) {
      const R1 = hole.r + hole.f, hg = o.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, R1), cut = 1 - hole.keep;
      hg.addColorStop(0, `rgba(0,0,0,${cut})`); hg.addColorStop(clamp((hole.r - hole.f) / R1), `rgba(0,0,0,${cut})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
      o.globalCompositeOperation = 'destination-out'; o.fillStyle = hg; o.fillRect(hole.x - R1, hole.y - R1, 2 * R1, 2 * R1);
    }
    o.restore();
    dst.save(); dst.globalCompositeOperation = 'lighter'; dst.globalAlpha = clamp(a);
    dst.drawImage(o.canvas, bx, by, bw, bh, bx, by, bw, bh);
    dst.restore();
  }
  /** Flash de cloche : monte en inQuad sur 0,12 s jusqu'à Tᵢ, puis e^(−6τ). */
  const bellFlash = (i, t) => { const T = BELL[i]; return t < T - 0.12 ? 0 : t < T ? E.inQuad(seg(t, T - 0.12, T)) : Math.exp(-6 * (t - T)); };
  /** Orbe d'attente : disque de lumière additif au profil en cloche a·(1 − u²)², u = d/r (plateau doux, aucun bord ;
   *  à pic égal, deux fois plus de lumière à mi-rayon que NX.lk.glow, si bien qu'elle se lit encore sur un téléphone). */
  const ORB_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1].map(u => [u, (1 - u * u) ** 2]);
  function eqOrb(ctx, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 0.5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [u, k] of ORB_STOPS) g.addColorStop(u, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * k).toFixed(4)})`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }

  /** Point du pourtour arrondi (rayon 16) de la tuile, au milieu du liseré ; f ∈ [0,1) → [lx, ly] en px de tuile. */
  function rimPoint(f) {
    const h = HALF - 0.75, rc = 15.25, L = 2 * (h - rc), A = Math.PI / 2 * rc;
    let d = f * 4 * (L + A), side = 0, x, y;
    while (d >= L + A && side < 3) { d -= L + A; side++; }
    if (d < L) { x = -h + rc + d; y = -h; } else { const a = (d - L) / rc; x = h - rc + rc * Math.sin(a); y = -h + rc - rc * Math.cos(a); }
    for (let k = 0; k < side; k++) [x, y] = [-y, x];   // quart de tour horaire (écran)
    return [x, y];
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  /** Traînée effilée dans le tampon NX.px : même énergie totale que NX.px.line (2×), répartie en v² de la queue
   *  (xa, ya) vers la tête (xb, yb) ; une traînée uniforme se lisait comme des poils, celle-ci comme une comète. */
  const TAILW = [null];                                  // table fixe, bâtie au chargement (pas de cache en rendu)
  for (let n = 1; n <= 96; n++) { const w = []; let s = 0; for (let k = 0; k < n; k++) { const v = (k + 1) / n; w.push(v * v); s += v * v; } TAILW.push(w.map(v => 2 * v / s)); }
  /** La même traînée, dont on ne trace que les points d'un côté de l'empreinte de l'emblème (derrière lui ou devant). */
  function eqTailSplit(xa, ya, xb, yb, r, g, b, back, behind) {
    const n = Math.min(96, Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya)))), w = TAILW[n];
    for (let k = 0; k < n; k++) {
      const u = k / n, x = xa + (xb - xa) * u, y = ya + (yb - ya) * u;
      if (behind(x, y) !== back) continue;
      const f = w[k]; NX.px.dot(x, y, r * f, g * f, b * f);
    }
  }

  /** Instant d'arrivée d'une cible du secteur k (anneau ou reste), h ∈ [0, 1] : position dans la fenêtre. */
  const arriveAt = (k, ring, h) => { const [a, w] = ARRIVE[k][ring ? 'ring' : 'rest']; return a + w * h; };

  NX.scene({
    id: 'equipe', start: WIN0, end: HIT, post: EMBER_OUT[1] - HIT, z: 1,
    build(root) {
      this.fav = NX.image(FAV);                          // échantillonné seulement : jamais affiché ici
      this.tiles = ROLES.map((r, i) => {
        const g = NX.glass(`<svg class="eq-ic" viewBox="0 0 34 34" aria-hidden="true"><defs><linearGradient id="eq-ig${i}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="34"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".38" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color}" stop-opacity=".85"/></linearGradient></defs><g fill="url(#eq-ig${i})">${r.svg}</g></svg>`, { w: SIZE, h: SIZE, color: r.color + '30' });
        g.el.classList.add('eq-tile');
        g.el.style.left = `${(PX[i] - HALF).toFixed(2)}px`; g.el.style.top = `${(PY[i] - HALF).toFixed(2)}px`;
        g.fog.style.display = 'none';                    // jamais de brouillard sur ces tuiles
        const hot = NX.el('<div class="eq-hot"></div>', g.el);  // liseré additionnel : flashs au-delà de l'opacité 1
        root.appendChild(g.el);
        return { g, hot, icon: g.content.querySelector('.eq-ic') };
      });
      // Toile annexe des faisceaux de cloche (tracé opaque, fondu, puis ajout en lumière).
      const oc = document.createElement('canvas'); oc.width = NX.W; oc.height = NX.H;
      this.oc = oc.getContext('2d');
      this.P = [];
    },

    /* Fusion (§3.9) : cibles dans l'emblème (px du favicon, posées sur l'emblème tel qu'il est à chaque instant :
     * NX.M72.pose), secteurs par rôle, sources dans l'icône et le liseré, appariement par angle autour du centre de
     * l'anneau. Les tuiles ne bougent plus pendant les vols : la source de chaque particule est le point de sa tuile à
     * l'instant où elle s'en détache (pose exacte, lever et rapprochement compris), calculée ici une fois.
     * Tout dépend des images, de la frise et de graines fixes. */
    prepare() {
      const img = this.fav;
      if (!img.naturalWidth) { console.warn('equipe : emblème non décodé'); return; }
      const S1 = M72.S1, [C1x, C1y] = M72.C1;
      /* Cibles (revue M) : le point d'arrivée d'une cible tombée sur le bord d'un trait (alpha < 0,95) est rentré dans le
       * trait, au pixel opaque (alpha ≥ 0,98) le plus proche à 8 px du favicon au plus : la particule finit son vol derrière
       * le trait opaque, au lieu de rester posée sur son bord (une frange de points le long des traits, 9,3–9,4). Le
       * départ de l'éclatement (9,6) reste le point échantillonné. */
      const fa = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = FV.W; const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0); return c.getImageData(0, 0, FV.W, FV.W).data; })();
      const alphaAt = (x, y) => (x < 0 || y < 0 || x >= FV.W || y >= FV.W) ? 0 : fa[(y * FV.W + x) * 4 + 3] / 255;
      const RING_OFF = [];                               // décalages entiers triés par distance (rayon ≤ 8 px)
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy <= 64) RING_OFF.push([dx, dy, dx * dx + dy * dy]);
      RING_OFF.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      const tg = NX.sample(img, 5000, 4242, 256, 0.28).map(p => {
        const bx = p.u * FV.W - FV.ringC[0], by = p.v * FV.W - FV.ringC[1];
        let fx = bx, fy = by, rgb = p.rgb;
        const x0 = Math.floor(p.u * FV.W), y0 = Math.floor(p.v * FV.W);
        if (alphaAt(x0, y0) < 0.95) for (const [dx, dy] of RING_OFF) {
          if (alphaAt(x0 + dx, y0 + dy) >= 0.98) { fx = bx + dx; fy = by + dy; const o = ((y0 + dy) * FV.W + x0 + dx) * 4; rgb = [fa[o], fa[o + 1], fa[o + 2]]; break; }
        }
        const rho = Math.hypot(fx, fy);
        return { fx, fy, bx, by, rho, rgb, brgb: p.rgb, pe: Math.atan2(fy, fx), ring: rho >= 140 && rho <= 190 };
      });
      const R = NX.rng(901), P = [];
      ROLES.forEach((r, k) => {
        const c = (PENT.deg[k] + 20) * RAD, rel = a => wrap(a - c);
        const mine = tg.filter(e => { const d = rel(e.pe); return d >= -36 * RAD && d < 36 * RAD; })
          .sort((a, b) => rel(a.pe) - rel(b.pe));
        const n = mine.length, nIcon = Math.round(n * 0.85), src = [];
        for (const p of NX.sampleSvg(r.svg, nIcon, 100 + k)) src.push({ lx: (p.u - 0.5) * ICON, ly: (p.v - 0.5) * ICON, lz: ZICON });
        const rr = NX.rng(300 + k);
        while (src.length < n) { const [lx, ly] = rimPoint(rr()); src.push({ lx, ly, lz: ZRIM }); }
        for (const v of src) v.a = rel(Math.atan2(PY[k] + SC * v.ly - CY0, PX[k] + SC * v.lx - CX0));
        src.sort((a, b) => a.a - b.a);
        mine.forEach((e, j) => {
          const v = src[j], h = R(), h2 = R(), zA = -60 + 220 * R(), ph = R() * TAU, bv = 100 + 300 * R(), ember = R() < 0.08;
          const dl = Math.hypot(e.bx, e.by) || 1;
          P.push({ k, lx: v.lx, ly: v.ly, lz: v.lz, fx: e.fx, fy: e.fy, rho: e.rho, pe: e.pe, ux: e.bx / dl, uy: e.by / dl,
            tx: C1x + S1 * e.bx, ty: C1y + S1 * e.by,     // point échantillonné à la géométrie E5 (départ de l'éclatement)
            te: REL[k] + 0.08 * h, ta: arriveAt(k, e.ring, h2), ring: e.ring, zA, ph, bv, ember,
            r0: RGB[k][0], g0: RGB[k][1], b0: RGB[k][2], r1: e.rgb[0], g1: e.rgb[1], b1: e.rgb[2],
            rb: e.brgb[0], gb: e.brgb[1], bb: e.brgb[2] });
        });
      });
      for (const q of P) this.source(q);
      this.P = P;
      this.buf = new Float32Array(P.length * 8);         // état des particules d'une image (réécrit à chaque rendu)
      // Garde-fou de vitesse (§2.6) : vitesse écran de pointe de chaque vol, mesurée avec la vraie caméra sur une grille
      // fixe de 1/240 s. Les particules au-delà de 950 px/s (v7.1 : 1 150) reçoivent la fenêtre la plus longue permise
      // (départ au plus tôt, pose au plus tard) : même trajet, pointe plus basse.
      const dt = 1 / 240, cams = [], t0 = REL[0], t1 = HIT;
      for (let i = 0, t = t0; t <= t1; i++, t = t0 + i * dt) cams.push([t, NX.cam.at(t)]);
      const peak = q => {
        let mx = 0, px = null, py = 0;
        for (const [t, c] of cams) {
          if (t < q.te || t > q.ta) { px = null; continue; }
          const w = this.world(q, t), pr = NX.cam.project(w[0], w[1], w[2] + ZR, c);
          if (px !== null) mx = Math.max(mx, Math.hypot(pr.x - px, pr.y - py) / dt);
          px = pr.x; py = pr.y;
        }
        return mx;
      };
      let slow = 0;
      for (const q of P) if (peak(q) > SLOW_V) { q.te = REL[q.k]; q.ta = arriveAt(q.k, q.ring, 1); this.source(q); slow++; }
      this.slowed = slow;
      /* Part absorbée par secteur (revue M) : moyenne, sur les particules du secteur, de smoothstep(1 − ABSORB, 1, u) (la
       * particule s'éteint dans l'emblème), tabulée au 1/600 s de REL[0] à l'impact. direction.js en tire la lumière de
       * chaque secteur (NX.M72.absorbed(k, t), 0 avant, 1 après). */
      const AT0 = REL[0], ADT = 1 / 600, AN = Math.ceil((HIT - AT0) / ADT) + 1, tab = ROLES.map(() => new Float32Array(AN)), cnt = [0, 0, 0, 0, 0];
      for (const q of P) {
        cnt[q.k]++;
        const T = tab[q.k];
        for (let i = 0; i < AN; i++) { const u = (AT0 + i * ADT - q.te) / (q.ta - q.te); T[i] += u <= 1 - ABSORB ? 0 : u >= 1 ? 1 : sm(1 - ABSORB, 1, u); }
      }
      tab.forEach((T, k) => { for (let i = 0; i < AN; i++) T[i] /= Math.max(1, cnt[k]); });
      M72.absorbed = (k, t) => {
        const f = (t - AT0) / ADT; if (f <= 0) return 0; if (f >= AN - 1) return 1;
        const i = Math.floor(f), T = tab[k]; return T[i] + (T[i + 1] - T[i]) * (f - i);
      };
      // Empreinte de l'emblème (grille de 4 px du favicon) : alpha > 0,05 élargi de FOOT_DIL px, ou disque de l'anneau
      // (rayon FOOT_RING). Une particule qui s'y trouve passe derrière l'emblème (voir particles()).
      {
        const N = FV.W, cv = document.createElement('canvas'); cv.width = cv.height = N;
        const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, N, N);
        const d = cx.getImageData(0, 0, N, N).data, a = new Uint8Array(N * N), b = new Uint8Array(N * N), D = FOOT_DIL;
        for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] > 13 ? 1 : 0;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let o = -D; o <= D && !v; o++) { const X = x + o; if (X >= 0 && X < N) v = a[y * N + X]; } b[y * N + x] = v; }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let o = -D; o <= D && !v; o++) { const Y = y + o; if (Y >= 0 && Y < N) v = b[Y * N + x]; } a[y * N + x] = v; }
        const C = N / FOOT_N, foot = new Uint8Array(FOOT_N * FOOT_N);
        for (let j = 0; j < FOOT_N; j++) for (let i = 0; i < FOOT_N; i++) {
          let v = Math.hypot((i + 0.5) * C - FV.ringC[0], (j + 0.5) * C - FV.ringC[1]) <= FOOT_RING ? 1 : 0;
          for (let y = j * C; y < (j + 1) * C && !v; y++) for (let x = i * C; x < (i + 1) * C && !v; x++) v = a[y * N + x];
          foot[j * FOOT_N + i] = v;
        }
        this.foot = foot;
      }
    },

    /** Source d'une particule : son point sur la tuile à l'instant te, en coordonnées polaires autour du centre de
     *  l'anneau à cet instant (angle à parcourir jusqu'à la cible, profondeur de départ). */
    source(q) {
      const w = tilePoint(pose(q.k, q.te), q.lx, q.ly, q.lz), m = M72.pose(q.te), sx = w[0] - m.cx, sy = w[1] - m.cy;
      q.rs = Math.hypot(sx, sy); q.ps = Math.atan2(sy, sx); q.dp = wrap(q.pe - q.ps); q.sz = w[2];
    },

    /** Coins et centre (points monde) de la tuile i au temps t : pour les sondes de vitesse et d'alignement. */
    tileCorners(i, t) {
      const P = pose(i, t), h = HALF;
      return [[-h, -h], [h, -h], [h, h], [-h, h], [0, 0]].map(([lx, ly]) => tilePoint(P, lx, ly, 0));
    },

    /** Position monde [x, y, z] d'une particule au temps t, ou null si elle n'existe pas (aussi pour la sonde de vitesse).
     *  Le vol est décrit autour du centre de l'anneau tel qu'il est à l'instant t (l'emblème grandit pendant la fusion) :
     *  rayon de la source vers celui de la cible sur l'emblème (inOutCubic), angle en SINE ; posée, la particule suit
     *  son point de l'emblème. */
    world(q, t) {
      if (t < q.te) return null;
      if (t >= HIT) {                                    // éclatement depuis la cible (géométrie E5), braises qui montent
        const tau = t - HIT, f = (1 - Math.exp(-3 * tau)) / 3;
        return [q.tx + q.ux * q.bv * f, q.ty + q.uy * q.bv * f - (q.ember ? 50 * tau : 0), 0];
      }
      const m = M72.pose(t);
      if (t >= q.ta) return [m.cx + m.s * q.fx, m.cy + m.s * q.fy, 0];
      const u = (t - q.te) / (q.ta - q.te), er = IOC(u), ea = SINE(u);
      const r = q.rs + (m.s * q.rho - q.rs) * er, a = q.ps + q.dp * ea;
      return [m.cx + r * Math.cos(a), m.cy + r * Math.sin(a), q.sz * (1 - er) + q.zA * Math.sin(Math.PI * u)];
    },

    render(S) {
      const t = S.t, c = NX.camState, bctx = NX.fxBack.ctx, fctx = NX.fx.ctx;
      const pj = (X, Y, Z = 0) => NX.cam.project(X, Y, Z + ZR, c);
      const em = M72.pose(t);                            // l'emblème à cet instant (centre de l'anneau, échelle)

      /* ---------------- Lumière de scène (fxBack, derrière les tuiles et l'emblème) ----------------
       * Le cœur prend le relais de la lumière que le mot-symbole rend à l'emblème pendant que le front le reprend
       * (6,95 → 7,12) : les rôles naissent autour de lui. Un bassin doux éclaire le cercle ; pendant la fusion, bassin et
       * cœur se resserrent vers l'emblème, puis rendent la main au halo et à l'impact de « direction » (9,6). */
      const dbg = NX.eqDebug || {};                       // { noStage } : sans lumière de scène (mesures du relais)
      const onIn = dbg.noStage ? 0 : SINE(seg(t, STAGE_IN[0], STAGE_IN[1]));
      // Relais (revue M) : pendant que le front reprend le mot-symbole, la scène reçoit en plus la lumière des lettres
      // (anneau SWELL autour de l'emblème, même forme que la reprise : monte 6,96 → 7,10, rendu 7,12 → 7,62) : la scène
      // des rôles s'allume de la lumière du logo, sans creux.
      const take = dbg.noStage ? 0 : SINE(seg(t, TAKE_IN[0], TAKE_IN[1])) * (1 - SINE(seg(t, TAKE_OUT[0], TAKE_OUT[1])));
      const heartIn = dbg.noStage ? 0 : SINE(seg(t, HEART_IN[0], HEART_IN[1]));
      const onPool = onIn * (1 - SINE(seg(t, POOL_OUT[0], POOL_OUT[1])));
      const onHeart = heartIn * (1 - sm(HEART_OUT[0], HEART_OUT[1], t));
      if (onPool > 0.002 || onHeart > 0.002 || take > 0.002) {
        // Le cœur grandit avec l'équipe : chaque rôle qui arrive lui ajoute un peu de lumière (0,7 → 1), et sur sa cloche
        // l'emblème bat d'une lumière brève (+0,06, la forme du flash de cloche) : chaque joueur naît de sa lumière.
        let team = 0, beat = 0; for (let i = 0; i < 5; i++) { team += sm(APPEAR[i][0], APPEAR[i][1] + 0.15, t); beat += bellFlash(i, t); }
        const gq = SINE(seg(t, REL[0], HIT)), q = pj(em.cx, em.cy), heart = HEART_A * (0.7 + 0.06 * team) + HEART_BEAT * beat;
        bctx.save(); bctx.translate(q.x, q.y); bctx.scale(1, POOL_SY);
        const pr = 1 - 0.25 * gq;                        // le bassin se resserre (rayon × 0,75) en gardant son énergie
        const inhale = INHALE_A * E.inQuad(seg(t, INHALE[0], INHALE[1])) * (t < HIT ? 1 : Math.exp(-5 * (t - HIT)));
        NX.lk.glow(0, 0, POOL_R * pr * q.s, POOL_RGB, POOL_A / (pr * pr) * onPool * (1 + inhale), bctx);
        bctx.restore();
        if (take > 0.002) {                              // anneau du relais, autour de l'emblème
          const R = SWELL_R * q.s, g = bctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, R), a = SWELL_A * take;
          for (const [u, k] of SWELL_STOPS) g.addColorStop(u, `rgba(${POOL_RGB[0]},${POOL_RGB[1]},${POOL_RGB[2]},${(a * k).toFixed(4)})`);
          bctx.save(); bctx.globalCompositeOperation = 'lighter'; bctx.fillStyle = g; bctx.fillRect(q.x - R, q.y - R, 2 * R, 2 * R); bctx.restore();
        }
        // Profil plat au centre (revue M) : même lumière qu'une lueur du kit d'intensité HEART_FLAT fois plus forte, mais
        // sans pointe entre les traits de l'emblème.
        eqOrb(bctx, q.x, q.y, (HEART_R - 60 * gq) * q.s, HEART_RGB, HEART_FLAT * (heart + 0.10 * gq) * onHeart);
      }

      /* ---------------- Tuiles, lumière de leur place, faisceaux de cloche ---------------- */
      const src = NX.light.src(t), yaw = c.yaw;
      // Emblème à l'écran (centre de l'anneau, px écran par px du favicon) : trou doux des faisceaux qui passent derrière.
      const qe = NX.cam.project(em.cx, em.cy, em.z, c), emS = em.s * qe.s;
      this.tiles.forEach((T, i) => {
        const P = pose(i, t), flash = bellFlash(i, t);
        // Lumière de sa place : orbe douce qui s'allume avec sa tuile (Tᵢ − 0,30 → Tᵢ − 0,05 ; Top pendant que le front
        // reprend le mot-symbole) et s'éteint pendant la dissolution. Les rôles à venir attendent déjà sous une orbe faible
        // (WAIT, 0,15 sous la lumière de leur tuile) qui grandit en elle : le pentagone s'annonce dès le départ du logo.
        const gL = sm(LIGHT_IN[i][0], LIGHT_IN[i][1], t), out = 1 - sm(REL[i], REL[i] + 0.35, t);
        const wait = i ? WAIT_A * sm(WAIT[0], WAIT[1], t) * (1 - gL) : 0, onL = (0.24 + 0.24 * flash) * (1 + 0.4 * P.an) * gL * out;
        if (wait > 0.002 || onL > 0.002) {
          const q = pj(P.x, P.y);
          eqOrb(bctx, q.x, q.y, WAIT_R * q.s, RGB[i], wait);
          NX.lk.glow(q.x, q.y, 200 * q.s, RGB[i], onL, bctx);
        }
        // Faisceau de cloche : de la source au centre de la tuile + 37·s, derrière la tuile ; fin fondue sous la tuile.
        // Revue M : ceux de Top et Support croisent l'emblème ; ils passent derrière lui sans remplir ses jours (BEAM_HOLE).
        if (flash > 0.006) {
          const w = tilePoint(P, 0, 0, 0), q = pj(w[0], w[1], w[2]);
          const hole = i === 0 || i === 4 ? { x: qe.x, y: qe.y, r: BEAM_HOLE.r * FV.ringBand[1] * emS, f: BEAM_HOLE.f, keep: BEAM_HOLE.keep } : null;
          eqBeam(bctx, this.oc, src.x, src.y, q.x, q.y + 37 * q.s, 8, 186 * q.s, 0.45 * flash, BEAMRGB[i], 105 * q.s, hole);
        }
        // Tuile de verre. Top naît d'abord en lumière : seules ses feuilles additives (liseré chaud, halo de verre) se
        // lèvent pendant que le front reprend le mot-symbole (TOP_LIGHT) ; sa plaque, son icône et son ombre viennent ensuite
        // (TOP_GLASS, SINE) et reprennent la main sur cette lumière à mesure qu'elles s'opacifient.
        const ap = i ? sm(APPEAR[i][0], APPEAR[i][1], t) : SINE(seg(t, TOP_GLASS[0], TOP_GLASS[1]));
        const a = ap * (1 - sm(REL[i], REL[i] + 0.20, t));
        const lt = i ? 0 : SINE(seg(t, TOP_LIGHT[0], TOP_LIGHT[1])) * (1 - ap);
        const el = T.g.el;
        if (a <= 0 && lt <= 0.002) { el.style.display = 'none'; return; }
        el.style.display = '';
        const X = P.x - PX[i], Y = P.y - PY[i] + P.dy - HALF * (1 - P.s);
        el.style.transform = `translate3d(${X.toFixed(2)}px,${Y.toFixed(2)}px,${P.z.toFixed(2)}px) rotateX(${P.th.toFixed(3)}deg) scale(${P.s.toFixed(4)})`;
        NX.glassFade(T.g, a);
        T.g.content.style.opacity = '';                  // .gl-content est preserve-3d : on fond la feuille icône, jamais le conteneur
        T.icon.style.opacity = a;
        const glow = (0.6 + 0.4 * flash) * (1 + 0.4 * P.an);
        NX.glassLight(T.g, { pos: -0.43 * yaw, lit: 1, rimAngle: 180 + 6 * yaw, rimGain: 1, glow });
        if (lt > 0) T.g.glow.style.opacity = clamp(glow * a + TOP_HALO * lt);
        if (!i) {                                        // Top en lumière : ses feuilles sombres, encore nulles, sont retirées
          const d = a > 0 ? '' : 'none';                 // (règle ENGINE : aucune feuille transparente affichée)
          for (const k of ['shadow', 'plate', 'content', 'sheen', 'rim']) T.g[k].style.display = d;
        }
        const hot = clamp((0.6 * flash + 0.3 * P.an) * a + TOP_HOT * lt);
        if (hot > 0.002) {
          T.hot.style.display = '';
          T.hot.style.setProperty('--rim', `${(180 + 6 * yaw).toFixed(1)}deg`);
          T.hot.style.opacity = hot.toFixed(4);
        } else T.hot.style.display = 'none';
      });

      /* ---------------- Fusion : particules (devant le DOM, derrière l'emblème dans son empreinte) ---------------- */
      if (t >= REL[0] && t < EMBER_OUT[1] && this.P.length) this.particles(t, c, fctx, bctx, qe, emS, em);

      /* ---------------- Cœur de la fusion (fxBack, derrière l'emblème : ses traits restent nets) ----------------
       * Revue M : plus discret qu'en v7.1 (0,12 + 0,33·g), où il était le cœur d'un emblème de points ; l'emblème est là,
       * sa charge passe par ses traits (direction.js) et l'intérieur de l'anneau reste sous ses traits. */
      if (t >= CORE[0] && t < CORE[1]) {
        const g = E.inQuad(seg(t, CORE[0], CORE[1])), q = pj(em.cx, em.cy);
        eqOrb(bctx, q.x, q.y, (60 + 130 * g) * q.s, [200, 245, 255], (CORE_A[0] + CORE_A[1] * g) * sm(CORE[0], CORE[0] + 0.1, t));
      }
    },

    /** Vol des particules (§3.9), entrée dans l'emblème (revue M), éclatement à 9,6 et braises. Tampon additif NX.px.
     *  Avant l'impact, chaque point (tête et points de traînée) qui tombe dans l'empreinte de l'emblème (this.foot) est
     *  tracé sur #fxback, derrière lui : il ne se voit qu'entre ses traits, jamais sur eux ; le reste est tracé sur #fx,
     *  devant le DOM. Deux passes du tampon, sur un état calculé une fois (this.buf, réécrit à chaque image).
     *  Après l'impact, l'éclatement part des traits, devant, comme en v7.1. */
    particles(t, c, fctx, bctx, qe, emS, em) {
      const cyw = Math.cos(c.yaw * RAD), syw = Math.sin(c.yaw * RAD), cp = Math.cos(c.pitch * RAD), sp = Math.sin(c.pitch * RAD);
      const cr = Math.cos(c.roll * RAD), sr = Math.sin(c.roll * RAD);
      let qx = 0, qy = 0;
      const EX = NX.W / 2, EY = NX.H / 2;                 // centre de l'image (œil de la caméra)
      const proj = (X, Y, Z) => {                        // mêmes calculs que NX.cam.project, sans allocation
        const x = X - EX - c.x, y = Y - EY - c.y, z = Z + ZR + c.z - D;
        const x2 = x * cyw + z * syw, z2 = -x * syw + z * cyw, y2 = y * cp - z2 * sp, z3 = y * sp + z2 * cp;
        const s = D / Math.max(1, -z3);
        qx = EX + (x2 * cr - y2 * sr) * s; qy = EY + (x2 * sr + y2 * cr) * s;
      };
      const tau = t - HIT;
      if (tau >= 0) {
        // Éclatement : chaque point ne s'allume qu'en quittant son trait (déplacement d = bv·(1 − e^(−3τ))/3, 1,5 → 6 px).
        // Sur l'image de l'impact le PNG de « direction » est seul, complet et net ; l'éclatement naît des traits.
        const burstOut = 1 - sm(BURST_OUT[0], BURST_OUT[1], t), emberOut = 1 - sm(EMBER_OUT[0], EMBER_OUT[1], t);
        const fb = (1 - Math.exp(-3 * tau)) / 3;         // déplacement d'éclatement (px) par px/s de vitesse initiale
        NX.px.begin();
        for (const q of this.P) {
          const a = (q.ember ? Math.exp(-1.2 * tau) * emberOut : 1.4 * Math.exp(-6 * tau) * burstOut) * sm(1.5, 6, q.bv * fb);
          if (a < 0.01) continue;
          const w = this.world(q, t), k = a * 1.3 / 255;
          proj(w[0], w[1], w[2]);
          NX.px.blob(qx, qy, 1.3, q.rb * k, q.gb * k, q.bb * k);
        }
        NX.px.end(fctx);
        return;
      }
      // Vol : l'énergie monte en 0,08 s au départ et s'éteint sur les derniers 15 % (la particule entre dans l'emblème,
      // sa lumière passe au secteur) ; couleur du rôle → couleur du pixel visé sur u 0,7 → 1 ; traînée depuis u − 0,02.
      const buf = this.buf, n = this.P.length;
      for (let j = 0; j < n; j++) {
        const q = this.P[j], o = j * 8;
        buf[o + 7] = 0;
        if (t < q.te || t >= q.ta) continue;
        const u = (t - q.te) / (q.ta - q.te);
        let a = sm(q.te, q.te + 0.08, t) * (1 - sm(1 - ABSORB, 1, u));
        if (a < 0.01) continue;
        const w = this.world(q, t);
        proj(w[0], w[1], w[2]);
        const X = qx, Y = qy;
        proj(em.cx + em.s * q.fx, em.cy + em.s * q.fy, em.z - ZR);        // sa cible, à l'écran
        a *= sm(NEAR[0], NEAR[1], Math.hypot(X - qx, Y - qy));
        if (a < 0.01) continue;
        const m = sm(0.7, 1, u), k = a * 1.3 / 255;
        buf[o] = X; buf[o + 1] = Y;
        if (u > 0.02) { const w0 = this.world(q, t - 0.02 * (q.ta - q.te)); proj(w0[0], w0[1], w0[2]); buf[o + 2] = qx; buf[o + 3] = qy; }
        else buf[o + 2] = NaN;
        buf[o + 4] = (q.r0 + (q.r1 - q.r0) * m) * k; buf[o + 5] = (q.g0 + (q.g1 - q.g0) * m) * k; buf[o + 6] = (q.b0 + (q.b1 - q.b0) * m) * k;
        buf[o + 7] = 1;
      }
      // Empreinte : px écran → cellule de la grille (4 px du favicon) autour du centre de l'anneau projeté.
      const foot = this.foot, FN = FOOT_N, inv = FN / FV.W / emS, ox = FV.ringC[0] * FN / FV.W, oy = FV.ringC[1] * FN / FV.W;
      const behind = (X, Y) => {
        const i = Math.floor((X - qe.x) * inv + ox), j = Math.floor((Y - qe.y) * inv + oy);
        return i >= 0 && j >= 0 && i < FN && j < FN && foot[j * FN + i] === 1;
      };
      const pdbg = NX.eqDebug || {};
      for (const back of [true, false]) {
        if ((pdbg.onlyFront && back) || (pdbg.onlyBack && !back)) continue;
        NX.px.begin();
        for (let j = 0; j < n; j++) {
          const o = j * 8;
          if (!buf[o + 7]) continue;
          const X = buf[o], Y = buf[o + 1], R = buf[o + 4], Gc = buf[o + 5], B = buf[o + 6];
          if (buf[o + 2] === buf[o + 2]) eqTailSplit(buf[o + 2], buf[o + 3], X, Y, R, Gc, B, back, behind);
          if (behind(X, Y) === back) NX.px.blob(X, Y, 1.3, R, Gc, B);   // énergie k = 1,3/255 · alpha (bible §3.9)
        }
        NX.px.end(back ? bctx : fctx);
      }
    },
  });
})();
