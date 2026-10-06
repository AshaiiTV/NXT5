import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicGuidePage } from "../pages/public/PublicGuides.jsx";
import { LEGAL_PAGES, LegalLinks, LegalPage } from "../pages/public/PublicPages.jsx";
import SocialPage from "../pages/public/SocialPage.jsx";
import { DEMO_MATCHES } from "../pages/public/demo-data.js";

describe("public guidance and discovery links", () => {
  it.each([
    ["/guides/importer-premier-scrim", "/guides/preparer-debrief"],
    ["/guides/preparer-debrief", "/guides/importer-premier-scrim"],
  ])("renders %s with readable steps and links before JavaScript", (path, nextPath) => {
    const html = renderToStaticMarkup(<PublicGuidePage path={path} />);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('<ol class="public-guide-steps">');
    expect(html).toContain('<time dateTime="2026-10-06">');
    for (const href of ["/fonctionnalites", "/demo", nextPath]) {
      expect(html).toContain(`href="${href}"`);
    }
    if (path.includes("importer")) {
      expect(html).toContain("<details>");
      expect(html).toContain('href="/contact"');
    }
  });

  it("grounds the review example in the same fictitious match shown beside it", () => {
    const html = renderToStaticMarkup(<PublicGuidePage path="/guides/preparer-debrief" />);
    expect(html).toContain(DEMO_MATCHES[2].demoReview.observation);
    expect(html).toContain(DEMO_MATCHES[2].demoReview.question);
    expect(html).toContain("Aucun résultat d’équipe réel");
    expect(html).toContain("<dt>La vérification</dt>");
  });

  it("keeps discovery and information reachable from the shared footer", () => {
    const html = renderToStaticMarkup(<LegalLinks />);
    for (const href of ["/fonctionnalites", "/demo", "/guides/importer-premier-scrim", "/guides/preparer-debrief", "/mentions-legales", "/confidentialite", "/reseaux"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('aria-label="Découvrir NXT5"');
    expect(html).toContain('aria-label="Informations et contact"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("links community readers to the full contact instructions without repeating them", () => {
    const socialHtml = renderToStaticMarkup(<SocialPage />);
    const contactHtml = renderToStaticMarkup(<LegalPage route={{ path: "/contact" }} />);
    const supportInstructions = LEGAL_PAGES["/contact"].sections.find(([title]) => title === "Support produit")[1];
    expect(socialHtml).toContain('href="/contact"');
    expect(socialHtml).toContain('href="mailto:');
    expect(socialHtml).not.toContain(supportInstructions);
    expect(contactHtml).toContain(supportInstructions);
  });
});
