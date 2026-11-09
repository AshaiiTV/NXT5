// Identité NXT5 : le 5 de la page d'accueil partout. Le 5 en couleur est le rendu de la scène
// Three.js (render-glass-five.mjs) ; les versions une couleur reprennent son contour exact.
// NXT est dessiné en verre dépoli sur la même inclinaison que le 5.
import { skew, word, bbox, mapPts, toD } from "./geometry.mjs";
import { crystal, flat, svg } from "./materials.mjs";

const f = (n) => +n.toFixed(2);

// Contour du 5 repris de src/pages/home/glass-scene.js (unités de la scène, y vers le haut),
// avant l'inclinaison de la scène : x + 0,24 × y.
export const HERO_FIVE = [[-1.55, 2.2], [1.5, 2.2], [1.5, 1.34], [-0.64, 1.34], [-0.64, 0.48], [1.04, 0.48], [1.48, 0.04], [1.48, -1.75], [1.03, -2.2], [-1.55, -2.2], [-1.55, -1.31], [0.56, -1.31], [0.56, -0.43], [-1.55, -0.43]];
export const HERO_SLANT = 0.24;
const UNIT = 130 / 4.4; // capitale de 130 unités, comme les lettres
const heroFive = (o = {}) => [skew(HERO_FIVE.map(([x, y]) => [(x + 1.55) * UNIT, (2.2 - y) * UNIT]), { ...o, k: HERO_SLANT })];

function fit(polys, box) {
  const bb = bbox(polys);
  const s = Math.min(box.w / bb.w, box.h / bb.h);
  const dx = box.x + (box.w - bb.w * s) / 2 - bb.x0 * s;
  const dy = box.y + (box.h - bb.h * s) / 2 - bb.y0 * s;
  return mapPts(polys, ([x, y]) => [dx + x * s, dy + y * s]);
}

// Logo : NXT en verre dépoli ; le 5 rendu en 3D, 1,32 fois plus haut, posé sur la ligne de base.
const NXT = word("NXT", { k: HERO_SLANT });
const FIVE_RATIO = 2990 / 3400; // largeur / hauteur de la silhouette du rendu 3D (pose de l'accueil)
const FIVE_H = 130 * 1.32;
export const LOGO_FIVE_BOX = { x: 344, y: 134 - FIVE_H, w: FIVE_H * FIVE_RATIO, h: FIVE_H };

function logoFrame(pad = 3) {
  const bb = bbox(NXT);
  const b = LOGO_FIVE_BOX;
  const x0 = Math.min(bb.x0, b.x) - pad, y0 = Math.min(bb.y0, b.y) - pad;
  const x1 = Math.max(bb.x1 + 6 * 0.75, b.x + b.w) + pad, y1 = Math.max(bb.y1 + 6 * 0.95, b.y + b.h) + pad;
  return { viewBox: `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`, w: x1 - x0, h: y1 - y0 };
}

// fiveHref : image du 5 rendu en 3D (data URI), recadrée sur sa silhouette.
export function logo(fiveHref) {
  const fr = logoFrame();
  const b = LOGO_FIVE_BOX;
  return {
    ...fr,
    svg: svg(fr.viewBox, [
      crystal("lg-nxt", NXT, { pal: "frost", depth: 6, seed: 3, bandAt: 0.22, glow: 0 }),
      { defs: "", body: `<image href="${fiveHref}" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" preserveAspectRatio="none"/>` },
    ], 'role="img" aria-label="NXT5"'),
  };
}

export function logoMono(color) {
  const fr = logoFrame();
  const five = fit(heroFive(), LOGO_FIVE_BOX);
  return svg(fr.viewBox, [flat("lm", [...NXT, ...five], color)], 'role="img" aria-label="NXT5"');
}

export function iconMono(color) {
  const glyph = fit(heroFive(), { x: 26, y: 22, w: 68, h: 76 });
  return svg("0 0 120 120", [{ defs: "", body: `<rect x="4" y="4" width="112" height="112" rx="28" fill="none" stroke="${color}" stroke-width="8"/>` }, flat("im", glyph, color)], 'role="img" aria-label="NXT5"');
}

export { toD };
