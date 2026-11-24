import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { flatCataloguePlugin } from "../../tools/i18n-catalogue-plugin.mjs";
import en from "../i18n/catalogue-en.js";
import es from "../i18n/catalogue-es.js";

const file = language => fileURLToPath(new URL(`../i18n/catalogue-${language}.js`, import.meta.url));
const PREFIX = "export default JSON.parse(";

async function built(language) {
  const code = await flatCataloguePlugin().load(file(language));
  expect(code.startsWith(PREFIX)).toBe(true);
  return JSON.parse(JSON.parse(code.trim().slice(PREFIX.length, -2)));
}

describe("build-time flattened i18n catalogues", () => {
  it.each([["en", en], ["es", es]])("ships the %s catalogue with the same keys, values and order", async (language, source) => {
    const flat = await built(language);
    expect(Object.keys(flat)).toEqual(Object.keys(source));
    expect(flat).toEqual({ ...source });
    expect(Object.values(flat).every(value => typeof value === "string")).toBe(true);
  });

  it("only flattens the two catalogue entry points", async () => {
    const plugin = flatCataloguePlugin();
    expect(plugin.apply).toBe("build");
    expect(await plugin.load(fileURLToPath(new URL("../i18n/translate.js", import.meta.url)))).toBeNull();
    expect(await plugin.load(fileURLToPath(new URL("../i18n/demo-overrides.js", import.meta.url)))).toBeNull();
  });
});
