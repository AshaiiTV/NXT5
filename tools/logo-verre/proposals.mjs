// Cinq pistes de logo NXT5 dans la direction « 5 en verre ».
import { GLYPHS, FIVE_SHARDS, skew, word, bbox, inset, mapPts, toD } from "./geometry.mjs";
import { crystal, clearGlass, flat, tile, tint, svg } from "./materials.mjs";

const f = (n) => +n.toFixed(2);
const five = (o) => [skew(GLYPHS[5].pts, o)];
const SPECTRUM = ["#67e8f9", "#818cf8", "#a78bfa", "#c084fc", "#e879f9"];

function fit(polys, box, pad = 0) {
  const bb = bbox(polys);
  const s = Math.min((box.w - pad * 2) / bb.w, (box.h - pad * 2) / bb.h);
  const dx = box.x + (box.w - bb.w * s) / 2 - bb.x0 * s;
  const dy = box.y + (box.h - bb.h * s) / 2 - bb.y0 * s;
  return mapPts(polys, ([x, y]) => [dx + x * s, dy + y * s]);
}

const nightBg = (id, size, r = 0.22) => ({
  defs: `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2140"/><stop offset="1" stop-color="#0d1222"/></linearGradient>`,
  body: `<rect width="${size}" height="${size}" rx="${f(size * r)}" fill="url(#${id}-bg)"/>`,
});

// Enveloppe « scène » : reflet sur sol de verre sous le logo.
function stage(id, vb, parts, floor, reflected = parts) {
  const [x, y, w, h] = vb;
  const defs = parts.map((p) => p.defs).join("") +
    `<linearGradient id="${id}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="${f(floor)}" x2="0" y2="${f(floor + (y + h - floor))}"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="${x}" y="${floor}" width="${w}" height="${y + h - floor}"><rect x="${x}" y="${floor}" width="${w}" height="${y + h - floor}" fill="url(#${id}-fade)"/></mask>`;
  const rest = parts.filter((p) => !reflected.includes(p)).map((p) => p.body).join("\n");
  const body = `<g id="${id}-art">${reflected.map((p) => p.body).join("\n")}</g>${rest}<g mask="url(#${id}-m)"><use href="#${id}-art" transform="translate(0 ${f(floor * 2 + 6)}) scale(1 -1)"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" role="img"><defs>${defs}</defs>${body}</svg>`;
}

/* ---------- A · Monolithe ---------- */
function monolithe() {
  const nxt = word("NXT", { s: 1 });
  const big5 = five({ dx: 3 * 116 - 6, dy: -42, s: 1.32 });
  const lock = [crystal("a-nxt", nxt, { pal: "frost", depth: 6, seed: 3, bandAt: 0.22, glow: 0.18 }), crystal("a-5", big5, { depth: 9, seed: 11, bandAt: 0.32 })];
  const hero = stage("a-h", [-30, -70, 570, 300], [crystal("ah-nxt", nxt, { pal: "frost", depth: 6, seed: 3, bandAt: 0.22, glow: 0.18 }), crystal("ah-5", big5, { depth: 9, seed: 11, bandAt: 0.32 })], 133);
  const sym5 = fit(five(), { x: 10, y: 10, w: 140, h: 140 });
  const symbol = svg("0 0 160 160", [crystal("a-s", sym5, { depth: 8, seed: 11 })]);
  const lockup = svg("-14 -60 540 210", lock);
  const mono = svg("-14 -60 540 210", [flat("a-m", [...nxt, ...big5], "currentColor")]);
  const fv = fit(five(), { x: 7, y: 6, w: 50, h: 52 });
  const favicon = svg("0 0 64 64", [nightBg("a-f", 64), crystal("a-fv", fv, { depth: 3, facets: 0, glow: 0.5, unit: 0.36 })]);
  return { hero, symbol, lockup, mono, favicon };
}

/* ---------- B · Prisme ---------- */
function prisme() {
  const all = word("NXT5");
  const nxt = all.slice(0, 3), f5 = all.slice(3);
  const b5 = bbox(f5);
  const parts = (p) => [clearGlass(p + "n", nxt, { bandAt: 0.5, bb: bbox(all) }), clearGlass(p + "5", f5, { bandAt: 0.5, bb: bbox(all), core: "#8b5cf6", coreOpacity: 0.85, coreAt: [(b5.x0 + b5.x1) / 2, (b5.y0 + b5.y1) / 2], coreR: 95 })];
  const hero = stage("b-h", [-30, -40, 540, 250], parts("bh"), 133);
  const lockup = svg("-14 -14 500 158", parts("bl"));
  const sym5 = fit(five(), { x: 12, y: 12, w: 136, h: 136 });
  const symbol = svg("0 0 160 160", [clearGlass("b-s", sym5, { core: "#8b5cf6", coreOpacity: 0.75 })]);
  const mono = svg("-14 -14 500 158", [flat("b-m", all, "currentColor")]);
  const fv = fit(five(), { x: 7, y: 6, w: 50, h: 52 });
  const favicon = svg("0 0 64 64", [nightBg("b-f", 64), clearGlass("b-fv", fv, { core: "#8b5cf6", coreOpacity: 0.9, unit: 0.42 })]);
  return { hero, symbol, lockup, mono, favicon };
}

