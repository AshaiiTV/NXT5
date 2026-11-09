// Matières SVG : cristal facetté, verre clair prismatique, verre dépoli, tuile gravée.
import { bbox, toD, rng } from "./geometry.mjs";

const f = (n) => +n.toFixed(2);

function facets(id, bb, seed, count, tone = "violet") {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const cx = bb.x0 + r() * bb.w, cy = bb.y0 + r() * bb.h;
    const s = 14 + r() * 34;
    const a0 = r() * Math.PI * 2;
    const pts = [0, 1, 2].map((j) => {
      const a = a0 + j * (2.1 + r() * 0.5);
      const rr = s * (0.55 + r() * 0.6);
      return `${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    });
    const light = r() > 0.42;
    const op = light ? 0.04 + r() * 0.1 : 0.07 + r() * 0.14;
    const fill = light ? "#ffffff" : tone === "frost" ? "#5b6aa8" : "#1a1150";
    out.push(`<path d="M${pts.join("L")}Z" fill="${fill}" fill-opacity="${f(op)}" stroke="#ffffff" stroke-opacity="${light ? 0.12 : 0.05}" stroke-width=".6"/>`);
  }
  return out.join("");
}

function band(bb, at, width, slope = 0.55) {
  const x = bb.x0 + bb.w * at;
  const y0 = bb.y0 - 20, y1 = bb.y1 + 20;
  const dx = (y1 - y0) * slope;
  return `M${f(x + dx / 2)} ${f(y0)}L${f(x + dx / 2 + width)} ${f(y0)}L${f(x - dx / 2 + width)} ${f(y1)}L${f(x - dx / 2)} ${f(y1)}Z`;
}

const PALETTES = {
  violet: { hi: "#d6ccff", a: "#9277fb", b: "#5f42e0", c: "#3a2499", side0: "#6f8dff", side1: "#24135f", glow: "#7c3aed", rim0: "#a5f3fc", rim1: "#f0abfc" },
  frost: { hi: "#ffffff", a: "#eef1ff", b: "#c9d1f3", c: "#8f9bd0", side0: "#a9b6f0", side1: "#2c2f63", glow: "#93c5fd", rim0: "#ffffff", rim1: "#c4b5fd" },
};

export function tint(hex) {
  const mix = (h1, h2, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [a, b] = [p(h1), p(h2)];
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  return { hi: mix(hex, "#ffffff", 0.62), a: mix(hex, "#7c5cf0", 0.25), b: mix(hex, "#4c2fc8", 0.55), c: mix(hex, "#22145e", 0.62), side0: mix(hex, "#ffffff", 0.2), side1: mix(hex, "#150c40", 0.78), glow: hex, rim0: mix(hex, "#ffffff", 0.7), rim1: mix(hex, "#f0abfc", 0.4) };
}

// Cristal facetté avec épaisseur : inspiré directement du 5 de l'accueil.
export function crystal(id, polys, o = {}) {
  const pal = typeof o.pal === "string" ? PALETTES[o.pal] : o.pal || PALETTES.violet;
  const D = toD(polys);
  const bb = o.bb || bbox(polys);
  const depth = o.depth ?? 7;
  const dir = o.dir || [0.75, 0.95];
  const unit = o.unit ?? Math.max(bb.h / 130, 0.25);
  const glow = o.glow ?? 0.42;
  const defs = `
<clipPath id="${id}-c"><path d="${D}"/></clipPath>
<linearGradient id="${id}-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.hi}"/><stop offset=".28" stop-color="${pal.a}"/><stop offset=".62" stop-color="${pal.b}"/><stop offset="1" stop-color="${pal.c}"/></linearGradient>
<linearGradient id="${id}-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.side0}"/><stop offset="1" stop-color="${pal.side1}"/></linearGradient>
<linearGradient id="${id}-e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.rim0}"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="${pal.rim1}"/></linearGradient>
<radialGradient id="${id}-h" cx=".18" cy="0" r=".75"><stop offset="0" stop-color="#ffffff" stop-opacity=".42"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".26"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<filter id="${id}-g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(9 * unit)}"/></filter>
<filter id="${id}-i" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(2.4 * unit)}"/></filter>`;
  const layers = [];
  if (glow > 0) layers.push(`<path d="${D}" fill="${pal.glow}" opacity="${glow}" filter="url(#${id}-g)"/>`);
  for (let i = depth; i >= 1; i--) {
    layers.push(`<path d="${D}" transform="translate(${f(i * dir[0] * unit)} ${f(i * dir[1] * unit)})" fill="url(#${id}-s)"/>`);
  }
  const fc = o.facets ?? Math.round(10 + (bb.w * bb.h) / 1400);
  const tone = pal === PALETTES.frost ? "frost" : "violet";
  layers.push(`<path d="${D}" fill="url(#${id}-f)"/>`);
  layers.push(`<g clip-path="url(#${id}-c)">
${facets(id, bb, o.seed ?? 7, fc, tone)}
<path d="${D}" fill="url(#${id}-h)"/>
<path d="${band(bb, o.bandAt ?? 0.3, bb.w * 0.09)}" fill="url(#${id}-b)"/>
<path d="${D}" fill="none" stroke="${pal.hi}" stroke-opacity=".38" stroke-width="${f(9 * unit)}" filter="url(#${id}-i)"/>
<path d="${D}" fill="none" stroke="url(#${id}-e)" stroke-width="${f(3.4 * unit)}"/>
</g>`);
  layers.push(`<path d="${D}" fill="none" stroke="#eef0ff" stroke-opacity=".35" stroke-width="${f(0.7 * unit)}"/>`);
  return { defs, body: layers.join("\n") };
}

// Verre clair : transparence, bord épais lumineux, bande prismatique.
export function clearGlass(id, polys, o = {}) {
  const D = toD(polys);
  const bb = o.bb || bbox(polys);
  const unit = o.unit ?? Math.max(bb.h / 130, 0.25);
  const at = o.bandAt ?? 0.5;
  const defs = `
<clipPath id="${id}-c"><path d="${D}"/></clipPath>
<linearGradient id="${id}-f" gradientUnits="userSpaceOnUse" x1="${f(bb.x0)}" y1="${f(bb.y0)}" x2="${f(bb.x1)}" y2="${f(bb.y1)}"><stop offset="0" stop-color="#c4b5fd" stop-opacity=".34"/><stop offset=".5" stop-color="#818cf8" stop-opacity=".12"/><stop offset="1" stop-color="#e879f9" stop-opacity=".26"/></linearGradient>
<linearGradient id="${id}-sp" gradientUnits="userSpaceOnUse" x1="${f(bb.x0)}" y1="0" x2="${f(bb.x1)}" y2="0"><stop offset="0" stop-color="#67e8f9"/><stop offset=".38" stop-color="#818cf8"/><stop offset=".65" stop-color="#a78bfa"/><stop offset="1" stop-color="#e879f9"/></linearGradient>
<linearGradient id="${id}-r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#67e8f9" stop-opacity="0"/><stop offset=".22" stop-color="#67e8f9" stop-opacity=".75"/><stop offset=".5" stop-color="#c4b5fd" stop-opacity=".85"/><stop offset=".78" stop-color="#f0abfc" stop-opacity=".75"/><stop offset="1" stop-color="#f0abfc" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".32"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<radialGradient id="${id}-in" gradientUnits="userSpaceOnUse" cx="${f(o.coreAt ? o.coreAt[0] : (bb.x0 + bb.x1) / 2)}" cy="${f(o.coreAt ? o.coreAt[1] : (bb.y0 + bb.y1) / 2)}" r="${f(o.coreR ?? Math.max(bb.w, bb.h) * 0.6)}"><stop offset="0" stop-color="${o.core || "#8b5cf6"}" stop-opacity="${o.coreOpacity ?? 0}"/><stop offset="1" stop-color="${o.core || "#8b5cf6"}" stop-opacity="0"/></radialGradient>
<filter id="${id}-i" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(3 * unit)}"/></filter>
<filter id="${id}-g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(10 * unit)}"/></filter>`;
  const body = `
<path d="${D}" fill="#8b5cf6" opacity=".26" filter="url(#${id}-g)"/>
<path d="${D}" fill="#0b1022" fill-opacity=".34"/>
<path d="${D}" fill="url(#${id}-f)"/>
<g clip-path="url(#${id}-c)">
<path d="${D}" fill="url(#${id}-in)"/>
<path d="${band(bb, at, bb.w * 0.26, 0.42)}" fill="url(#${id}-r)" filter="url(#${id}-i)"/>
<path d="${band(bb, at - 0.3, bb.w * 0.1, 0.42)}" fill="url(#${id}-w)"/>
<path d="${D}" fill="url(#${id}-top)"/>
<path d="${D}" fill="none" stroke="#ddd6fe" stroke-opacity=".6" stroke-width="${f(15 * unit)}" filter="url(#${id}-i)"/>
<path d="${D}" fill="none" stroke="url(#${id}-sp)" stroke-width="${f(4.6 * unit)}"/>
</g>
<path d="${D}" transform="translate(${f(-1.4 * unit)} 0)" fill="none" stroke="#67e8f9" stroke-opacity=".6" stroke-width="${f(0.9 * unit)}"/>
<path d="${D}" transform="translate(${f(1.4 * unit)} 0)" fill="none" stroke="#f0abfc" stroke-opacity=".55" stroke-width="${f(0.9 * unit)}"/>
<path d="${D}" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="${f(0.7 * unit)}"/>`;
  return { defs, body };
}

// Aplat (monochrome ou dégradé simple) pour les petites tailles et l'impression.
export function flat(id, polys, fill = "#f1f5f9") {
  const D = toD(polys);
  if (Array.isArray(fill)) {
    const bb = bbox(polys);
    const stops = fill.map((c, i) => `<stop offset="${f(i / (fill.length - 1))}" stop-color="${c}"/>`).join("");
    return { defs: `<linearGradient id="${id}-l" gradientUnits="userSpaceOnUse" x1="${f(bb.x0)}" y1="${f(bb.y0)}" x2="${f(bb.x1)}" y2="${f(bb.y1)}">${stops}</linearGradient>`, body: `<path d="${D}" fill="url(#${id}-l)"/>` };
  }
  return { defs: "", body: `<path d="${D}" fill="${fill}"/>` };
}

// Tuile de verre fumé avec le 5 gravé et éclairé par-dessous.
export function tile(id, x, y, size, glyphPolys, o = {}) {
  const r = size * (o.radius ?? 0.25);
  const D = toD(glyphPolys);
  const u = size / 120;
  const t = Math.max(3 * u, 1.2);
  const defs = `
<linearGradient id="${id}-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#36406a"/><stop offset=".45" stop-color="#231d4a"/><stop offset="1" stop-color="#121a30"/></linearGradient>
<linearGradient id="${id}-te" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5f3fc"/><stop offset=".45" stop-color="#c4b5fd" stop-opacity=".35"/><stop offset="1" stop-color="#f0abfc"/></linearGradient>
<linearGradient id="${id}-ts" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset=".42" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-tk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#d946ef"/></linearGradient>
<linearGradient id="${id}-5" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#ddd6fe"/><stop offset=".75" stop-color="#a78bfa"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
<radialGradient id="${id}-gl" cx=".5" cy=".62" r=".55"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".65"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>
<clipPath id="${id}-tc"><rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(r)}"/></clipPath>
<filter id="${id}-b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f(5 * u)}"/></filter>
<filter id="${id}-in" x="-10%" y="-10%" width="120%" height="120%">
<feOffset in="SourceAlpha" dx="${f(2.2 * u)}" dy="${f(3 * u)}" result="o"/><feGaussianBlur in="o" stdDeviation="${f(1.4 * u)}" result="ob"/>
<feComposite in="SourceAlpha" in2="ob" operator="out" result="ring"/><feFlood flood-color="#1e1047" flood-opacity=".85"/><feComposite in2="ring" operator="in" result="sh"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge></filter>`;
  const body = `
<rect x="${f(x)}" y="${f(y + 4 * u)}" width="${f(size)}" height="${f(size)}" rx="${f(r)}" fill="url(#${id}-tk)" opacity=".85"/>
<rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(r)}" fill="url(#${id}-t)"/>
<g clip-path="url(#${id}-tc)">
<rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" fill="url(#${id}-gl)"/>
<path d="${D}" fill="#a78bfa" opacity=".9" filter="url(#${id}-b)"/>
<path d="${D}" fill="url(#${id}-5)" filter="url(#${id}-in)"/>
<rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" fill="url(#${id}-ts)"/>
<path d="M${f(x + size * 0.58)} ${f(y - 4)}L${f(x + size * 0.7)} ${f(y - 4)}L${f(x + size * 0.18)} ${f(y + size + 4)}L${f(x + size * 0.06)} ${f(y + size + 4)}Z" fill="#ffffff" fill-opacity=".07"/>
</g>
<rect x="${f(x + t / 2)}" y="${f(y + t / 2)}" width="${f(size - t)}" height="${f(size - t)}" rx="${f(r - t / 2)}" fill="none" stroke="url(#${id}-te)" stroke-width="${f(t)}" stroke-opacity=".9"/>`;
  return { defs, body };
}

export function svg(viewBox, parts, attrs = "") {
  const defs = parts.map((p) => p.defs).join("");
  const body = parts.map((p) => p.body).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${attrs}><defs>${defs}</defs>${body}</svg>`;
}
