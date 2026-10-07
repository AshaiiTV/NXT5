/* Version verticale 9:16 (1080×1920, ?format=v) : géométrie partagée et fronts de lumière (MOTION-BIBLE-9x16.md §2).
 * Chargé juste après « style », avant la caméra et les scènes. Sans effet en 16:9 : le film 16:9 reste identique à l'octet.
 * Chaque scène lit NX.G et NX.FRONT ; ses propres valeurs verticales sont dans ses branches NX.V.
 * Propriétaire : le lead (amendement 9:16) ; les paquets de scènes demandent leurs changements dans leur rapport. */
(function () {
  if (!NX.V) return;
  const G = NX.G, LOGO = G.LOGO, FAV = G.FAV, AX = 540;          // axe vertical de toutes les compositions centrées
  const K2 = 800 / LOGO.W, K9 = 720 / LOGO.W, S5 = 500 / FAV.W;
  const L9 = { left: AX - LOGO.axisX * K9, top: 225, w: 720 };     // logo final : 720 px (16:9 : 620)
  NX.G = Object.assign({}, G, {
    // S1 : six lignes de 88 px (interligne 1,06), première boîte de ligne à 492, centrées sur 540.
    hook: { top: 492, size: 88, lh: 1.06, lines: ['Envie d’analyser', 'tes games', 'et de comprendre', 'ton équipe', 'sur League', 'of Legends ?'] },
    // S2 : le logo de 800 px du 16:9, sur l'axe (anneau (540 ; 747,11)).
    L2: { left: AX - LOGO.axisX * K2, top: 520, w: 800 },
    // S5 : emblème de 500 px (16:9 : 460), anneau en (540 ; 680).
    E5: { left: AX - FAV.ringC[0] * S5, top: 680 - FAV.ringC[1] * S5, size: 500 },
    // S3′ : pentagone r 275 sur le centre optique de l'emblème (NX.M72 : (539,35 ; 725,50)), tuiles à l'échelle 0,70.
    pent: { c: [539.35, 725.50], r: 275, deg: [126, 198, 270, 342, 54], scale: 0.70 },
    // S5 : « Une même / direction. » en deux lignes de 104 px, boîte de ligne à 934 (100 px sous l'emblème).
    dir: { top: 934, size: 104, lh: 1.06, z: 3 },
    // Outils : la carte en haut, le surtitre et le titre dessous, alignés à gauche sur le contenu de la carte.
    tools: { col: { left: 154, top: 982, z: 40 },
             stack: { left: 90, top: 300, w: 840, h: 625, z: -60, rotY: 4, rotX: 3, origin: '0 0',
                      slots: [[0, 0, 0], [0, -80, -150], [0, -160, -300], [0, -240, -450]], fog: [0, 0.42, 0.84, 1] },
             kicker: 34, title: 104 },
    // S9 : logo final de 720 px et emblème posé exactement sur le sien (favicon × 1,1425 en (335,5 ; 48,5) px logo).
    L9,
    dock: { left: L9.left + FAV.toLockup.x * K9, top: L9.top + FAV.toLockup.y * K9, size: FAV.W * FAV.toLockup.s * K9 },
    end: { buttonTop: 841, line1Top: 1033, cta: 64, line: 56, lines: ['Pour les équipes et coachs', 'League of Legends'] },
    // S9 : retour de l'emblème depuis la lumière (anneau de (540 ; −1150 ; −4000) au dock, SINE 27,0–27,6).
    ret: { from: [AX, -1150, -4000], t: [27.0, 27.6] },
  });
  const SINE = NX.ease.sine, seg = NX.seg;
  NX.FRONT = {
    // S1–S2 : le front part plus tôt (3,84) et plus haut qu'en 16:9 ; bord de brûlure de la question = R + hookLead.
    hook: NX.track([[3.84, 40], [4.10, 290], [4.28, 487], [4.50, 750], [4.80, 1081], [5.02, 1300], [5.30, 1470], [5.60, 1540]]),
    hookLead: t => 60 + 86 * SINE(seg(t, 4.20, 4.78)),
    hookEnv: [3.84, 3.94, 5.30, 5.60],                                       // bande du front dans les rayons (ciel)
    // S2 : rideau inverse qui reprend le mot-symbole (16:9 : UNWRITE 1070 → 590 sur 6,78–7,17).
    unwrite: NX.track([[6.66, 1360], [6.83, 1208], [7.00, 1057], [7.17, 905]]),
    // S8 → S9 : brûle les outils (avance endLead) puis écrit le logo final (avance 0).
    end: NX.track([[26.6, 120], [26.85, 260], [27.10, 395], [27.30, 538], [27.60, 830], [27.85, 1080], [28.15, 1420], [28.5, 1600], [28.8, 1660]]),
    endLead: t => 100 + 45 * SINE(seg(t, 27.30, 27.55)),
    endEnv: [26.55, 26.65, 28.5, 28.8],
  };
  // Ciel vertical (shader) : rayons qui portent plus bas, masse de la nébuleuse relevée, pied assombri (bande des légendes).
  NX.SKY.fall = 0.80; NX.SKY.nebY = 0.10; NX.SKY.foot = 0.28;
})();
