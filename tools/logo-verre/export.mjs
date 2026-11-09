// Exporte les pistes de logo « 5 en verre » en SVG autonomes.
// Usage : node tools/logo-verre/export.mjs [dossier]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "./proposals.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(root, process.argv[2] || "docs/assets/logo-verre-2026-11-09");

for (const [name, assets] of Object.entries(buildAll())) {
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const kind of ["symbol", "lockup", "favicon"]) fs.writeFileSync(path.join(dir, `${kind}.svg`), assets[kind] + "\n");
  fs.writeFileSync(path.join(dir, "mono-blanc.svg"), assets.mono.replaceAll("currentColor", "#f1f5f9") + "\n");
  fs.writeFileSync(path.join(dir, "mono-nuit.svg"), assets.mono.replaceAll("currentColor", "#111827") + "\n");
}
console.log(`SVG exportés dans ${path.relative(root, out)}`);