/* ---------- C · Écrin ---------- */
function ecrin() {
  const tileAt = (id, x, y, s) => tile(id, x, y, s, fit(five(), { x: x + s * 0.2, y: y + s * 0.2, w: s * 0.6, h: s * 0.6 }));
  const wm = word("NXT5", { s: 0.62, dx: 168, dy: 34 });
  const wmFlat = (id) => [flat(id + "n", wm.slice(0, 3), "#eef2ff"), flat(id + "5", wm.slice(3), ["#67e8f9", "#a78bfa", "#e879f9"])];
  const heroTile = tileAt("ch-t", 0, 0, 140);
  const hero = stage("c-h", [-30, -40, 540, 250], [heroTile, ...wmFlat("ch-w")], 146, [heroTile]);
  const lockup = svg("-6 -6 482 158", [tileAt("cl-t", 0, 0, 140), ...wmFlat("cl-w")]);
  const symbol = svg("0 0 160 160", [tileAt("c-s", 10, 6, 140)]);
  const monoTile = `<rect x="0" y="0" width="140" height="140" rx="35" fill="none" stroke="currentColor" stroke-width="8"/>`;
  const mono = svg("-6 -6 482 158", [{ defs: "", body: monoTile }, flat("c-m5", fit(five(), { x: 28, y: 28, w: 84, h: 84 }), "currentColor"), flat("c-mw", wm, "currentColor")]);
  const favicon = svg("0 0 64 64", [tileAt("c-f", 2, 0, 60)]);
  return { hero, symbol, lockup, mono, favicon };
}

/* ---------- D · Héritage ---------- */
const mirror = (polys, cx = 60) => mapPts(polys, ([x, y]) => [2 * cx - x, y]).map((p) => p.reverse());
const CREST = {
  spearL: [[60, 2], [49, 40], [56.5, 44], [56.5, 86], [60, 110]],
  spearR: [[60, 2], [71, 40], [63.5, 44], [63.5, 86], [60, 110]],
  wingTop: [[4, 24], [51, 49], [51, 62], [18, 47]],
  wingLow: [[16, 58], [51, 76], [51, 89], [28, 79]],
};
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}
function crest(id, { x = 0, y = 0, s = 1, small = false } = {}) {
  const T = (polys) => mapPts(polys, ([px, py]) => [x + px * s, y + py * s]);
  const ring = [[205, 248], [262, 322], [38, 98], [112, 155]].map(([a, b]) => arc(x + 60 * s, y + 60 * s, 55 * s, a, b)).join("");
  const ringPart = {
    defs: `<linearGradient id="${id}-rg" gradientUnits="userSpaceOnUse" x1="${x}" y1="0" x2="${x + 120 * s}" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#818cf8"/><stop offset="1" stop-color="#d946ef"/></linearGradient><filter id="${id}-rb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(3 * s)}"/></filter>`,
    body: `<path d="${ring}" fill="none" stroke="url(#${id}-rg)" stroke-width="${f(7 * s)}" stroke-linecap="butt" opacity=".55" filter="url(#${id}-rb)"/><path d="${ring}" fill="none" stroke="url(#${id}-rg)" stroke-width="${f(3.2 * s)}"/><path d="${ring}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${f(0.7 * s)}"/>`,
  };
  const opt = { depth: small ? 2 : 4, unit: s * 0.6, glow: small ? 0.3 : 0.4, facets: small ? 0 : undefined };
  const left = T([CREST.wingTop, CREST.wingLow]);
  const right = T(mirror([CREST.wingTop, CREST.wingLow]));
  return [
    ringPart,
    crystal(id + "-wl", left, { ...opt, pal: tint("#38bdf8"), seed: 5, facets: small ? 0 : 6 }),
    crystal(id + "-wr", right, { ...opt, pal: tint("#a855f7"), seed: 9, facets: small ? 0 : 6 }),
    crystal(id + "-sl", T([CREST.spearL]), { ...opt, pal: tint("#a5b4fc"), seed: 2, facets: small ? 0 : 3, glow: 0.6 }),
    crystal(id + "-sr", T([CREST.spearR]), { ...opt, pal: tint("#6d28d9"), seed: 4, facets: small ? 0 : 3, glow: 0 }),
  ];
}
function heritage() {
  const wm = (dx, dy, s) => word("NXT5", { s, dx, dy });
  const heroWm = wm(-43.9, 168, 0.5);
  const hero = stage("d-h", [-125, -20, 400, 280], [...crest("dh-c", { x: 0, y: 0, s: 1.25 }), crystal("dh-n", heroWm.slice(0, 3), { pal: "frost", depth: 3, seed: 3, glow: 0.15, unit: 0.5 }), crystal("dh-5", heroWm.slice(3), { depth: 3, seed: 6, unit: 0.5 })], 236);
  const lw = wm(150, 40, 0.5);
  const lockup = svg("-6 -6 400 162", [...crest("dl-c", { x: 0, y: 0, s: 1.25 }), crystal("dl-n", lw.slice(0, 3), { pal: "frost", depth: 3, seed: 3, glow: 0.15, unit: 0.5 }), crystal("dl-5", lw.slice(3), { depth: 3, seed: 6, unit: 0.5 })]);
  const symbol = svg("0 0 160 160", crest("d-s", { x: 8, y: 8, s: 1.2 }));
  const monoBody = (c) => {
    const ring = [[205, 248], [262, 322], [38, 98], [112, 155]].map(([a, b]) => arc(75, 75, 68.75, a, b)).join("");
    const shapes = mapPts([CREST.spearL, CREST.spearR, CREST.wingTop, CREST.wingLow, ...mirror([CREST.wingTop, CREST.wingLow])], ([x, y]) => [x * 1.25, y * 1.25]);
    return `<path d="${ring}" fill="none" stroke="${c}" stroke-width="4"/><path d="${toD(shapes)}" fill="${c}"/><path d="${toD(lw)}" fill="${c}"/>`;
  };
  const mono = svg("-6 -6 400 162", [{ defs: "", body: monoBody("currentColor") }]);
  const favicon = svg("0 0 64 64", [nightBg("d-f", 64), ...crest("d-fv", { x: 3, y: 3, s: 0.483, small: true })]);
  return { hero, symbol, lockup, mono, favicon };
}

