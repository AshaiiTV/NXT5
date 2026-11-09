// Géométrie partagée des pistes de logo NXT5 « verre ».
// Grille : capitale de 130 unités, fût de 26 unités, italique de 12°.

export const H = 130;
export const K = Math.tan((12 * Math.PI) / 180);

export const GLYPHS = {
  N: { w: 100, pts: [[0, 0], [26, 0], [74, 82], [74, 0], [100, 0], [100, 116], [86, 130], [74, 130], [26, 48], [26, 130], [0, 130]] },
  X: { w: 100, pts: [[0, 0], [30, 0], [50, 37.1], [70, 0], [100, 0], [65, 65], [100, 130], [70, 130], [50, 92.9], [30, 130], [0, 130], [35, 65]] },
  T: { w: 100, pts: [[0, 0], [100, 0], [100, 26], [63, 26], [63, 130], [37, 130], [37, 26], [0, 26]] },
  5: { w: 100, pts: [[14, 0], [100, 0], [100, 26], [40, 26], [40, 46], [82, 46], [100, 64], [100, 112], [82, 130], [0, 130], [0, 104], [74, 104], [74, 72], [14, 72]] },
};

// Le 5 découpé en cinq éclats convexes : barre haute, fût, barre médiane, panse, base.
export const FIVE_SHARDS = [
  [[14, 0], [100, 0], [100, 26], [40, 26]],
  [[14, 0], [40, 26], [40, 46], [14, 72]],
  [[40, 46], [82, 46], [100, 64], [74, 72], [14, 72]],
  [[74, 72], [100, 64], [100, 112], [74, 104]],
  [[0, 104], [74, 104], [100, 112], [82, 130], [0, 130]],
];

export const skew = (pts, { dx = 0, dy = 0, s = 1, k = K } = {}) =>
  pts.map(([x, y]) => [dx + s * (x + k * (H - y)), dy + s * y]);

export const toD = (polys) =>
  polys.map((p) => "M" + p.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join("L") + "Z").join("");

export function bbox(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function word(text, { gap = 16, s = 1, dx = 0, dy = 0, k = K } = {}) {
  const polys = [];
  let x = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    polys.push(skew(g.pts, { dx: dx + x * s, dy, s, k }));
    x += g.w + gap;
  }
  return polys;
}

// Rétrécit un polygone convexe de « d » unités (joints entre éclats).
export function inset(poly, dist) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const sign = area > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    const nx = (-ey / len) * sign, ny = (ex / len) * sign;
    return [[a[0] + nx * dist, a[1] + ny * dist], [b[0] + nx * dist, b[1] + ny * dist]];
  });
  return lines.map((l, i) => intersect(lines[(i - 1 + n) % n], l));
}

function intersect([[x1, y1], [x2, y2]], [[x3, y3], [x4, y4]]) {
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mapPts = (polys, f) => polys.map((p) => p.map(f));
