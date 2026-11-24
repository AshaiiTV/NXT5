import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLanguageMessages, t } from "../i18n/translate.js";

describe("cookie banner choices", () => {
  it("gives refuse and accept the same short, capitalised wording in every language", async () => {
    await Promise.all(["en", "es"].map(loadLanguageMessages));
    expect(["Tout refuser", "Tout accepter", "Personnaliser"].map((label) => t(label, undefined, "en"))).toEqual(["Refuse all", "Accept all", "Customize"]);
    expect(["Tout refuser", "Tout accepter", "Personnaliser"].map((label) => t(label, undefined, "es"))).toEqual(["Rechazar todo", "Aceptar todo", "Personalizar"]);
  });

  it("lets labels wrap and moves Personnaliser to a second row on narrow phones instead of clipping", () => {
    const css = readFileSync(new URL("../components/privacy/cookies.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/nxt5-cookie-actions > button \{[^}]*white-space: nowrap/);
    expect(css).toMatch(/@container \(max-width: 21rem\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?button:last-child \{ grid-column: 1 \/ -1; \}/);
  });
});
