import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import "./helpers/i18n.js";
import { renderToStaticMarkup } from "react-dom/server";
import { getLanguage, getLocale, setLanguage } from "../i18n/locale.js";
import { audienceDate, audienceDecimal, audienceNumber, countryLabel } from "../pages/admin/audience-metrics.js";
import { subscriptionPeriodLabel } from "../app/subscriptions.js";
import { pngDateRange, pngFitText, pngNumber, pngWrapText } from "../utils/png-report.js";
import { applyDocumentMetadata, getMetadata, metadataTags, PUBLIC_METADATA, SITE_ORIGIN } from "../seo/metadata.js";
import { createSeoDocument } from "./helpers/seo-document.js";
import { BlockComparisonPanel } from "../NextPhase.jsx";
import { MetricCard } from "../pages/workspace/GameWorkspace.jsx";
import { t } from "../i18n/translate.js";

afterEach(() => { setLanguage("fr"); vi.unstubAllGlobals(); });

describe("locale-dependent presentation", () => {
  it("reformats numbers and countries after changing language without reloading modules", () => {
    for (const language of ["fr", "en", "es", "fr"]) {
      setLanguage(language);
      const locale = getLocale();
      expect(pngNumber(12345.6, 1)).toBe(new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(12345.6));
      expect(audienceNumber(12345.6)).toBe(new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(12345.6));
      expect(audienceDecimal(12345.6)).toBe(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(12345.6));
      expect(countryLabel("DE")).toBe(new Intl.DisplayNames([locale], { type: "region" }).of("DE"));
    }
  });

  it("updates displayed dates while retaining their original time zone and source timestamps", () => {
    const timestamp = "2026-09-12T12:00:00Z";
    const source = { game_date: timestamp };
    for (const language of ["fr", "en", "es"]) {
      setLanguage(language);
      const locale = getLocale();
      expect(audienceDate(timestamp)).toBe(new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(timestamp)));
      expect(pngDateRange([source])).toBe(new Date(timestamp).toLocaleDateString(locale));
      expect(subscriptionPeriodLabel({ planCode: "team", startsAt: timestamp })).toContain(new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp)));
    }
    expect(source).toEqual({ game_date: timestamp });
  });
});

describe("localized browser metadata", () => {
  it("keeps build metadata in French regardless of the current client preference", () => {
    setLanguage("es");
    const built = getMetadata("/");
    expect(built.language).toBe("fr");
    expect(built.title).toBe(PUBLIC_METADATA["/"].title);
    expect(built.description).toBe(PUBLIC_METADATA["/"].description);
    expect(built.canonical).toBe(`${SITE_ORIGIN}/`);
    expect(metadataTags(built)).toContainEqual(["property", "og:locale", "fr_FR"]);
  });

  it.each(["fr", "en", "es"])("updates language metadata without translating canonical URLs for %s", language => {
    const document = createSeoDocument({ documentElement: { lang: "fr" } });
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { location: new URL(SITE_ORIGIN) });
    setLanguage(language);
    applyDocumentMetadata("/fonctionnalites?private=token");
    expect(document.documentElement.lang).toBe(language);
    const expected = getMetadata("/fonctionnalites", { language });
    expect(document.title).toBe(expected.title);
    expect(expected.canonical).toBe(`${SITE_ORIGIN}/fonctionnalites`);
    expect(expected.structuredData["@graph"].filter(item => item.inLanguage).every(item => item.inLanguage === getLocale(language))).toBe(true);
    expect(metadataTags(expected)).toContainEqual(["property", "og:locale", getLocale(language).replace("-", "_")]);
  });
});

describe("canvas content boundaries", () => {
  it("preserves names and notes matching French interface labels unless localization is explicit", () => {
    const context = { save() {}, restore() {}, measureText: value => ({ width: value.length * 5 }), fillText: vi.fn() };
    for (const language of ["en", "es"]) {
      setLanguage(language);
      expect(getLanguage()).toBe(language);
      expect(pngFitText(context, "Victoire", 0, 0, 400)).toBe("Victoire");
      expect(pngWrapText(context, "Victoire\nPréparer un débrief", 400)).toEqual(["Victoire", "Préparer un débrief"]);
    }
  });
});

describe("interface content boundaries", () => {
  it("keeps custom category names while translating comparison controls", () => {
    setLanguage("en");
    const html = renderToStaticMarkup(React.createElement(BlockComparisonPanel, { categories: [{ id: "custom", name: "Accueil" }] }));
    expect(t("Accueil")).not.toBe("Accueil");
    expect(html).toContain('value="category:custom">Accueil</option>');
    expect(html).toContain(t("Bloc de référence"));
  });

  it("translates metric labels while retaining the value and semantic color", () => {
    setLanguage("es");
    const html = renderToStaticMarkup(React.createElement(MetricCard, { icon: () => null, label: "Victoire", value: "Accueil", hint: "Défaite", tone: "purple" }));
    expect(html).toContain(t("Victoire"));
    expect(html).toContain(t("Défaite"));
    expect(html).toContain("Accueil");
    expect(html).toContain("border-violet-200/40");
  });
});
