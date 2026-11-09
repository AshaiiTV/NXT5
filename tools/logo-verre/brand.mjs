// Identité retenue le 9 novembre 2026 : logo « Monolithe » (piste A) et icône « Écrin » (piste C).
// Chaque fonction renvoie un SVG autonome ; build-brand.mjs le décline en PNG, WebP et ICO.
import { GLYPHS, skew, word, bbox, mapPts, toD } from "./geometry.mjs";
import { crystal, flat, tile, svg } from "./materials.mjs";

const f = (n) => +n.toFixed(2);
const five = () => [skew(GLYPHS[5].pts)];

function fit(polys, box) {
  const bb = bbox(polys);
  const s = Math.min(box.w / bb.w, box.h / bb.h);
  const dx = box.x + (box.w - bb.w * s) / 2 - bb.x0 * s;
  const dy = box.y + (box.h - bb.h * s) / 2 - bb.y0 * s;
  return mapPts(polys, ([x, y]) => [dx + x * s, dy + y * s]);
}

// Cadre serré : contour + épaisseur du verre (décalage vers le bas à droite) + marge.
function frame(polys, { depth = 0, unit = 1, dir = [0.75, 0.95], pad = 3 } = {}) {
  const bb = bbox(polys);
  const x0 = bb.x0 - pad, y0 = bb.y0 - pad;
  const x1 = bb.x1 + depth * dir[0] * unit + pad, y1 = bb.y1 + depth * dir[1] * unit + pad;
  return { viewBox: `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`, w: x1 - x0, h: y1 - y0 };
}

// Logo : NXT en verre dépoli, 5 en cristal violet plus haut que les lettres.
const NXT = word("NXT");
const BIG5 = [skew(GLYPHS[5].pts, { dx: 342, dy: -42, s: 1.32 })];
const DEPTH_5 = 9, UNIT_5 = 1.32;

export function logo({ glow = 0 } = {}) {
  const fr = frame([...NXT, ...BIG5], { depth: DEPTH_5, unit: UNIT_5 });
  return {
    ...fr,
    svg: svg(fr.viewBox, [
      crystal("lg-nxt", NXT, { pal: "frost", depth: 6, seed: 3, bandAt: 0.22, glow: glow * 0.4 }),
      crystal("lg-5", BIG5, { depth: DEPTH_5, seed: 11, bandAt: 0.32, glow }),
    ], 'role="img" aria-label="NXT5"'),
  };
}

export function logoMono(color) {
  const fr = frame([...NXT, ...BIG5]);
  return svg(fr.viewBox, [flat("lm", [...NXT, ...BIG5], color)], 'role="img" aria-label="NXT5"');
}

// Symbole : le 5 en cristal seul, fond transparent.
export function symbol() {
  const p = fit(five(), { x: 8, y: 6, w: 132, h: 140 });
  return svg("0 0 160 160", [crystal("sy", p, { depth: 8, seed: 11, glow: 0 })], 'role="img" aria-label="NXT5"');
}

// Icône : tuile de verre fumé, 5 gravé. La tranche colorée dépasse de 4 unités sous la tuile.
export function icon({ size = 120, simple = false } = {}) {
  const u = size / 120;
  const inner = simple ? 0.14 : 0.2;
  const glyph = fit(five(), { x: size * inner, y: size * inner, w: size * (1 - inner * 2), h: size * (1 - inner * 2) });
  return svg(`0 0 ${size} ${f(size + 4 * u)}`, [tile("ic", 0, 0, size, glyph, { simple })], 'role="img" aria-label="NXT5"');
}

// Icône carrée plein cadre : Apple (coins arrondis par le système) et Android « maskable »
// (zone sûre : cercle de 80 %). Pas de liseré ni de tranche, qui seraient rognés.
export function iconSquare({ safe = 0.26 } = {}) {
  const size = 120;
  const glyph = fit(five(), { x: size * safe, y: size * safe, w: size * (1 - safe * 2), h: size * (1 - safe * 2) });
  return svg(`0 0 ${size} ${size}`, [tile("iq", 0, 0, size, glyph, { radius: 0, edge: false, border: false })], 'role="img" aria-label="NXT5"');
}

// Favicons : tuile qui occupe tout le carré, sans tranche. « simple » pour le 16 px.
export function favicon({ simple = false } = {}) {
  const size = 64;
  const inner = simple ? 0.13 : 0.17;
  const glyph = fit(five(), { x: size * inner, y: size * inner, w: size * (1 - inner * 2), h: size * (1 - inner * 2) });
  return svg(`0 0 ${size} ${size}`, [tile("fv", 0, 0, size, glyph, { radius: 0.22, edge: false, simple })], 'role="img" aria-label="NXT5"');
}

export function iconMono(color) {
  const glyph = fit(five(), { x: 24, y: 24, w: 72, h: 72 });
  return svg("0 0 120 120", [{ defs: "", body: `<rect x="4" y="4" width="112" height="112" rx="28" fill="none" stroke="${color}" stroke-width="8"/>` }, flat("im", glyph, color)], 'role="img" aria-label="NXT5"');
}

export { toD };
