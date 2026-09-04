import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, LEGAL_VERSION } from "../pages/public/PublicPages.jsx";
import { PUBLIC_ROUTES } from "../app/constants.jsx";

describe("public legal information", () => {
  it("exposes every legal document as a public route", () => {
    for (const path of ["/mentions-legales", "/confidentialite", "/cookies", "/conditions", "/reglement", "/contact"]) {
      expect(PUBLIC_ROUTES).toContain(path);
      expect(LEGAL_PAGES[path]).toBeTruthy();
    }
  });

  it("publishes a consistent dated legal version", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(LEGAL_PAGES["/confidentialite"])).toContain(LEGAL_VERSION);
    expect(JSON.stringify(LEGAL_PAGES["/conditions"])).toContain(LEGAL_VERSION);
    expect(JSON.stringify(LEGAL_PAGES["/reglement"])).toContain(LEGAL_VERSION);
  });

  it("discloses the real processors and session duration", () => {
    const privacy = JSON.stringify(LEGAL_PAGES["/confidentialite"]);
    const cookies = JSON.stringify(LEGAL_PAGES["/cookies"]);
    for (const provider of ["Netlify", "Neon", "Resend", "Riot Games", "OpenAI"]) expect(privacy).toContain(provider);
    expect(cookies).toContain("12 heures");
    expect(cookies).toContain("30 jours");
  });
});
