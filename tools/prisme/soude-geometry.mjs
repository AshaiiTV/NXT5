// Géométrie de la signature soudée NXT5 (charte 2.9), dans le gabarit 1600 x 600.
// Fichier généré par tools/prisme/derive-soude-geometry.py : ne pas le modifier à la main.
export const SOUDE_CANVAS = { width: 1600, height: 600 };
/** Contour unique de NXT5 : silhouette extérieure puis les deux contre-formes de la ligature. */
export const SOUDE_CONTOUR = 'M1178.9,71.2L1144.6,176.3L880.7,178.2L881.2,177.2L751.1,177.2L667.5,260.8L662.8,257.3L611.7,178.3L422.4,179.5L364.3,342.1L259.8,179.5L141.3,180.7L72.8,378.1L24.0,529.1L154.1,529.1L211.0,357.2L315.5,530.3L532.7,530.3L625.7,429.2L629.1,431.5L687.2,530.3L956.7,529.1L1036.8,271.3L1113.9,270.5L1089.8,344.5L1349.5,344.5L1352.5,347.6L1332.9,403.4L1068.7,403.4L1026.4,528.8L1409.9,530.3L1464.3,489.5L1523.2,299.2L1465.8,238.8L1268.0,240.4L1266.5,235.8L1283.1,190.5L1538.3,190.5L1576.0,69.7ZM830.9,519.3L722.1,346.8L796.4,271.3L910.2,272.4ZM515.3,229.8L571.1,330.5L433.3,479.5Z';
/** Silhouette du 5 seul, pour la matière, les monochromes et les icônes. */
export const SOUDE_FIVE = 'M1576.0,69.7L1178.9,71.2L1089.8,344.5L1349.5,344.5L1352.5,347.6L1332.9,403.4L1068.7,403.4L1026.4,528.8L1409.9,530.3L1464.3,489.5L1523.2,299.2L1465.8,238.8L1268.0,240.4L1266.5,235.8L1283.1,190.5L1538.3,190.5Z';
/** Biseau intérieur du 5. */
export const SOUDE_FIVE_INNER = 'M1556.3,84.3L1189.4,85.7L1109.8,330.0L1355.5,330.0L1369.2,343.8L1343.2,417.9L1079.1,417.9L1046.5,514.3L1405.1,515.8L1451.8,480.7L1506.8,303.1L1459.6,253.4L1257.5,254.9L1251.1,235.6L1272.9,176.0L1527.6,176.0Z';
export const SOUDE_BOUNDS = { x0: 24.0, y0: 69.7, x1: 1576.0, y1: 530.3 };
export const SOUDE_FIVE_BOUNDS = { x0: 1026.4, y0: 69.7, x1: 1576.0, y1: 530.3 };
/** Ligne de pied et sommet des capitales NXT. */
export const SOUDE_BASELINE = 530.3;
export const SOUDE_CAP_TOP = 176.0;
/** Pente des fûts et position du bord gauche du 5 le long de cette pente (t = x + pente * y). */
export const SOUDE_SLOPE = 0.317;
export const SOUDE_FIVE_EDGE = 1194.0;
/** Échelle appliquée aux tracés d'origine pour remplir le gabarit. */
export const SOUDE_SCALE = 1.1615;
