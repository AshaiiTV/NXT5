// Build-time flattening of the translation catalogues.
//
// `src/i18n/catalogue-<lang>.js` merge `messages/<lang>.json` with many
// `*-overrides.js` modules, each exporting both `en` and `es`. Bundled as-is,
// those shared modules put both languages in the chunk an English visitor
// downloads. During `vite build`, this plugin evaluates the catalogue in Node
// (same merge, same precedence) and replaces the module with its flattened
// result, so each language chunk only contains its own strings. Development,
// tests, the prerender server and `npm run i18n:check` keep using the sources.
import { pathToFileURL } from "node:url";

const CATALOGUE = /[/\\]src[/\\]i18n[/\\]catalogue-(en|es)\.js$/;

/** Return the merged catalogue exactly as the runtime module exports it. */
export async function loadMergedCatalogue(file) {
  const { default: catalogue } = await import(pathToFileURL(file).href);
  return catalogue;
}

/** ES module source exporting the flattened catalogue. */
export async function flatCatalogueModule(file) {
  const catalogue = await loadMergedCatalogue(file);
  // JSON.parse keeps every key as an own data property, like the object spread.
  return `export default JSON.parse(${JSON.stringify(JSON.stringify(catalogue))});\n`;
}

export function flatCataloguePlugin() {
  return {
    name: "nxt5-flat-i18n-catalogue",
    apply: "build",
    enforce: "pre",
    async load(id) {
      const file = id.split("?", 1)[0];
      if (!CATALOGUE.test(file)) return null;
      return flatCatalogueModule(file);
    },
  };
}
