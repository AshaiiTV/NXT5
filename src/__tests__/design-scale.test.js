import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Pages and components stay on the charter scales: 4 px spacing grid, the four
// radii mapped in tailwind.config.js, and editorial title sizes limited to the
// public pages. Shared tokens live in src/index.css; see docs/charte-graphique.md §0.
// Every string literal of a source file is scanned (plain className="…", cx(…)
// arguments, template literals and class strings kept in variables); the
// utility names are specific enough not to collide with copy or translations.
const ROOT = join(process.cwd(), "src");
const SKIP = new Set(["__tests__"]);
const EDITORIAL = [/^pages[\\/]public[\\/]/, /^pages[\\/]home[\\/]/, /^pages[\\/]Guide/];

function sources(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (SKIP.has(entry)) continue;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(jsx|js)$/.test(entry)) out.push(path);
  }
  return out;
}

const files = sources().map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));
const literals = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const findings = (pattern, filter = () => true) => files.flatMap(({ path, text }) => {
  if (!filter(path)) return [];
  const hits = new Set();
  for (const match of text.matchAll(literals)) for (const token of match[2].split(/[\s${}]+/)) if (pattern.test(token)) hits.add(token);
  return hits.size ? [`${path}: ${[...hits].join(" ")}`] : [];
});

describe("design scale", () => {
  it("keeps spacing utilities on the 4 px grid (no 7, 9, 11, 13, 14 or 15 steps)", () => {
    expect(findings(/^(?:[a-z]+:)*-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(?:7|9|11|13|14|15)$/)).toEqual([]);
  });

  it("uses only radius utilities that resolve to a charter radius", () => {
    expect(findings(/^(?:[a-z]+:)*rounded(?:-[trbl]{1,2})?-(?:none|\[(?!2px\]|10px\]|inherit\])[^\]]*\])$/)).toEqual([]);
  });

  it("reserves editorial title sizes to the public pages", () => {
    expect(findings(/^(?:[a-z]+:)*text-(?:3xl|4xl|5xl|6xl|7xl)$/, (path) => !EDITORIAL.some((rule) => rule.test(path)))).toEqual([]);
  });
});