/* ---------- E · Cinq éclats ---------- */
function shards(id, box, { gap = 3.4, depth = 6, small = false, explode = 0 } = {}) {
  const base = FIVE_SHARDS.map((p) => skew(inset(p, gap / 2)));
  const placed = fit(base, box);
  const bb = bbox(placed);
  const s = bb.h / 130;
  const drift = [[6, -26], [-22, -6], [18, 0], [26, 10], [-10, 26]];
  return placed.map((p, i) => {
    const part = crystal(`${id}-${i}`, [p], { pal: tint(SPECTRUM[i]), depth, unit: s, seed: 20 + i * 7, facets: small ? 0 : 4, bb, bandAt: 0.34, glow: small ? 0.3 : 0.32 });
    return { defs: part.defs, body: `<g class="shard" style="--i:${i};--dx:${f(drift[i][0] * s)}px;--dy:${f(drift[i][1] * s)}px">${part.body}</g>` };
  });
}
function eclats() {
  const nxt = word("NXT", { s: 1 });
  const nxtPart = (id) => crystal(id, nxt, { pal: "frost", depth: 5, seed: 3, bandAt: 0.22, glow: 0.15 });
  const box5 = { x: 344, y: -40, w: 150, h: 170 };
  const hero = stage("e-h", [-30, -70, 570, 300], [nxtPart("eh-n"), ...shards("eh-5", box5)], 133);
  const lockup = svg("-14 -60 540 210", [nxtPart("el-n"), ...shards("el-5", box5)]);
  const symbol = svg("0 0 160 160", shards("e-s", { x: 10, y: 8, w: 140, h: 144 }, { gap: 4 }));
  const monoShards = fit(FIVE_SHARDS.map((p) => skew(inset(p, 1.7))), box5);
  const mono = svg("-14 -60 540 210", [flat("e-m", [...nxt, ...monoShards], "currentColor")]);
  const favicon = svg("0 0 64 64", [nightBg("e-f", 64), ...shards("e-fv", { x: 7, y: 6, w: 50, h: 52 }, { gap: 5.5, depth: 2, small: true })]);
  return { hero, symbol, lockup, mono, favicon };
}

export const PROPOSALS = { monolithe, prisme, ecrin, heritage, eclats };
export function buildAll() {
  return Object.fromEntries(Object.entries(PROPOSALS).map(([k, fn]) => [k, fn()]));
}
