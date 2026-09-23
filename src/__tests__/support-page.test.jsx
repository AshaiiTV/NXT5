import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeSupportUrl } from "../app/support.js";
import { SupportPage } from "../pages/public/SupportPage.jsx";

describe("support destination", () => {
  it("requires a public HTTPS destination without embedded credentials", () => {
    expect(normalizeSupportUrl(" https://ko-fi.com/nxt5-test ")).toBe("https://ko-fi.com/nxt5-test");
    for (const value of [undefined, null, 5, "", "not a URL", "/soutenir", "//ko-fi.com/test", "http://ko-fi.com/test", "javascript:alert(1)", "https://user:secret@ko-fi.com/test"]) {
      expect(normalizeSupportUrl(value)).toBe("");
    }
  });
});

describe("support page", () => {
  it.each(["", "javascript:alert(1)"])("shows an honest closed state for an unavailable destination (%s)", (supportUrl) => {
    const html = renderToStaticMarkup(<SupportPage supportUrl={supportUrl} />);
    expect(html).toContain("Les contributions ne sont pas encore ouvertes.");
    expect(html).toContain('href="/reseaux"');
    expect(html).not.toContain("nxt5-support-cta");
    expect(html).not.toContain("javascript:");
  });

  it("opens the configured destination without inventing payment status or collecting payment details", () => {
    const html = renderToStaticMarkup(<SupportPage supportUrl="https://ko-fi.com/nxt5-test" />);
    expect(html).toContain('href="https://ko-fi.com/nxt5-test"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("nouvel onglet");
    expect(html).toContain("ponctuelle ou mensuelle");
    expect(html).toContain("Le soutien est entièrement facultatif.");
    expect(html).not.toContain("ne sont pas encore ouvertes");
    expect(html).not.toMatch(/<(form|iframe|input)\b/);
  });

  it("returns signed-in members to their workspace", () => {
    const html = renderToStaticMarkup(<SupportPage user={{ id: "member" }} supportUrl="" />);
    expect(html).toContain('href="/equipes"');
    expect(html).toContain("Mon espace");
    expect(html).not.toContain('href="/connexion"');
  });
});
