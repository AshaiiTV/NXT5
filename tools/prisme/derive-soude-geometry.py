#!/usr/bin/env python3
"""Dérive la géométrie de la signature soudée NXT5 (charte 2.9) et écrit soude-geometry.mjs.

Source : les trois contours N, X, T de la scène d'accueil et le tracé du 5 facetté,
tels qu'ils figurent dans tools/prisme/build-neon-signature.mjs (signature 2.7).

Étapes :
  1. Ligature : X et T sont resserrés de 34 et 30 unités puis fusionnés avec N en une
     seule silhouette. Deux contre-formes triangulaires subsistent.
  2. Le 5 est ramené à 1,3 fois la hauteur de capitale, posé sur la ligne de pied de NXT,
     puis avancé de 30 unités dans la barre du T (jonction « Barre »).
  3. L'ensemble est fusionné : un seul contour pour NXT5, ajusté au gabarit 1600 x 600.

Ce script n'est pas exécuté par le build. Il exige shapely (`pip install shapely`) et ne
sert qu'à régénérer soude-geometry.mjs si le dessin évolue :
    python3 tools/prisme/derive-soude-geometry.py
"""
import re
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

HERE = Path(__file__).parent
NXT = [
    'M534,361L443,362L393,502L303,362L201,363L142,533L100,663L212,663L261,515L351,664L438,664L533,375Z',
    'M872,360L760,360L688,432L684,429L640,361L538,361L543,380L605,492L458,651L451,664L572,664L652,577L655,579L705,664L834,663L735,506L866,373Z',
    'M1159,359L884,361L825,441L927,442L856,663L967,663L1036,441L1133,440Z',
]
FIVE = 'M1435,358L1172,359L1113,540L1285,540L1287,542L1274,579L1099,579L1071,662L1325,663L1361,636L1400,510L1362,470L1231,471L1230,468L1241,438L1410,438Z'
TIGHTEN_X, TIGHTEN_T = 34, 30      # resserrement de la ligature, en unités des tracés d'origine
FIVE_RATIO = 1.3                   # hauteur du 5 / hauteur de capitale
FIVE_OVERLAP = 30                  # avancée du 5 dans la barre du T
BEVEL = 9.6                        # retrait du biseau intérieur, en unités du 5 d'origine
CANVAS, MARGIN = (1600, 600), 24
SLOPE = 0.317                      # pente des fûts : t = x + SLOPE * y est constant le long d'un fût


def parse(d):
    return [(float(a), float(b)) for a, b in re.findall(r'[ML](-?[\d.]+),(-?[\d.]+)', d)]


def ring(coords):
    pts = list(coords)[:-1]
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'


def path(geom):
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    return ''.join(ring(p.exterior.coords) + ''.join(ring(h.coords) for h in p.interiors) for p in polys)


n, x, t = [Polygon(parse(d)).buffer(0) for d in NXT]
ligature = unary_union([n, affinity.translate(x, -TIGHTEN_X, 0), affinity.translate(t, -(TIGHTEN_X + TIGHTEN_T), 0)])
_, top, _, base = ligature.bounds
cap = base - top

five = Polygon(parse(FIVE))
fx0, fy0, fx1, fy1 = five.bounds
scale = FIVE_RATIO * cap / (fy1 - fy0)
five = affinity.scale(five, scale, scale, origin=(fx0, fy1))
five = affinity.translate(five, 400, base - fy1)
while five.distance(ligature) > 0:
    five = affinity.translate(five, -1, 0)
five = affinity.translate(five, -FIVE_OVERLAP, 0)
inner = five.buffer(-BEVEL * scale, join_style=2)
# La fusion laisse des points quasi alignés : on les retire sans changer le dessin.
whole = unary_union([ligature, five]).simplify(0.8, preserve_topology=True)

# Ajustement au gabarit : largeur utile maximale, centrage vertical.
bx0, by0, bx1, by1 = whole.bounds
k = min((CANVAS[0] - 2 * MARGIN) / (bx1 - bx0), (CANVAS[1] - 2 * MARGIN) / (by1 - by0))
dx = (CANVAS[0] - (bx1 - bx0) * k) / 2 - bx0 * k
dy = (CANVAS[1] - (by1 - by0) * k) / 2 - by0 * k
fit = lambda g: affinity.translate(affinity.scale(g, k, k, origin=(0, 0)), dx, dy)
whole, five, inner, ligature = fit(whole), fit(five), fit(inner), fit(ligature)
t_five = min(px + SLOPE * py for px, py in five.exterior.coords)

out = f'''// Géométrie de la signature soudée NXT5 (charte 2.9), dans le gabarit {CANVAS[0]} x {CANVAS[1]}.
// Fichier généré par tools/prisme/derive-soude-geometry.py : ne pas le modifier à la main.
export const SOUDE_CANVAS = {{ width: {CANVAS[0]}, height: {CANVAS[1]} }};
/** Contour unique de NXT5 : silhouette extérieure puis les deux contre-formes de la ligature. */
export const SOUDE_CONTOUR = '{path(whole)}';
/** Silhouette du 5 seul, pour la matière, les monochromes et les icônes. */
export const SOUDE_FIVE = '{path(five)}';
/** Biseau intérieur du 5. */
export const SOUDE_FIVE_INNER = '{path(inner)}';
export const SOUDE_BOUNDS = {{ x0: {whole.bounds[0]:.1f}, y0: {whole.bounds[1]:.1f}, x1: {whole.bounds[2]:.1f}, y1: {whole.bounds[3]:.1f} }};
export const SOUDE_FIVE_BOUNDS = {{ x0: {five.bounds[0]:.1f}, y0: {five.bounds[1]:.1f}, x1: {five.bounds[2]:.1f}, y1: {five.bounds[3]:.1f} }};
/** Ligne de pied et sommet des capitales NXT. */
export const SOUDE_BASELINE = {ligature.bounds[3]:.1f};
export const SOUDE_CAP_TOP = {ligature.bounds[1]:.1f};
/** Pente des fûts et position du bord gauche du 5 le long de cette pente (t = x + pente * y). */
export const SOUDE_SLOPE = {SLOPE};
export const SOUDE_FIVE_EDGE = {t_five:.1f};
/** Échelle appliquée aux tracés d'origine pour remplir le gabarit. */
export const SOUDE_SCALE = {k:.4f};
'''
(HERE / 'soude-geometry.mjs').write_text(out, encoding='utf-8')
print(f'soude-geometry.mjs : capitale {cap * k:.0f}, 5 {(five.bounds[3] - five.bounds[1]):.0f}, échelle {k:.4f}')
