import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentMetadata, getMetadata, PUBLIC_METADATA, renderMetadata, serializeStructuredData, SITE_ORIGIN } from "../seo/metadata.js";
import { createSeoDocument } from "./helpers/seo-document.js";
import { dynamicPaths, privatePaths, publicPaths, render } from "../seo/render.jsx";
import { HomeScreen } from "../pages/public/PublicPages.jsx";
import { FeaturesPage } from "../pages/public/FeaturesPage.jsx";
import { isAppPath, isKnownPath } from "../app/routing.js";
import { redirectRules, resolveSeoConfig, robotsHeaders, robotsTxt, sitemapXml, withMetadata } from "../../tools/seo-build.mjs";

afterEach(() => vi.unstubAllGlobals());

describe("public SEO and real component rendering", () => {
  it("renders the same homepage and features as the browser, with crawlable links", () => {
    expect(render("/")).toBe(renderToStaticMarkup(<HomeScreen />));
    expect(render("/fonctionnalites")).toBe(renderToStaticMarkup(<FeaturesPage />));
    expect(render("/")).toContain('href="/fonctionnalites"');
    expect(render("/fonctionnalites")).toContain('href="/creer-un-compte"');
    expect(isKnownPath("/fonctionnalites")).toBe(true);
    expect(isAppPath("/fonctionnalites")).toBe(false);
  });

  it.each(publicPaths)("provides a distinct, populated public page at %s", path => {
    const markup = render(path);
    expect(markup.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    const metadata = getMetadata(path);
    expect(metadata.canonical).toBe(`${SITE_ORIGIN}${path}`);
    expect(metadata.robots).toContain("index, follow");
    expect(metadata.description.length).toBeGreaterThan(80);
    expect(metadata.structuredData["@graph"].some(item => ["WebPage", "ContactPage"].includes(item["@type"]) && item.url === metadata.canonical)).toBe(true);
  });

  it("strips query, fragment and trailing slash from canonical URLs", () => {
    expect(getMetadata("/fonctionnalites/?utm_source=discord#draft").canonical).toBe(`${SITE_ORIGIN}/fonctionnalites`);
    expect(getMetadata("/?invite=private-token").canonical).toBe(`${SITE_ORIGIN}/`);
  });

  it("replaces metadata on public, private and public navigation without leaking or duplicating it", () => {
    const document = createSeoDocument();
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { location: new URL(SITE_ORIGIN) });
    const unrelatedMeta = document.createElement("meta");
    unrelatedMeta.setAttribute("name", "theme-color");
    document.head.append(unrelatedMeta);

    const managed = () => document.head.querySelectorAll("[data-nxt5-seo]");
    const canonical = () => managed().filter(element => element.rel === "canonical");
    const structuredData = () => managed().filter(element => element.type === "application/ld+json");
    const meta = name => managed().filter(element => element.getAttribute("name") === name || element.getAttribute("property") === name);

    applyDocumentMetadata("/");
    expect(canonical()).toHaveLength(1);
    expect(canonical()[0].href).toBe(`${SITE_ORIGIN}/`);
    expect(structuredData()).toHaveLength(1);

    applyDocumentMetadata("/profil/champions?invite=private-token");
    expect(document.title).toBe("Espace équipe — NXT5");
    expect(meta("robots")[0].getAttribute("content")).toBe("noindex, follow");
    expect(canonical()).toHaveLength(0);
    expect(structuredData()).toHaveLength(0);
    expect(meta("og:url")).toHaveLength(0);

    applyDocumentMetadata("/fonctionnalites/?utm_source=discord#draft");
    applyDocumentMetadata("/fonctionnalites");
    const expected = getMetadata("/fonctionnalites", { noindex: Boolean(import.meta.env.NXT5_NOINDEX) });
    expect(document.title).toBe(expected.title);
    expect(meta("description")).toHaveLength(1);
    expect(meta("description")[0].getAttribute("content")).toBe(expected.description);
    expect(meta("robots")[0].getAttribute("content")).toBe(expected.robots);
    expect(meta("og:url")).toHaveLength(1);
    expect(meta("og:url")[0].getAttribute("content")).toBe(expected.canonical);
    expect(canonical()).toHaveLength(1);
    expect(canonical()[0].href).toBe(expected.canonical);
    expect(structuredData()).toHaveLength(1);
    expect(JSON.parse(structuredData()[0].textContent)).toEqual(expected.structuredData);
    const keys = managed().map(element => `${element.tagName}:${element.getAttribute("name") || element.getAttribute("property") || element.rel || element.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(document.head.children).toContain(unrelatedMeta);
  });

  it.each([...privatePaths, "/profil/champions", "/does-not-exist", "/404"])("keeps private and unknown URLs out of indexing: %s", path => {
    const metadata = getMetadata(path);
    expect(metadata.robots).toBe("noindex, follow");
    expect(metadata.canonical).toBeNull();
    expect(metadata.structuredData).toBeNull();
    expect(renderMetadata(metadata)).not.toContain('property="og:url"');
    expect(sitemapXml({ noindex: false })).not.toContain(`<loc>${SITE_ORIGIN}${path}</loc>`);
  });

  it("keeps previews noindex without changing canonical production URLs", () => {
    for (const CONTEXT of ["deploy-preview", "branch-deploy", "dev"]) {
      const config = resolveSeoConfig({ CONTEXT, URL: "https://preview.netlify.app", DEPLOY_PRIME_URL: "https://preview.netlify.app" });
      const metadata = getMetadata("/fonctionnalites", config);
      expect(metadata.robots).toBe("noindex, follow");
      expect(metadata.canonical).toBe(`${SITE_ORIGIN}/fonctionnalites`);
      expect(sitemapXml(config)).not.toContain("<loc>");
      expect(robotsTxt(config)).not.toContain("Sitemap:");
      expect(robotsHeaders(config, privatePaths, dynamicPaths)).toBe("/*\n  X-Robots-Tag: noindex, follow\n");
    }
    expect(resolveSeoConfig({ CONTEXT: "production" }).noindex).toBe(false);
    expect(() => resolveSeoConfig({ PUBLIC_SITE_URL: "https://preview.netlify.app" })).toThrow("canonical production origin");
  });

  it("has a sitemap consistent with real pages and safe private deep links", () => {
    expect(publicPaths).toEqual(Object.keys(PUBLIC_METADATA));
    const rules = redirectRules(privatePaths, dynamicPaths);
    expect(rules).toContain("/integration /app-shell.html 200");
    expect(rules).toContain("/tendances/draft/compositions /app-shell.html 200");
    expect(rules).toContain("/admin/tarifs /app-shell.html 200");
    expect(rules).toContain("/profil/* /app-shell.html 200");
    expect(rules).toContain("/* /404.html 404\n");
    expect(rules).not.toContain("/* /index.html 200");
    expect(rules).not.toContain("/.netlify/functions/");
    expect(robotsTxt({ noindex: false })).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it("escapes metadata and inert structured data without weakening CSP", () => {
    const metadata = getMetadata("/fonctionnalites");
    const html = renderMetadata({ ...metadata, title: 'Title <&"' });
    expect(html).toContain("Title &lt;&amp;&quot;");
    expect(serializeStructuredData({ text: "</script><script>bad()</script>" })).not.toContain("<");
    expect(() => withMetadata("no marker", "/", {})).toThrow("Missing SEO metadata marker");
    expect(withMetadata("<!--seo:start-->old<!--seo:end-->", "/fonctionnalites", {})).toContain(metadata.description);
  });
});
