import React from "react";
import "./helpers/i18n.js";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HomeScreen } from "../pages/public/PublicPages.jsx";
import { FeaturesPage } from "../pages/public/FeaturesPage.jsx";
import { PUBLIC_GUIDES, PublicGuidePage } from "../pages/public/PublicGuides.jsx";
import { setLanguage } from "../i18n/locale.js";
import { DemoMatchSummary } from "../pages/public/DemoMatchSummary.jsx";

afterEach(() => setLanguage("fr"));

describe("translated public copy", () => {
  it.each([
    ["en", "Understand your matches.", "Organise your team", "Prepare your next session"],
    ["es", "Entiende tus partidas.", "Organiza tu equipo", "Prepara la próxima sesión"],
  ])("translates both homepage markup and feature arrays in %s", (language, heading, feature, nextSession) => {
    setLanguage(language);
    const html = renderToStaticMarkup(<HomeScreen />);
    expect(html).toContain(heading);
    expect(html).toContain(feature);
    expect(html).toContain(nextSession);
    expect(html).not.toContain("Comprends tes parties");
    expect(html).not.toContain("Organise l’équipe");
  });

  it.each([
    ["en", "Prepare all five picks together.", "Reviews linked to matches", "Who is NXT5 for?"],
    ["es", "Preparad juntos las cinco selecciones.", "Análisis vinculados a las partidas", "¿A quién va dirigido NXT5?"],
  ])("translates feature descriptions, nested items and FAQ headings in %s", (language, title, item, question) => {
    setLanguage(language);
    const html = renderToStaticMarkup(<FeaturesPage />);
    expect(html).toContain(title);
    expect(html).toContain(item);
    expect(html).toContain(question);
    expect(html).not.toContain("Préparer les cinq choix ensemble.");
  });

  it("translates guide data at display time without changing the French source data", () => {
    setLanguage("es");
    const html = renderToStaticMarkup(<PublicGuidePage path="/guides/importer-premier-scrim" />);
    expect(html).toContain("Importa tu primer scrim de League of Legends");
    expect(html).toContain("Comprueba el lado, los roles y los cinco jugadores");
    expect(html).not.toContain("Vérifier le côté, les postes et les cinq joueurs");
    expect(PUBLIC_GUIDES["/guides/importer-premier-scrim"].title).toBe("Importer ton premier scrim League of Legends");
  });

  it.each([
    ["en", "Horizon · fictional team", "Sample data · Read only", "Review question", "Did vision help us make decisions, or does it mainly reflect our lead?"],
    ["es", "Horizon · equipo ficticio", "Datos de ejemplo · Solo lectura", "Pregunta para el análisis", "¿La visión nos ayudó a tomar decisiones o refleja sobre todo nuestra ventaja?"],
  ])("translates demo fixtures in %s while keeping player and champion names intact", (language, team, status, label, question) => {
    setLanguage(language);
    const html = renderToStaticMarkup(<DemoMatchSummary />);
    for (const text of [team, status, label, question, "Horizon TOP", "Gnar"]) expect(html).toContain(text);
    expect(html).not.toContain("Équipe Horizon · fictive");
  });
});
