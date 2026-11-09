import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as subset from "../pages/home/glass-three.js";

const source = readFileSync(new URL("../pages/home/glass-scene.js", import.meta.url), "utf8");

describe("Three.js subset of the glass sculpture", () => {
  it("exports exactly the Three.js names the scene references", () => {
    const used = [...new Set([...source.matchAll(/\bTHREE\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]))].sort();
    expect(used.length).toBeGreaterThan(0);
    expect(Object.keys(subset).sort()).toEqual(used);
    for (const name of used) expect(subset[name], name).toBeDefined();
  });

  it("never loads the whole package from the scene", () => {
    expect(source).not.toMatch(/import\s*\(\s*["']three["']\s*\)|from\s+["']three["']/);
    expect(source).toContain('import("./glass-three.js")');
  });
});
